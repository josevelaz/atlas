# Gmail Ingestion Runbook (Gmail Push + Verification)

## Purpose

This runbook defines the **external production dependencies** required to run Gmail
ingestion with Pub/Sub push. The server supports polling fallback automatically, but
near-real-time updates require all steps below in both dev and production environments.

## Hard production blocker (must not be skipped)

- **Production launch is blocked until Google OAuth verification is complete for the
  restricted `gmail.readonly` scope** and the approval status is recorded in the
  release notes / task tracker.
- `gmail.readonly` is a **restricted** scope; production use normally requires
  verification and can require a **CASA/security review**.
- Do not enable production `GMAIL_INGESTION_ENABLED=true` unless verification status
  is explicitly marked as complete.

## GCP setup (required per environment)

### 1) Project and APIs

1. Use a dedicated GCP project for the environment (or document cross-project use).
2. Enable these APIs:
   - **Gmail API**
   - **Pub/Sub API**

### 2) Pub/Sub topic

1. Create topic (example: `atlas-gmail-push-dev` / `atlas-gmail-push-prod`).
2. Confirm topic ARN/URL format:
   - `projects/<project-id>/topics/<topic-name>`

### 3) Allow Gmail push service account to publish

1. Grant `roles/pubsub.publisher` on the topic to:

```
gmail-api-push@system.gserviceaccount.com
```

This principal is the Gmail API publisher for watch notifications.

### 4) Push subscription

1. Create subscription with OIDC to the Atlas API endpoint:

```
https://<api-host>/gmail/push
```

2. Set the subscription audience to the exact same value used in `GMAIL_PUSH_AUDIENCE`.
3. Choose/define an endpoint service account and assign it in the push subscription so Google can
   mint/attach OIDC tokens.
4. Set `GMAIL_PUSH_SERVICE_ACCOUNT` to that exact service-account email (the
   `email` claim expected in incoming JWTs).

Example audience values:

- Dev: `https://api.dev.hay.example.com/gmail/push`
- Prod: `https://api.hay.example.com/gmail/push`

### 5) Route availability sanity check

- Keep `POST /gmail/push` reachable from Google (public HTTPS endpoint).
- If `GMAIL_PUSH_*` values are missing, the route returns `404` by design and
  ingestion falls back to polling; this is a valid local/dev state but not production
  with the push SLA.

## Google OAuth verification checklist

1. Configure OAuth consent screen in the Google Cloud project that holds the Google
   client used by Atlas.
2. Ensure scope includes:

```
https://www.googleapis.com/auth/gmail.readonly
```

3. Submit restricted-scope verification for this app.
4. Record verification result (pending / approved / rejected / CASA required) and
   the approver/date in repo notes before production launch.
5. Keep the app's production consent configuration aligned with deployed callback
   domains.

## Environment variables (by deployment)

### Server variables required to enable push

Common required vars:

- `GMAIL_INGESTION_ENABLED=true`
- `GMAIL_PUBSUB_TOPIC=projects/<project-id>/topics/<topic-name>`
- `GMAIL_PUSH_AUDIENCE=https://<api-host>/gmail/push`
- `GMAIL_PUSH_SERVICE_ACCOUNT=<service-account-email>`

Optional tuning:

- `GMAIL_POLL_INTERVAL_SECONDS` (default `120`)
- `GMAIL_WATCH_RENEWAL_HOURS` (default `24`)

### Dev

- `GMAIL_INGESTION_ENABLED=true` once pub/sub is configured (optional at first if
  you intentionally run polling-only).
- `CORS_ALLOWED_ORIGINS` should include the dev web origin.

### Production

- `GMAIL_INGESTION_ENABLED=true`
- `GMAIL_PUBSUB_TOPIC` -> production topic name
- `GMAIL_PUSH_AUDIENCE` -> production API push URL
- `GMAIL_PUSH_SERVICE_ACCOUNT` -> production OIDC-push service account email
- Verify `CORS_ALLOWED_ORIGINS` does not contain localhost/wildcard and includes
  real production frontend origins.

## Terraform note

- Pub/Sub/Gmail-integration resources are **outside current `infra/` (AWS) Terraform**.
  Provisioning is a manual/parallel GCP runbook task and should be migrated to
  dedicated GCP infrastructure code in a follow-up.

## Run verification before release

1. Confirm `gmail-watch` setup succeeds for a connected account:
   - `connected_account.sync_state` becomes `watching`
   - no warning log that push vars are missing
2. Confirm a test email into connected inbox produces a push/ack cycle and
   resulting catch-up queue activity.
3. Confirm audience and service-account match between:
   - Pub/Sub subscription config (`audience`, OIDC email)
   - `apps/server` env (`GMAIL_PUSH_AUDIENCE`, `GMAIL_PUSH_SERVICE_ACCOUNT`)
4. Block merge/release until verification status in step 1 (OAuth restricted-scope)
   is recorded as complete.

## Operator inputs still required

- **Which GCP project(s)** own dev and production push infra.
- Who owns/executes Google OAuth restricted-scope verification artifacts and CASA interactions.
- Exact production API hostname(s) and callback domains used by deployment.
