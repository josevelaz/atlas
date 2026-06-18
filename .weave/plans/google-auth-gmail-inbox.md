# Google Auth and Gmail Inbox Access

> **⚠️ Superseded — ingestion scope only.** The ingestion/sync scope of this plan (single-account M1, watch/push-gated connect success, a provider-token encryption key framed as separate from `BETTER_AUTH_SECRET`, and earlier auth assumptions) is superseded by `.weave/plans/gmail-ingestion-pipeline.md` and ADRs 0009–0013 (coupled Google identity + Gmail consent, provider-token encryption at rest, per-account checkpoint with forward-only sync, metadata-first ingestion with lazy bodies, initial-ingest-only provider state). Where this document conflicts with those, they win. The remainder is retained as historical context.

## TL;DR
> **Summary**: Add one Google OAuth button that signs the user into Atlas and atomically authorizes read-only Gmail inbox access, backed by a first-class Connected Account model, encrypted provider-token custody, Gmail watch/push ingestion, and fallback polling. M1 delivers a single connected Gmail/Google Workspace mailbox, new-mail-only inbox sync, reconnect/disconnect gates, and production-launch runbooks without implementing historical import, sending, multi-account UX, or provider mailbox mutations.
> **Estimated Effort**: XL

## Context
### Original Request
Create an execution-ready implementation plan at `.weave/plans/google-auth-gmail-inbox.md` for Google OAuth sign-in plus Gmail inbox access in this SolidJS + TanStack Start / ElysiaJS / Tauri / Drizzle monorepo. This is planning/scoping only, not implementation.

### Key Findings
- `apps/server/src/auth.ts` already exports Better Auth with the Drizzle adapter, `/api/auth` base path, strict trusted origins, and cross-origin cookie attributes for Tauri. No social provider is configured yet.
- `apps/server/src/server.ts` mounts Better Auth at `/api/auth/*`, derives `authUser`/`authSession` via `apps/server/src/plugins/auth_session.ts`, and autoloads route modules from `apps/server/src/routes/`.
- `apps/server/src/db/schema.ts` only contains Better Auth `user`, `session`, `account`, and `verification` tables. The Better Auth `account` table includes token columns, but it is not sufficient as the Atlas mailbox ownership model.
- `apps/web` is currently a SolidJS prototype driven by sample data. There is no Better Auth client, Google sign-in button, server-backed session gate, or live mail API consumption.
- Existing docs align with the requested scope: app-owned mail organization (`docs/adr/0001-*`), new-mail-only sync (`docs/adr/0003-*`), provider-native threading (`docs/adr/0004-*`), and `User` vs `Connected Account` separation (`CONTEXT.md`). No repo contradiction was found.
- The current Tauri/auth/CORS/cookie posture is documented in `.weave/decisions/auth-cors-cookie-matrix.md`, `apps/server/src/config.ts`, `apps/server/src/auth.ts`, and `apps/desktop/src-tauri/tauri.conf.json`. Local HTTP auth remains a known problem because `SameSite=None` requires `Secure` cookies.
- Current AWS infra creates/injects only a small set of secrets. Google OAuth credentials, provider-token encryption keys, Gmail Pub/Sub settings, and some existing auth URL/CORS secrets need explicit deployment wiring before production.
- Better Auth v1.6.11 docs confirm Google refresh-token semantics require `accessType: "offline"` and `prompt: "select_account consent"`; Google may still omit a refresh token if the user previously consented and has not revoked the app.
- Gmail API docs confirm `users.watch` can filter to `INBOX` and delivers Pub/Sub push notifications containing an email address and `historyId`; incremental sync should then use `users.history.list`.
- Pub/Sub push should use an authenticated OIDC push subscription; the API must validate issuer, audience, service account identity, expiry, and signature before enqueueing sync work.

### Milestone 1 Must-Haves
- One user-facing Google button and one consent session.
- Google social sign-in creates/authenticates the Atlas `User`; the same OAuth grant creates the first Gmail `Connected Account`.
- First-run onboarding is atomic: no active Connected Account and no browsing until required Google identity + Gmail read-only scopes are granted and stored successfully.
- Durable server-side provider tokens encrypted at rest with a provider-token key separate from `BETTER_AUTH_SECRET`.
- New-mail-only sync using Gmail watch/push plus fallback polling; no historical import.
- Inbox-first UI backed by real newly synced Gmail `INBOX` messages for one connected account.
- Disconnect/revoke handling that preserves the User, removes usable tokens, and gates the app behind reconnect when the user has zero active mailboxes.
- Public-launch readiness docs that explicitly call out Google OAuth/Gmail verification as a launch dependency.

### Later Follow-Ups (Out of Scope for This Plan)
- Historical mailbox import or retroactive Screener decisions.
- Sending/reply/compose through Gmail, Gmail label/read/archive/trash mutation, unsubscribe, or spam/report-sender flows.
- Multi-account UX, shared mailboxes, domain-admin delegation, Google Workspace admin scopes, or domain-wide delegation.
- Outlook/Microsoft 365 implementation.
- AI categorization/summaries/action extraction against live mail beyond preserving schema/API seams.
- Alternate sign-in/recovery when the original Google sign-in identity is revoked.

### Risks and Dependencies
- **Google verification is a production blocker**: Gmail read scopes can trigger Google OAuth app verification and possibly security assessment. Public-immediate release can proceed only if Google approval is granted or scope choice avoids that requirement; do not hand-wave this in launch docs.
- **Refresh tokens are fragile**: Google may return no refresh token after prior consent. M1 must fail onboarding cleanly and instruct the user/tester to revoke Atlas in Google Account permissions before retrying.
- **Token custody is security-critical**: Better Auth account rows must not be treated as the Atlas mailbox model or the only durable token vault. Sync must use a dedicated encrypted provider-token path with a separate key and key version.
- **Push delivery is not an auth boundary**: Pub/Sub push requests must be authenticated with OIDC and still treated as hints; the server must reconcile with Gmail history rather than trusting message content.
- **History gaps can happen**: If Gmail `historyId` is too old or invalid, M1 should record a sync gap, reset the baseline to current, and keep syncing future mail instead of forcing reconnect or importing history.
- **Local dev auth requires an explicit posture**: production-style `SameSite=None; Secure` cookies will not work over plain HTTP. M1 should document/use local HTTPS or a tightly guarded development-only insecure mode that cannot run in production.
- **Single-account v1 constraints must be enforced server-side**: hiding connect buttons in the UI is insufficient; API logic must reject a second active connected mailbox for the same user in M1.

### Open Questions
- No product/domain decisions are blocking implementation. The only unresolved external inputs are the production Google Cloud project, OAuth consent screen assets, Pub/Sub topic/subscription names, OIDC push service account email, and Google verification timeline.

## Objectives
### Core Objective
Ship a secure M1 path where a user signs in with Google, grants Gmail read-only inbox access in the same consent flow, and sees newly arriving Gmail inbox threads in Atlas through a server-backed sync pipeline.

### Deliverables
- [ ] Create ADRs that lock the Google identity/Connected Account split, provider-token custody, and Gmail watch/history sync model before code changes.
- [ ] Configure Better Auth Google social sign-in with offline access, required Gmail read-only scopes, strict scope enforcement, and durable rate limiting.
- [ ] Add a first-class `ConnectedAccount` domain model and related Gmail/mail/sync tables, separate from Better Auth `account`.
- [ ] Add encrypted provider-token storage using a separate provider-token encryption key and key version.
- [ ] Add atomic onboarding/finalization APIs that create or restore the first Connected Account only when required scopes and refresh-token requirements are satisfied.
- [ ] Add Gmail REST client, watch setup/renewal, Pub/Sub push endpoint authentication, incremental history sync, and fallback polling.
- [ ] Add authenticated mail/connected-account APIs for inbox listing, thread details, status, disconnect, and reconnect gates.
- [ ] Replace prototype-only onboarding with a SolidJS Google sign-in and session/connected-account gate while preserving the design system.
- [ ] Update Tauri CSP/CORS/cookie/local-dev docs for OAuth redirects and live API calls.
- [ ] Add tests, launch runbooks, and verification evidence for auth, token encryption, sync, and UI behavior.

### Definition of Done
- [ ] `bun install --frozen-lockfile` succeeds.
- [ ] `bun run lint` succeeds.
- [ ] `bun run typecheck` succeeds.
- [ ] `bun run --cwd apps/server test` succeeds after adding server tests.
- [ ] `bun run --cwd apps/server generate` creates the expected Drizzle migration with no unintended Better Auth table drift.
- [ ] `bun run --cwd apps/server migrate` applies the new schema to local libSQL.
- [ ] A Google test user can sign in once, grant required scopes, complete onboarding, and see only newly arriving Gmail `INBOX` messages in Atlas.
- [ ] Missing Gmail scope or missing refresh token prevents onboarding completion and leaves no active Connected Account.
- [ ] A forged Pub/Sub push request is rejected; a valid OIDC-authenticated push enqueues sync without trusting message payload content.
- [ ] Disconnect/revoke removes usable tokens, preserves the User, and shows the reconnect gate instead of normal browsing.
- [ ] Database inspection confirms provider tokens are not stored in plaintext and include a provider-token key version.
- [ ] `npx agent-browser` validates the changed web UI does not error and satisfies the onboarding/reconnect/inbox requirements.

### Guardrails (Must NOT)
- Do not use Better Auth `account` as the Atlas Connected Account ownership model.
- Do not store Google access, refresh, or ID tokens in plaintext.
- Do not rely only on `BETTER_AUTH_SECRET` for provider-token encryption.
- Do not request Gmail send/modify/settings/admin/domain-wide scopes in M1.
- Do not mutate Gmail labels, read state, archive state, trash state, or sent mail in M1.
- Do not import historical mail on initial connect or after a Gmail history gap.
- Do not allow browsing with zero active connected mailboxes except explicit dev/demo routes.
- Do not allow wildcard credentialed CORS or broaden Tauri CSP to arbitrary `https:`.
- Do not add multi-account UX or permit a second active connected mailbox for a user in M1.
- Do not proceed to public production launch without recording Google OAuth/Gmail verification status.

## TODOs

- [ ] 1. Create pre-implementation ADRs
  **What**: Add ADRs that capture the fixed design decisions so implementation cannot accidentally collapse Atlas `User`, Better Auth `account`, and Atlas `ConnectedAccount`, weaken token custody, or replace Gmail watch/history with historical import.
  **Files**: `docs/adr/0009-use-google-oauth-for-v1-identity-and-gmail-connected-account.md`, `docs/adr/0010-encrypt-provider-tokens-with-separate-key.md`, `docs/adr/0011-use-gmail-watch-history-with-polling-fallback.md`, `docs/notes/provider-scope.md`
  **Acceptance**: ADRs state M1 scope, security constraints, non-goals, and launch verification risk; `docs/notes/provider-scope.md` reflects that public-immediate M1 uses read-only Gmail inbox access while send/compose remains deferred.

- [ ] 2. Add packages, configuration, and secret surfaces
  **What**: Add only required dependencies (`better-auth` to the web app for the Solid client if used, `jose` to the server for Pub/Sub OIDC JWT validation), and extend config/env validation for Google OAuth, required scopes, provider-token encryption, Gmail watch/polling, Pub/Sub OIDC, and feature gating. Prefer Bun/Web APIs and native `fetch` for Google REST calls; do not add `googleapis` unless an ADR justifies it.
  **Files**: `apps/server/package.json`, `apps/web/package.json`, `bun.lock`, `apps/server/src/config.ts`, `apps/server/.env.example`, `apps/web/.env.example`, `infra/modules/secrets/main.tf`, `infra/modules/ecs-express-api/main.tf`, `.github/workflows/seed-secrets.yml`, `infra/README.md`
  **Acceptance**: Server startup fails fast when Google/Gmail is enabled without required env vars; production receives Google and token-encryption secrets through Secrets Manager; docs show local/staging/production values without committing secrets.

- [ ] 3. Add Connected Account, token, mail, and sync schema
  **What**: Extend Drizzle schema with first-class Atlas domain tables: `connectedAccount`, `providerTokenGrant`, `gmailSyncState`, `gmailSyncEvent` or equivalent idempotency table, `mailThread`, and `mailMessage`. Key app-owned mail/thread state by `connectedAccountId`, not Better Auth `account.id`, so mailbox transfers create fresh Atlas state for a new user while same-user reconnect can restore prior state.
  **Files**: `apps/server/src/db/schema.ts`, `apps/server/drizzle/`
  **Acceptance**: Schema enforces one active Google mailbox per user for M1 and one active owner per provider mailbox; stores provider IDs/history IDs as strings; adds indexes for `userId`, `connectedAccountId`, provider mailbox identity, provider thread/message IDs, active-status lookups, and webhook idempotency; generated migration is committed.

- [ ] 4. Implement provider-token encryption service
  **What**: Create a token vault utility using Bun-supported Web Crypto AES-256-GCM with random IVs, authenticated additional data, key IDs, and explicit decrypt/encrypt boundaries. Store encrypted access/refresh/ID tokens in the provider token table, and encrypt or scrub Better Auth `account` token fields after vault capture so they are not plaintext. Built-in Better Auth token encryption may be used only as defense-in-depth; separate-key provider-token custody is the authoritative control.
  **Files**: `apps/server/src/services/security/provider_token_crypto.ts`, `apps/server/src/services/security/provider_token_crypto.test.ts`, `apps/server/src/services/security/provider_token_vault.ts`
  **Acceptance**: Tests prove round-trip encryption, wrong-key/wrong-AAD failure, key-version handling, and no plaintext persistence in vault outputs or Better Auth account token columns; sync code can request decrypted tokens only through the vault service.

- [ ] 5. Configure Better Auth Google sign-in and auth hardening
  **What**: Add Google to `socialProviders` with `clientId`, `clientSecret`, `scope: ["openid", "email", "profile", "https://www.googleapis.com/auth/gmail.readonly"]`, `accessType: "offline"`, and `prompt: "select_account consent"`. Enable durable Better Auth rate limiting with database or secondary storage, keep CSRF/origin checks enabled, and avoid permissive account linking.
  **Files**: `apps/server/src/auth.ts`, `apps/server/src/config.ts`, `apps/server/.env.example`
  **Acceptance**: OAuth redirects use `BETTER_AUTH_URL` and `/api/auth/callback/google`; required scopes are centralized and testable; auth rate limits do not use process-memory storage in deployed environments; production origin/cookie constraints remain intact.

- [ ] 6. Add atomic Google onboarding finalization
  **What**: Add authenticated onboarding APIs that inspect the current Better Auth Google account, validate granted scopes, require a refresh token for durable sync, verify the Google identity (`sub`/email) matches the account being connected, create or restore the Connected Account in a transaction, store encrypted tokens, establish the Gmail sync baseline, and start watch setup. Do not mark onboarding complete until all steps succeed.
  **Files**: `apps/server/src/routes/onboarding.ts`, `apps/server/src/services/onboarding/google_onboarding.ts`, `apps/server/src/services/google/google_identity.ts`, `apps/server/src/services/google/google_scopes.ts`, `apps/server/src/services/connected_accounts.ts`
  **Acceptance**: `GET /api/onboarding/status` returns session + connected-account gate state; `POST /api/onboarding/google/finalize` is idempotent; missing scopes or refresh token returns a typed incomplete status and leaves no active Connected Account; same-user reconnect reuses/restores prior state where possible.

- [ ] 7. Enforce Connected Account ownership, disconnect, revoke, and transfer rules
  **What**: Implement repository/service logic for exclusive ownership: reject connecting an already-active mailbox owned by another user, allow transfer only after explicit disconnect/revocation, create a fresh relationship for a different user after transfer, and restore app-owned state for the same user reconnecting the same mailbox. Implement disconnect/revoke as token revocation + token erasure + status transition, not User deletion.
  **Files**: `apps/server/src/services/connected_accounts.ts`, `apps/server/src/routes/connected_accounts.ts`, `apps/server/src/services/google/google_oauth_tokens.ts`, `apps/server/src/services/connected_accounts.test.ts`
  **Acceptance**: Tests cover active-owner conflict, same-user reconnect restore, different-user fresh relationship, disconnect token erasure, and zero-mailbox gate state; API responses never expose provider tokens.

- [ ] 8. Implement Gmail REST client and read-only inbox fetchers
  **What**: Build a small Gmail REST client around native `fetch` for token refresh, `users.getProfile`, `users.watch`, `users.history.list`, `users.messages.get`, and any minimal `users.threads.get` usage. Limit reads to `INBOX` and message/thread fields needed by Atlas; do not use Gmail mutation endpoints.
  **Files**: `apps/server/src/services/google/gmail_client.ts`, `apps/server/src/services/google/gmail_types.ts`, `apps/server/src/services/google/gmail_message_normalizer.ts`, `apps/server/src/services/google/gmail_client.test.ts`
  **Acceptance**: Client refreshes expired access tokens using the encrypted refresh token, marks `invalid_grant`/401 as revoked-needs-reconnect, filters or verifies `INBOX`, normalizes provider-native `threadId`, and has mocked tests for success/rate-limit/revocation paths.

- [ ] 9. Add Gmail watch setup, renewal, and authenticated Pub/Sub push endpoint
  **What**: Configure Gmail watch with `labelIds: ["INBOX"]`, `labelFilterBehavior: "INCLUDE"`, and the configured Pub/Sub topic. Add a Pub/Sub push route that validates Google OIDC JWT issuer/audience/service-account identity with `jose`, deduplicates message IDs/history IDs, and enqueues sync work.
  **Files**: `apps/server/src/services/google/gmail_watch.ts`, `apps/server/src/services/google/pubsub_oidc.ts`, `apps/server/src/routes/webhooks/google_gmail.ts`, `apps/server/src/services/google/gmail_watch.test.ts`, `apps/server/src/services/google/pubsub_oidc.test.ts`
  **Acceptance**: Watch expiration is stored and renewed before expiry; invalid/unsigned/wrong-audience Pub/Sub pushes are rejected; valid pushes return 2xx only after durable enqueue/idempotency recording; push payload is treated as a hint, not trusted mail content.

- [ ] 10. Add incremental sync jobs and fallback polling
  **What**: Use existing `defineJob`/Redis queue and `verrou` locks to process Gmail history from the last stored `historyId`, fetch new INBOX messages, upsert provider-native threads/messages, and update cursors transactionally. Add a background loop that renews watches and polls stale accounts so sync continues if push degrades.
  **Files**: `apps/server/src/services/google/gmail_sync.ts`, `apps/server/src/services/google/gmail_polling.ts`, `apps/server/src/jobs/gmail_sync.ts`, `apps/server/src/services/background_sync.ts`, `apps/server/src/index.ts`, `apps/server/src/services/google/gmail_sync.test.ts`
  **Acceptance**: Push-triggered sync is near-real-time; fallback polling runs under a distributed lock; duplicate pushes are idempotent; Gmail history gaps record a sync-gap event and reset the baseline to current without historical import or forced reconnect.

- [ ] 11. Add authenticated mail and mailbox status APIs
  **What**: Add server routes for active mailbox status, inbox thread list, thread details, and connected account state. All routes must require Better Auth session, derive the current active Connected Account, and return zero-mailbox/reconnect responses instead of sample data.
  **Files**: `apps/server/src/routes/mail.ts`, `apps/server/src/routes/connected_accounts.ts`, `apps/server/src/services/mail_repository.ts`, `apps/server/src/services/mail_repository.test.ts`
  **Acceptance**: `GET /api/mail/inbox` returns only the authenticated user’s active connected account mail; `GET /api/mail/threads/:id` rejects cross-user/cross-account access; zero-mailbox state returns a typed reconnect gate; no route returns provider tokens or raw OAuth account rows.

- [ ] 12. Add SolidJS auth client, onboarding Google button, and session gate
  **What**: Add a Better Auth Solid/client wrapper or minimal redirect helper, replace onboarding bypass actions with a single Google button, add an OAuth callback/finalize route, and gate normal app routes on `GET /api/onboarding/status`. Preserve Atlas design tokens and SolidJS conventions.
  **Files**: `apps/web/src/lib/auth.ts`, `apps/web/src/lib/session.ts`, `apps/web/src/routes/index.tsx`, `apps/web/src/routes/onboarding.tsx`, `apps/web/src/routes/auth/google/callback.tsx`, `apps/web/src/components/atlas/onboarding.tsx`, `apps/web/src/components/atlas/auth_gate.tsx`, `apps/web/src/lib/api.ts`, `apps/web/package.json`
  **Acceptance**: First-run UI exposes one Google sign-in button; Skip/Open Atlas cannot bypass the mailbox gate; OAuth callback calls finalize and routes to inbox only when onboarding is complete; missing scopes/refresh-token errors show actionable retry/revoke copy.

- [ ] 13. Replace prototype inbox/settings data with live API states for M1
  **What**: Wire the inbox list/thread view/settings connected-account section to the new APIs while keeping prototype/demo-only sample data isolated to dev routes if still needed. Show loading, empty new-mail-only state, sync degraded state, revoked/reconnect gate, and disconnect confirmation.
  **Files**: `apps/web/src/components/atlas/atlas_app.tsx`, `apps/web/src/components/atlas/mail_workspace.tsx`, `apps/web/src/components/atlas/mail_list.tsx`, `apps/web/src/components/atlas/thread_view.tsx`, `apps/web/src/components/atlas/settings_screen.tsx`, `apps/web/src/lib/atlas/types.ts`, `apps/web/src/lib/api.ts`
  **Acceptance**: Authenticated users with an active Connected Account see server-backed inbox data; newly connected users see the intentional new-mail-only empty state until new mail arrives; settings shows the real Gmail/Workspace account and disconnect action; multi-account controls remain disabled/deferred.

- [ ] 14. Resolve Tauri, CORS, CSP, and local-dev cookie workflows
  **What**: Update desktop CSP and server CORS/auth docs for Google OAuth redirects and API calls. Decide and implement the local development path: preferred local HTTPS proxy with mkcert, or a development-only insecure-cookie switch that is impossible in production. Keep Tauri origins exact and production CSP narrow.
  **Files**: `apps/server/src/auth.ts`, `apps/server/src/config.ts`, `apps/server/.env.example`, `apps/web/.env.example`, `apps/desktop/src-tauri/tauri.conf.json`, `docs/runbooks/local-auth-and-tauri.md`, `.weave/decisions/auth-cors-cookie-matrix.md`
  **Acceptance**: Local dev instructions let engineers complete OAuth without silently dropped cookies; production startup rejects insecure cookie/CORS settings; desktop CSP uses exact `connect-src` values per environment; no wildcard credentialed CORS is introduced.

- [ ] 15. Document Google Cloud, OAuth approval, and operational setup
  **What**: Add runbooks for creating/configuring the Google Cloud project, enabling Gmail API, creating OAuth client credentials, configuring OAuth consent screen/test users, creating Pub/Sub topic/subscription with OIDC push, granting Gmail publish permission to the topic, and preparing verification evidence.
  **Files**: `docs/runbooks/google-oauth-gmail-setup.md`, `docs/runbooks/google-oauth-verification.md`, `infra/README.md`, `apps/server/.env.example`
  **Acceptance**: A deployer can configure staging without guessing; production launch checklist explicitly marks Google OAuth/Gmail verification as a blocking dependency; docs include rollback/revocation steps and required redirect URIs for web and Tauri-supported flows.

- [ ] 16. Add automated tests and smoke fixtures
  **What**: Add Bun test scripts and coverage for scope enforcement, token encryption, connected-account ownership, Gmail normalization/sync idempotency, Pub/Sub OIDC validation, route auth boundaries, and onboarding status. Use mocked Google/PubSub responses; do not call real Google APIs in CI.
  **Files**: `apps/server/package.json`, `turbo.json`, `apps/server/src/services/security/provider_token_crypto.test.ts`, `apps/server/src/services/connected_accounts.test.ts`, `apps/server/src/services/google/gmail_client.test.ts`, `apps/server/src/services/google/gmail_watch.test.ts`, `apps/server/src/services/google/pubsub_oidc.test.ts`, `apps/server/src/services/google/gmail_sync.test.ts`, `apps/server/src/services/mail_repository.test.ts`, `apps/server/src/routes/onboarding.test.ts`, `.github/workflows/ci.yml`
  **Acceptance**: `bun run --cwd apps/server test` runs in CI; tests fail if scopes are weakened, plaintext tokens are returned, cross-account mail access is allowed, or forged Pub/Sub pushes are accepted.

- [ ] 17. Run end-to-end verification and prepare release evidence
  **What**: Verify local/staging auth, onboarding, sync, disconnect/reconnect, fallback polling, and UI behavior with a Google test user and mocked/fake Pub/Sub pushes where appropriate.
  **Acceptance**: Verification commands in the section below pass; screenshots/log snippets prove successful onboarding, missing-scope failure, new-mail-only behavior, valid/invalid push handling, fallback polling, zero-mailbox reconnect gate, and absence of plaintext provider tokens.

## Verification
- [ ] All tests pass: `bun run --cwd apps/server test`.
- [ ] Type/lint/build pass: `bun run typecheck`, `bun run lint`, and `bun run build`.
- [ ] Migration path passes locally: `bun run --cwd apps/server generate` and `bun run --cwd apps/server migrate` against local libSQL.
- [ ] Auth smoke passes: `GET /api/auth/get-session`, Google sign-in redirect, OAuth callback, and `GET /api/onboarding/status` behave correctly before and after sign-in.
- [ ] Scope enforcement passes: removing Gmail read-only scope or refresh-token availability prevents active Connected Account creation.
- [ ] Token custody passes: DB rows for provider tokens and Better Auth account token fields contain no plaintext access/refresh/ID tokens.
- [ ] Push security passes: forged Pub/Sub requests are rejected; valid OIDC-authenticated requests enqueue sync idempotently.
- [ ] Sync resilience passes: push-delivered mail appears promptly, fallback polling catches missed push, and watch renewal updates expiration.
- [ ] Disconnect/revoke passes: tokens are revoked/erased, User remains signed in or can sign in, and the app shows reconnect gate with no normal browsing.
- [ ] UI validation passes with `npx agent-browser` for onboarding, callback success/error, inbox empty/new-mail states, settings connected account, disconnect, and reconnect gate.
- [ ] Launch readiness passes: Google verification status, production redirect URIs, Pub/Sub OIDC settings, Tauri CSP, CORS origins, and secrets are documented before public release.
