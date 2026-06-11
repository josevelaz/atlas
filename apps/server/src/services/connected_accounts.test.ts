import { describe, expect, it } from "bun:test";

import { user } from "../db/schema.ts";
import {
	CREDENTIAL_PROVIDER_ID,
	type ConnectedAccountRow,
	ConnectedAccountForbiddenError,
	ConnectedAccountNotFoundError,
	decodeJwtPayload,
	listConnectedAccounts,
	pickEffectivePrimary,
	setPrimaryConnectedAccount,
	toConnectedAccountDto,
} from "./connected_accounts.ts";

type ListDb = Parameters<typeof listConnectedAccounts>[1];
type SetPrimaryDb = Parameters<typeof setPrimaryConnectedAccount>[2];

/** Build a structurally valid (unsigned) JWT with the given payload claims. */
const makeIdToken = (claims: Record<string, unknown>): string => {
	const header = Buffer.from(JSON.stringify({ alg: "none" })).toString(
		"base64url",
	);
	const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
	return `${header}.${payload}.signature`;
};

const makeRow = (
	overrides: Partial<ConnectedAccountRow> = {},
): ConnectedAccountRow => ({
	id: "acc-1",
	providerId: "google",
	idToken: null,
	isPrimary: false,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	...overrides,
});

describe("decodeJwtPayload", () => {
	it("decodes the email claim from a valid token", () => {
		const token = makeIdToken({ email: "alice@gmail.com", sub: "123" });

		expect(decodeJwtPayload(token)).toEqual({
			email: "alice@gmail.com",
			sub: "123",
		});
	});

	it("returns null for a token without a payload segment", () => {
		expect(decodeJwtPayload("not-a-jwt")).toBeNull();
	});

	it("returns null for a payload that is not valid JSON", () => {
		const garbage = Buffer.from("not json {{", "utf8").toString("base64url");

		expect(decodeJwtPayload(`header.${garbage}.sig`)).toBeNull();
	});

	it("returns null for a JSON payload that is not an object", () => {
		const scalar = Buffer.from(JSON.stringify("hello"), "utf8").toString(
			"base64url",
		);

		expect(decodeJwtPayload(`header.${scalar}.sig`)).toBeNull();
	});
});

describe("toConnectedAccountDto", () => {
	it("uses the id token email claim when present", () => {
		const row = makeRow({
			idToken: makeIdToken({ email: "provider@gmail.com" }),
		});

		const dto = toConnectedAccountDto(row, "owner@example.com");

		expect(dto).toEqual({
			id: "acc-1",
			providerId: "google",
			email: "provider@gmail.com",
			isPrimary: false,
			createdAt: "2026-01-01T00:00:00.000Z",
		});
	});

	it("falls back to the user email for a malformed token", () => {
		const row = makeRow({ idToken: "garbage-token" });

		const dto = toConnectedAccountDto(row, "owner@example.com");

		expect(dto.email).toBe("owner@example.com");
	});

	it("falls back to the user email when the email claim is missing", () => {
		const row = makeRow({ idToken: makeIdToken({ sub: "123" }) });

		const dto = toConnectedAccountDto(row, "owner@example.com");

		expect(dto.email).toBe("owner@example.com");
	});

	it("falls back to the user email when the email claim is empty", () => {
		const row = makeRow({ idToken: makeIdToken({ email: "" }) });

		const dto = toConnectedAccountDto(row, "owner@example.com");

		expect(dto.email).toBe("owner@example.com");
	});

	it("falls back to the user email when there is no id token", () => {
		const dto = toConnectedAccountDto(makeRow(), "owner@example.com");

		expect(dto.email).toBe("owner@example.com");
	});

	it("serialises createdAt as an ISO 8601 string", () => {
		const row = makeRow({ createdAt: new Date("2026-06-11T12:34:56.789Z") });

		expect(toConnectedAccountDto(row, "x@y.z").createdAt).toBe(
			"2026-06-11T12:34:56.789Z",
		);
	});
});

describe("pickEffectivePrimary", () => {
	it("returns null for an empty list", () => {
		expect(pickEffectivePrimary([])).toBeNull();
	});

	it("prefers the explicitly flagged row even when it is newer", () => {
		const oldest = makeRow({
			id: "acc-old",
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
		});
		const flagged = makeRow({
			id: "acc-new",
			isPrimary: true,
			createdAt: new Date("2026-03-01T00:00:00.000Z"),
		});

		expect(pickEffectivePrimary([oldest, flagged])).toBe(flagged);
	});

	it("falls back to the oldest createdAt when nothing is flagged", () => {
		const newer = makeRow({
			id: "acc-b",
			createdAt: new Date("2026-02-01T00:00:00.000Z"),
		});
		const oldest = makeRow({
			id: "acc-c",
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
		});

		expect(pickEffectivePrimary([newer, oldest])).toBe(oldest);
	});

	it("breaks createdAt ties deterministically by id", () => {
		const createdAt = new Date("2026-01-01T00:00:00.000Z");
		const b = makeRow({ id: "acc-b", createdAt });
		const a = makeRow({ id: "acc-a", createdAt });

		expect(pickEffectivePrimary([b, a])).toBe(a);
		expect(pickEffectivePrimary([a, b])).toBe(a);
	});
});

/**
 * Minimal chainable stub for the two drizzle selects in
 * `listConnectedAccounts`, routed by the table passed to `.from()`.
 */
const makeListDbStub = (
	userRows: Array<{ email: string }>,
	accountRows: ConnectedAccountRow[],
): ListDb => {
	const stub = {
		select: () => ({
			from: (table: unknown) => {
				const rows = table === user ? userRows : accountRows;
				return {
					where: () => ({
						limit: () => Promise.resolve(rows),
						orderBy: () => Promise.resolve(rows),
					}),
				};
			},
		}),
	};
	return stub as unknown as ListDb;
};

describe("listConnectedAccounts", () => {
	it("marks the effective primary even when no row is flagged", async () => {
		const oldest = makeRow({
			id: "acc-old",
			idToken: makeIdToken({ email: "old@gmail.com" }),
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
		});
		const newer = makeRow({
			id: "acc-new",
			createdAt: new Date("2026-02-01T00:00:00.000Z"),
		});
		const db = makeListDbStub(
			[{ email: "owner@example.com" }],
			[oldest, newer],
		);

		const dtos = await listConnectedAccounts("user-1", db);

		expect(dtos).toEqual([
			{
				id: "acc-old",
				providerId: "google",
				email: "old@gmail.com",
				isPrimary: true,
				createdAt: "2026-01-01T00:00:00.000Z",
			},
			{
				id: "acc-new",
				providerId: "google",
				email: "owner@example.com",
				isPrimary: false,
				createdAt: "2026-02-01T00:00:00.000Z",
			},
		]);
	});

	it("returns an empty list when the user has no connected accounts", async () => {
		const db = makeListDbStub([{ email: "owner@example.com" }], []);

		expect(await listConnectedAccounts("user-1", db)).toEqual([]);
	});
});

/**
 * Stub for `setPrimaryConnectedAccount`: a transaction whose lookup select
 * resolves to `target` and whose updates are recorded for assertions.
 */
const makeSetPrimaryDbStub = (
	target: { id: string; userId: string; providerId: string } | undefined,
) => {
	const updates: Array<Record<string, unknown>> = [];
	const tx = {
		select: () => ({
			from: () => ({
				where: () => ({
					limit: () => Promise.resolve(target ? [target] : []),
				}),
			}),
		}),
		update: () => ({
			set: (values: Record<string, unknown>) => ({
				where: () => {
					updates.push(values);
					return Promise.resolve();
				},
			}),
		}),
	};
	const db = {
		transaction: (fn: (txArg: typeof tx) => Promise<void>) => fn(tx),
	};
	return { db: db as unknown as SetPrimaryDb, updates };
};

describe("setPrimaryConnectedAccount", () => {
	it("rejects credential (email/password) rows", async () => {
		const { db, updates } = makeSetPrimaryDbStub({
			id: "acc-cred",
			userId: "user-1",
			providerId: CREDENTIAL_PROVIDER_ID,
		});

		await expect(
			setPrimaryConnectedAccount("user-1", "acc-cred", db),
		).rejects.toThrow(ConnectedAccountForbiddenError);
		expect(updates).toEqual([]);
	});

	it("treats another user's account as not found", async () => {
		const { db, updates } = makeSetPrimaryDbStub({
			id: "acc-1",
			userId: "user-2",
			providerId: "google",
		});

		await expect(
			setPrimaryConnectedAccount("user-1", "acc-1", db),
		).rejects.toThrow(ConnectedAccountNotFoundError);
		expect(updates).toEqual([]);
	});

	it("throws not-found for a missing account", async () => {
		const { db } = makeSetPrimaryDbStub(undefined);

		await expect(
			setPrimaryConnectedAccount("user-1", "acc-missing", db),
		).rejects.toThrow(ConnectedAccountNotFoundError);
	});

	it("clears the previous primary before flagging the target", async () => {
		const { db, updates } = makeSetPrimaryDbStub({
			id: "acc-1",
			userId: "user-1",
			providerId: "google",
		});

		await setPrimaryConnectedAccount("user-1", "acc-1", db);

		expect(updates).toEqual([{ isPrimary: false }, { isPrimary: true }]);
	});
});
