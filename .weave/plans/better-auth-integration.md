# Better Auth Integration

## TL;DR
> **Summary**: Replace the scaffold JWT/bearer/OAuth plugins with Better Auth mounted in Elysia, backed by the existing Drizzle/libSQL database, with explicit credentialed CORS and a reusable protected-route session pattern.
> **Estimated Effort**: Medium

## Context
### Original Request
Create an implementation plan for integrating Better Auth into this Bun/Elysia/Drizzle/libSQL repo. Include dependency changes, env vars, migration/generation commands, verification commands, and security requirements. Do not modify source code except writing this plan.

### Key Findings
- `src/index.ts` only imports `app` from `src/server.ts`, registers shutdown/error handlers, and calls `app.listen(config.PORT)`.
- `src/server.ts` currently chains `swagger()`, `oauth2({})`, `bearer()`, unrestricted `cors()`, `html()`, `jwt({ secret: config.JWT_SECRET })`, `serverTiming()`, `staticPlugin()`, `autoload()`, and `get("/")`.
- Existing auth dependencies are scaffold-only: `@elysiajs/jwt`, `@elysiajs/bearer`, `elysia-oauth2`, and `arctic` are only referenced in `src/server.ts` or not referenced at all.
- `src/config.ts` uses `env-var` and currently requires `JWT_SECRET`; Better Auth should replace that with `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and an explicit CORS origin allowlist.
- `src/db/index.ts` already exports a Drizzle/libSQL instance with `casing: "snake_case"`; `src/db/schema.ts` is effectively empty, so Better Auth tables can be generated there without merging app tables.
- `drizzle.config.ts` uses `dialect: "turso"`, schema path `./src/db/schema.ts`, and output `./drizzle`; there is currently no `drizzle/` migration directory.
- Better Auth docs confirm: create `auth = betterAuth({ database: drizzleAdapter(db, { provider: "sqlite" }), ... })`, mount `auth.handler` in Elysia, configure CORS with explicit origin + `credentials: true`, and expose sessions with `auth.api.getSession({ headers })`.
- Chosen default: integrate Better Auth session/cookie infrastructure now, leave social/provider credentials unconfigured, and do not enable public self-signup unless product requirements explicitly add it later.

## Objectives
### Core Objective
Integrate Better Auth as the app-owned authentication/session layer for Bun/Elysia using Drizzle/libSQL, with secure cookie/session defaults and a clear path for adding provider credentials later.

### Deliverables
- [x] Add Better Auth dependencies and remove unused scaffold auth packages.
- [x] Add Better Auth runtime configuration and production-safe env validation.
- [x] Create a Better Auth server instance backed by the existing Drizzle/libSQL database.
- [x] Generate Better Auth Drizzle schema and create/apply Drizzle migrations.
- [x] Mount Better Auth in Elysia and replace unrestricted CORS with an allowlisted credentialed configuration.
- [x] Add a reusable protected-route pattern based on `auth.api.getSession({ headers })`.
- [x] Document local/prod env vars and auth setup commands.

### Definition of Done
- [x] `bun install --frozen-lockfile` succeeds after dependency updates.
- [x] `bunx tsc --noEmit` succeeds.
- [x] `bun run lint` succeeds.
- [x] `bun run generate` produces no unexpected schema drift after the committed migration exists.
- [x] `bun run migrate` applies the Better Auth tables to a local libSQL database.
- [x] `bun run dev` starts, `GET /` still returns `Hello World`, and unauthenticated protected routes return `401`.
- [x] CORS responses include credentials only for configured origins and never for `*`.

### Guardrails (Must NOT)
- Do not keep `JWT_SECRET`, `@elysiajs/jwt`, `@elysiajs/bearer`, `elysia-oauth2`, or `arctic` unless a real current usage is added before implementation.
- Do not use wildcard CORS with credentials.
- Do not hard-code auth secrets, provider client IDs, provider client secrets, or production URLs.
- Do not expose Better Auth session tokens to browser JavaScript; rely on Better Auth-managed HttpOnly cookies.
- Do not bypass Drizzle migrations by applying Better Auth schema directly to production outside the repo migration flow.

## TODOs

- [x] 1. Update package dependencies
  **What**: Add Better Auth and the Drizzle adapter, update `drizzle-orm` to satisfy Better Auth's current peer range, and remove scaffold auth packages that are unused.
  **Files**: `package.json`, `bun.lock`
  **Commands**:
  ```sh
  bun remove @elysiajs/jwt @elysiajs/bearer elysia-oauth2 arctic
  bun add better-auth@^1.6.11 @better-auth/drizzle-adapter@^1.6.11 drizzle-orm@^0.45.2
  ```
  **Acceptance**: `package.json` contains `better-auth`, `@better-auth/drizzle-adapter`, and `drizzle-orm@^0.45.2`; removed packages no longer appear in dependencies or source imports.

- [x] 2. Add Better Auth configuration to env handling
  **What**: Replace `JWT_SECRET` config with Better Auth config. Add `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `CORS_ALLOWED_ORIGINS`; parse comma-separated origins into a trimmed/deduped array; require non-local production values.
  **Files**: `src/config.ts`
  **Security requirements**: `BETTER_AUTH_SECRET` must be required and generated with at least 32 bytes of entropy; `BETTER_AUTH_URL` must be the externally reachable API origin in production; production `CORS_ALLOWED_ORIGINS` must be explicit and must not contain localhost or `*`.
  **Example env**:
  ```sh
  BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
  BETTER_AUTH_URL="http://localhost:3000"
  CORS_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001,http://localhost:5173"
  ```
  **Acceptance**: `config` exports `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `CORS_ALLOWED_ORIGINS`; `JWT_SECRET` is no longer required; startup fails fast in production if secret, URL, or allowlist are unsafe/missing.

- [x] 3. Create the Better Auth instance
  **What**: Add a dedicated auth module that imports `betterAuth`, `drizzleAdapter`, `db`, and `config`; configure Drizzle provider as `sqlite` for libSQL/Turso; explicitly set `basePath: "/api/auth"`, `baseURL: config.BETTER_AUTH_URL`, `secret: config.BETTER_AUTH_SECRET`, and `trustedOrigins: config.CORS_ALLOWED_ORIGINS`.
  **Files**: `src/auth.ts`
  **Security requirements**: Do not configure social providers yet; add provider credentials later through env-only `socialProviders` config. Keep Better Auth's session cookies as the source of truth and assume HttpOnly cookie management is owned by Better Auth.
  **Acceptance**: `src/auth.ts` exports `auth`; no provider secrets are hard-coded; `auth` can be imported by the Better Auth CLI and Elysia server.

- [x] 4. Generate Better Auth Drizzle schema
  **What**: Use the Better Auth CLI to generate Drizzle schema into the existing empty schema file, then review the generated SQLite tables for expected Better Auth entities (`user`, `session`, `account`, `verification`).
  **Files**: `src/db/schema.ts`
  **Commands**:
  ```sh
  BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  BETTER_AUTH_URL="http://localhost:3000" \
  CORS_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001,http://localhost:5173" \
  bunx @better-auth/cli@latest generate --config src/auth.ts --output src/db/schema.ts --yes
  ```
  **Acceptance**: `src/db/schema.ts` contains Drizzle `sqliteTable` exports for Better Auth; column/table names remain compatible with the repo's snake_case Drizzle setup; no app tables are lost.

- [x] 5. Create and apply Drizzle migrations
  **What**: Generate the SQL migration from the updated schema and apply it to local libSQL using the existing Drizzle workflow.
  **Files**: `drizzle/`
  **Commands**:
  ```sh
  bun run dev:db
  bun run generate
  bun run migrate
  ```
  **Acceptance**: A new `drizzle/` directory contains the generated SQL migration and metadata; local libSQL has Better Auth tables after `bun run migrate`; the implementation does not use `better-auth migrate` as the production migration path.

- [x] 6. Mount Better Auth and lock down CORS in Elysia
  **What**: Remove `oauth2({})`, `bearer()`, and `jwt(...)` from the server chain. Configure `cors({ origin: config.CORS_ALLOWED_ORIGINS, credentials: true, methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization"] })`, mount `auth.handler`, and keep existing non-auth plugins/routes.
  **Files**: `src/server.ts`
  **Security requirements**: `credentials: true` is allowed only with an explicit origin allowlist; never use `origin: "*"` or unrestricted `cors()` for authenticated endpoints. Mount Better Auth before app routes that depend on session state.
  **Acceptance**: Better Auth endpoints are served under `/api/auth/*`; `GET /` still works; old JWT/bearer/OAuth imports are gone; CORS rejects/omits credential headers for unlisted origins.

- [x] 7. Add a protected-route/session pattern
  **What**: Add a reusable Elysia plugin or macro that calls `auth.api.getSession({ headers: request.headers })`, exposes `{ authSession, authUser }` to handlers, and provides a required-auth guard that returns `401` when no session exists. Add a minimal smoke route such as `GET /me` using that guard.
  **Files**: `src/plugins/auth-session.ts`, `src/server.ts`
  **Security requirements**: Protected routes must validate the server-side session on every request; do not trust client-provided user IDs, bearer tokens, or decoded cookies. Treat CSRF as origin/session-policy sensitive: keep mutating endpoints behind trusted origins and SameSite/HttpOnly cookies.
  **Acceptance**: Unauthenticated `GET /me` returns `401`; authenticated requests later receive the Better Auth user/session; new routes have a clear pattern for requiring auth without reintroducing JWT middleware.

- [x] 8. Document env vars and local workflow
  **What**: Add auth setup docs for local and production, including secret generation, URL/origin examples, migration commands, and provider-extension notes.
  **Files**: `.env.example`, `README.md`
  **Security requirements**: Document that production must use HTTPS `BETTER_AUTH_URL`, non-wildcard `CORS_ALLOWED_ORIGINS`, and secret management outside git. Note that cross-site frontends requiring `SameSite=None` must also use `Secure` cookies and should get an explicit CSRF review.
  **Acceptance**: A new developer can copy `.env.example`, run the DB/auth migration commands, start the app, and understand where future provider credentials belong.

- [x] 9. Verify integration and security behavior
  **What**: Run install, typecheck, lint, migration, and smoke checks against local libSQL and the running Elysia app.
  **Commands**:
  ```sh
  bun install --frozen-lockfile
  bunx tsc --noEmit
  bun run lint
  bun run dev:db
  bun run migrate
  bun run dev
  curl -i http://localhost:3000/
  curl -i http://localhost:3000/api/auth/get-session
  curl -i http://localhost:3000/me
  curl -i -H 'Origin: http://evil.example' http://localhost:3000/api/auth/get-session
  curl -i -H 'Origin: http://localhost:3001' http://localhost:3000/api/auth/get-session
  ```
  **Acceptance**: `/` returns `Hello World`; `/api/auth/get-session` is handled by Better Auth; `/me` returns `401` without cookies; the disallowed origin response does not include credentialed wildcard CORS headers; the allowed origin response includes the configured `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials: true`.

## Verification
- [x] All tests/checks pass: `bunx tsc --noEmit` and `bun run lint`.
- [x] Database migration applies cleanly: `bun run migrate` against local libSQL.
- [x] Dependency cleanup verified: `grep -R "@elysiajs/jwt\|@elysiajs/bearer\|elysia-oauth2\|arctic\|JWT_SECRET" src package.json` returns no active usage.
- [x] Auth smoke verified: Better Auth handles `/api/auth/get-session`, and the protected route returns `401` when unauthenticated.
- [x] CORS security verified: no wildcard credentialed CORS, no production localhost trusted origins, and only allowlisted origins receive credential headers.
- [x] Cookie/session assumptions documented: Better Auth owns HttpOnly session cookies; production uses HTTPS `BETTER_AUTH_URL`; any future cross-site `SameSite=None` change receives CSRF review.
