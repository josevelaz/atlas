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

## Secret seeding expectations

Secret values are never stored in Terraform configuration, Terraform variables, or Terraform state intentionally.

Terraform is responsible for creating secret names and ARNs only. After Terraform creates those secret containers, seed the actual secret values by one of these protected paths:

- The protected GitHub Actions seed workflow.
- Manual seeding through the AWS Console.
- Manual seeding through the AWS CLI.

Do not commit secret values, pass them through Terraform, or include them in plan output.
