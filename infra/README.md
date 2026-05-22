# Infrastructure

Operator-oriented notes for bootstrapping and managing Hay infrastructure.

## Required local tools

- Terraform CLI >= 1.x
- AWS CLI configured for the single AWS account in `us-east-1`
- Turso CLI
- Bun

## Stack order

Run infrastructure in this order:

1. **Bootstrap stack**: `infra/bootstrap/`
   - Must run first.
   - Creates the shared Terraform S3 state bucket.
   - Creates the DynamoDB state lock table.
   - Creates GitHub OIDC roles used by CI/CD workflows.
2. **Environment stacks**: `infra/envs/staging/` and `infra/envs/production/`
   - Manage long-lived staging and production resources.
   - Depend on the bootstrap stack's remote state and CI roles.
3. **Preview stack**: `infra/preview/`
   - Manages per-PR preview environments.
   - Uses isolated state per pull request.

## State key layout

Remote Terraform state keys should follow this layout:

- Staging: `infra/staging/terraform.tfstate`
- Production: `infra/production/terraform.tfstate`
- PR previews: `infra/previews/pr-<number>/terraform.tfstate`

## Environment stacks

The staging and production stacks are long-lived environment stacks under:

- `infra/envs/staging/`
- `infra/envs/production/`

Run staging changes before production where practical. Production should only be applied after the bootstrap stack exists and the staging path has validated the change.

## Preview stack

The preview stack lives in `infra/preview/` and is intended for pull request previews. Each PR must use its own state key in the form:

```text
infra/previews/pr-<number>/terraform.tfstate
```

Preview resources should be treated as ephemeral and cleaned up when the PR closes.

## Auth cookie behavior

### SameSite=None; Secure

All Better Auth session cookies are configured with `SameSite=None; Secure`. This is required because the Tauri desktop app uses a custom protocol origin (`tauri://localhost` on macOS/Linux, `https://tauri.localhost` on Windows) that is cross-origin relative to the API server. Without `SameSite=None`, browsers block cookies on cross-site requests.

**Rules that follow from this:**

| Requirement | Reason |
|---|---|
| API must be served over HTTPS in production | `Secure` cookies are silently dropped over plain HTTP |
| `BETTER_AUTH_URL` must be an `https://` URL in production | Better Auth uses this to auto-detect the `__Secure-` prefix |
| `CORS_ALLOWED_ORIGINS` must list all frontend origins explicitly | No wildcards; credentials require explicit origin matching |
| Tauri origins are always merged into `trustedOrigins` | See `apps/server/src/config.ts` — `TAURI_ORIGINS` constant |

### CSRF protection

Better Auth performs origin-check CSRF protection by default (`advanced.disableCSRFCheck` is **not** set). Only origins listed in `trustedOrigins` (derived from `CORS_ALLOWED_ORIGINS` + Tauri origins) can make credentialed requests to auth endpoints.

`SameSite=None` does **not** weaken CSRF protection — it only allows the cookie to be sent cross-origin. The origin check still applies on every request.

### Session fixation

Better Auth rotates the session token on sign-in, mitigating session fixation attacks.

### Host-scoped cookies

No `domain` attribute is set on auth cookies. This means cookies are host-only (scoped to the exact API hostname) and will not leak to sibling subdomains. Cross-subdomain sharing requires explicit opt-in via `advanced.crossSubDomainCookies` in `apps/server/src/auth.ts`.

### Local development tradeoff

In local dev the API runs on `http://localhost:3000`. `Secure` cookies are silently dropped over plain HTTP, so cookie-based auth will not work in the Tauri dev build out of the box. Options:

1. Use a local HTTPS proxy (e.g. `mkcert` + `caddy` or `nginx`).
2. Test auth flows against a staging HTTPS environment.
3. Set `BETTER_AUTH_URL` to an `https://` URL if you have a local TLS setup.

---

## Database migrations

### Step order

Migrations must run **after** Terraform apply (infrastructure exists) and **before** ECS task update (new code is deployed). The deploy workflows enforce this order:

```
terraform-apply → migrate → deploy-ecs (ECS task update / SPA deploy)
```

Never run migrations against a database that does not yet exist. Never deploy new server code before its required schema changes are applied.

### Running migrations in CI

Migrations run via:

```sh
bun run --cwd apps/server migrate
```

This calls `drizzle-kit migrate` using `apps/server/drizzle.config.ts`, which reads:

| Env var | Source in CI |
|---|---|
| `TURSO_DATABASE_URL` | Fetched from AWS Secrets Manager (`hay/{env}/TURSO_DATABASE_URL`) |
| `TURSO_AUTH_TOKEN` | Fetched from AWS Secrets Manager (`hay/{env}/TURSO_AUTH_TOKEN`) |

Both values are masked with `::add-mask::` immediately after fetching, before being written to `GITHUB_ENV`. This prevents them from appearing in any subsequent log line.

If either variable is missing and the database URL is not a local URL, the migration command exits with a non-zero code and a clear error message — it will never silently succeed against localhost.

### Smoke test (CI)

The CI workflow runs a non-destructive smoke test:

```sh
bun run --cwd apps/server migrate -- --help
```

This verifies the migration CLI is importable and the config parses without errors, without touching any database. It runs with `continue-on-error: true` because `drizzle-kit` may exit non-zero for `--help` on some versions.

### Rollback

**There is no automatic rollback.** Drizzle Kit does not support down migrations by default.

If a migration causes a problem:

1. **Assess impact** — determine whether the schema change is destructive (column drop, rename) or additive (new column, new table).
2. **Additive changes** — deploy a hotfix that is compatible with both old and new schema, then write a corrective migration.
3. **Destructive changes** — restore from the most recent Turso database backup (contact Turso support or use point-in-time recovery if enabled on the group).
4. **Never** manually edit the `drizzle/__drizzle_migrations` journal table to fake a rollback — this will desync the migration state.

### Token masking

All CI workflows that run migrations follow this pattern:

```sh
VALUE=$(aws secretsmanager get-secret-value \
  --secret-id "hay/{env}/SECRET_NAME" \
  --query SecretString \
  --output text)
echo "::add-mask::$VALUE"          # mask BEFORE writing to env
echo "VAR_NAME=$VALUE" >> "$GITHUB_ENV"
```

`::add-mask::` must be called **before** the value is written to `GITHUB_ENV` or used in any shell expansion. Once masked, the runner redacts the value from all subsequent log output in the job.

---

## Turso database management

### Groups (one-time setup)

Turso databases live inside groups. Groups must be created **before** running `terraform apply` on any stack that uses the turso module. Create them once:

```sh
# Staging group
turso group create hay-staging --location iad

# Production group
turso group create hay-prod --location iad

# Shared preview group (all PR preview databases share this group)
turso group create hay-preview --location iad
```

The group name is passed to each stack via `var.turso_group_name` (defaults: `hay-staging`, `hay-prod`, `hay-preview`).

### Databases (managed by Terraform)

| Stack | Database name | Group |
|---|---|---|
| `infra/envs/staging/` | `hay-staging` | `hay-staging` |
| `infra/envs/production/` | `hay-prod` | `hay-prod` |
| `infra/preview/` (per PR) | `hay-preview-pr-<number>` | `hay-preview` |

Preview databases are created on PR open and destroyed on PR close via `terraform destroy`.

### Turso token rotation workflow

> **Tokens are never stored in Terraform state, variables, or outputs.**

Turso auth tokens are created and rotated out-of-band. After creating or rotating a token, seed it into AWS Secrets Manager manually or via the protected GitHub Actions seed workflow.

**Create a token (initial setup or rotation):**

```sh
# Staging
turso db tokens create hay-staging --expiration none

# Production
turso db tokens create hay-prod --expiration none

# Preview PR (replace 42 with the PR number)
turso db tokens create hay-preview-pr-42 --expiration none
```

**Seed the token into Secrets Manager:**

```sh
# Staging
aws secretsmanager put-secret-value \
  --secret-id hay/staging/TURSO_AUTH_TOKEN \
  --secret-string "<token>"

# Production
aws secretsmanager put-secret-value \
  --secret-id hay/production/TURSO_AUTH_TOKEN \
  --secret-string "<token>"

# Preview PR 42
aws secretsmanager put-secret-value \
  --secret-id hay/preview-pr-42/TURSO_AUTH_TOKEN \
  --secret-string "<token>"
```

**Seed the database URL** (available as a Terraform output after `terraform apply`):

```sh
# Get the URL from Terraform output
terraform -chdir=infra/envs/staging output turso_database_url

# Seed it
aws secretsmanager put-secret-value \
  --secret-id hay/staging/TURSO_DATABASE_URL \
  --secret-string "libsql://<hostname>"
```

**Rotation cadence:**

- Rotate tokens on suspected compromise immediately.
- Rotate production tokens at least every 90 days as a hygiene practice.
- Preview tokens can use `--expiration 7d` instead of `none` to auto-expire with the PR lifecycle.

**Never:**
- Pass tokens as Terraform variables
- Include tokens in `terraform.tfvars` or `.env` files committed to the repo
- Log tokens in CI output

---

## Secret seeding expectations

Secret values are never stored in Terraform configuration, Terraform variables, or Terraform state intentionally.

Terraform is responsible for creating secret names and ARNs only. After Terraform creates those secret containers, seed the actual secret values by one of these protected paths:

- The protected GitHub Actions seed workflow (`.github/workflows/seed-secrets.yml`).
- Manual seeding through the AWS Console.
- Manual seeding through the AWS CLI.

Do not commit secret values, pass them through Terraform, or include them in plan output.

### Protected seed workflow

`.github/workflows/seed-secrets.yml` is a `workflow_dispatch`-only workflow that writes secret values into AWS Secrets Manager. It never runs automatically.

**How it works:**

1. Operator triggers the workflow manually from the GitHub Actions UI.
2. Selects `staging` or `production` as the target environment.
3. GitHub Environment gate fires — required reviewers must approve before the job runs.
4. The job assumes the environment's OIDC role (`STAGING_DEPLOY_ROLE_ARN` or `PRODUCTION_DEPLOY_ROLE_ARN`).
5. Secret values are read from GitHub Actions secrets (never from workflow inputs).
6. All values are masked with `::add-mask::` before any shell expansion.
7. Each secret is written with `aws secretsmanager put-secret-value`.

**Secrets written (per environment):**

| Secret name | GitHub Actions secret |
|---|---|
| `hay/{env}/BETTER_AUTH_SECRET` | `SEED_BETTER_AUTH_SECRET` |
| `hay/{env}/TURSO_AUTH_TOKEN` | `SEED_TURSO_AUTH_TOKEN` |
| `hay/{env}/TURSO_DATABASE_URL` | `SEED_TURSO_DATABASE_URL` |
| `hay/{env}/CORS_ALLOWED_ORIGINS` | `SEED_CORS_ALLOWED_ORIGINS` |
| `hay/{env}/BETTER_AUTH_URL` | `SEED_BETTER_AUTH_URL` |

**Redis/ElastiCache:** No token seeding is required. The ECS task role has IAM permissions to connect directly — no password or auth token is used.

**One-time setup:**

1. In GitHub → Settings → Environments, create `staging` and `production` environments with required reviewers.
2. Add the five `SEED_*` secrets to the repo (Settings → Secrets and variables → Actions).
3. Add `STAGING_DEPLOY_ROLE_ARN` and `PRODUCTION_DEPLOY_ROLE_ARN` as Actions variables (not secrets — they are not sensitive).

**Security properties:**

- Secret values never appear in workflow inputs, logs, or the GitHub UI run summary.
- `::add-mask::` is applied before any AWS CLI call.
- The OIDC role is scoped per environment — staging credentials cannot write production secrets.
- The GitHub Environment gate provides a human approval checkpoint before any write occurs.

---

## Tauri CSP `connect-src` — deployment requirement

`apps/desktop/src-tauri/tauri.conf.json` contains placeholder values in the `connect-src` directive that **must be replaced with actual ECS Express API URLs before shipping a production or staging desktop build**:

| Placeholder | Replace with |
|---|---|
| `https://REPLACE_WITH_PROD_API.ecs.us-east-1.on.aws` | Production ECS Express service URL (from `terraform output api_url` in `infra/envs/production/`) |
| `https://REPLACE_WITH_STAGING_API.ecs.us-east-1.on.aws` | Staging ECS Express service URL (from `terraform output api_url` in `infra/envs/staging/`) |

The current CSP `connect-src` allows:

- `'self'` — same-origin requests (Tauri custom protocol)
- `http://localhost:3000` — local dev API server
- Production ECS Express URL (placeholder — replace before shipping)
- Staging ECS Express URL (placeholder — replace before shipping)

**Rules:**
- Production desktop builds must only list the production API URL in `connect-src` — remove the staging placeholder.
- Staging desktop builds must only list the staging API URL in `connect-src` — remove the production placeholder.
- Do **not** use broad wildcards (`*` or `https:`) in `connect-src`.
- The ECS Express URLs are outputs of the Terraform environment stacks. Retrieve them after `terraform apply` with:

```sh
# Production
cd infra/envs/production && terraform output api_url

# Staging
cd infra/envs/staging && terraform output api_url
```

Update `tauri.conf.json` with the real URLs as part of the desktop release pipeline before bundling.

---

## Static SPA output path for S3 deployment

The web frontend (`apps/web`) is a fully static SPA built with TanStack Start in SPA mode. The verified build output is:

```
apps/web/dist/client/
```

### Verified contents (as of 2026-05-22)

| File / Directory | Description |
|---|---|
| `index.html` | Prerendered SPA shell (entry point for CloudFront) |
| `assets/styles-*.css` | Tailwind CSS bundle (~12.9 kB, ~3.3 kB gzip) |
| `assets/index-*.js` | App entry chunk (~0.2 kB) |
| `assets/index-*.js` | Main app bundle (~188 kB, ~62 kB gzip) |
| `assets/tanstack-libraries-*.js` | TanStack vendor chunk (~106 kB, ~32 kB gzip) |

> **Note:** Asset filenames include a content hash (e.g. `index-DVxwEGNP.js`). The hash changes on every build — always upload the full `dist/client/` directory.

### Build command

```sh
bun run --cwd apps/web build
```

This produces both `dist/client/` (static SPA, deploy this) and `dist/server/` (build-time prerender only — **do not deploy**).

### S3 / CloudFront deployment

- Upload the entire contents of `apps/web/dist/client/` to the S3 bucket root (or the configured prefix).
- Configure CloudFront to serve `index.html` as the default root object.
- Set the CloudFront error page for 403/404 to `/index.html` with HTTP 200 so client-side routing works.
- All assets under `assets/` are content-hashed and can be cached indefinitely (`Cache-Control: max-age=31536000, immutable`).
- `index.html` itself should use a short cache TTL or `no-cache` so new deployments are picked up promptly.
