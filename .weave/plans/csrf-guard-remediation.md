# CSRF Guard Remediation for Cookie-Authenticated Unsafe Routes

## TL;DR
> **Summary**: Add a server-side CSRF guard plugin that rejects unsafe (non-GET/HEAD/OPTIONS) cookie-authenticated app requests unless they carry the non-simple `x-atlas-csrf` header AND — when an `Origin`/`Referer` is present — a trusted origin; requests with NO resolvable `Origin`/`Referer` are allowed only when the `x-atlas-csrf` header is present (the Tauri case), otherwise rejected. Mounted before all app route handlers but excluding Better Auth (`/api/auth/*`) and the OIDC-authenticated Gmail push webhook. The server CORS allow-headers list is extended to permit `x-atlas-csrf` so the browser preflight for it succeeds.
> **Canonical CSRF rule** (single source of truth, used everywhere below):
> 1. Safe methods (`GET`/`HEAD`/`OPTIONS`) and excluded paths (`/api/auth/*`, `/gmail/push`) bypass the guard.
> 2. The non-simple `x-atlas-csrf` header is **always required** on unsafe methods — missing header → **403**.
> 3. If an origin is resolvable (from `Origin`, else derived from `Referer`), it **must** be in the trusted set — untrusted origin → **403**.
> 4. If NO origin is resolvable (both `Origin` and `Referer` absent), the request is **allowed only because rule 2 already required the header** (supports Tauri custom-protocol requests that omit `Origin`). Missing origin + missing header → **403**.
> **Estimated Effort**: Short

## Context

### Original Request
Terminal reviews (Weft + Warp) REJECTED PR #31 (`real-user-profile-ui`) for missing CSRF protection on cookie-authenticated unsafe routes while production cookies use `SameSite=None; Secure`. Reviewers require a server-side CSRF guard for all non-auth unsafe methods: strict `Origin`/`Referer` validation against trusted origins and/or an anti-CSRF token / non-simple custom header, rejecting missing/untrusted origins before handlers run. Fix must be minimal, coherent, and cover ALL unsafe cookie-authenticated app routes — not just the cited examples.

### Key Findings
- **Cookie policy** (`apps/server/src/auth.ts:66-68`): production session cookies are `SameSite=None; Secure; HttpOnly`. This is intentional (Tauri custom-protocol cross-origin) and must NOT change — it is the reason CSRF protection is required at the application layer.
- **CORS is not CSRF protection** (`apps/server/src/server.ts:30-50`): `strictCors` only controls which cross-origin *responses* a browser will expose. A simple cross-site `POST` (e.g. form/`text/plain`) still *reaches the handler* with cookies attached, and the side effect occurs regardless of whether the attacker can read the response. CORS alone cannot block this.
- **CORS allow-headers currently exclude the CSRF header** (`apps/server/src/server.ts:20`): `CORS_HEADERS = "Content-Type, Authorization"`. A browser preflight (`OPTIONS`) for a request carrying `x-atlas-csrf` sends `Access-Control-Request-Headers: x-atlas-csrf`; because that header is not echoed in `Access-Control-Allow-Headers`, the browser will **block the actual request before it is sent**. The CORS allow-headers list MUST be extended to include `x-atlas-csrf`, otherwise legitimate web/Tauri clients break. This is a required, coupled change — the new header on the client (Task 5) is useless until the server advertises it (Task 1).
- **Session derivation** (`apps/server/src/plugins/auth_session.ts`): `authSessionPlugin.derive({ as: "global" })` validates the session cookie on every request; `requireAuth` is a separate `onBeforeHandle` guard. Neither performs an origin check.
- **Trusted origins** already exist: `config.CORS_ALLOWED_ORIGINS` (`apps/server/src/config.ts:124-136`) is the single source of truth, already merged with Tauri origins (`tauri://localhost`, `https://tauri.localhost`) and used both by `strictCors` and Better Auth `trustedOrigins`.
- **Better Auth has its own CSRF** (`auth.ts:37-45`): origin-check CSRF is enabled by default on `/api/auth/*` against `trustedOrigins`. The new guard MUST NOT wrap `/api/auth/*` (double-handling / breaking sign-in).
- **Mount order** (`server.ts:52-65`): plugins apply in order: `swagger → strictCors → html → serverTiming → static → /health → /api/auth/* → authSessionPlugin → autoload(routes) → requireAuth → /me…`. The Gmail push webhook (`routes/gmail/push.ts`) is autoloaded at `/gmail/push`, authenticated by an OIDC bearer token (NOT cookies), and must be excluded.
- **Tauri origin caveat**: Tauri webview requests may send `Origin: tauri://localhost` (macOS/Linux) but on some platforms/versions the custom-protocol `Origin` can be absent or non-standard. The guard's allowlist includes the Tauri origins (already in `CORS_ALLOWED_ORIGINS`). The **missing-origin behavior is now resolved** (see TL;DR Canonical CSRF rule, item 4): a request with no resolvable `Origin`/`Referer` is accepted **only** when the `x-atlas-csrf` header is present. This is what makes Tauri work without weakening protection against browser-originated forgery (a cross-site simple request cannot set `x-atlas-csrf` without a preflight, which the allow-headers list controls).
- **Inventory of unsafe cookie-authenticated app routes** (the full set to cover):
  - `server.ts`: `PUT /me/primary-connected-account`, `POST /me/connected-accounts/:id/disconnect`
  - `routes/screener.ts`: `POST /senders/:email/accept`, `POST /senders/:email/reject`, `POST /senders/:email/recover`
  - `routes/mail/threads.ts`: `POST /mail/threads/:id/category`
- **Test conventions**: tests use `bun:test` (`describe/it/expect`); all existing server tests are service-level against a temp libsql DB. **No app-level integration test exists** (`app.handle(new Request(...))` is used nowhere). The guard test should be a focused plugin-unit test against a minimal Elysia app to avoid the DB/Better-Auth dependency.

## Objectives

### Core Objective
Reject cross-site forged unsafe requests to cookie-authenticated app routes at the server, before any handler runs, without weakening the `SameSite=None; Secure` cookie policy or breaking Better Auth, the Gmail push webhook, same-origin web, or the Tauri desktop app.

### Deliverables
- [ ] Server CORS allow-headers extended to permit `x-atlas-csrf` so the browser preflight for the header succeeds.
- [ ] A reusable `csrfGuard` Elysia plugin enforcing the Canonical CSRF rule (always-required header + origin allowlist with the explicit missing-origin behavior) on unsafe methods.
- [ ] The guard mounted so it covers every unsafe cookie-authenticated app route and excludes `/api/auth/*` and `/gmail/push`.
- [ ] The web client sends the required `x-atlas-csrf` custom header on all unsafe requests.
- [ ] Unit tests for the guard's accept/reject matrix, including the explicit missing-origin cases.
- [ ] A preflight test asserting an allowed-origin `OPTIONS` with `Access-Control-Request-Headers: x-atlas-csrf` is permitted.
- [ ] Documented validation steps that do not depend on Google OAuth or protected-route browser automation.

### Definition of Done
- [ ] `cd apps/server && bun test` passes (including new guard tests).
- [ ] `cd apps/server && bun run typecheck` passes.
- [ ] `cd apps/server && bun run lint` passes.
- [ ] A forged cross-site `POST` (untrusted `Origin`, no `x-atlas-csrf` header) to each listed unsafe route returns **403** before the handler executes.
- [ ] A `POST` with NO `Origin`/`Referer` and NO `x-atlas-csrf` header returns **403**.
- [ ] A `POST` with NO `Origin`/`Referer` but WITH the `x-atlas-csrf` header passes the guard (Tauri case).
- [ ] A legitimate same-origin/Tauri unsafe request (trusted or absent `Origin` + `x-atlas-csrf` header) still succeeds (verified at the guard layer with a stub handler).
- [ ] An allowed-origin `OPTIONS` preflight with `Access-Control-Request-Headers: x-atlas-csrf` returns the header in `Access-Control-Allow-Headers`.

### Guardrails (Must NOT)
- Do NOT change the cookie policy in `auth.ts` (`SameSite=None; Secure` stays).
- Do NOT apply the guard to `/api/auth/*` (Better Auth owns its CSRF) or `/gmail/push` (OIDC bearer, no cookies).
- Do NOT block safe methods (`GET`, `HEAD`, `OPTIONS`) — CORS preflight and reads must continue to work.
- Do NOT loosen `strictCors` origin handling or add `Access-Control-Allow-Origin: *`. (Adding `x-atlas-csrf` to `Access-Control-Allow-Headers` is REQUIRED and is not a loosening of the origin allowlist.)
- Do NOT introduce React; web client changes are SolidJS (`apps/web`).
- Out of scope: redesigning auth, rotating tokens, rate limiting, or any non-CSRF review item.

## TODOs

- [x] 1. Extend the server CORS allow-headers to permit `x-atlas-csrf`
  **What**: Update the effective CORS allow-headers list so browsers accept the new non-simple header on preflight. In `apps/server/src/server.ts:20`, change `const CORS_HEADERS = "Content-Type, Authorization";` to include the CSRF header, e.g. `"Content-Type, Authorization, x-atlas-csrf"`. Define the header name as a single shared constant (`CSRF_HEADER = "x-atlas-csrf"`, created in Task 2) and reference it when building `CORS_HEADERS` so the allow-list and the guard cannot drift. This is the value echoed into `Access-Control-Allow-Headers` by `strictCors` for both normal responses and the `OPTIONS` preflight branch (`server.ts:34-35,43-48`). Do NOT change origin handling.
  **Files**: `apps/server/src/server.ts`
  **Acceptance**: `Access-Control-Allow-Headers` contains `x-atlas-csrf`; an `OPTIONS` preflight from an allowed origin with `Access-Control-Request-Headers: x-atlas-csrf` returns 204 with the header advertised (asserted in Task 6 test). Origin allowlist behavior unchanged.

- [x] 2. Define the CSRF guard policy (Canonical CSRF rule)
  **What**: Document the exact accept/reject rules in the guard module, copied verbatim from the TL;DR **Canonical CSRF rule** so there is one authoritative statement. The rule for unsafe methods (`POST`/`PUT`/`PATCH`/`DELETE`):
  1. Safe methods and excluded paths (`/api/auth/*`, `/gmail/push`) bypass.
  2. The `x-atlas-csrf` header is **always required** — missing → **403**.
  3. If an origin is resolvable (from `Origin`, else derived from `Referer`), it MUST be in the trusted set (`config.CORS_ALLOWED_ORIGINS`, includes Tauri origins) — untrusted → **403**.
  4. If NO origin is resolvable, the request is accepted (rule 2 already guarantees the header was present) — this is the explicit Tauri allowance. Missing origin + missing header → **403** (caught by rule 2).
  Export `CSRF_HEADER = "x-atlas-csrf"` for reuse by Task 1 and the web client.
  **Files**: `apps/server/src/plugins/csrf_guard.ts` (new — doc comment + policy constants)
  **Acceptance**: File defines `CSRF_HEADER`, names the trusted-origin source, and contains a rule table covering: safe method; trusted origin + header (pass); trusted origin, no header (403); untrusted origin + header (403); **no origin + header (pass)**; **no origin + no header (403)**.

- [x] 3. Implement the `csrfGuard` plugin
  **What**: Create an `Elysia({ name: "csrf-guard" })` plugin with `.onBeforeHandle({ as: "global" }, …)` (runs before route handlers, after method/route resolution). Logic, implementing the Canonical CSRF rule exactly:
  - Return early for `GET`/`HEAD`/`OPTIONS`.
  - Skip excluded path prefixes: `/api/auth/`, `/gmail/push` (defense-in-depth even though it's mounted outside the guard — see Task 4).
  - If the `CSRF_HEADER` is absent → **403** JSON `{ error: "CSRF check failed" }` (rule 2, applies regardless of origin).
  - Resolve origin from `Origin`, else parse `Referer` → origin. If a resolved origin exists and is NOT in `allowedOriginsSet` → **403** (rule 3).
  - Otherwise (header present AND (origin trusted OR no resolvable origin)) → pass (rules 3–4).
  - Reuse the existing `allowedOriginsSet` pattern from `server.ts` (extract to a shared module OR rebuild from `config.CORS_ALLOWED_ORIGINS` inside the plugin — prefer a tiny shared helper to keep one allowlist).
  **Files**: `apps/server/src/plugins/csrf_guard.ts`
  **Acceptance**: Plugin exports `csrfGuard` and `CSRF_HEADER`; `bun run typecheck` clean; behavior matches the Canonical CSRF rule for every combination, including no-origin+header (pass) and no-origin+no-header (403).

- [x] 4. Mount the guard to cover all unsafe app routes
  **What**: In `apps/server/src/server.ts`, mount `csrfGuard` so it wraps every cookie-authenticated app route but NOT `/api/auth/*` or `/gmail/push`. Recommended: insert `.use(csrfGuard)` AFTER the `.all("/api/auth/*", …)` line and BEFORE `.use(autoload(...))` and the inline `/me…` routes. Because the autoloaded `/gmail/push` is a webhook, also confirm the guard skips it via the path exclusion in Task 3 (belt-and-suspenders). Verify the `/health` and `/` routes are unaffected (GET).
  **Files**: `apps/server/src/server.ts`
  **Acceptance**: Static reasoning + Task 6 tests confirm guard runs for `screener.ts`, `mail/threads.ts`, and inline `/me` unsafe routes; does NOT run for `/api/auth/*` or `/gmail/push`.

- [x] 5. Send the anti-CSRF header from the web client
  **What**: Ensure every unsafe (`POST`/`PUT`/`PATCH`/`DELETE`) request from `apps/web` to the API includes `x-atlas-csrf: 1`. Locate the shared fetch/HTTP wrapper used by the profile/screener/threads features and add the header there (single chokepoint, SolidJS — not React). If no shared wrapper exists, add one or update each call site touched by PR #31.
  **Files**: the web API client module under `apps/web/src/**` (identify via the fetch wrapper used for `/me`, `/screener`, `/mail/threads`; e.g. `apps/web/src/lib/api*.ts` — confirm exact path during execution)
  **Acceptance**: All unsafe API calls from the web app carry `x-atlas-csrf`; `cd apps/web && bun run build` succeeds; no React patterns introduced.

- [x] 6. Unit-test the CSRF guard (incl. missing-origin cases) and the CORS preflight
  **What**: Add `bun:test` tests that mount `csrfGuard` on a minimal `new Elysia().use(csrfGuard).post("/probe", () => ({ ok: true }))` and drive it with `app.handle(new Request("http://localhost/probe", { method, headers }))`. Cover the full matrix:
  - `GET /probe` → passes (safe method).
  - `OPTIONS /probe` → passes (preflight not blocked).
  - `POST` with trusted `Origin` + `x-atlas-csrf` → 200.
  - `POST` with trusted `Origin`, NO header → 403.
  - `POST` with untrusted `Origin` + header → 403.
  - **`POST` with NO `Origin`/`Referer` + `x-atlas-csrf` header → 200 (explicit Tauri allowance, rule 4).**
  - **`POST` with NO `Origin`/`Referer` + NO header → 403 (rule 2).**
  - `POST` with valid `Referer` (trusted origin) + header, no `Origin` → 200 (Referer fallback).
  - `POST` with untrusted `Referer` (no `Origin`) + header → 403 (Referer resolves to untrusted origin).
  - `POST` with Tauri origin (`tauri://localhost`) + header → 200.
  - Excluded path: a `POST` under `/api/auth/` and `/gmail/push` bypasses the guard (mount stubs at excluded prefixes to assert skip).
  Plus a **CORS preflight test** against the `strictCors`/server layer: an `OPTIONS` from an allowed origin (`http://localhost:3001`) with `Access-Control-Request-Headers: x-atlas-csrf` returns 204 and `Access-Control-Allow-Headers` includes `x-atlas-csrf`. (Mount `strictCors` on a minimal app, or import `app` from `server.ts` and `app.handle` the OPTIONS request.)
  Set `CORS_ALLOWED_ORIGINS` deterministically for the test (env or by asserting against `config.CORS_ALLOWED_ORIGINS` defaults which include `http://localhost:3001` and Tauri origins).
  **Files**: `apps/server/src/plugins/csrf_guard.test.ts` (new)
  **Acceptance**: `cd apps/server && bun test src/plugins/csrf_guard.test.ts` passes; every matrix row asserted, including both missing-origin cases and the preflight allow-header assertion.

- [x] 7. Manual / scripted validation without OAuth or protected-route browser automation
  **What**: Document and run a curl/script check against a locally running server (`bun run dev` in `apps/server`) hitting an unsafe route. Because the routes also require a session, assert the **CSRF 403 occurs before the auth/session result** by sending requests WITHOUT a session cookie and confirming a forged unsafe request returns 403 (CSRF) rather than 401 (auth) when the guard runs before `requireAuth`/handler. Checks:
  - Untrusted origin, no header → 403: `curl -i -X POST localhost:3000/mail/threads/x/category -H 'content-type: application/json' -H 'Origin: https://evil.example' -d '{}'`.
  - No origin, no header → 403: same command without `Origin` and without `x-atlas-csrf`.
  - No origin, WITH header → passes CSRF (then 401/validation, proving the guard passed): `curl -i -X POST localhost:3000/mail/threads/x/category -H 'content-type: application/json' -H 'x-atlas-csrf: 1' -d '{}'`.
  - Trusted origin + header → passes CSRF: add `-H 'Origin: http://localhost:3001' -H 'x-atlas-csrf: 1'`.
  - **CORS preflight**: `curl -i -X OPTIONS localhost:3000/mail/threads/x/category -H 'Origin: http://localhost:3001' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: x-atlas-csrf'` → 204 with `Access-Control-Allow-Headers` containing `x-atlas-csrf`.
  This avoids Google OAuth and protected-route browser automation entirely.
  **Acceptance**: A short runbook in the plan/PR description; commands produce the documented status codes and preflight header.

  **Runbook / results (2026-06-16)**
  1. Start a local libsql HTTP server because this repo's `apps/server/local.db` is a sqld data directory, not a plain SQLite file:
     - `cd apps/server && bunx sqld --http-listen-addr 127.0.0.1:8081 --db-path local.db`
  2. Start the API server in a separate shell against that local sqld instance:
     - `cd apps/server && BETTER_AUTH_SECRET=dev-secret-dev-secret-dev-secret-1234 TURSO_DATABASE_URL=http://127.0.0.1:8081 bun run dev`
  3. Run the curl matrix against `POST /mail/threads/x/category` with no session cookie:
     - Untrusted origin, no header → **403** `{"error":"CSRF check failed"}`
     - No origin, no header → **403** `{"error":"CSRF check failed"}`
     - No origin, with `x-atlas-csrf: 1` → **422** validation error for missing `category` (proves CSRF passed and request advanced past the guard)
     - Trusted origin + `x-atlas-csrf: 1` → **422** validation error for missing `category` (same proof)
     - Allowed-origin `OPTIONS` preflight with `Access-Control-Request-Headers: x-atlas-csrf` → **204** and `Access-Control-Allow-Headers: Content-Type, Authorization, x-atlas-csrf`
  4. Interpretation: the two forged unsafe requests fail at the CSRF layer before auth/session or route validation; the header-bearing variants pass the guard and continue to downstream validation.

- [x] 8. Full verification sweep
  **What**: Run the whole server test suite, typecheck, and lint; build the web app.
  **Acceptance**: `cd apps/server && bun test && bun run typecheck && bun run lint` all pass; `cd apps/web && bun run build` passes.

  **Results (2026-06-15)**
  - `cd apps/server && bun test` → **PASS** (`266 pass`, `0 fail`)
  - `cd apps/server && bun run typecheck` → **PASS** (`tsc --noEmit` clean)
  - `cd apps/server && bun run lint` → **PASS** (`biome lint ./src` clean)
  - `cd apps/web && bun run build` → **PASS** (client + SSR/prerender build completed successfully)

## Verification
- [x] `cd apps/server && bun test` (all suites green, incl. `csrf_guard.test.ts`)
- [x] `cd apps/server && bun run typecheck`
- [x] `cd apps/server && bun run lint`
- [x] `cd apps/web && bun run build`
- [x] Manual curl matrix from Task 7 returns expected codes, including: untrusted-origin+no-header → 403, no-origin+no-header → 403, no-origin+header → passes CSRF, trusted-origin+header → passes CSRF
- [x] Allowed-origin `OPTIONS` preflight with `Access-Control-Request-Headers: x-atlas-csrf` returns 204 and advertises `x-atlas-csrf` in `Access-Control-Allow-Headers` (Task 6 test + Task 7 curl)
- [x] `Access-Control-Allow-Headers` includes `x-atlas-csrf` (Task 1)
- [x] No change to `auth.ts` cookie attributes; no change to `strictCors` origin handling
- [x] Guard demonstrably skips `/api/auth/*` and `/gmail/push`
- [ ] No regressions to GET routes (`/health`, `/`, `/me`, list endpoints)

## Decisions & Tradeoffs (captured for reviewers)
- **Layered defense (origin check + non-simple header), not token-based**: Avoids stateful CSRF-token storage/rotation while satisfying the reviewers' accepted directions. The custom header forces a CORS preflight for any cross-site attempt (and the preflight only succeeds because Task 1 advertises the header for *allowed origins only*), and the origin allowlist rejects untrusted/forgeable origins.
- **Canonical missing-origin rule (per reviewer recommendation): allow missing `Origin`/`Referer` ONLY when the `x-atlas-csrf` header is present (Tauri), reject otherwise**: This is now the single, consistent rule across TL;DR, tasks, acceptance, verification, and tests. Rationale: the `x-atlas-csrf` header is always mandatory on unsafe methods, and a cross-site *simple* browser request cannot set it without a preflight — which `strictCors` grants only to allowed origins. So a header-bearing no-origin request can only come from a trusted client (Tauri), while a browser forgery attempt with no header is always rejected. The earlier contradiction (summary requiring origin AND header vs. implying no-origin could be allowed) is resolved in favor of this rule.
- **CORS allow-headers must advertise `x-atlas-csrf` (Task 1) — coupled with the client header (Task 5)**: Without it the browser blocks the request at preflight before it is ever sent, breaking legitimate web/Tauri clients. The header name lives in one shared `CSRF_HEADER` constant so the allow-list and guard never drift.
- **Reuse `config.CORS_ALLOWED_ORIGINS` as the single trusted-origin source**: One allowlist already shared by `strictCors` and Better Auth `trustedOrigins`; avoids drift. Consider extracting `allowedOriginsSet` into a shared helper to prevent duplication.
- **Guard mounted at app layer, excludes `/api/auth/*`**: Better Auth already enforces origin-CSRF on its endpoints; double-guarding risks breaking its flows. `/gmail/push` is excluded because it is bearer-authenticated, not cookie-authenticated.
- **Plugin-unit tests over full integration tests**: The repo has no app-level integration harness and route handlers depend on libsql + Better Auth. Testing the guard in isolation gives deterministic, fast, DB-free coverage of the security-relevant logic.
