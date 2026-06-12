# Tie Real User Profile Data to the UI

## TL;DR
> **Summary**: Replace the hardcoded "Rob Barrett / rob@atlas.co" profile data in the web app with real identity data: a User-bound profile (top bar avatar, settings profile section, editable display name) and Connected-Account-bound surfaces (compose From, settings connected-account rows), backed by new server endpoints, a Primary Connected Account designation, and auth-aware routing — all in a new identity layer that lives outside `AtlasProvider`.
> **Estimated Effort**: Large

## Context

### Original Request
Tie real user profile data to the UI per the resolved decisions:
- **User** = Atlas identity; **Connected Account** = attached mailbox.
- A User owns many Connected Accounts; exactly one **Primary Connected Account**.
- **Onboarded** = signed in **and** ≥1 Connected Account.
- Display name is Atlas-owned and **editable now**; login email is auth-derived and **read-only**; avatar is provider-derived and **read-only** for this slice.
- Top bar + settings profile bind to **User**; compose From + connected-account rows bind to **Connected Account**.
- Profile UI stays separate from account switching (no switching UI).
- This slice **includes auth-aware routing**.
- Identity state stays **outside `AtlasProvider`**.

### Key Findings
- **Server** (`apps/server`): Better Auth + drizzle (sqlite/libsql). `src/db/schema.ts` has `user` / `session` / `account` / `verification`. The Better Auth `account` table **is** the Connected Account store (Google OAuth rows with tokens/scope), but it has **no email column** — mailbox email must be derived (idToken claim or `user.email` fallback). `src/server.ts` has a smoke `GET /me` behind `requireAuth` (`src/plugins/auth_session.ts`). `routes/` autoload dir is empty; existing route lives inline in `server.ts`. Drizzle migrations exist under `apps/server/drizzle/` (`generate`/`migrate` scripts present).
- **Web** (`apps/web`): SolidJS + TanStack Start (SPA prerendered shell). `lib/auth.ts` exposes lazy `getAuthClient()` (better-auth/solid) — used only by `onboarding_visuals.tsx` (`signIn.social` Google) and `routes/logout.tsx` (`signOut`). **No session usage anywhere else.** `QueryClientProvider` is already mounted in `routes/__root.tsx` above `AtlasProvider`.
- **Hardcoded profile data** (grep-verified):
  - `components/atlas/top_bar.tsx:46` — `<AtlasAvatar name="Rob Barrett" />`
  - `components/atlas/compose_dialog.tsx:37` — `FROM_ADDRESS = "rob@atlas.co"`
  - `components/atlas/settings_screen.tsx:128,141` — fake Google/Outlook account rows
  - (`routes/dev/design-system.tsx:184` and `lib/atlas/sample_data.ts:319` are demo/sample data — leave alone)
- **`AtlasProvider`** (`lib/atlas/atlas_state.tsx`) is prototype interaction state (view/screener/compose/assistant) — confirmed it must not absorb identity.
- **Routing**: file routes `/`, `/onboarding`, `/logout`, `/inbox`, `/feed`, `/paper-trail`, `/screener`, `/tasks`, `/settings` (+ `/dev/*`). `/` and `/onboarding` both render the walkthrough; no guards exist anywhere.
- **`AtlasAvatar`** (`components/atlas/mail_row.tsx`) is initials-only — no image support; Google avatars are URLs (`user.image`).
- **No test infrastructure exists** (`**/*.test.*` → 0 files). Bun is the runtime, so `bun:test` is the natural choice.
- **CONTEXT.md** already defines User / Connected Account / Primary Connected Account; "Onboarded" is not yet in the glossary.
- Better Auth client already supports `updateUser({ name })` (display name) and `linkSocial` (connect another mailbox) — no custom server endpoints needed for those.

## Objectives

### Core Objective
Bind every profile-displaying surface to real data with correct entity semantics (User vs Connected Account), persisted Primary designation, and routing that gates the app on Onboarded status — without touching `AtlasProvider`.

### Deliverables
- [ ] Server: `is_primary` flag on `account` + migration; shaped `GET /me`; `GET /me/connected-accounts`; `PUT /me/primary-connected-account`
- [ ] Web: `lib/identity/` module (types, fetchers, solid-query hooks, route guards) — separate from `lib/atlas/`
- [ ] Auth-aware routing: app routes require Onboarded; `/` redirects onboarded users to `/inbox`
- [ ] Top bar avatar bound to User (image or initials fallback)
- [ ] Settings: new Profile section (editable display name, read-only email, read-only avatar) + real connected-account rows with Primary badge / Set-primary / Connect-another (linkSocial)
- [ ] Compose From bound to Primary Connected Account email
- [ ] `bun:test` unit tests for the connected-accounts service pure logic
- [ ] CONTEXT.md glossary: add **Onboarded**

### Definition of Done
- [ ] `bun run typecheck` passes in `apps/server` and `apps/web`
- [ ] `bun run lint` passes in `apps/server` and `apps/web`
- [ ] `bun test apps/server` passes
- [ ] `grep -rn '"Rob Barrett"\|rob@atlas.co\|rob.barrett@outlook' apps/web/src --include='*.tsx' --exclude-dir=dev` returns hits only in `sample_data.ts` (mail fixtures) — none in top bar, compose, or settings
- [ ] Manual: signed-out visit to `/inbox` lands on `/`; after Google sign-in, `/` lands on `/inbox`; settings shows real name/email/avatar; display-name edit persists across reload (validated with `npx agent-browser` where OAuth creds are configured)

### Guardrails (Must NOT)
- Do NOT add identity state to `AtlasProvider` / `lib/atlas/atlas_state.tsx` — identity lives in its own module backed by the solid-query cache.
- Do NOT build account-switching UI (no account picker in top bar, no per-view account filter).
- Do NOT make avatar or login email editable.
- Do NOT rename/move existing route files into a pathless layout (`_app/`) — apply guards per-route to avoid routeTree churn.
- Do NOT modify `docs/prototype/**`, `lib/atlas/sample_data.ts`, or `routes/dev/*` demo values.
- Do NOT upgrade zod or other pinned deps.

## TODOs

- [x] 1. Add Primary Connected Account storage to the schema
  **What**: Add `isPrimary` (`integer { mode: "boolean" }`, `.default(false).notNull()`) to the `account` table, plus a **partial unique index** enforcing one primary per user: `uniqueIndex("account_user_primary_uq").on(table.userId).where(sql\`is_primary = 1\`)`. A flag on `account` avoids a circular FK (`user` → `account` → `user`). Better Auth ignores the extra column (it has a default, so its inserts succeed). Then generate + apply the migration.
  **Files**: `apps/server/src/db/schema.ts`, generated file under `apps/server/drizzle/`
  **Acceptance**: `bun run generate` produces a migration adding the column + partial index; `bun run migrate` (or `push`) applies cleanly against `local.db`; `bun run typecheck` passes.

- [x] 2. Connected-accounts service (server)
  **What**: New `connected_accounts.ts` service with small pure functions (exported for testing) plus drizzle queries:
  - `toConnectedAccountDto(row, userEmail)` → `{ id, providerId, email, isPrimary, createdAt }`. Email resolution: decode the stored `idToken` JWT payload (base64url, **no signature verification needed** — it was obtained server-side from our own OAuth flow) and read the `email` claim; fall back to `userEmail`.
  - `pickEffectivePrimary(accounts)` → the explicitly flagged row, else oldest `createdAt` (deterministic tiebreak on `id`). Never null when ≥1 account exists.
  - `listConnectedAccounts(userId)` → query `account` where `userId`, **excluding `providerId === "credential"`** rows, mapped to DTOs with the effective primary marked.
  - `setPrimaryConnectedAccount(userId, accountId)` → single transaction: verify the account exists, belongs to `userId`, and is not a credential row (else throw a typed not-found/forbidden error); clear `isPrimary` for the user's other rows; set it on the target.
  **Files**: `apps/server/src/services/connected_accounts.ts`
  **Acceptance**: Typechecks; functions are import-pure enough to unit test without a live Better Auth instance (db access isolated to the two query functions, injectable or thin).

- [x] 3. Identity endpoints (server)
  **What**: In `server.ts`, after `.use(requireAuth)`:
  - Reshape `GET /me` → `{ user: { id, name, email, image, createdAt } }` (stop echoing the raw session object; no current consumers, safe to change).
  - `GET /me/connected-accounts` → `{ accounts: ConnectedAccountDto[], primaryConnectedAccountId: string }` via the service.
  - `PUT /me/primary-connected-account` with body `{ accountId: string }` (Elysia `t.Object` validation) → 204 on success, 404 on unknown/unowned account. Note: `CORS_METHODS` in `server.ts` already includes PUT — no CORS change needed.
  Keep routes inline in `server.ts` next to the existing `/me` (the `routes/` autoload dir is unused; don't introduce a second convention in this slice).
  **Files**: `apps/server/src/server.ts`
  **Acceptance**: With a session cookie, `curl` of all three endpoints returns the documented shapes; unauthenticated requests get 401 from `requireAuth`; swagger (`/swagger`) lists them.

- [x] 4. Server unit tests (bun:test)
  **What**: First test file in the repo. Cover the pure logic: idToken email-claim decoding (valid token, malformed token → fallback, missing claim → fallback), `pickEffectivePrimary` (explicit flag wins; oldest-createdAt fallback; deterministic tiebreak), DTO mapping, and credential-row exclusion. No live-server or DB integration tests in this slice (no harness exists; don't build one now).
  **Files**: `apps/server/src/services/connected_accounts.test.ts`
  **Acceptance**: `bun test` passes from `apps/server`.

- [x] 5. Web identity module — types + fetchers
  **What**: New `lib/identity/` (deliberately sibling to, not inside, `lib/atlas/`):
  - `types.ts` — `UserProfile`, `ConnectedAccount`, `IdentitySnapshot` mirroring the server DTOs.
  - `api.ts` — `fetchMe()`, `fetchConnectedAccounts()`, `putPrimaryConnectedAccount(accountId)` using `apiUrl()` from `lib/api.ts` with `credentials: "include"`. A 401 from `/me` resolves to `null` (signed-out is a state, not an error); other non-2xx throw.
  **Files**: `apps/web/src/lib/identity/types.ts`, `apps/web/src/lib/identity/api.ts`
  **Acceptance**: Typechecks; no imports from `lib/atlas/**`.

- [x] 6. Web identity module — solid-query hooks
  **What**: `queries.ts` with query options + hooks (uses the existing `queryClient` / `QueryClientProvider` from `__root.tsx`):
  - `meQueryOptions()` (key `["identity","me"]`, `retry: false`, `staleTime` ~30s) and `connectedAccountsQueryOptions()` (key `["identity","connected-accounts"]`, **enabled only when `me` resolved non-null**).
  - Hooks: `useUser()`, `useConnectedAccounts()`, `usePrimaryConnectedAccount()` (resolves the row matching `primaryConnectedAccountId`), `useIdentityStatus()` → `"loading" | "signedOut" | "needsConnection" | "onboarded"` (onboarded = user non-null AND ≥1 connected account).
  - Mutations: `useUpdateDisplayName()` → `getAuthClient().updateUser({ name })` then invalidate `["identity","me"]`; `useSetPrimary()` → `putPrimaryConnectedAccount` then invalidate `["identity","connected-accounts"]`.
  - `invalidateIdentity(queryClient)` helper (used by logout).
  All browser-only concerns stay lazy (mirror the `getAuthClient()` pattern) so SSR/prerender of the SPA shell never executes a fetch.
  **Files**: `apps/web/src/lib/identity/queries.ts`
  **Acceptance**: Typechecks; nothing in `lib/atlas/atlas_state.tsx` or `lib/atlas/app_state.ts` is touched.

- [x] 7. Auth-aware routing
  **What**: `lib/identity/route_guards.ts` exporting two async `beforeLoad` helpers built on `queryClient.ensureQueryData`:
  - `requireOnboarded()` — skip entirely when `typeof window === "undefined"` (prerender of the SPA shell must not fetch or redirect); fetch me + connected accounts; throw `redirect({ to: "/" })` unless onboarded.
  - `redirectIfOnboarded()` — same guard for `/`; throw `redirect({ to: "/inbox" })` when onboarded.
  Apply `requireOnboarded` as `beforeLoad` on the six app routes: `inbox.tsx`, `feed.tsx`, `paper-trail.tsx`, `screener.tsx`, `tasks.tsx`, `settings.tsx`. Apply `redirectIfOnboarded` on `index.tsx`. Leave `/onboarding` (replay) and `/logout` ungated; leave `/dev/*` ungated. In `routes/logout.tsx`, call `invalidateIdentity(queryClient)` in the `onSuccess` before navigating.
  **Files**: `apps/web/src/lib/identity/route_guards.ts`, `apps/web/src/routes/{index,inbox,feed,paper-trail,screener,tasks,settings,logout}.tsx`
  **Acceptance**: Signed-out `/inbox` → `/`; onboarded `/` → `/inbox`; `bun run build` still prerenders the shell without network errors.

- [x] 8. Avatar image support
  **What**: Extend `AtlasAvatar` (`components/atlas/mail_row.tsx`) with an optional `src?: string`: when set, render an `<img>` (with `referrerpolicy="no-referrer"` — Google avatar CDN 403s otherwise, and `loading="lazy"`) inside the existing chip styling; on image error or absent `src`, fall back to current initials+palette rendering. Mail rows keep passing name-only — zero visual change there.
  **Files**: `apps/web/src/components/atlas/mail_row.tsx`
  **Acceptance**: Mail list renders identically; an avatar with `src` shows the image clipped to the chip; broken URL falls back to initials.

- [x] 9. Bind top bar to User
  **What**: In `top_bar.tsx`, replace `<AtlasAvatar name="Rob Barrett" size="sm" />` with data from `useUser()`: `name` → initials fallback, `image` → `src`. While loading / signed-out (only transiently possible behind the guard), render the initials chip with a neutral placeholder (e.g. `"·"` / empty name guard) — no layout shift.
  **Files**: `apps/web/src/components/atlas/top_bar.tsx`
  **Acceptance**: Top bar shows the signed-in Google user's avatar/initials; no `"Rob Barrett"` literal remains in the file.

- [x] 10. Settings — Profile section (User-bound)
  **What**: Add a new "Profile" carded section **above** "Connected accounts" in `settings_screen.tsx`:
  - Avatar (read-only, via `AtlasAvatar` with `src`).
  - **Display name** — editable `Input` + Save button driven by `useUpdateDisplayName()`; disable Save while pending/unchanged; on success the top bar updates reactively (shared `["identity","me"]` cache).
  - **Login email** — read-only (disabled input or plain mono text with a "read-only" affordance), sourced from `user.email`.
  Follow the existing `SettingsRow`/`Card` patterns and DESIGN.md tokens. This section is profile-only: no account switching affordances.
  **Files**: `apps/web/src/components/atlas/settings_screen.tsx` (optionally a small `profile_section.tsx` sibling if the screen file grows unwieldy)
  **Acceptance**: Editing the name and saving persists (reload shows new name; server `user.name` updated via Better Auth); email field is not editable.

- [x] 11. Settings — real Connected Account rows
  **What**: Replace the three hardcoded rows in the "Connected accounts" card:
  - `<For each={accounts}>` from `useConnectedAccounts()`: provider icon (map `providerId` → `google`/`outlook` icon, default fallback), title = account email, sub = provider label, `Badge` "Primary" on the primary row, and a `Set primary` button (via `useSetPrimary()`) on non-primary rows.
  - Keep a final "Connect another account" row whose button calls `getAuthClient().linkSocial({ provider: "google", callbackURL: <settings URL> })`.
  - Drop the fake Outlook "Upgrade to connect" row.
  No disconnect/unlink in this slice (it's adjacent to switching/removal — out of scope).
  **Files**: `apps/web/src/components/atlas/settings_screen.tsx`
  **Acceptance**: Rows reflect the DB `account` table; exactly one Primary badge; Set primary round-trips and re-renders; Connect button starts a Google link flow.

- [x] 12. Bind compose From to Primary Connected Account
  **What**: In `compose_dialog.tsx`, delete the `FROM_ADDRESS` constant; read `usePrimaryConnectedAccount()` and render its `email` in the (still disabled) From input; empty-string fallback while loading. No account picker (switching is out of scope).
  **Files**: `apps/web/src/components/atlas/compose_dialog.tsx`
  **Acceptance**: Compose From shows the primary mailbox address; changing primary in settings changes compose From without reload.

- [x] 13. CONTEXT.md — define Onboarded
  **What**: Add an **Onboarded** glossary entry: "A User is Onboarded when they are signed in and have at least one Connected Account. Only Onboarded users can access the main app views; everyone else lands on the onboarding flow." Add the relationship bullet if natural.
  **Files**: `CONTEXT.md`
  **Acceptance**: Term present and consistent with existing User / Connected Account / Primary Connected Account entries.

- [ ] 14. Verification pass + commits _(blocked: Shuttle verification task interrupted/cancelled twice)_
  **What**: Run `bun run typecheck` + `bun run lint` in both apps, `bun test` in `apps/server`, `bun run build` in `apps/web` (confirms prerender survives the guards). Run the grep check from Definition of Done. Validate the UI flows with `npx agent-browser` (signed-out redirect; if `GOOGLE_CLIENT_ID/SECRET` are configured locally: sign in, check top bar/settings/compose bindings, edit display name, set primary; otherwise validate the signed-out half and note the gap). Commit per task with conventional commits (e.g. `feat(server): add primary connected account flag and identity endpoints`, `feat(web): add identity layer and auth-aware routing`, `feat(web): bind profile surfaces to real user data`, `docs(context): define onboarded`); push and open a PR via `gh` per repo AGENTS.md.
  **Acceptance**: All commands green; PR open.

## Implementation Order & Dependencies

```
1 (schema) ─→ 2 (service) ─→ 3 (endpoints) ─→ 4 (server tests)
                                   │
                                   ▼
5 (types/fetchers) ─→ 6 (hooks) ─→ 7 (route guards)
                          │
                          ├─→ 8 (avatar src) ─→ 9 (top bar)
                          ├─→ 10 (settings profile)
                          ├─→ 11 (settings accounts)
                          └─→ 12 (compose From)
13 (CONTEXT.md) — anytime · 14 (verify) — last
```

## Potential Pitfalls

- **SPA prerender executes route code at build time** — any guard or hook that fetches during SSR will break `bun run build`. Mitigation: `typeof window === "undefined"` early-return in guards (task 7) and lazy browser-only client init (task 6), mirroring the existing `getAuthClient()` pattern.
- **Better Auth owns the `account` table** — only add a defaulted, not-null column (`is_primary`), never alter Better Auth-managed columns; its inserts ignore unknown columns with defaults. Avoid a `user.primary_connected_account_id` FK (circular reference user↔account).
- **Mailbox email isn't stored on `account`** — idToken claim decode can fail (absent/opaque token). Always fall back to `user.email`; cover both paths in tests (task 4). If a future provider lacks both, the DTO email may be wrong — acceptable for this Google-only slice.
- **Credential account rows** — Better Auth creates `providerId: "credential"` rows for password users; they are not mailboxes. Filter them in the service (task 2) or settings will show a bogus "connected account".
- **401 retry storms** — solid-query default retries on error; `/me` must use `retry: false` and map 401 → `null` so signed-out renders instantly instead of spinning.
- **Skip-link bounce** — onboarding's "Skip"/"Open Atlas" link to `/inbox`; a not-yet-connected user will be redirected back to `/`. Accepted for this slice (the guard is the spec); do not "fix" by weakening the guard.
- **Google avatar 403s** — must render `<img referrerpolicy="no-referrer">` (task 8).
- **`/onboarding` replay stays ungated** — gating it would break the documented replay feature; only `/` gets the onboarded-redirect.
- **OAuth-less dev environments** — agent-browser validation of signed-in flows requires Google OAuth env vars; the plan's manual validation explicitly degrades to signed-out-flow checks when absent.
- **Response-shape change to `GET /me`** — verified no current web consumers; safe now, would not be after this slice ships.

## Verification
- [ ] `bun run typecheck` passes in `apps/server` and `apps/web`
- [ ] `bun run lint` passes in `apps/server` and `apps/web`
- [ ] `bun test` passes in `apps/server` (new service tests)
- [ ] `bun run build` succeeds in `apps/web` (prerender unaffected by guards)
- [ ] Grep check: no `Rob Barrett` / `rob@atlas.co` / `rob.barrett@outlook` in top bar, compose, or settings components
- [ ] Migration applies cleanly to a fresh DB (`bun run migrate` from scratch) and to the existing `local.db`
- [ ] `npx agent-browser` flow: signed-out `/inbox` → `/`; (with OAuth configured) sign-in → `/inbox`, top bar avatar real, settings profile editable name persists, primary toggle updates compose From
- [ ] No regressions: mail list avatars, screener, tasks, onboarding walkthrough render unchanged
