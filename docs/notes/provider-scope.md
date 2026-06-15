# Provider Scope

## v1 Implementation: Gmail-only

The first implementation (v1) supports connecting only:

- Gmail / Google Workspace

Outlook / Microsoft 365 remains in the product's MVP scope but is **gated in v1**: it stays visible in the UI as a clearly marked "coming soon" option and cannot be connected yet.

## MVP (product scope)

The MVP supports connected accounts from:

- Gmail / Google Workspace
- Outlook / Microsoft 365 (visible but gated "coming soon" in v1)

Users can sync mail from these connected accounts and send mail through the connected account, so outgoing messages appear from the user's existing email address. Send reply / compose through a connected account remains supported at the product level regardless of the v1 provider gate.

The MVP syncs these actions back to the connected account:

- Send reply / compose new email

The MVP keeps these as app-owned metadata only:

- Category
- Read/unread: tracks read state inside Atlas while leaving the connected Gmail/Outlook account unchanged.
- Archive: removes the thread from active category views in Atlas while leaving the connected Gmail/Outlook account unchanged.
- Trash/Delete: removes the thread from normal Atlas views while leaving the connected Gmail/Outlook account unchanged.
- Set Aside
- Reply Later
- AI priority
- AI summaries
- Extracted action items

Spam/report-sender flows and unsubscribe flows are deferred.

## Future

Future provider support should include generic IMAP/SMTP for users outside Gmail and Outlook/Microsoft 365.

## Maintenance: reset legacy plaintext Google OAuth tokens (dev only)

- Task: remove legacy Google `account` rows that still store OAuth tokens in plaintext.
- Script: `apps/server/scripts/reset_plaintext_google_accounts.ts`
- Invocation:
  - Preview: `bun run --cwd apps/server reset:google-plaintext-accounts -- --dry-run`
  - Apply: `bun run --cwd apps/server reset:google-plaintext-accounts -- --apply`
- Scope constraints enforced by the script:
  - Only `account.provider_id = 'google'` rows are considered.
  - It deletes rows only when **access_token** or **refresh_token** is plaintext.
  - Non-Google provider rows are never touched.
- Token shape detection used in the script matches Better Auth v1.6.11 behavior:
  - Encrypted payloads are treated as such when they match either:
    - prefix `"$ba$"`
    - even-length hex (`/^[0-9a-f]+$/i`)
  - Plaintext (legacy) tokens are rows that do not match either pattern.
- This is a one-off dev cleanup. It is **not** a migration and intentionally forces
  affected users to reconnect Google OAuth so fresh token writes use encrypted
  storage.
