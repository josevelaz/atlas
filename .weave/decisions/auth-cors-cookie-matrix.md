# Auth, CORS, Cookie, Tauri, and Redis Security Contracts

## Status

Accepted for implementation.

## Context

Hay deploys from a single AWS account in `us-east-1`. DNS zone names are supplied by environment variables:

- `prod_zone_name`
- `staging_zone_name`

API custom domains are deferred. Until custom domains are implemented, production, staging, and preview APIs use ECS Express generated origins.

Tauri desktop is in scope for production and must be treated as a first-class client with explicit security contracts rather than a development-only localhost exception.

## Origin Matrix

| Environment | Web origin | API origin | Notes |
|---|---|---|---|
| Production web | `https://app.<prod_zone_name>` | `https://<service>.ecs.us-east-1.on.aws` | Web served by CloudFront. API uses ECS Express generated URL. Custom API domain deferred. |
| Staging web | `https://app.<staging_zone_name>` | `https://<service>.ecs.us-east-1.on.aws` | Web served by CloudFront. API uses ECS Express generated URL. |
| Preview | CloudFront generated URL per PR | ECS Express generated URL per PR | Preview origins are unique per PR and must be registered exactly for that PR environment. |
| Tauri desktop macOS/Linux | `tauri://localhost` | Production or staging API for the selected build/channel | Explicit production exception to generic localhost rejection. |
| Tauri desktop Windows | `https://tauri.localhost` | Production or staging API for the selected build/channel | Explicit production exception to generic localhost rejection. |

## CORS Rules

- CORS must use an exact origin allowlist per environment.
- Never use wildcard origins with `Access-Control-Allow-Credentials: true`.
- Credentialed requests are allowed only when `Origin` exactly matches the environment allowlist.
- Production allowlist:
  - `https://app.<prod_zone_name>`
  - `tauri://localhost`
  - `https://tauri.localhost`
- Staging allowlist:
  - `https://app.<staging_zone_name>`
  - `tauri://localhost` only for staging desktop builds/channels
  - `https://tauri.localhost` only for staging desktop builds/channels
- Preview allowlist:
  - the exact CloudFront generated web URL for that PR
  - no Tauri origins unless the preview explicitly provisions a desktop test channel
- `localhost`, `127.0.0.1`, and private-network origins must be rejected in production by default.
- Tauri origins are the only explicit exceptions to production localhost-origin rejection.
- Allowed methods, headers, and exposed headers must be intentionally enumerated; avoid reflective header policies where practical.
- `Vary: Origin` must be emitted whenever responses vary by allowed origin.

## Cookie Rules

- Session cookies must set the `Secure` flag.
- Production and staging browser origins must be HTTPS-only.
- Cross-site desktop requests from Tauri custom protocol origins require `SameSite=None; Secure`.
- Cookie domain must be scoped to the API host only.
- Do not use a broad parent domain that could bleed cookies across production, staging, or preview environments.
- Preview cookies must be isolated to the preview API host.
- CSRF validation is required for authenticated state-changing requests.
- CSRF validation must not be bypassed solely because a request origin is allowlisted.
- Cookie names should be environment-scoped if the auth library supports it, to reduce accidental cross-environment confusion during testing.

## Session Fixation Validation Before Production Desktop Release

Before shipping production desktop auth, validate and record evidence for all of the following:

1. Signing in rotates the session identifier issued before authentication.
2. Privilege changes, account linking, password changes, and MFA enrollment rotate or invalidate existing sessions as appropriate.
3. Sign-out invalidates the server-side session and prevents reuse of the previous cookie/session token.
4. Re-authentication after expiration or revocation receives a new session identifier.
5. Tauri desktop flows cannot preserve or inject a pre-authenticated session identifier across sign-in.
6. Session cookies/tokens are not accepted from another environment or preview deployment.
7. CSRF validation remains enforced for desktop-origin authenticated mutations.

Production desktop release is blocked until this validation is complete.

## Redis/Valkey Security Contracts

- Redis/Valkey must use TLS in transit wherever ElastiCache supports it.
- Redis/Valkey must use ElastiCache IAM authentication; the ECS task role authenticates directly to Redis/Valkey.
- No Redis/Valkey auth token material may be generated, stored in Terraform state, seeded to Secrets Manager, or managed anywhere else.
- Redis/Valkey security groups must restrict inbound access to ECS task security groups only.
- No public Redis/Valkey ingress is allowed.
- Every environment and PR preview must use a distinct key prefix.
- All Redis/Valkey access must go through a single wrapper that applies the environment/PR key prefix.
- Direct Redis key construction or bypassing the wrapper is prohibited.
- The wrapper must make prefix omission difficult or impossible at the type/API level.
- Operational commands that enumerate or delete keys must be scoped to the current environment/PR prefix.

## Tauri CSP Contracts

Tauri builds must use narrow `connect-src` values. Do not use broad `https:`.

### Production Desktop Build

```text
default-src 'self'; connect-src https://<production-service>.ecs.us-east-1.on.aws; img-src 'self' data:
```

- Connects only to the production API.
- Does not allow staging, preview, arbitrary HTTPS, or localhost APIs.

### Staging Desktop Build

```text
default-src 'self'; connect-src https://<staging-service>.ecs.us-east-1.on.aws; img-src 'self' data:
```

- Connects only to the staging API.
- Does not allow production, preview, arbitrary HTTPS, or localhost APIs.

### Preview Desktop Builds

Preview desktop builds are not enabled by default. If introduced, each preview build must set `connect-src` to that PR's exact ECS Express generated API URL only.

## Implementation Requirements

- Auth server trusted origins, API CORS allowlists, cookie configuration, CSRF enforcement, Redis/Valkey wrapper configuration, and Tauri CSP must all be generated from environment-specific configuration rather than duplicated ad hoc.
- Security reviews must verify that production does not accept arbitrary localhost origins and that Tauri origins are intentional explicit exceptions.
- Release checks must verify the deployed CloudFront and ECS Express generated URLs match the configured allowlists for that environment.
