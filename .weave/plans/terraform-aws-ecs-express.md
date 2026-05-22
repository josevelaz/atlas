# Terraform AWS ECS Express Deployment

## TL;DR
> **Summary**: Add Terraform-managed AWS deployment for the Bun/Elysia API on ECS Express Mode, the Solid/TanStack Start static SPA on S3 + CloudFront, Turso-managed databases, Secrets Manager-backed runtime secrets, GitHub Actions CI/CD, and ephemeral PR previews.
> **Estimated Effort**: Large

## Context
### Current repository
- Bun/Turborepo monorepo.
- `apps/server`: Bun + Elysia API. Existing Dockerfile builds only this app and runs `bun run start` from `apps/server`.
- `apps/web`: SolidJS + TanStack Start static SPA.
- `apps/desktop`: Tauri v2 shell loading the web build.
- No Terraform/IaC or GitHub Actions currently exists.
- Database target is Turso, not AWS RDS.

### Deployment target
- AWS owns application infrastructure: ECS Express Mode, ECR, VPCs, S3, CloudFront, Route 53, ACM, ElastiCache/Valkey, CloudWatch Logs, Secrets Manager, IAM/OIDC.
- Turso owns database infrastructure. Terraform may manage Turso databases/groups, but Turso auth tokens are created/rotated outside Terraform and stored in AWS Secrets Manager outside Terraform state.
- API runs as the existing Bun/Elysia workload in a container on AWS ECS Express Mode using `aws_ecs_express_gateway_service`.
- Frontend deploys as a static SPA to S3 + CloudFront with environment-specific build-time API URL.
- Desktop/Tauri remains supported through CORS, Better Auth trusted origins/cookie config, and Tauri CSP `connect-src` for staging/production APIs.

### Naming and environment strategy
- AWS account model: one AWS account initially. Compensating controls are mandatory: separate preview/staging/production deploy roles, separate state keys, tag-conditioned preview permissions, scoped Secrets Manager permissions, AWS-managed KMS keys, and no preview role access to production/staging secrets or production resources.
- AWS region: `us-east-1` for production, staging, and previews initially.
- Long-lived environments: `staging`, `production`.
- Ephemeral previews: one `preview/pr-<number>` environment per open same-repo PR after a trusted maintainer applies the GitHub `preview` label.
- Remote Terraform state keys are separate for `staging`, `production`, and each `preview/pr-<number>`.
- VPCs: separate production and nonproduction VPCs; staging and previews share the nonproduction VPC.
- Redis/Valkey: production and staging have environment Redis. Previews share staging/nonproduction Redis and must use key prefixes.
- S3 isolation: production bucket; shared nonproduction bucket using prefixes `staging/` and `previews/pr-<number>/`.
- DNS uses required Route 53 variables `prod_zone_name` and `staging_zone_name`; exact zone names are supplied during implementation and must not be hardcoded in this plan or Terraform examples:
  - Production: `app.<prod-zone>`, `api.<prod-zone>`.
  - Staging: `app.<staging-zone>`, `api.<staging-zone>`.
  - Previews: deterministic PR-specific CloudFront/API origins unless Phase 0 approves preview custom domains.

### Resolved Phase 0 decisions to carry into implementation
- Terraform CLI only; do not use OpenTofu. Pin providers in every stack. Target AWS provider `>= 6.43.0` or a similarly pinned recent v6 provider because `aws_ecs_express_gateway_service` was added in v6.23.0 and later fixes are required.
- ECS Express is available in `us-east-1`; keep ECS Express as the target unless the Phase 0 API custom-domain spike proves safe custom domains are not automatable.
- `aws_ecs_express_gateway_service` does not provide first-class custom-domain support. Validate a safe path for `api.<env-zone>` before implementation; if not safe, choose explicitly between deferring the API custom domain or switching API hosting to raw ECS/ALB. Do not ad-hoc mutate Express-generated ALB resources in a drift-prone way.
- Terraform manages secret names, ARNs, IAM permissions, AWS-managed KMS key usage, and ECS secret references only. Secret values are seeded through a protected manual GitHub Actions workflow using AWS OIDC and GitHub Environment approval. No secret values may appear in Terraform variables, state, plans, logs, docs comments, or PR comments. Customer-managed KMS keys are intentionally deferred.
- GitHub Actions uses a two-workflow preview safety model. All PRs, including forks, run only unprivileged `pull_request` checks. Privileged preview deploys run only from a maintainer-approved path (`workflow_dispatch` and/or protected GitHub Environment approval), check out only same-repo PR branches, and require all of: `head.repo.full_name == github.repository`, exact `preview` label present, trusted maintainer/write-permission actor/deployer, no AWS credentials for fork PRs, and no unsafe `pull_request_target` checkout of untrusted code.
- Preview DB seed source is a sanitized template Turso DB only. Maintainers update the template via a protected workflow that records audit/evidence before previews may seed from it. The template must exclude emails, names, OAuth IDs, provider account IDs, access/refresh tokens, user content, auth sessions, and production/staging-derived message data.
- Turso provider may manage groups/databases. Turso tokens are created outside Terraform and written to Secrets Manager by the protected secret-seeding workflow.
- CORS and Better Auth origins must be exact deterministic allowlists including scheme, host, and optional port. No wildcard origins with credentials. Preview origins are PR-specific. Tauri custom protocols are explicit exceptions, not broad localhost allowances.
- Cookies are scoped to the API host, Secure/HTTPS only, and require explicit CSRF/session-fixation validation.
- Terraform plan output in PR comments must be sanitized allowlisted summaries only, generated from explicit allowlisted fields/redaction tooling. Never paste raw `terraform show` output into comments. Binary/JSON plan artifacts are retained exactly 1 day with restricted GitHub Actions artifact access. Sensitive outputs must be marked `sensitive`.
- Static web buckets are private with public access blocked and mandatory CloudFront Origin Access Control. Deploy roles can write only scoped environment/prefix paths.
- Tauri CSP must use exact per-environment `connect-src`: production desktop builds may reach only production API/required endpoints; staging builds may reach only staging API/required endpoints. Do not use broad `https:`.
- Redis/Valkey must use TLS/auth where supported, security group restrictions, and per-env/PR key prefixes. Redis/ElastiCache auth token values must not be Terraform-managed or stored in Terraform state; seed/rotate them out-of-band into AWS Secrets Manager where possible. If required ElastiCache auth cannot be configured without secret-in-state, block implementation or document an explicit security exception with compensating controls. Implement one Redis wrapper/prefix discipline covering direct Redis, jobify, and verrou.
- GitHub Actions builds/pushes the server image. Terraform owns ECS updates using an immutable image digest/tag variable.
- Terraform provisions S3/CloudFront/IAM. CI builds/uploads web artifacts using Terraform outputs and invalidates CloudFront.
- Drizzle migration failure stops before ECS image or web update. No automatic migration rollback. If post-migration app deploy fails, operators manually roll back/forward using the recorded prior image digest and migration notes.
- Pre-existing dirty file: `apps/web/src/routeTree.gen.ts` must be inspected and separately committed, stashed, or reverted before deployment implementation starts. It must not be mixed into infra commits.
- Observability scope is logs only initially: 30-day retention for production/staging, 7-day retention for previews.
- Frontend changes require `npx agent-browser` validation after the app builds and runs, per repo instruction.

## Objectives
### Core objective
Create an execution-ready implementation path for Terraform-based AWS deployment without changing application behavior beyond required deployment readiness, security hardening, health checks, and environment configuration.

### Deliverables
- [ ] Terraform infrastructure under `infra/` with reusable modules plus thin stacks: `infra/bootstrap`, `infra/env`, `infra/preview`.
- [ ] Bootstrap stack for S3 remote state/locking and GitHub OIDC deploy roles.
- [ ] AWS ECS Express Mode API deployment using `aws_ecs_express_gateway_service`.
- [ ] ECR repository and immutable SHA-tagged/digest image deployment flow.
- [ ] S3 + CloudFront static SPA hosting for staging/production and previews.
- [ ] Route 53 + ACM custom-domain wiring for staging/production.
- [ ] VPC, security groups, and ElastiCache/Valkey topology for production and nonproduction.
- [ ] Secrets Manager names/permissions/ARN injection, with no secret values in Terraform state.
- [ ] Turso provider usage for database/group resources, with token lifecycle explicitly outside Terraform.
- [ ] GitHub Actions workflows for gates, Terraform plan/apply, Docker image build/push, migrations, web upload, preview create/update/destroy, and scheduled cleanup.
- [ ] Server changes for shallow `/health`, Redis namespace configuration, S3 bucket/region/prefix/task-role access, production CORS/trusted origins, and deployment env validation.
- [ ] Web changes for build-time API URL per environment/preview.
- [ ] Desktop/Tauri changes for production API `connect-src` and auth/CORS compatibility.
- [ ] Concise ADRs under `docs/adr/` for the key deployment decisions.
- [ ] Security review after implementation planning and again before merge, because the work touches secrets, auth, CORS, IAM, and token boundaries.

### Guardrails
- Do not treat ECS Express Mode as Express.js. The API remains Bun/Elysia.
- Do not put Turso tokens, Better Auth secrets, S3 access keys, or OAuth/provider secrets in Terraform variables, `.tfvars`, logs, plans, or state.
- Do not create long-lived S3 access keys for the ECS task unless task-role access is impossible and explicitly approved.
- Do not deep-check Turso or Redis in `/health`; it must stay unauthenticated and shallow for ECS health checks.
- Do not use `CONTEXT.md` for implementation details. Only add glossary content if new domain terms are introduced.
- Do not deploy production without GitHub Environment approval.
- Do not make preview resources share production VPC, production Redis, production buckets, production Turso DBs, or production secrets.
- Do not allow preview state collisions; every preview state key must include the PR number.
- Do not proceed past Phase 0 until Warp and Weft re-review the amended plan and remove their BLOCK findings.
- Do not use `|| true` on validation gates. If a local prerequisite is missing, the task must fail with an explicit blocker and owner.
- Do not use macOS-incompatible `timeout` in validation commands.
- Do not manage Redis/ElastiCache auth token values in Terraform state. If a provider/resource path would leak auth tokens to state, stop or obtain a documented security exception with compensating controls.
- Do not use `pull_request_target` to check out or execute untrusted PR code in privileged preview workflows.
- Do not publish raw Terraform plans or `terraform show` output in PR comments.

## Proposed file layout
```text
infra/
  README.md
  bootstrap/
    main.tf
    variables.tf
    outputs.tf
    versions.tf
  env/
    main.tf
    variables.tf
    outputs.tf
    versions.tf
    backend.tf.example
    envs/
      staging.tfvars.example
      production.tfvars.example
  preview/
    main.tf
    variables.tf
    outputs.tf
    versions.tf
    backend.tf.example
  modules/
    github-oidc/
    remote-state/
    network/
    ecs-express-api/
    ecr/
    redis/
    static-spa/
    dns-acm/
    secrets/
    turso/
.github/
  workflows/
    ci.yml
    deploy-staging.yml
    deploy-production.yml
    preview.yml
    preview-cleanup.yml
docs/
  adr/
    0006-use-ecs-express-and-aws-managed-app-infra.md
    0007-use-staging-production-and-pr-preview-environments.md
    0008-define-terraform-turso-and-secrets-boundaries.md
apps/server/
  src/**
  .env.example
apps/web/
  src/**
  .env.example
apps/desktop/src-tauri/
  tauri.conf.json
```

## Execution milestones and gates

- **Gate 0 — Blocking decisions/validation**: Complete Phase 0, including the API custom-domain spike and explicit security decision records. Owner: infra implementer with Warp/Weft reviewers. Inputs: this plan, AWS/Terraform provider docs, existing repo status, domain/delegation details, GitHub environment/role names. Acceptance: every Phase 0 task is complete, the ECS Express custom-domain path is approved or an alternative is chosen, and Warp/Weft re-review removes BLOCK.
- **Gate 1 — ADR/docs foundation**: Complete Phase 1 before editing app or Terraform runtime code. ADRs must match the existing repository style: concise `# Title` plus prose, not mandatory Status/Context/Decision/Consequences headings.
- **Gate 2 — App readiness**: Complete server/web/desktop readiness Phases 2–3 before infra workflows depend on those contracts.
- **Gate 3 — Terraform foundation**: Complete modules and stacks Phases 4–5 before GitHub Actions deploy workflows use their outputs. Stacks must run `terraform init -backend=false` before every local `terraform validate`.
- **Gate 4 — CI/CD handoff**: Complete Phases 6–7 after Terraform outputs exist. Workflows must encode image digest, migration, web upload, and rollback handoff ordering.
- **Gate 5 — E2E/reviews**: Complete Phases 8–9 before merge. Warp/Weft security block remains a hard gate until re-reviewed.

## Validation command policy

- Use deterministic, non-silent gates. No `|| true` on required checks.
- If `actionlint` is required, use `npx actionlint ...`; if unavailable, stop and record a blocker instead of silently passing.
- For Terraform stacks, run `terraform -chdir=<stack> init -backend=false` before `terraform -chdir=<stack> validate` in each validation block.
- For local server smoke tests, use shell PID/trap cleanup instead of macOS `timeout`.
- Terraform `plan` commands used as gates must fail on errors and must not publish raw plan output to comments/logs beyond restricted artifacts.

## Phases and atomic tasks

### Phase 0 — Blocking decisions, validation spikes, and current-state capture

> **Hard gate**: This phase must complete before implementation. Owners must record inputs, outcomes, and acceptance evidence in implementation notes or ADRs. Warp/Weft BLOCK remains in force until this amended plan and Phase 0 outputs are re-reviewed.

- [ ] 0.1 Confirm repo/worktree baseline
  **Owner**: implementation lead.
  **What**: Verify the executor is in the intended worktree, capture current status, and avoid mixing unrelated changes. Specifically inspect `apps/web/src/routeTree.gen.ts` and commit, stash, or revert it separately before infra implementation begins.
  **Files likely touched**: none.
  **Commands**:
  ```sh
  git rev-parse --show-toplevel
  git rev-parse --is-bare-repository
  git worktree list --porcelain
  git status --short
  ```
  **Acceptance**: Baseline state is documented; `apps/web/src/routeTree.gen.ts` is not mixed into infra commits.

- [ ] 0.2 Capture current app validation baseline
  **What**: Run existing gates before infrastructure changes so regressions are attributable.
  **Files likely touched**: none.
  **Commands**:
  ```sh
  bun install --frozen-lockfile
  bun run lint
  bun run typecheck
  bun run build
  docker build -t hay-server-baseline .
  bun run --cwd apps/web build
  bun run --cwd apps/desktop info
  ```
  **Acceptance**: Existing failures, if any, are recorded before editing files; missing Tauri prerequisites are explicit blockers, not silently ignored.

- [ ] 0.3 Inventory deployment-sensitive code paths
  **What**: Locate current env parsing, auth config, CORS config, Redis clients, jobify/verrou usage, S3 clients, Drizzle config, server entrypoint, and web API URL wiring.
  **Files likely touched**: none.
  **Commands**:
  ```sh
  grep -R "REDIS_HOST\|ioredis\|jobify\|verrou\|S3_\|trustedOrigins\|cors\|CORS_ALLOWED_ORIGINS\|BETTER_AUTH\|TURSO\|LIBSQL\|drizzle" -n apps package.json Dockerfile
  ```
  **Acceptance**: Concrete files to edit in later phases are listed in implementation notes.

- [ ] 0.4 Record single-account AWS isolation model
  **Owner**: infra/security owner.
  **Inputs**: AWS account ID, GitHub repo/environment names, planned state key names, production/nonproduction resource names.
  **What**: Document strict separation within one AWS account: preview/staging/prod OIDC roles, state keys, AWS-managed KMS usage, strict Secrets Manager ARN/path scopes, tag-conditioned preview permissions, and no preview role access to production resources or production/staging secrets.
  **Files likely touched**: `docs/adr/0007-use-staging-production-and-pr-preview-environments.md`, `docs/adr/0008-define-terraform-turso-and-secrets-boundaries.md`, `infra/README.md`.
  **Acceptance**: ADRs/README state the compensating controls and role/resource boundaries clearly enough for Warp review.

- [ ] 0.5 Validate ECS Express provider/region/API-domain path
  **Owner**: infra owner.
  **Inputs**: AWS provider changelog/docs, AWS ECS Express regional availability for `us-east-1`, Route 53 zones, desired `api.<prod-zone>` and `api.<staging-zone>` hostnames.
  **What**: Confirm `aws_ecs_express_gateway_service` is usable with AWS provider `>= 6.43.0` and spike the safe custom-domain path for API hostnames.
  **Commands**:
  ```sh
  terraform version
  npx ctx7@latest library "Terraform AWS Provider" "aws_ecs_express_gateway_service custom domain support and provider version"
  npx ctx7@latest docs /hashicorp/terraform-provider-aws "aws_ecs_express_gateway_service custom domain support provider version 6.43.0"
  ```
  **Acceptance**: ECS Express stays the target only if the API custom-domain path is safe and automatable. Otherwise an explicit decision is made to defer API custom domains or switch API to raw ECS/ALB. No plan may customize Express-generated ALB resources ad hoc.

- [ ] 0.6 Record DNS/environment zone model
  **Owner**: infra owner.
  **Inputs**: delegated production and staging Route 53 zone names.
  **What**: Record the exact environment subdomain zones and hostnames derived from required variables `prod_zone_name` and `staging_zone_name`: `app.<prod-zone>`, `api.<prod-zone>`, `app.<staging-zone>`, `api.<staging-zone>`. Exact hosted zone names are supplied at implementation time, not hardcoded in the plan or module examples.
  **Acceptance**: Terraform variables and ADRs use required variables `prod_zone_name` and `staging_zone_name` plus the resolved `app.<zone>` / `api.<zone>` naming convention.

- [ ] 0.7 Record secrets/Turso/preview trust model
  **Owner**: security/platform owner.
  **Inputs**: GitHub Environment approval policy, protected manual workflow design, Turso sanitized template DB owner, Secrets Manager/KMS scope.
  **What**: Document protected secret seeding, Turso token lifecycle outside Terraform, Redis/ElastiCache auth token lifecycle outside Terraform state, same-repo preview label trust, fork PR non-privileged behavior, and sanitized template-only preview DB seeding. Define the two-workflow preview safety model: unprivileged `pull_request` checks for every PR; privileged preview deploy only via maintainer-approved `workflow_dispatch` and/or protected environment approval. The privileged path must check out only same-repo PR branches and require `head.repo.full_name == github.repository`, exact `preview` label, and actor/deployer write or maintainer trust.
  **Acceptance**: No task later in the plan requires secret values in Terraform, raw prod/staging data in previews, AWS credentials for fork PRs, or unsafe `pull_request_target` checkout of untrusted code.

- [ ] 0.8 Record auth/CORS/cookie/Tauri/Redis security contracts
  **Owner**: app/security owner.
  **Inputs**: production/staging/preview origins, Tauri desktop origins, Redis/Valkey capabilities, Better Auth config surface.
  **What**: Record the computed origin matrix before implementation: web origins, API origins, preview origin pattern, Tauri origins (`tauri://localhost`, `https://tauri.localhost`), cookie domain/path/SameSite/Secure rules, CSRF validation steps, session-fixation validation steps, exact Tauri CSP `connect-src`, Redis TLS/auth where supported, SG restrictions, and single Redis prefix wrapper discipline.
  **Acceptance**: Phases 2–4 have concrete env var names, the origin/cookie/CSRF/session matrix is recorded, and acceptance criteria are ready for Warp review.

- [ ] 0.10 Record Terraform plan/comment/artifact policy
  **Owner**: infra/security owner.
  **Inputs**: GitHub Actions artifact retention/access behavior, Terraform JSON plan shape, redaction/allowlist tooling design.
  **What**: Define plan handling before any workflow implementation. PR comments and job summaries may include only sanitized allowlisted summaries generated from explicit fields/redaction tooling. Never publish raw `terraform show` output. Binary/JSON plan artifacts are retained exactly 1 day with restricted GitHub Actions artifact access.
  **Acceptance**: Workflow tasks have a concrete redaction/allowlist mechanism and retention setting; raw plans are restricted artifacts only.

- [ ] 0.11 Record KMS/IAM secret isolation model
  **Owner**: infra/security owner.
  **Inputs**: Secrets Manager path/ARN convention, preview/staging/production role names, AWS-managed KMS behavior.
  **What**: Use AWS-managed KMS keys rather than customer-managed keys. Compensate with strict Secrets Manager ARN/path IAM, role separation, and explicit denial/no access from preview roles to production and staging secrets. Note that CMK-level encryption-context controls are intentionally deferred.
  **Acceptance**: IAM design proves preview roles cannot read prod/staging secrets and documents the deferred CMK encryption-context tradeoff.

- [ ] 0.12 Re-review Phase 0 outputs with Warp and Weft
  **Owner**: implementation lead.
  **What**: Request Warp security review and Weft quality review after Phase 0 decisions/spikes are recorded.
  **Acceptance**: No implementation starts while either reviewer remains BLOCK.

### Phase 1 — ADRs and deployment docs skeleton

- [ ] 1.1 Add ADR for ECS Express + AWS-managed app infra
  **What**: Create a concise ADR matching existing `docs/adr/` style explaining why app infra is AWS-managed, why API uses ECS Express Mode, and why Turso remains the database provider.
  **Files likely touched**: `docs/adr/0006-use-ecs-express-and-aws-managed-app-infra.md`.
  **Validation**:
  ```sh
  grep -n "^# " docs/adr/0006-use-ecs-express-and-aws-managed-app-infra.md
  test -s docs/adr/0006-use-ecs-express-and-aws-managed-app-infra.md
  ```
  **Acceptance**: ADR follows existing repo style: one `# Title` and concise prose covering context, decision, and consequences without requiring `Status`, `Context`, `Decision`, or `Consequences` headings.

- [ ] 1.2 Add ADR for environment and preview strategy
  **What**: Document staging/production, ephemeral previews, state key separation, nonprod sharing rules, custom domains, and preview cleanup lifecycle.
  **Files likely touched**: `docs/adr/0007-use-staging-production-and-pr-preview-environments.md`.
  **Validation**:
  ```sh
  grep -n "^# " docs/adr/0007-use-staging-production-and-pr-preview-environments.md
  test -s docs/adr/0007-use-staging-production-and-pr-preview-environments.md
  ```
  **Acceptance**: ADR follows existing repo style and explicitly states prod/nonprod VPC split, staging/preview nonprod sharing, preview label behavior, and production approval gate.

- [ ] 1.3 Add ADR for Terraform/Turso/secrets boundaries
  **What**: Document what Terraform manages, what Terraform references only by ARN/name, and what is created/rotated outside Terraform.
  **Files likely touched**: `docs/adr/0008-define-terraform-turso-and-secrets-boundaries.md`.
  **Validation**:
  ```sh
  grep -n "^# " docs/adr/0008-define-terraform-turso-and-secrets-boundaries.md
  test -s docs/adr/0008-define-terraform-turso-and-secrets-boundaries.md
  ```
  **Acceptance**: ADR follows existing repo style and states Turso tokens, Redis/ElastiCache auth tokens, and other secret values are never stored in Terraform state and are written to AWS Secrets Manager outside Terraform where possible.

- [ ] 1.4 Add infrastructure README skeleton
  **What**: Add operator-oriented docs for bootstrap order, env stacks, preview stack, required local tools, state keys, and secret seeding expectations.
  **Files likely touched**: `infra/README.md`.
  **Validation**:
  ```sh
  test -f infra/README.md
  ```
  **Acceptance**: README is enough for a new operator to know bootstrap precedes env/preview and where secret values must be seeded manually/through CI.

### Phase 2 — Server deployment readiness

- [ ] 2.1 Add shallow unauthenticated `/health`
  **What**: Add an API health route that returns a static success payload and does not require auth or check Turso/Redis/S3.
  **Files likely touched**: `apps/server/src/index.ts`, `apps/server/src/server.ts`, route/plugin files under `apps/server/src/**`.
  **Validation**:
  ```sh
  bun run --cwd apps/server lint
  bun run --cwd apps/server typecheck
  bun run --cwd apps/server start &
  server_pid=$!
  trap 'kill "$server_pid"' EXIT
  sleep 3
  curl -fsS http://localhost:3000/health
  kill "$server_pid"
  ```
  **Acceptance**: `GET /health` returns 2xx without auth and remains shallow.

- [ ] 2.2 Extend Redis env config
  **What**: Add TLS/auth-aware Redis configuration (`REDIS_PORT`, `REDIS_KEY_PREFIX`, and TLS/auth URL or equivalent settings); preserve existing `REDIS_HOST`; define defaults only where safe for local dev.
  **Files likely touched**: `apps/server/src/**`, `apps/server/.env.example`, deployment env docs.
  **Validation**:
  ```sh
  REDIS_HOST=localhost REDIS_PORT=6379 REDIS_KEY_PREFIX=local: bun run --cwd apps/server typecheck
  ```
  **Acceptance**: Env parsing accepts host, port, TLS/auth config or URL, and key prefix; missing production prefix is treated as invalid or explicitly guarded.

- [ ] 2.3 Namespace Redis/ioredis usage
  **What**: Ensure all direct `ioredis` keys are prefixed with `REDIS_KEY_PREFIX` through a shared helper/wrapper.
  **Files likely touched**: Redis client/helpers and any direct Redis usage in `apps/server/src/**`.
  **Validation**:
  ```sh
  grep -R "redis\.\|new Redis\|ioredis" -n apps/server/src
  bun run --cwd apps/server typecheck
  ```
  **Acceptance**: Direct key construction cannot bypass the configured prefix without an explicit, reviewed exception.

- [ ] 2.4 Namespace jobify/verrou Redis usage
  **What**: Configure jobify and verrou through the same Redis wrapper/prefix discipline so queue/lock keys include the environment/preview prefix.
  **Files likely touched**: job/queue/lock setup files in `apps/server/src/**`.
  **Validation**:
  ```sh
  grep -R "jobify\|verrou" -n apps/server/src
  bun run --cwd apps/server typecheck
  ```
  **Acceptance**: Staging and previews can safely share nonprod Redis without key collisions.

- [ ] 2.5 Replace/minimize S3 long-lived key assumptions
  **What**: Add app config for S3 bucket, region, and key prefix; prefer AWS SDK default credential provider/task role over access key envs. Keep local/minio endpoint support only if currently needed.
  **Files likely touched**: S3 service/client files in `apps/server/src/**`, `apps/server/.env.example`.
  **Validation**:
  ```sh
  grep -R "S3_\|AWS_ACCESS_KEY_ID\|AWS_SECRET_ACCESS_KEY" -n apps/server/src apps/server/.env.example
  bun run --cwd apps/server typecheck
  ```
  **Acceptance**: Runtime config supports `S3_BUCKET`, `S3_REGION`, and `S3_PREFIX`; ECS can use task-role credentials without long-lived S3 keys.

- [ ] 2.6 Harden production CORS and Better Auth origins
  **What**: Make CORS/trusted origins explicit for web, API, staging/prod custom domains, PR-specific preview URLs, and Tauri production origins (`tauri://localhost`, `https://tauri.localhost`). Use full scheme/host/optional port, no wildcard with credentials, and no broad localhost except explicit Tauri custom-protocol exceptions.
  **Files likely touched**: `apps/server/src/auth.ts`, CORS plugin/config files, `apps/server/.env.example`.
  **Validation**:
  ```sh
  bun run --cwd apps/server typecheck
  grep -R "tauri://localhost\|https://tauri.localhost\|trustedOrigins\|credentials" -n apps/server/src apps/server/.env.example
  ```
  **Acceptance**: Production/staging origins are allowlisted exactly, preview origins are deterministic per PR, and Tauri origins are included where auth requires them.

- [ ] 2.7 Validate Better Auth cookie behavior for desktop/web
  **What**: Keep cookie sessions, but configure/verify host-scoped Secure HTTPS cookies and `SameSite=None; Secure` where cross-origin desktop/web flows require it; explicitly validate CSRF and session-fixation behavior.
  **Files likely touched**: `apps/server/src/auth.ts`, `apps/server/.env.example`, `infra/README.md`.
  **Validation**:
  ```sh
  bun run --cwd apps/server typecheck
  grep -R "sameSite\|SameSite\|secure\|trustedOrigins" -n apps/server/src docs infra apps/server/.env.example
  ```
  **Acceptance**: Auth session cookies are scoped to API hosts, CSRF/session-fixation checks are documented, and this task is reviewed by security.

### Phase 3 — Web and desktop deployment readiness

- [ ] 3.1 Add web API URL env contract
  **What**: Ensure `apps/web` reads a build-time API base URL per environment/preview and documents required variables.
  **Files likely touched**: `apps/web/src/**`, `apps/web/.env.example`.
  **Validation**:
  ```sh
  API_BASE_URL=https://api.staging.example.test bun run --cwd apps/web build
  grep -R "API_BASE_URL\|VITE_.*API" -n apps/web/src apps/web/.env.example
  ```
  **Acceptance**: Static SPA build can target staging, production, or a preview API URL without code edits.

- [ ] 3.2 Configure Tauri production CSP connect sources
  **What**: Update Tauri CSP to allow only exact approved per-build API origins and preserve strict defaults for other sources. Production desktop builds may reach only production API/required endpoints; staging builds may reach only staging API/required endpoints.
  **Files likely touched**: `apps/desktop/src-tauri/tauri.conf.json`.
  **Validation**:
  ```sh
  bun run --cwd apps/desktop info
  bun run --cwd apps/desktop typecheck
  grep -n "connect-src\|api\." apps/desktop/src-tauri/tauri.conf.json
  ```
  **Acceptance**: CSP includes exact `connect-src` entries and does not broadly allow `*` or `https:`.

- [ ] 3.4 Validate frontend changes in browser
  **What**: After frontend/API URL changes, run the web app locally or use the staging web app and validate deterministically that it does not error and points to the expected API origin. `npx agent-browser --help` may be used only as an availability precheck; it is not sufficient acceptance evidence.
  **Files likely touched**: none unless fixing validation failures.
  **Validation**:
  ```sh
  bun run --cwd apps/web build
  bun run --cwd apps/web dev &
  web_pid=$!
  trap 'kill "$web_pid"' EXIT
  npx agent-browser --help
  npx agent-browser open http://localhost:3001 --screenshot /tmp/hay-web-validation.png
  kill "$web_pid"
  ```
  **Acceptance**: Implementer runs `npx agent-browser` against a running local or staging web UI after frontend changes and records deterministic result/evidence such as checked URL, console status, expected API origin, screenshot, or trace. Availability precheck alone does not satisfy acceptance; failures block merge.

- [ ] 3.3 Validate static SPA output path for deployment
  **What**: Confirm the build output to upload to S3/CloudFront, expected `apps/web/dist/client` based on current monorepo notes.
  **Files likely touched**: `infra/README.md`, GitHub Actions workflow env later.
  **Validation**:
  ```sh
  bun run --cwd apps/web build
  test -f apps/web/dist/client/index.html
  ```
  **Acceptance**: Deployment workflow uses the verified static output path, not a guessed TanStack Start output.

### Phase 4 — Terraform foundation and modules

- [ ] 4.1 Add Terraform versions and provider constraints
  **What**: Establish Terraform CLI decision, pinned AWS provider (`>= 6.43.0` or similarly pinned recent v6), Turso provider version, and required provider aliases if needed. Do not support OpenTofu in this plan.
  **Files likely touched**: `infra/**/versions.tf`, `infra/README.md`.
  **Validation**:
  ```sh
  terraform -chdir=infra/bootstrap fmt -check -recursive
  terraform -chdir=infra/bootstrap init -backend=false
  terraform -chdir=infra/bootstrap validate
  ```
  **Acceptance**: Every stack has provider constraints and validates with backend disabled before backend exists.

- [ ] 4.2 Implement remote-state bootstrap module/stack
  **What**: Create S3 backend bucket, encryption, versioning, public access block, and Terraform locking support appropriate for current Terraform AWS backend locking. Output backend config values.
  **Files likely touched**: `infra/bootstrap/**`, `infra/modules/remote-state/**`.
  **Validation**:
  ```sh
  terraform -chdir=infra/bootstrap fmt -check -recursive
  terraform -chdir=infra/bootstrap init -backend=false
  terraform -chdir=infra/bootstrap validate
  terraform -chdir=infra/bootstrap plan -out=tfplan
  ```
  **Acceptance**: Bootstrap plan creates only remote-state/locking resources and outputs backend settings.

- [ ] 4.3 Implement GitHub OIDC IAM module
  **What**: Create deploy roles for preview, staging, and production with least-privilege trust policies scoped to repo, refs/environments, labels, tags, and workflow needs. Preview permissions must be tag-conditioned and unable to access production resources, production/staging Secrets Manager paths/ARNs, buckets, or state. Use AWS-managed KMS keys, not CMKs; compensate with strict Secrets Manager ARN/path IAM, role separation, and explicit denial/no access from preview roles to production/staging secrets.
  **Files likely touched**: `infra/bootstrap/**`, `infra/modules/github-oidc/**`.
  **Validation**:
  ```sh
  terraform -chdir=infra/bootstrap fmt -check -recursive
  terraform -chdir=infra/bootstrap init -backend=false
  terraform -chdir=infra/bootstrap validate
  terraform -chdir=infra/bootstrap plan -out=tfplan
  ```
  **Acceptance**: Roles are separate; production trust is environment/ref constrained; preview roles cannot read prod/staging secrets or state; outputs expose role ARNs for GitHub secrets/variables; CMK-level encryption-context controls are intentionally deferred and documented.

- [ ] 4.4 Implement network module
  **What**: Create production and nonproduction VPC/network resources sufficient for ECS Express and Redis, with outputs consumed by env/preview stacks.
  **Files likely touched**: `infra/modules/network/**`, `infra/env/**`.
  **Validation**:
  ```sh
  terraform -chdir=infra/env fmt -check -recursive
  terraform -chdir=infra/env init -backend=false
  terraform -chdir=infra/env validate
  ```
  **Acceptance**: Env stack can select prod vs nonprod network; previews can reference/reuse nonprod network instead of creating prod-isolated resources.

- [ ] 4.5 Implement ECR module
  **What**: Create ECR repository for server images with immutable tags or equivalent digest deployment pattern and lifecycle cleanup policy.
  **Files likely touched**: `infra/modules/ecr/**`, `infra/env/**`.
  **Validation**:
  ```sh
  terraform -chdir=infra/env init -backend=false
  terraform -chdir=infra/env validate
  ```
  **Acceptance**: Actions can push SHA-tagged images and Terraform/ECS can deploy by image digest/tag.

- [ ] 4.6 Implement Redis/Valkey module
  **What**: Create production/staging ElastiCache/Valkey resources with TLS/auth where supported, security group access only from ECS tasks, and connection host/port/TLS config via outputs plus auth secret ARN/name references. Redis/ElastiCache auth token values must not be Terraform-managed or stored in Terraform state; prefer protected out-of-band seeding/rotation into AWS Secrets Manager. If required ElastiCache auth cannot be configured without secret-in-state, block implementation or document an explicit security exception with compensating controls before proceeding.
  **Files likely touched**: `infra/modules/redis/**`, `infra/env/**`.
  **Validation**:
  ```sh
  terraform -chdir=infra/env init -backend=false
  terraform -chdir=infra/env validate
  terraform -chdir=infra/env plan -var-file=envs/staging.tfvars.example -out=tfplan
  ```
  **Acceptance**: Production and staging have Redis; preview stack does not create preview Redis and instead consumes nonprod/staging Redis host/port with distinct `REDIS_KEY_PREFIX`; Redis auth token values are absent from Terraform state/plans or an explicit reviewed exception exists.

- [ ] 4.7 Implement Secrets Manager module
  **What**: Create/declare secret names, AWS-managed KMS usage, and IAM read permissions for ECS task roles while avoiding Terraform-managed secret values. Secret value seeding belongs to a protected manual GitHub Actions workflow with environment approval. Use strict Secrets Manager ARN/path IAM and role separation; explicitly deny/no-access preview roles from production and staging secrets.
  **Files likely touched**: `infra/modules/secrets/**`, `infra/env/**`, `infra/preview/**`.
  **Validation**:
  ```sh
  terraform -chdir=infra/env init -backend=false
  terraform -chdir=infra/env validate
  ! grep -R "secret_string\|secret_binary" -n infra
  ```
  **Acceptance**: Terraform references secret ARNs/names only; no secret value resources are added unless explicitly non-sensitive placeholders; AWS-managed KMS keys are used and CMK encryption-context controls are documented as deferred.

- [ ] 4.8 Implement Turso module/boundary
  **What**: Use the Turso provider for groups/databases, outputs for database URLs/names, and documentation for out-of-band token creation/rotation into Secrets Manager.
  **Files likely touched**: `infra/modules/turso/**`, `infra/env/**`, `infra/preview/**`, `infra/README.md`.
  **Validation**:
  ```sh
  terraform -chdir=infra/env init -backend=false
  terraform -chdir=infra/env validate
  ! grep -R "TURSO.*TOKEN\|LIBSQL.*TOKEN" -n infra/*.tf infra/**/*.tf
  ```
  **Acceptance**: Turso databases can be managed by Terraform, but Turso tokens are not Terraform variables/state outputs.

- [ ] 4.9 Implement static SPA module
  **What**: Create private S3 + CloudFront resources, bucket/prefix strategy, public access blocks, cache policies, invalidation hooks/outputs, and mandatory CloudFront Origin Access Control.
  **Files likely touched**: `infra/modules/static-spa/**`, `infra/env/**`, `infra/preview/**`.
  **Validation**:
  ```sh
  terraform -chdir=infra/env init -backend=false
  terraform -chdir=infra/env validate
  ```
  **Acceptance**: Production uses private prod bucket; staging uses `staging/` prefix in private nonprod bucket; previews use `previews/pr-<number>/` prefix; all bucket public access is blocked and deploy roles write only scoped env/prefixes.

- [ ] 4.10 Implement DNS/ACM module
  **What**: Wire environment Route 53 zones, ACM certificates, and CloudFront/API hostnames for staging/production according to Phase 0 domain decision. Use required variables `prod_zone_name` and `staging_zone_name`; exact zone names are provided by implementation configuration, not hardcoded.
  **Files likely touched**: `infra/modules/dns-acm/**`, `infra/env/**`.
  **Validation**:
  ```sh
  terraform -chdir=infra/env init -backend=false
  terraform -chdir=infra/env validate
  ```
  **Acceptance**: Env stack requires `prod_zone_name` and `staging_zone_name` and supports `app.<prod-zone>`, `api.<prod-zone>`, `app.<staging-zone>`, and `api.<staging-zone>`, or records the Phase 0-approved API-domain deferral/alternative.

- [ ] 4.11 Implement ECS Express API module
  **What**: Define ECS Express Gateway service with container image, port, shallow health check, task role, secret injection, env vars, logs, Redis/S3/Turso env, and network integration.
  **Files likely touched**: `infra/modules/ecs-express-api/**`, `infra/env/**`, `infra/preview/**`.
  **Validation**:
  ```sh
  terraform -chdir=infra/env init -backend=false
  terraform -chdir=infra/env validate
  grep -R "aws_ecs_express_gateway_service" -n infra
  ```
  **Acceptance**: API service deploys the Bun/Elysia container through `aws_ecs_express_gateway_service`, not a generic Express.js convention; custom-domain handling follows the Phase 0 decision and avoids drift-prone mutation of generated resources.

- [ ] 4.12 Add CloudWatch log retention
  **What**: Configure CloudWatch Logs with 30-day retention for staging/production and 7-day retention for previews.
  **Files likely touched**: `infra/modules/ecs-express-api/**`, `infra/env/**`, `infra/preview/**`.
  **Validation**:
  ```sh
  grep -R "retention_in_days" -n infra
  terraform -chdir=infra/env init -backend=false
  terraform -chdir=infra/env validate
  terraform -chdir=infra/preview init -backend=false
  terraform -chdir=infra/preview validate
  ```
  **Acceptance**: Logs are retained as specified; alarms/dashboards/tracing remain deferred.

### Phase 5 — Terraform stacks

- [ ] 5.1 Create thin environment stack
  **What**: Compose modules for staging/production with variable-driven environment selection, required `prod_zone_name` and `staging_zone_name` inputs, backend key examples, and outputs consumed by Actions.
  **Files likely touched**: `infra/env/**`.
  **Validation**:
  ```sh
  terraform -chdir=infra/env fmt -check -recursive
  terraform -chdir=infra/env init -backend=false
  terraform -chdir=infra/env validate
  terraform -chdir=infra/env plan -var-file=envs/staging.tfvars.example -out=tfplan
  terraform -chdir=infra/env plan -var-file=envs/production.tfvars.example -out=tfplan
  ```
  **Acceptance**: Same stack can target staging or production using different backend keys and vars; zone names are supplied by `prod_zone_name` and `staging_zone_name`, not hardcoded.

- [ ] 5.2 Create thin preview stack
  **What**: Compose modules for a single PR preview using `pr_number`, shared nonprod VPC/Redis/bucket, preview Turso DB, preview secrets references, preview API, and preview web distribution/prefix.
  **Files likely touched**: `infra/preview/**`.
  **Validation**:
  ```sh
  terraform -chdir=infra/preview fmt -check -recursive
  terraform -chdir=infra/preview init -backend=false
  terraform -chdir=infra/preview validate
  terraform -chdir=infra/preview plan -var='pr_number=123' -out=tfplan
  ```
  **Acceptance**: Preview state key pattern is `preview/pr-123`; preview resources include PR number in names/tags/prefixes and are destroyable independently.

- [ ] 5.3 Add tagging and cost controls
  **What**: Apply required tags to all AWS resources: app, env, managed-by, owner, pr-number where applicable, ttl/cleanup marker for previews.
  **Files likely touched**: `infra/modules/**`, `infra/env/**`, `infra/preview/**`.
  **Validation**:
  ```sh
  grep -R "tags" -n infra/modules infra/env infra/preview
  terraform -chdir=infra/env init -backend=false
  terraform -chdir=infra/env validate
  terraform -chdir=infra/preview init -backend=false
  terraform -chdir=infra/preview validate
  ```
  **Acceptance**: Preview resources are discoverable by scheduled cleanup and cost attribution.

### Phase 6 — CI/CD workflows

- [ ] 6.1 Add shared CI gates workflow
  **What**: Add GitHub Actions workflow for Bun install, lint, typecheck, web build, server Docker build, and migration check. Use Bun actions/caching appropriately.
  **Files likely touched**: `.github/workflows/ci.yml`.
  **Validation**:
  ```sh
  bun install --frozen-lockfile
  bun run lint
  bun run typecheck
  bun run build
  docker build -t hay-server-ci .
  bun run migrate -- --help
  npx actionlint .github/workflows/ci.yml
  ```
  **Acceptance**: CI blocks deployment if install/lint/typecheck/build/docker/migration checks fail.

- [ ] 6.2 Add Docker image build/push flow
  **What**: Authenticate to AWS with OIDC, login to ECR, build existing server Dockerfile, push SHA-tagged image, and expose immutable image digest for Terraform deploy jobs.
  **Files likely touched**: `.github/workflows/deploy-staging.yml`, `.github/workflows/deploy-production.yml`, maybe reusable workflow under `.github/workflows/`.
  **Validation**:
  ```sh
  docker build -t hay-server:${GITHUB_SHA:-local} .
  npx actionlint .github/workflows/deploy-staging.yml .github/workflows/deploy-production.yml
  ```
  **Acceptance**: Images are immutable SHA/digest deployments; no `latest` dependency.

- [ ] 6.3 Add staging deployment workflow
  **What**: On `main`, run gates, build/push image, Terraform plan/apply staging with immutable image digest variable, run Drizzle migrations, update ECS Express service through Terraform, build/upload web SPA using Terraform outputs, and invalidate CloudFront.
  **Files likely touched**: `.github/workflows/deploy-staging.yml`.
  **Validation**:
  ```sh
  npx actionlint .github/workflows/deploy-staging.yml
  ```
  **Acceptance**: Main auto-deploys staging with AWS OIDC staging role and staging backend key; migration failure stops before ECS image/web update.

- [ ] 6.4 Add production deployment workflow
  **What**: From `main`, after GitHub Environment approval, use production role/backend key, run Terraform apply with immutable image digest variable, run migrations, deploy API image through Terraform, upload prod web build using Terraform outputs, invalidate CloudFront.
  **Files likely touched**: `.github/workflows/deploy-production.yml`.
  **Validation**:
  ```sh
  npx actionlint .github/workflows/deploy-production.yml
  ```
  **Acceptance**: Production cannot deploy without GitHub Environment approval and separate production OIDC role.

- [ ] 6.5 Add preview lifecycle workflow
  **What**: Implement the two-workflow preview safety model. All PRs run unprivileged `pull_request` checks. Privileged preview create/update runs only via maintainer-approved `workflow_dispatch` and/or protected environment approval, checks out only same-repo PR branches, and requires all of: `head.repo.full_name == github.repository`, exact `preview` label present, actor/deployer has trusted maintainer/write permission, fork PRs never receive AWS credentials, and no unsafe `pull_request_target` checkout of untrusted code. On label removal or PR close, destroy preview infra. Build/push image, create preview Turso DB, seed from sanitized template only, write required secret values to Secrets Manager by approved protected mechanism, run migrations, deploy API through Terraform with immutable digest, build/upload preview web using Terraform outputs.
  **Files likely touched**: `.github/workflows/preview.yml`, scripts if absolutely necessary under `scripts/` or `infra/scripts/`.
  **Validation**:
  ```sh
  npx actionlint .github/workflows/preview.yml
  terraform -chdir=infra/preview init -backend=false
  terraform -chdir=infra/preview validate
  ```
  **Acceptance**: Preview exists only while label is present/open same-repo PR and maintainer approval remains valid; state key and resources include PR number; preview DB is isolated and disposable; fork PRs never receive AWS credentials; privileged jobs never use `pull_request_target` to execute untrusted code.

- [ ] 6.6 Add scheduled preview cleanup
  **What**: Add a scheduled workflow that lists preview state/resources/PRs and destroys stale previews for closed/unlabeled PRs.
  **Files likely touched**: `.github/workflows/preview-cleanup.yml`.
  **Validation**:
  ```sh
  npx actionlint .github/workflows/preview-cleanup.yml
  ```
  **Acceptance**: Stale preview infrastructure has an automated cleanup path with safe logging and no production access.

- [ ] 6.7 Add Terraform plan artifacts/comments
  **What**: Surface sanitized Terraform plan summaries in Actions summaries or PR comments without leaking secrets. Summaries must be generated only from explicit allowlisted fields/redaction tooling and must never include raw `terraform show` output. Keep binary/JSON plan artifacts only as restricted GitHub Actions artifacts retained exactly 1 day. Separate preview/staging/production plan scopes and mark Terraform sensitive outputs as sensitive.
  **Files likely touched**: `.github/workflows/*.yml`.
  **Validation**:
  ```sh
  npx actionlint .github/workflows/*.yml
  ```
  **Acceptance**: Reviewers can inspect sanitized allowlisted infra summaries before apply; raw plan output is never pasted into comments; binary/JSON plan artifacts have `retention-days: 1` and restricted artifact access.

- [ ] 6.8 Add protected manual secret seeding workflow
  **What**: Add a manual GitHub Actions workflow that uses AWS OIDC and GitHub Environment approval to write Turso, Better Auth, OAuth, Redis/ElastiCache auth, and other secret values into AWS Secrets Manager. Terraform must consume only names/ARNs and must not manage Redis auth token values in state.
  **Files likely touched**: `.github/workflows/seed-secrets.yml`, `infra/README.md`.
  **Validation**:
  ```sh
  npx actionlint .github/workflows/seed-secrets.yml
  ! grep -R "secret_string\|secret_binary\|TURSO_AUTH_TOKEN=.*\|BETTER_AUTH_SECRET=.*" -n infra .github docs
  ```
  **Acceptance**: Secret values, including Redis/ElastiCache auth tokens, never enter Terraform state/plans/comments/logs; workflow is protected by environment approval and scoped role permissions.

### Phase 7 — Database migrations and Turso preview lifecycle

- [ ] 7.1 Make migration command CI-safe
  **What**: Ensure Drizzle migrations can run in CI against Turso using secrets from AWS/GitHub without echoing tokens.
  **Files likely touched**: `apps/server/drizzle.config.ts`, package scripts/docs, workflow files.
  **Validation**:
  ```sh
  bun run --cwd apps/server migrate -- --help
  bun run --cwd apps/server typecheck
  ```
  **Acceptance**: Workflows can run migrations as explicit deployment steps before ECS/web update; migration failure stops deployment and records prior image digest plus migration notes.

- [ ] 7.2 Define preview DB create/seed/migrate/destroy steps
  **What**: Implement or document the exact commands used by Actions to create an isolated Turso DB per preview, seed it only from the sanitized template, write token to Secrets Manager, run migrations, and destroy it on cleanup. The template must forbid emails, names, OAuth IDs, provider account IDs, access/refresh tokens, user content, auth sessions, and production/staging-derived message data. A maintainer protected workflow must refresh the template and record audit/evidence before previews may seed from it.
  **Files likely touched**: `.github/workflows/preview.yml`, `.github/workflows/preview-cleanup.yml`, `infra/README.md`, optional scripts.
  **Validation**:
  ```sh
  grep -R "turso\|drizzle\|migrate" -n .github/workflows infra apps/server
  ```
  **Acceptance**: Preview DB lifecycle is deterministic; previews seed only from the audited sanitized template; forbidden identity/token/session/user-content/message fields are absent; production/staging-derived message data is never copied into previews.

### Phase 8 — End-to-end deployment validation

- [ ] 8.1 Validate Terraform formatting and static validation
  **What**: Run formatting and validation for all Terraform stacks.
  **Files likely touched**: none unless fixing format.
  **Commands**:
  ```sh
  terraform -chdir=infra/bootstrap fmt -check -recursive
  terraform -chdir=infra/env fmt -check -recursive
  terraform -chdir=infra/preview fmt -check -recursive
  terraform -chdir=infra/bootstrap init -backend=false
  terraform -chdir=infra/env init -backend=false
  terraform -chdir=infra/preview init -backend=false
  terraform -chdir=infra/bootstrap validate
  terraform -chdir=infra/env validate
  terraform -chdir=infra/preview validate
  ```
  **Acceptance**: All stacks format and validate locally without backend initialization.

- [ ] 8.2 Validate app gates
  **What**: Prove app changes still build and typecheck.
  **Commands**:
  ```sh
  bun install --frozen-lockfile
  bun run lint
  bun run typecheck
  bun run build
  bun run --cwd apps/web build
  docker build -t hay-server-deploy-test .
  ```
  **Acceptance**: No regressions from deployment-readiness code changes.

- [ ] 8.3 Validate local health endpoint smoke
  **What**: Start the server locally with representative env and confirm health endpoint behavior.
  **Commands**:
  ```sh
  BETTER_AUTH_SECRET=test \
  BETTER_AUTH_URL=http://localhost:3000 \
  CORS_ALLOWED_ORIGINS=http://localhost:3001,tauri://localhost,https://tauri.localhost \
  REDIS_HOST=localhost \
  REDIS_PORT=6379 \
  REDIS_KEY_PREFIX=local: \
  bun run --cwd apps/server start &
  server_pid=$!
  trap 'kill "$server_pid"' EXIT
  sleep 3
  curl -fsS http://localhost:3000/health
  kill "$server_pid"
  ```
  **Acceptance**: `/health` returns 2xx without requiring DB/Redis availability.

- [ ] 8.4 Validate GitHub Actions syntax
  **What**: Run `actionlint`. If unavailable through `npx`, stop and record an explicit blocker to add a CI actionlint gate; do not pass silently.
  **Commands**:
  ```sh
  npx actionlint .github/workflows/*.yml
  ```
  **Acceptance**: Workflows pass syntax validation; missing tool is a blocker until an equivalent CI gate exists.

- [ ] 8.5 Validate Tauri config
  **What**: Confirm Tauri config parses and CSP changes do not break the desktop package.
  **Commands**:
  ```sh
  bun run --cwd apps/desktop info
  bun run --cwd apps/desktop typecheck
  ```
  **Acceptance**: Tauri config is valid; missing toolchain is a blocker until validated in CI or another reproducible environment.

- [ ] 8.6 Validate remote deployment smoke after first staging apply
  **What**: After staging infrastructure is applied, confirm public API and web URLs.
  **Commands**:
  ```sh
  curl -fsS https://api.<staging-zone>/health
  curl -I https://app.<staging-zone>/
  ```
  **Acceptance**: Staging API health and static web shell are reachable over HTTPS.

- [ ] 8.7 Validate browser UI deterministically
  **What**: After a local or staging web app is running, use `agent-browser` to validate the UI and record evidence. `npx agent-browser --help` is allowed only as an availability precheck.
  **Commands**:
  ```sh
  npx agent-browser --help
  # Then run agent-browser against the live local or staging URL and record screenshot/trace/console evidence.
  ```
  **Acceptance**: A deterministic local or staging browser validation result is recorded, including target URL, expected API origin, console/error result, and screenshot or trace evidence. Help output alone does not satisfy this gate.

### Phase 9 — Security and review gates

- [ ] 9.1 Run secret/state leakage audit
  **What**: Search for accidental secrets in Terraform files, workflows, env examples, docs, and generated plans.
  **Commands**:
  ```sh
  ! grep -R "secret_string\|secret_binary\|TURSO_AUTH_TOKEN=.*\|BETTER_AUTH_SECRET=.*\|AWS_SECRET_ACCESS_KEY=.*" -n infra .github docs apps
  git diff --check
  ```
  **Acceptance**: No secret values or Terraform-managed sensitive token values are present.

- [ ] 9.2 Security review required
  **What**: Request mandatory security review focused on IAM/OIDC, Secrets Manager boundaries, Turso token lifecycle, CORS, Better Auth cookie settings, Tauri CSP, S3 bucket policy, CloudFront access, and preview isolation.
  **Files likely touched**: none, unless review fixes are needed.
  **Acceptance**: Warp approves or all findings are addressed before merge. Existing Warp BLOCK is a hard gate until re-reviewed.

- [ ] 9.3 Quality review
  **What**: Request general implementation review for Terraform module boundaries, workflow reliability, rollback paths, and operator docs.
  **Acceptance**: Weft approves or all findings are addressed before merge. Existing Weft BLOCK is a hard gate until re-reviewed.

## Deployment handoff and failure behavior

1. GitHub Actions runs install/lint/typecheck/build gates.
2. GitHub Actions builds the server Docker image, pushes it to ECR with the commit SHA, captures the immutable image digest, and records the previously deployed digest for rollback.
3. GitHub Actions runs Terraform plan/apply for the target environment using separate backend keys and the image digest/tag variable. PR comments/job summaries expose only sanitized allowlisted plan summaries; binary/JSON plan artifacts are restricted and retained exactly 1 day. Terraform owns ECS service updates; workflows do not manually mutate ECS resources.
4. GitHub Actions runs Drizzle migrations after infra prerequisites exist but before ECS service/web artifact updates. If migrations fail, deployment stops before the new ECS image or web artifact is deployed. There is no automatic migration rollback.
5. If migrations succeed, Terraform updates the ECS Express service to the immutable image digest. If app deploy fails after migrations, operators manually roll back/forward using recorded prior image digest and migration notes.
6. Terraform outputs S3 bucket/prefix, CloudFront distribution ID, API URL, and web URL. CI builds the static web app with the target API URL, uploads artifacts only to scoped Terraform-provided bucket/prefix, and invalidates CloudFront.
7. Preview destroy uses the preview state key, destroys preview AWS resources, deletes preview Turso DB/tokens by the approved external mechanism, and removes only `previews/pr-<number>/` web artifacts.

## Explicit dependency edges

- Bootstrap remote state and GitHub OIDC roles must exist before env/preview stacks or deploy workflows run.
- Phase 0 DNS/API custom-domain decision must complete before DNS/ACM and ECS Express modules are implemented.
- Secrets Manager names/KMS/IAM must exist before ECS task definitions reference secrets and before the protected secret-seeding workflow writes values.
- Network/security groups must exist before Redis and ECS modules.
- Redis module outputs and app Redis prefix wrapper must exist before previews share nonprod Redis.
- Turso database/group resources must exist before token creation, secret seeding, and migrations.
- ECR repository must exist before image build/push workflows.
- Image build/push must complete before Terraform applies ECS service updates.
- Drizzle migrations must succeed before ECS service update and web artifact upload.
- Static SPA Terraform outputs must exist before CI uploads web artifacts or invalidates CloudFront.
- Actionlint/workflow validation must pass before relying on deployment workflows.
- `npx agent-browser` validation must run against a running local or staging web app after frontend changes and before review completion; CLI help output is only an availability precheck.

## Rollback notes
- **Application code rollback**: Revert the deployment-readiness commit(s). `/health` is additive and can usually remain, but Redis/S3/auth config changes must be reverted if they break runtime behavior.
- **Workflow rollback**: Disable or revert `.github/workflows/deploy-*.yml`, `preview.yml`, and `preview-cleanup.yml`. Remove GitHub Environment deployment permissions if workflows misbehave.
- **Terraform bootstrap rollback**: Do not destroy remote state resources until all dependent state is migrated or destroyed. If bootstrap must roll back, first archive state and disable OIDC roles.
- **Staging rollback**: Redeploy previous server image digest through Actions or Terraform variable rollback; restore previous web S3 object prefix/build and invalidate CloudFront.
- **Production rollback**: Use GitHub Environment-approved rollback to previous image digest and previous static SPA artifact. Do not destroy production data stores during app rollback.
- **Preview rollback**: Destroy the preview stack using its `preview/pr-<number>` state key; delete preview Turso DB and preview secret entries.
- **Turso rollback**: Database schema rollback must follow Drizzle migration policy. Do not rely on Terraform to roll back Turso tokens because tokens are external to Terraform state.
- **Redis rollback**: Key prefix changes may leave old keys. For previews, delete prefixed keys. For staging/prod, only flush/delete with explicit operator approval.
- **S3 rollback**: Prefix-based nonprod isolation allows removing preview/staging prefixes without touching production bucket contents.

## Risks and mitigations
- **ECS Express Terraform provider support may be new or region-limited**: Validate provider version and AWS region early. If unsupported, stop and document alternatives rather than silently switching compute platform.
- **ECS Express API custom domains are not first-class**: Phase 0 must validate an automatable custom-domain path. If unsafe, explicitly defer the API custom domain or switch to raw ECS/ALB.
- **Terraform state secret leakage**: Never manage secret values in Terraform; audit plans/state and use Secrets Manager ARNs only. Redis/ElastiCache auth tokens are included in this boundary; if ElastiCache auth cannot be configured without secret-in-state, stop or document an explicit reviewed security exception with compensating controls.
- **Turso token lifecycle ambiguity**: Keep token creation/rotation outside Terraform and explicitly document CI/operator steps.
- **Preview data exposure**: Seed previews only from an audited sanitized template; never seed emails, names, OAuth IDs, provider account IDs, access/refresh tokens, user content, auth sessions, or production/staging-derived message data.
- **Preview workflow privilege escalation**: Keep unprivileged `pull_request` checks separate from privileged maintainer-approved preview deploys. Never give fork PRs AWS credentials and never use `pull_request_target` to check out or execute untrusted code.
- **Plan/comment leakage**: Use allowlisted redacted summaries only in comments and summaries; keep binary/JSON plan artifacts restricted with exactly 1-day retention.
- **Shared nonprod Redis collisions**: Enforce `REDIS_KEY_PREFIX` for staging and every preview across ioredis/jobify/verrou.
- **S3 prefix isolation mistakes**: Encode prefixes in Terraform outputs and workflow inputs; avoid hand-typed upload paths in multiple places.
- **CORS/auth regressions**: Test browser web and Tauri origins; require security review for credentialed CORS and `SameSite=None; Secure`.
- **CloudFront/API custom-domain ordering**: ACM DNS validation and delegated subdomain setup may block first apply; document manual DNS delegation before env stack apply.
- **Production deploy blast radius**: Use separate OIDC role, state key, VPC, Redis, bucket, Turso DB, and GitHub Environment approval.
- **Preview cleanup failures**: Add tags and scheduled cleanup; make destroy idempotent for missing PR labels/closed PRs.
- **Migrations before deploy**: A migration can fail after infra changes but before service update. Keep migration step explicit and fail closed before ECS update.

## Explicit acceptance criteria
- [ ] `infra/bootstrap`, `infra/env`, and `infra/preview` exist and validate with Terraform.
- [ ] Reusable Terraform modules exist for remote state, GitHub OIDC, network, ECR, Redis, static SPA, DNS/ACM, Secrets Manager boundaries, Turso, and ECS Express API.
- [ ] Terraform uses `aws_ecs_express_gateway_service` for the API service.
- [ ] AWS provider is pinned to `>= 6.43.0` or a similarly pinned recent v6 provider; Terraform CLI is used, not OpenTofu.
- [ ] Remote state keys are distinct for `staging`, `production`, and `preview/pr-<number>`.
- [ ] One AWS account is used with separate preview/staging/prod OIDC roles, tag-conditioned preview permissions, scoped Secrets Manager ARN/path access, AWS-managed KMS keys, and no preview access to prod/staging secrets or prod resources.
- [ ] Production and nonproduction VPCs are separate; staging/previews share nonprod VPC.
- [ ] Production and staging have Redis/Valkey with TLS/auth where supported and SG restrictions; previews share nonprod/staging Redis with unique prefixes; Redis/ElastiCache auth token values are not Terraform-managed or stored in Terraform state.
- [ ] Server config supports Redis host/port/TLS/auth or URL plus `REDIS_KEY_PREFIX`; ioredis/jobify/verrou keys are namespaced through one wrapper/prefix discipline.
- [ ] S3 config supports bucket, region, and prefix; ECS uses task-role access rather than long-lived S3 keys where possible.
- [ ] Static web S3 buckets are private, block public access, and require CloudFront OAC; deploy roles write only scoped env/prefixes.
- [ ] Secrets Manager ARNs/names are managed/referenced by Terraform, but secret values are not stored in Terraform state; AWS-managed KMS keys are used and CMK encryption-context controls are intentionally deferred.
- [ ] Turso databases/groups are managed by Terraform where appropriate; Turso tokens are external and stored in AWS Secrets Manager.
- [ ] Secret values are seeded only by protected manual GitHub Actions workflow with AWS OIDC and environment approval.
- [ ] Each preview has an isolated disposable Turso DB seeded only from the audited sanitized template, migrated after creation and destroyed on cleanup; template excludes emails, names, OAuth IDs, provider account IDs, access/refresh tokens, user content, auth sessions, and production/staging-derived message data.
- [ ] Production and staging custom domains are wired from required variables `prod_zone_name` and `staging_zone_name` as `app.<prod-zone>`, `api.<prod-zone>`, `app.<staging-zone>`, `api.<staging-zone>`, or the Phase 0 API-domain alternative is recorded.
- [ ] `apps/web` builds a static SPA with environment-specific API URL and uploads to S3 + CloudFront.
- [ ] GitHub Actions include CI gates, staging deploy, production deploy with approval, preview lifecycle, and scheduled preview cleanup; preview deploy follows the two-workflow model with unprivileged `pull_request` checks and maintainer-approved privileged deploys only for same-repo PRs with exact `preview` label and trusted write/maintainer actor.
- [ ] Fork PRs never receive AWS credentials and privileged preview workflows never use `pull_request_target` to check out or execute untrusted code.
- [ ] Terraform PR comments/job summaries contain sanitized allowlisted summaries only; raw `terraform show` is never published; binary/JSON plan artifacts are restricted and retained exactly 1 day.
- [ ] Docker images are pushed to ECR with immutable SHA/digest references.
- [ ] Terraform owns ECS updates using immutable image digest/tag variables supplied by GitHub Actions.
- [ ] Drizzle migrations run as explicit deployment steps before ECS service/web update and fail closed with recorded rollback notes.
- [ ] CORS/Better Auth origin matrix is recorded before implementation and uses exact deterministic allowlists with no credentialed wildcards; matrix includes web origins, API origins, preview origin pattern, and explicit Tauri custom protocols.
- [ ] Cookie domain/path/SameSite/Secure rules are recorded; cookies are host-scoped, Secure/HTTPS, and CSRF/session-fixation behavior is validated.
- [ ] Tauri CSP `connect-src` is exact per environment and does not broadly allow `https:`.
- [ ] `/health` is unauthenticated, shallow, and suitable for ECS health checks.
- [ ] CloudWatch log retention is 30 days for staging/production and 7 days for previews.
- [ ] ADRs under `docs/adr/` for ECS Express/AWS infra, environment/preview strategy, and Terraform/Turso/secrets boundaries match existing repository ADR style: concise `# Title` plus prose; no mandatory Status/Context/Decision/Consequences headings.
- [ ] Validation commands are deterministic and non-silent: no `|| true`, no macOS `timeout`, Terraform init before validate, and actionlint or explicit blocker.
- [ ] `npx agent-browser` validation is run after frontend changes against a running local or staging web app with recorded result/evidence; `--help` alone is not accepted.
- [ ] Security review is completed before merge; Warp/Weft BLOCK remains hard gate until re-reviewed.

## Remaining blockers before implementation
1. **Warp/Weft re-review**: Existing Warp and Weft BLOCK findings remain a hard gate until this amended plan and Phase 0 outputs are re-reviewed.
2. **API custom-domain spike**: Implementation must validate a safe `api.<env-zone>` path for ECS Express before coding DNS/ECS modules. If unsafe, decide explicitly between deferring API custom domains or switching API to raw ECS/ALB.
3. **Exact Route 53 zone names**: Production and staging environment zone names must be provided as Phase 0 inputs through required `prod_zone_name` and `staging_zone_name` variables before Terraform variables/backends are finalized.
4. **Dirty generated file**: `apps/web/src/routeTree.gen.ts` is already modified and must be handled separately before implementation commits begin.
5. **Actionlint availability**: If `npx actionlint` is unavailable, add an equivalent CI validation gate and record the blocker; do not silently skip workflow validation.
6. **S3 SDK/runtime details**: Confirm the current app S3 implementation and whether AWS SDK default credential provider is already available or must be added.
7. **Redis auth state boundary**: Confirm ElastiCache auth can be configured without storing token values in Terraform state, or stop for a documented security exception with compensating controls.
8. **Preview safety evidence**: Define and test the same-repo, maintainer-approved preview deploy path before any AWS credentials are exposed to preview workflows.
