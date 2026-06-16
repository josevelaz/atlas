import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

process.env.NODE_ENV = "test";
process.env.HAY_ENV = "test";
process.env.BETTER_AUTH_SECRET = "test-secret";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.CORS_ALLOWED_ORIGINS = [
	"http://localhost:3001",
	"https://trusted.example.com",
].join(",");

mkdirSync(join(import.meta.dir, "routes"), { recursive: true });

const [{ CSRF_HEADER, csrfGuard }, { app: serverApp }, { config }] =
	await Promise.all([
		import("./csrf_guard.ts"),
		import("../server.ts"),
		import("../config.ts"),
	]);

const TRUSTED_ORIGIN = "https://trusted.example.com";
const UNTRUSTED_ORIGIN = "https://evil.example.com";
const TAURI_ORIGIN = "tauri://localhost";

const testApp = new Elysia()
	.use(csrfGuard)
	.get("/probe", () => ({ ok: true }))
	.options("/probe", () => new Response(null, { status: 204 }))
	.post("/probe", () => ({ ok: true }))
	.post("/api/auth/test", () => ({ ok: true, skipped: "auth" }))
	.post("/gmail/push", () => ({ ok: true, skipped: "push" }));

const request = (
	path: string,
	method: string,
	headers?: Record<string, string>,
) =>
	new Request(`http://localhost${path}`, {
		method,
		...(headers ? { headers } : {}),
	});

const expectOk = async (response: Response) => {
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({ ok: true });
};

const expectForbidden = async (response: Response) => {
	expect(response.status).toBe(403);
	expect(await response.json()).toEqual({ error: "CSRF check failed" });
};

describe("csrfGuard", () => {
	it("passes GET /probe for safe methods", async () => {
		await expectOk(await testApp.handle(request("/probe", "GET")));
	});

	it("passes OPTIONS /probe so preflights are not blocked", async () => {
		const response = await testApp.handle(request("/probe", "OPTIONS"));

		expect(response.status).toBe(204);
	});

	it("passes POST with trusted Origin and CSRF header", async () => {
		await expectOk(
			await testApp.handle(
				request("/probe", "POST", {
					Origin: TRUSTED_ORIGIN,
					[CSRF_HEADER]: "1",
				}),
			),
		);
	});

	it("rejects POST with trusted Origin but no CSRF header", async () => {
		await expectForbidden(
			await testApp.handle(
				request("/probe", "POST", { Origin: TRUSTED_ORIGIN }),
			),
		);
	});

	it("rejects POST with untrusted Origin even when the CSRF header is present", async () => {
		await expectForbidden(
			await testApp.handle(
				request("/probe", "POST", {
					Origin: UNTRUSTED_ORIGIN,
					[CSRF_HEADER]: "1",
				}),
			),
		);
	});

	it("passes POST with no Origin/Referer when the CSRF header is present", async () => {
		await expectOk(
			await testApp.handle(request("/probe", "POST", { [CSRF_HEADER]: "1" })),
		);
	});

	it("rejects POST with no Origin/Referer and no CSRF header", async () => {
		await expectForbidden(await testApp.handle(request("/probe", "POST")));
	});

	it("passes POST with a trusted Referer fallback and CSRF header", async () => {
		await expectOk(
			await testApp.handle(
				request("/probe", "POST", {
					Referer: `${TRUSTED_ORIGIN}/thread/123`,
					[CSRF_HEADER]: "1",
				}),
			),
		);
	});

	it("rejects POST with an untrusted Referer fallback even when the CSRF header is present", async () => {
		await expectForbidden(
			await testApp.handle(
				request("/probe", "POST", {
					Referer: `${UNTRUSTED_ORIGIN}/thread/123`,
					[CSRF_HEADER]: "1",
				}),
			),
		);
	});

	it("passes POST with the Tauri origin and CSRF header", async () => {
		await expectOk(
			await testApp.handle(
				request("/probe", "POST", {
					Origin: TAURI_ORIGIN,
					[CSRF_HEADER]: "1",
				}),
			),
		);
	});

	it("bypasses POST requests under /api/auth/", async () => {
		const response = await testApp.handle(request("/api/auth/test", "POST"));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true, skipped: "auth" });
	});

	it("bypasses POST requests to /gmail/push", async () => {
		const response = await testApp.handle(request("/gmail/push", "POST"));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true, skipped: "push" });
	});
});

describe("strict CORS preflight", () => {
	it("allows the CSRF header for OPTIONS from an allowed origin", async () => {
		expect(config.CORS_ALLOWED_ORIGINS).toContain("http://localhost:3001");
		expect(config.CORS_ALLOWED_ORIGINS).toContain(TAURI_ORIGIN);

		const response = await serverApp.handle(
			request("/health", "OPTIONS", {
				Origin: "http://localhost:3001",
				"Access-Control-Request-Method": "POST",
				"Access-Control-Request-Headers": CSRF_HEADER,
			}),
		);

		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
			"http://localhost:3001",
		);
		expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
			"true",
		);
		expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
			CSRF_HEADER,
		);
	});
});
