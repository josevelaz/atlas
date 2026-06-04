# Task 3.0 Proof Artifacts — Desktop Mailbox Connect and Deep-Link Completion

## Summary

Task 3.0 implements the desktop mailbox-connect OAuth flow end-to-end:
- Server-side connect start/callback/complete endpoints
- Tauri deep-link bridge extension for mailbox-connect callbacks
- Web client helper for the desktop flow
- SolidJS `ConnectMailboxButton` component
- Updated onboarding route with real Gmail connect CTA

---

## Subtask Status

| Subtask | Status | Evidence |
|---|---|---|
| 3.1 Desktop mailbox-connect client flow | ✅ Complete | `apps/web/src/lib/desktop_mailbox.ts` |
| 3.2 Tauri deep-link bridge extension | ✅ Complete | `apps/desktop/src-tauri/src/lib.rs` |
| 3.3 Server/client handling for desktop completion | ✅ Complete | `apps/server/src/routes/accounts_connect.ts` |
| 3.4 Typecheck/build-safe wiring + proof artifacts | ✅ Complete | All three typecheck commands pass (see below) |

---

## Proof 1 — `bun run --cwd apps/web typecheck` passes

```
$ bun run --cwd apps/web typecheck
$ tsc --noEmit
EXIT:0
```

**Interpretation:** All new SolidJS files (`desktop_mailbox.ts`, `connect_mailbox_button.tsx`,
updated `onboarding.tsx`) type-check cleanly. No React patterns introduced.

---

## Proof 2 — `bun run --cwd apps/server typecheck` passes

```
$ bun run --cwd apps/server typecheck
$ tsc --noEmit
EXIT:0
```

**Interpretation:** New `accounts_connect.ts` route plugin type-checks cleanly.
All four endpoints (`/start`, `/callback`, `/desktop/callback`, `/desktop/complete`)
are type-safe.

---

## Proof 3 — `bun run --cwd apps/desktop typecheck` passes (Rust `cargo check`)

```
$ bun run --cwd apps/desktop typecheck
$ cargo check --manifest-path src-tauri/Cargo.toml
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.34s
EXIT:0
```

**Interpretation:** Updated `lib.rs` with the new `atlas://mailbox-connect/callback`
deep-link handler and `url` crate dependency compiles cleanly.

---

## Proof 4 — Web lint passes (zero issues in new files)

```
$ bun run --cwd apps/web lint
$ biome lint ./src
Checked 32 files in 5ms. No fixes applied.
EXIT:0
```

---

## Proof 5 — Server lint passes (zero issues in new file)

```
$ bun run --cwd apps/server lint
# accounts_connect.ts: no warnings or errors
# (pre-existing warnings in accounts.ts and accounts.test.ts are unrelated to task 3.0)
EXIT:0
```

---

## Architecture: Desktop Mailbox-Connect Round Trip

```
Desktop App (Tauri webview)
  │
  ├─ 1. POST /api/accounts/google/connect/start
  │       { channel: "desktop", returnIntent: "/" }
  │       ← { authUrl: "https://accounts.google.com/...", state: "<uuid>" }
  │
  ├─ 2. open(authUrl) via tauri-plugin-opener
  │       → System browser opens Google consent screen
  │
  ├─ 3. listen("atlas://mailbox-connect-callback")
  │       (registered BEFORE open() to avoid race condition)
  │
  │   [User grants consent in system browser]
  │
  │   Google → GET /api/accounts/google/connect/desktop/callback
  │               ?code=<oauth-code>&state=<uuid>
  │
  ├─ 4. Server validates state, stores code server-side
  │       → 302 atlas://mailbox-connect/callback?state=<uuid>
  │         (code is NOT forwarded — stays server-side)
  │
  ├─ 5. OS delivers deep link to Tauri app
  │       lib.rs parses URL, extracts only { state, error }
  │       emits "atlas://mailbox-connect-callback" event to webview
  │         (raw URL never logged, code never forwarded)
  │
  ├─ 6. desktop_mailbox.ts receives event
  │       validates state matches the one from step 1
  │
  ├─ 7. POST /api/accounts/google/connect/desktop/complete
  │       { state: "<uuid>" }
  │       Server: validates state, exchanges stored code with Google,
  │               persists connected_account row
  │       ← { ok: true, accountId: "...", email: "user@gmail.com" }
  │
  └─ 8. onSuccess({ accountId, email }) called
         → navigate to "/"
```

---

## Security Properties

| Property | Implementation |
|---|---|
| OAuth code never reaches webview | `lib.rs` emits only `{ state, error }` — raw URL is never forwarded |
| State validated client-side | `desktop_mailbox.ts` checks `callbackState === state` before calling `/complete` |
| State validated server-side | `/complete` checks `pending.userId === authUser.id` and state expiry |
| Single-use state | Deleted from `pendingMailboxConnects` immediately on first use |
| 5-minute TTL on pending state | `expiresAt = Date.now() + 5 * 60 * 1000` |
| 60-second TTL on code-bearing state | After callback arrives, TTL shortened to 60s for `/complete` |
| Non-enumerating duplicate rejection | Returns generic 409 without revealing which user owns the mailbox |
| External browser (not webview) | `tauri-plugin-opener` opens system browser per RFC 8252 |
| No sensitive params logged | `lib.rs` comment: "Never log the URL (contains the one-time code)" |

---

## Files Changed

| File | Change |
|---|---|
| `apps/server/src/routes/accounts_connect.ts` | **New** — four mailbox-connect endpoints |
| `apps/desktop/src-tauri/src/lib.rs` | **Updated** — added `atlas://mailbox-connect/callback` deep-link handler |
| `apps/desktop/src-tauri/Cargo.toml` | **Updated** — added `url = "2"` dependency |
| `apps/web/src/lib/desktop_mailbox.ts` | **New** — desktop mailbox-connect client helper |
| `apps/web/src/components/accounts/connect_mailbox_button.tsx` | **New** — SolidJS connect CTA component |
| `apps/web/src/routes/onboarding.tsx` | **Updated** — replaced "coming soon" with real connect button |
| `apps/server/.env.example` | **Updated** — documented `API_URL` and Google OAuth redirect URIs |

---

## Known Limitations / Follow-ups

1. **Token encryption**: Tokens are stored as plaintext in this MVP. Task 4.0 adds
   encryption-at-rest via `mailbox_tokens.ts`.

2. **PKCE**: The current implementation does not use PKCE. The server-side code
   exchange mitigates the risk (code never reaches the client), but a future
   hardening pass should add PKCE for defense-in-depth per RFC 8252.

3. **Live round-trip proof**: A full live recording of the system-browser + deep-link
   round trip requires a running server with valid `GOOGLE_CLIENT_ID` /
   `GOOGLE_CLIENT_SECRET` and a registered redirect URI. This is blocked by the
   absence of live credentials in the CI environment. The typecheck and lint proofs
   above demonstrate build-safe wiring; a live integration test is deferred to
   task 3.4 follow-up with real credentials.

4. **Free-tier limit enforcement**: The `/start` endpoint does not yet check the
   free-tier active-account limit before issuing an auth URL. Task 4.0 adds this
   guard.
