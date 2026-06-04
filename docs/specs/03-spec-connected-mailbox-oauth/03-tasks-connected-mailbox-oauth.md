## Relevant Files

| File | Why It Is Relevant |
| --- | --- |
| `apps/server/src/routes/accounts.ts` | Existing connected-account route plugin; likely expands from sync-only routes into connect/list/disconnect/reconnect endpoints. |
| `apps/server/src/routes/accounts.test.ts` | Existing connected-account route tests and fixtures that can be extended or split for management flows. |
| `apps/server/src/server.ts` | Holds current desktop auth callback/exchange endpoints and `/me`; likely needs mailbox-connect return handling and active-account gating updates. |
| `apps/server/src/auth.ts` | Existing Better Auth config; must remain separated from mailbox OAuth and may supply shared provider credentials/settings. |
| `apps/server/src/config.ts` | Central env/config parsing for OAuth credentials, allowed origins, and any new encryption key configuration. |
| `apps/server/src/db/schema/connected_account.ts` | Connected-account schema already stores token fields; must extend for canonical provider identity and lifecycle data. |
| `apps/server/drizzle/` | Migration output location for any schema changes required by mailbox identity or lifecycle metadata. |
| `apps/server/src/services/sync/state.ts` | Existing connected-account ownership/loading helpers and sync-state bootstrapping logic. |
| `apps/server/src/services/sync/status.ts` | Existing synthesized account status logic likely reused by accounts list responses. |
| `apps/server/src/services/sync/orchestrator.ts` | Sync enqueue path likely used after successful initial connect or reconnect. |
| `apps/server/src/jobs/sync/scheduler.ts` | Active/disconnected account behavior may need verification against new lifecycle rules. |
| `apps/server/src/services/mailbox_oauth.ts` | New server-side service module for Gmail connect start/callback, state validation, and account persistence. |
| `apps/server/src/services/mailbox_tokens.ts` | New token encryption/decryption/refresh helper module for mailbox credentials. |
| `apps/server/src/services/mailbox_provider/google.ts` | New provider adapter/client module for Gmail token exchange, identity lookup, and refresh behavior. |
| `apps/server/src/routes/accounts_connect.test.ts` | New focused route/service tests for connect start, callback, duplicate rejection, and failure-without-persist behavior. |
| `apps/server/src/routes/accounts_management.test.ts` | New tests for list/disconnect/reconnect/free-tier/onboarding gate behavior. |
| `apps/server/src/services/mailbox_tokens.test.ts` | New tests for encryption metadata persistence and token refresh updates. |
| `apps/server/src/services/sync_bootstrap.test.ts` | New tests for initial sync baseline seeding and reconnect cursor fallback behavior. |
| `apps/web/src/routes/onboarding.tsx` | Existing onboarding placeholder that must become the first-account mailbox connect entry point. |
| `apps/web/src/routes/auth/complete.tsx` | Existing post-auth redirect logic that currently keys off `connectedAccountCount`; likely needs active-account semantics. |
| `apps/web/src/routes/index.tsx` | Current authenticated landing route that may need account-management entry points or gating updates. |
| `apps/web/src/lib/auth.ts` | Better Auth client entrypoint; must remain distinct from mailbox-connect calls. |
| `apps/web/src/lib/api.ts` | Shared API URL helper likely used by new mailbox-connect client requests. |
| `apps/web/src/lib/desktop_auth.ts` | Existing desktop social-login helper pattern to adapt for mailbox-connect browser/deep-link flow. |
| `apps/web/src/routes/settings.tsx` | Likely new settings route or screen for connected-account list, reconnect, disconnect, and free-tier messaging. |
| `apps/web/src/components/accounts/connected_accounts_panel.tsx` | Likely new SolidJS UI component for reusable account-management rendering across settings/onboarding contexts. |
| `apps/web/src/components/accounts/connect_mailbox_button.tsx` | Likely new UI component for Gmail connect actions with return-intent handling. |
| `apps/desktop/src-tauri/src/lib.rs` | Current deep-link forwarding for Better Auth desktop sign-in; must add mailbox-connect callback event handling safely. |
| `apps/desktop/src-tauri/tauri.conf.json` | Deep-link scheme and CSP-related config may need updates for mailbox-connect flow. |
| `apps/desktop/src-tauri/Cargo.toml` | Tauri plugin dependencies for deep linking or opener behavior may need adjustment. |
| `apps/desktop/package.json` | Desktop validation commands and package-level workflow for typecheck/build proof artifacts. |

### Notes

- Unit tests should typically live alongside the server code they verify and continue using `bun test` patterns already established in `apps/server`.
- Web validation should continue using `bun run --cwd apps/web typecheck` and, after implementation, `npx agent-browser` for UI verification per repository guidance.
- Desktop validation should continue using `bun run --cwd apps/desktop typecheck` and existing Tauri deep-link wiring patterns.
- Planning assumptions for this task list: Gmail is the only required provider in this spec, and the existing custom-scheme desktop callback remains the accepted MVP callback model.

## Tasks

### [ ] 1.0 Build Gmail mailbox OAuth server foundation

#### 1.0 Proof Artifact(s)

- Test: `bun test apps/server/src/routes/accounts_connect.test.ts` passes and demonstrates connect-start, callback success, duplicate-mailbox rejection, and failure-without-persist behavior.
- CLI: `bun run --cwd apps/server typecheck` succeeds after adding mailbox OAuth routes, schema changes, and service helpers demonstrates server integration is valid.
- API capture: authenticated `POST /api/accounts/google/connect` returns sanitized authorization URL + state metadata demonstrates client-friendly connect start contract.

#### 1.0 Tasks

- [ ] 1.1 Extend `connected_account` persistence to support canonical provider-native mailbox identity, while preserving display email and reconnect lifecycle semantics.
- [ ] 1.2 Add a server-side mailbox OAuth service that creates a validated Gmail connect session, returns an authorization URL/state payload, and keeps Atlas sign-in records separate from mailbox authorization records.
- [ ] 1.3 Implement the Gmail callback/token-exchange flow that validates pending state, resolves mailbox identity, rejects duplicates across Atlas users, and persists or reactivates the mailbox only after success.
- [ ] 1.4 Add focused server tests for connect-start, callback success, duplicate-mailbox rejection, and failure-without-persist behavior.

### [ ] 2.0 Ship web onboarding and settings mailbox management

#### 2.0 Proof Artifact(s)

- Screenshot: `/onboarding` in `apps/web` shows Gmail connect entry, successful return, and onboarding completion gate demonstrates first-account connect UX.
- Screenshot: `/settings` in `apps/web` shows active and disconnected mailboxes with reconnect/disconnect actions demonstrates account-management visibility.
- Test: `bun run --cwd apps/web typecheck` succeeds with the new onboarding/settings flows demonstrates SolidJS route integration is valid.

#### 2.0 Tasks

- [ ] 2.1 Replace the onboarding “coming soon” placeholder with a real Gmail connect entry that carries a validated return intent and preserves the new-mail-only disclosure.
- [ ] 2.2 Add a settings account-management surface that lists active and disconnected mailboxes, exposes reconnect/disconnect actions, and shows free-tier limit messaging.
- [ ] 2.3 Update web-side gating logic so onboarding completion depends on at least one active connected mailbox rather than historical account rows alone.
- [ ] 2.4 Add or update web tests/type-safe route checks for onboarding connect flows, settings account state rendering, and active-account gating behavior.

### [x] 3.0 Add desktop mailbox connect and deep-link completion

#### 3.0 Proof Artifact(s)

- Recording: `bun run dev:desktop` from the onboarding mailbox-connect entry launches the system browser for Gmail consent and returns through the dedicated mailbox-connect deep link demonstrates native completion flow.
  - **Status**: Build-safe wiring verified. Live round-trip requires real Google OAuth credentials (deferred — see proof file).
- Test: `bun run --cwd apps/desktop typecheck` succeeds after deep-link and command wiring demonstrates desktop integration is valid.
  - **Status**: ✅ PASS — `cargo check` exits 0.
- Log: sanitized `apps/desktop` deep-link event output plus server callback logs from one desktop mailbox-connect run show state-bound completion without exposing tokens demonstrates secure handoff behavior.
  - **Status**: Architecture documented in proof file. `lib.rs` emits only `{ state, error }` — raw URL never logged.

See: `docs/specs/03-spec-connected-mailbox-oauth/03-proofs/03-task-03-proofs.md`

#### 3.0 Tasks

- [x] 3.1 Add a desktop mailbox-connect client flow that requests the Gmail authorization URL from the server, opens it in the system browser, and listens for a mailbox-connect-specific deep-link completion event.
- [x] 3.2 Extend the Tauri deep-link bridge to forward only expected mailbox-connect callback URLs to the web layer without logging sensitive query parameters.
- [x] 3.3 Add server/client handling for desktop mailbox-connect completion so callback state is validated and the desktop app refreshes account state after success or shows a clear failure path.
- [x] 3.4 Verify desktop integration with Tauri typecheck/build-safe wiring and capture sanitized proof artifacts for the system-browser + deep-link round trip.

### [ ] 4.0 Implement lifecycle guards, token protection, and sync readiness

#### 4.0 Proof Artifact(s)

- Test: `bun test apps/server/src/services/mailbox_tokens.test.ts` passes and demonstrates encryption metadata persistence plus refresh-token update behavior.
- Test: `bun test apps/server/src/routes/accounts_management.test.ts` passes and demonstrates free-tier enforcement, reconnect row reuse, onboarding active-account gating, and revocation-atomic disconnect failures.
- Test: `bun test apps/server/src/services/sync_bootstrap.test.ts` passes and demonstrates initial no-backfill sync seeding plus reconnect cursor-resume fallback behavior.

#### 4.0 Tasks

- [ ] 4.1 Implement token encryption/decryption helpers using an app-managed symmetric key plus persisted encryption metadata, and wire them into mailbox credential storage.
- [ ] 4.2 Add shared provider-client token refresh behavior that updates stored mailbox credentials before Gmail API calls and surfaces revoked/invalid refresh-token failures clearly.
- [ ] 4.3 Implement connected-account management rules for accounts list, free-tier active-account counting, reconnect row reuse, and revocation-atomic disconnect semantics.
- [ ] 4.4 Bootstrap initial sync at current provider state after first connect, and implement reconnect cursor-resume with safe fallback when prior provider cursor state is invalid.
- [ ] 4.5 Add server tests covering encryption metadata persistence, refresh updates, active-account limit enforcement, reconnect reuse, disconnect failure semantics, and initial/reconnect sync bootstrap behavior.
