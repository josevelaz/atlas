import { Elysia } from "elysia";

import { config } from "../config.ts";

/**
 * Canonical CSRF rule for Atlas unsafe requests.
 *
 * This module is the single authoritative statement of the accept/reject
 * policy that the eventual guard implementation must enforce, copied verbatim
 * from the TL;DR "Canonical CSRF rule":
 *
 * For unsafe methods (`POST` / `PUT` / `PATCH` / `DELETE`):
 * 1. Safe methods and excluded paths (`/api/auth/*`, `/gmail/push`) bypass.
 * 2. The `x-atlas-csrf` header is always required — missing → 403.
 * 3. If an origin is resolvable (from `Origin`, else derived from `Referer`),
 *    it MUST be in the trusted set (`config.CORS_ALLOWED_ORIGINS`, which
 *    includes the Tauri desktop origins) — untrusted → 403.
 * 4. If NO origin is resolvable, the request is accepted (rule 2 already
 *    guarantees the header was present) — this is the explicit Tauri
 *    allowance. Missing origin + missing header → 403 (caught by rule 2).
 */

/** Shared custom header required on unsafe requests. */
export const CSRF_HEADER = "x-atlas-csrf" as const;

/**
 * Canonical source of trusted origins for the CSRF guard.
 *
 * `config.CORS_ALLOWED_ORIGINS` is built in `src/config.ts` and always merges
 * the Tauri desktop origins (`tauri://localhost`,
 * `https://tauri.localhost`).
 */
export const CSRF_TRUSTED_ORIGIN_SOURCE =
	"config.CORS_ALLOWED_ORIGINS" as const;

/** Paths that bypass the CSRF guard regardless of method. */
export const CSRF_BYPASS_PATHS = ["/gmail/push"] as const;

/** Path prefixes that bypass the CSRF guard regardless of method. */
export const CSRF_BYPASS_PATH_PREFIXES = ["/api/auth/"] as const;

/** Methods that are never subject to CSRF enforcement. */
export const CSRF_SAFE_METHODS = ["GET", "HEAD", "OPTIONS"] as const;

/** Methods that must follow the canonical CSRF rule. */
export const CSRF_UNSAFE_METHODS = ["POST", "PUT", "PATCH", "DELETE"] as const;

/**
 * Decision table for the canonical policy.
 *
 * `originStatus` semantics:
 * - `trusted`: resolvable origin exists and is in `config.CORS_ALLOWED_ORIGINS`
 * - `untrusted`: resolvable origin exists and is NOT in that trusted set
 * - `none`: no origin could be resolved from `Origin` or `Referer`
 */
export const CSRF_RULE_TABLE = [
	{
		case: "Safe method or excluded path",
		methodScope: "bypass",
		originStatus: "any",
		headerRequired: false,
		result: "pass",
		reason: "Safe methods and excluded paths bypass.",
	},
	{
		case: "Trusted origin + header",
		methodScope: "unsafe",
		originStatus: "trusted",
		headerRequired: true,
		result: "pass",
		reason: "Header present and resolvable origin is trusted.",
	},
	{
		case: "Trusted origin + no header",
		methodScope: "unsafe",
		originStatus: "trusted",
		headerRequired: true,
		result: "403",
		reason: `${CSRF_HEADER} is always required on unsafe requests.`,
	},
	{
		case: "Untrusted origin + header",
		methodScope: "unsafe",
		originStatus: "untrusted",
		headerRequired: true,
		result: "403",
		reason: "Resolvable origin is not in the trusted set.",
	},
	{
		case: "No origin + header",
		methodScope: "unsafe",
		originStatus: "none",
		headerRequired: true,
		result: "pass",
		reason: "Explicit Tauri allowance when no origin is resolvable.",
	},
	{
		case: "No origin + no header",
		methodScope: "unsafe",
		originStatus: "none",
		headerRequired: true,
		result: "403",
		reason: `${CSRF_HEADER} is always required on unsafe requests.`,
	},
] as const;

const allowedOriginsSet = new Set(config.CORS_ALLOWED_ORIGINS);

const CSRF_FAILURE_BODY = { error: "CSRF check failed" } as const;

const hasBypassPrefix = (path: string) =>
	CSRF_BYPASS_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));

const hasBypassPath = (path: string) =>
	CSRF_BYPASS_PATHS.some((bypassPath) => bypassPath === path);

const resolveOrigin = (request: Request): string | null => {
	const origin = request.headers.get("Origin");

	if (origin) {
		return origin;
	}

	const referer = request.headers.get("Referer");

	if (!referer) {
		return null;
	}

	try {
		return new URL(referer).origin;
	} catch {
		return null;
	}
};

export const csrfGuard = new Elysia({ name: "csrf-guard" }).onRequest(
	({ request, set }) => {
		if (
			CSRF_SAFE_METHODS.includes(
				request.method as (typeof CSRF_SAFE_METHODS)[number],
			)
		) {
			return;
		}

		const path = new URL(request.url).pathname;

		if (hasBypassPath(path) || hasBypassPrefix(path)) {
			return;
		}

		if (!request.headers.has(CSRF_HEADER)) {
			set.status = 403;
			return CSRF_FAILURE_BODY;
		}

		const origin = resolveOrigin(request);

		if (origin && !allowedOriginsSet.has(origin)) {
			set.status = 403;
			return CSRF_FAILURE_BODY;
		}
	},
);
