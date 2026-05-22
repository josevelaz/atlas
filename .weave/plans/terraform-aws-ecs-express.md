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
- Long-lived environments: `staging`, `production`.
- Ephemeral previews: one `preview/pr-<number>` environment per open PR with GitHub `preview` label.
- Remote Terraform state keys are separate for `staging`, `production`, and each `preview/pr-<number>`.
- VPCs: separate production and nonproduction VPCs; staging and previews share the nonproduction VPC.
- Redis/Valkey: production and staging have environment Redis. Previews share staging/nonproduction Redis and must use key prefixes.
- S3 isolation: production bucket; shared nonproduction bucket using prefixes `staging/` and `previews/pr-<number>/`.
- Hostnames:
  - Production: `app.<delegated-domain>`, `api.<delegated-domain>`.
  - Staging: `staging-app.<delegated-domain>`, `staging-api.<delegated-domain>`.
  - Previews: generated ECS/CloudFront URLs initially.

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

## Phases and atomic tasks

### Phase 0 — Preflight and current-state capture

- [ ] 0.1 Confirm repo/worktree baseline
  **What**: Verify the executor is in the intended worktree, capture current status, and avoid mixing unrelated changes.
  **Files likely touched**: none.
  **Commands**:
  ```sh
  git rev-parse --show-toplevel
  git rev-parse --is-bare-repository
  git worktree list --porcelain
  git status --short
  ```
  **Acceptance**: Baseline state is documented; unrelated local changes are not modified.

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
  bun run --cwd apps/desktop info || true
  ```
  **Acceptance**: Existing failures, if any, are recorded before editing files.

- [ ] 0.3 Inventory deployment-sensitive code paths
  **What**: Locate current env parsing, auth config, CORS config, Redis clients, jobify/verrou usage, S3 clients, Drizzle config, server entrypoint, and web API URL wiring.
  **Files likely touched**: none.
  **Commands**:
  ```sh
  grep -R "REDIS_HOST\|ioredis\|jobify\|verrou\|S3_\|trustedOrigins\|cors\|CORS_ALLOWED_ORIGINS\|BETTER_AUTH\|TURSO\|LIBSQL\|drizzle" -n apps package.json Dockerfile
  ```
  **Acceptance**: Concrete files to edit in later phases are listed in implementation notes.

### Phase 1 — ADRs and deployment docs skeleton

- [ ] 1.1 Add ADR for ECS Express + AWS-managed app infra
  **What**: Create a concise ADR matching existing `docs/adr/` style explaining why app infra is AWS-managed, why API uses ECS Express Mode, and why Turso remains the database provider.
  **Files likely touched**: `docs/adr/0006-use-ecs-express-and-aws-managed-app-infra.md`.
  **Validation**:
  ```sh
  test -f docs/adr/0006-use-ecs-express-and-aws-managed-app-infra.md
  ```
  **Acceptance**: ADR includes context, decision, and consequences in concise prose.

- [ ] 1.2 Add ADR for environment and preview strategy
  **What**: Document staging/production, ephemeral previews, state key separation, nonprod sharing rules, custom domains, and preview cleanup lifecycle.
  **Files likely touched**: `docs/adr/0007-use-staging-production-and-pr-preview-environments.md`.
  **Validation**:
  ```sh
  test -f docs/adr/0007-use-staging-production-and-pr-preview-environments.md
  ```
  **Acceptance**: ADR explicitly states prod/nonprod VPC split, staging/preview nonprod sharing, preview label behavior, and production approval gate.

- [ ] 1.3 Add ADR for Terraform/Turso/secrets boundaries
  **What**: Document what Terraform manages, what Terraform references only by ARN/name, and what is created/rotated outside Terraform.
  **Files likely touched**: `docs/adr/0008-define-terraform-turso-and-secrets-boundaries.md`.
  **Validation**:
  ```sh
  test -f docs/adr/0008-define-terraform-turso-and-secrets-boundaries.md
  ```
  **Acceptance**: ADR states Turso tokens are never stored in Terraform state and secret values are written to AWS Secrets Manager outside Terraform.

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
  timeout 15s bun run --cwd apps/server start &
  sleep 3
  curl -fsS http://localhost:3000/health
  ```
  **Acceptance**: `GET /health` returns 2xx without auth and remains shallow.

- [ ] 2.2 Extend Redis env config
  **What**: Add `REDIS_PORT` and `REDIS_KEY_PREFIX`; preserve existing `REDIS_HOST`; define defaults only where safe for local dev.
  **Files likely touched**: `apps/server/src/**`, `apps/server/.env.example`, deployment env docs.
  **Validation**:
  ```sh
  REDIS_HOST=localhost REDIS_PORT=6379 REDIS_KEY_PREFIX=local: bun run --cwd apps/server typecheck
  ```
  **Acceptance**: Env parsing accepts host, port, and key prefix; missing production prefix is treated as invalid or explicitly guarded.

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
  **What**: Configure jobify and verrou so queue/lock keys include the environment/preview prefix.
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
  **What**: Make CORS/trusted origins explicit for web, API, staging/prod custom domains, preview URLs, and Tauri production origins (`tauri://localhost`, `https://tauri.localhost`). Ensure credentialed CORS is correct.
  **Files likely touched**: `apps/server/src/auth.ts`, CORS plugin/config files, `apps/server/.env.example`.
  **Validation**:
  ```sh
  bun run --cwd apps/server typecheck
  grep -R "tauri://localhost\|https://tauri.localhost\|trustedOrigins\|credentials" -n apps/server/src apps/server/.env.example
  ```
  **Acceptance**: Production/staging origins are allowlisted, preview origin strategy is documented, and Tauri origins are included where auth requires them.

- [ ] 2.7 Validate Better Auth cookie behavior for desktop/web
  **What**: Keep cookie sessions, but configure/verify `SameSite=None; Secure` where cross-origin desktop/web flows require it; document platform-specific constraints.
  **Files likely touched**: `apps/server/src/auth.ts`, `apps/server/.env.example`, `infra/README.md`.
  **Validation**:
  ```sh
  bun run --cwd apps/server typecheck
  grep -R "sameSite\|SameSite\|secure\|trustedOrigins" -n apps/server/src docs infra apps/server/.env.example
  ```
  **Acceptance**: Auth session cookies are explicitly configured or documented as safe for the chosen origins; this task must be reviewed by security.

### Phase 3 — Web and desktop deployment readiness

- [ ] 3.1 Add web API URL env contract
  **What**: Ensure `apps/web` reads a build-time API base URL per environment/preview and documents required variables.
  **Files likely touched**: `apps/web/src/**`, `apps/web/.env.example`.
  **Validation**:
  ```sh
  API_BASE_URL=https://staging-api.example.test bun run --cwd apps/web build
  grep -R "API_BASE_URL\|VITE_.*API" -n apps/web/src apps/web/.env.example
  ```
  **Acceptance**: Static SPA build can target staging, production, or a preview API URL without code edits.

- [ ] 3.2 Configure Tauri production CSP connect sources
  **What**: Update Tauri CSP to allow only the approved staging/prod API origins and preserve strict defaults for other sources.
  **Files likely touched**: `apps/desktop/src-tauri/tauri.conf.json`.
  **Validation**:
  ```sh
  bun run --cwd apps/desktop info || true
  bun run --cwd apps/desktop typecheck || true
  grep -n "connect-src\|staging-api\|api\." apps/desktop/src-tauri/tauri.conf.json
  ```
  **Acceptance**: CSP includes `connect-src` for staging/prod APIs and does not broadly allow `*`.

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
  **What**: Establish Terraform/OpenTofu compatibility decision, AWS provider version, Turso provider version, and required provider aliases if needed.
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
  **What**: Create deploy roles for preview, staging, and production with least-privilege trust policies scoped to repo, refs/environments, and workflow needs.
  **Files likely touched**: `infra/bootstrap/**`, `infra/modules/github-oidc/**`.
  **Validation**:
  ```sh
  terraform -chdir=infra/bootstrap fmt -check -recursive
  terraform -chdir=infra/bootstrap validate
  terraform -chdir=infra/bootstrap plan -out=tfplan
  ```
  **Acceptance**: Roles are separate; production trust is environment/ref constrained; outputs expose role ARNs for GitHub secrets/variables.

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
  terraform -chdir=infra/env validate
  ```
  **Acceptance**: Actions can push SHA-tagged images and Terraform/ECS can deploy by image digest/tag.

- [ ] 4.6 Implement Redis/Valkey module
  **What**: Create production/staging ElastiCache/Valkey resources with security group access from ECS tasks; expose connection host/port via outputs or secrets/env injection.
  **Files likely touched**: `infra/modules/redis/**`, `infra/env/**`.
  **Validation**:
  ```sh
  terraform -chdir=infra/env validate
  terraform -chdir=infra/env plan -var-file=envs/staging.tfvars.example -out=tfplan || true
  ```
  **Acceptance**: Production and staging have Redis; preview stack does not create preview Redis and instead consumes nonprod/staging Redis host/port with distinct `REDIS_KEY_PREFIX`.

- [ ] 4.7 Implement Secrets Manager module
  **What**: Create/declare secret names and IAM read permissions for ECS task roles while avoiding Terraform-managed secret values.
  **Files likely touched**: `infra/modules/secrets/**`, `infra/env/**`, `infra/preview/**`.
  **Validation**:
  ```sh
  terraform -chdir=infra/env validate
  grep -R "secret_string\|secret_binary" -n infra && exit 1 || true
  ```
  **Acceptance**: Terraform references secret ARNs/names only; no secret value resources are added unless explicitly non-sensitive placeholders.

- [ ] 4.8 Implement Turso module/boundary
  **What**: Use the Turso provider for groups/databases, outputs for database URLs/names, and documentation for out-of-band token creation/rotation into Secrets Manager.
  **Files likely touched**: `infra/modules/turso/**`, `infra/env/**`, `infra/preview/**`, `infra/README.md`.
  **Validation**:
  ```sh
  terraform -chdir=infra/env validate
  grep -R "TURSO.*TOKEN\|LIBSQL.*TOKEN" -n infra/*.tf infra/**/*.tf || true
  ```
  **Acceptance**: Turso databases can be managed by Terraform, but Turso tokens are not Terraform variables/state outputs.

- [ ] 4.9 Implement static SPA module
  **What**: Create S3 + CloudFront resources, bucket/prefix strategy, cache policies, invalidation hooks/outputs, and optional Origin Access Control.
  **Files likely touched**: `infra/modules/static-spa/**`, `infra/env/**`, `infra/preview/**`.
  **Validation**:
  ```sh
  terraform -chdir=infra/env validate
  ```
  **Acceptance**: Production uses prod bucket; staging uses `staging/` prefix in nonprod bucket; previews use `previews/pr-<number>/` prefix.

- [ ] 4.10 Implement DNS/ACM module
  **What**: Wire delegated Route 53 zone, ACM certificates, and CloudFront/API hostnames for staging/production.
  **Files likely touched**: `infra/modules/dns-acm/**`, `infra/env/**`.
  **Validation**:
  ```sh
  terraform -chdir=infra/env validate
  ```
  **Acceptance**: Env stack supports `app.<delegated-domain>`, `api.<delegated-domain>`, `staging-app.<delegated-domain>`, and `staging-api.<delegated-domain>`.

- [ ] 4.11 Implement ECS Express API module
  **What**: Define ECS Express Gateway service with container image, port, shallow health check, task role, secret injection, env vars, logs, Redis/S3/Turso env, and network integration.
  **Files likely touched**: `infra/modules/ecs-express-api/**`, `infra/env/**`, `infra/preview/**`.
  **Validation**:
  ```sh
  terraform -chdir=infra/env validate
  grep -R "aws_ecs_express_gateway_service" -n infra
  ```
  **Acceptance**: API service deploys the Bun/Elysia container through `aws_ecs_express_gateway_service`, not a generic Express.js convention.

- [ ] 4.12 Add CloudWatch log retention
  **What**: Configure CloudWatch Logs with 30-day retention for staging/production and 7-day retention for previews.
  **Files likely touched**: `infra/modules/ecs-express-api/**`, `infra/env/**`, `infra/preview/**`.
  **Validation**:
  ```sh
  grep -R "retention_in_days" -n infra
  terraform -chdir=infra/env validate
  terraform -chdir=infra/preview validate
  ```
  **Acceptance**: Logs are retained as specified; alarms/dashboards/tracing remain deferred.

### Phase 5 — Terraform stacks

- [ ] 5.1 Create thin environment stack
  **What**: Compose modules for staging/production with variable-driven environment selection, backend key examples, and outputs consumed by Actions.
  **Files likely touched**: `infra/env/**`.
  **Validation**:
  ```sh
  terraform -chdir=infra/env fmt -check -recursive
  terraform -chdir=infra/env init -backend=false
  terraform -chdir=infra/env validate
  terraform -chdir=infra/env plan -var-file=envs/staging.tfvars.example -out=tfplan || true
  terraform -chdir=infra/env plan -var-file=envs/production.tfvars.example -out=tfplan || true
  ```
  **Acceptance**: Same stack can target staging or production using different backend keys and vars.

- [ ] 5.2 Create thin preview stack
  **What**: Compose modules for a single PR preview using `pr_number`, shared nonprod VPC/Redis/bucket, preview Turso DB, preview secrets references, preview API, and preview web distribution/prefix.
  **Files likely touched**: `infra/preview/**`.
  **Validation**:
  ```sh
  terraform -chdir=infra/preview fmt -check -recursive
  terraform -chdir=infra/preview init -backend=false
  terraform -chdir=infra/preview validate
  terraform -chdir=infra/preview plan -var='pr_number=123' -out=tfplan || true
  ```
  **Acceptance**: Preview state key pattern is `preview/pr-123`; preview resources include PR number in names/tags/prefixes and are destroyable independently.

- [ ] 5.3 Add tagging and cost controls
  **What**: Apply required tags to all AWS resources: app, env, managed-by, owner, pr-number where applicable, ttl/cleanup marker for previews.
  **Files likely touched**: `infra/modules/**`, `infra/env/**`, `infra/preview/**`.
  **Validation**:
  ```sh
  grep -R "tags" -n infra/modules infra/env infra/preview
  terraform -chdir=infra/env validate
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
  bun run migrate -- --help || true
  npx actionlint .github/workflows/ci.yml || true
  ```
  **Acceptance**: CI blocks deployment if install/lint/typecheck/build/docker/migration checks fail.

- [ ] 6.2 Add Docker image build/push flow
  **What**: Authenticate to AWS with OIDC, login to ECR, build existing server Dockerfile, push SHA-tagged image, and expose image digest for deploy jobs.
  **Files likely touched**: `.github/workflows/deploy-staging.yml`, `.github/workflows/deploy-production.yml`, maybe reusable workflow under `.github/workflows/`.
  **Validation**:
  ```sh
  docker build -t hay-server:${GITHUB_SHA:-local} .
  npx actionlint .github/workflows/deploy-staging.yml .github/workflows/deploy-production.yml || true
  ```
  **Acceptance**: Images are immutable SHA/digest deployments; no `latest` dependency.

- [ ] 6.3 Add staging deployment workflow
  **What**: On `main`, run gates, build/push image, Terraform plan/apply staging, run Drizzle migrations, update ECS Express service, build/upload web SPA, and invalidate CloudFront.
  **Files likely touched**: `.github/workflows/deploy-staging.yml`.
  **Validation**:
  ```sh
  npx actionlint .github/workflows/deploy-staging.yml || true
  ```
  **Acceptance**: Main auto-deploys staging with AWS OIDC staging role and staging backend key.

- [ ] 6.4 Add production deployment workflow
  **What**: From `main`, after GitHub Environment approval, use production role/backend key, run Terraform apply, run migrations, deploy API image, upload prod web build, invalidate CloudFront.
  **Files likely touched**: `.github/workflows/deploy-production.yml`.
  **Validation**:
  ```sh
  npx actionlint .github/workflows/deploy-production.yml || true
  ```
  **Acceptance**: Production cannot deploy without GitHub Environment approval and separate production OIDC role.

- [ ] 6.5 Add preview lifecycle workflow
  **What**: On PR label `preview`, create/update preview infra; on label removal or PR close, destroy preview infra. Build/push image, create preview Turso DB, seed from staging/sanitized template, write required secret values to Secrets Manager by approved external mechanism, run migrations, deploy API, build/upload preview web.
  **Files likely touched**: `.github/workflows/preview.yml`, scripts if absolutely necessary under `scripts/` or `infra/scripts/`.
  **Validation**:
  ```sh
  npx actionlint .github/workflows/preview.yml || true
  terraform -chdir=infra/preview validate
  ```
  **Acceptance**: Preview exists only while label is present/open PR; state key and resources include PR number; preview DB is isolated and disposable.

- [ ] 6.6 Add scheduled preview cleanup
  **What**: Add a scheduled workflow that lists preview state/resources/PRs and destroys stale previews for closed/unlabeled PRs.
  **Files likely touched**: `.github/workflows/preview-cleanup.yml`.
  **Validation**:
  ```sh
  npx actionlint .github/workflows/preview-cleanup.yml || true
  ```
  **Acceptance**: Stale preview infrastructure has an automated cleanup path with safe logging and no production access.

- [ ] 6.7 Add Terraform plan artifacts/comments
  **What**: Surface Terraform plans in Actions summaries or PR comments without leaking secrets. Separate preview/staging/production plan scopes.
  **Files likely touched**: `.github/workflows/*.yml`.
  **Validation**:
  ```sh
  npx actionlint .github/workflows/*.yml || true
  ```
  **Acceptance**: Reviewers can inspect infra changes before apply; plan output is redacted where necessary.

### Phase 7 — Database migrations and Turso preview lifecycle

- [ ] 7.1 Make migration command CI-safe
  **What**: Ensure Drizzle migrations can run in CI against Turso using secrets from AWS/GitHub without echoing tokens.
  **Files likely touched**: `apps/server/drizzle.config.ts`, package scripts/docs, workflow files.
  **Validation**:
  ```sh
  bun run --cwd apps/server migrate -- --help || true
  bun run --cwd apps/server typecheck
  ```
  **Acceptance**: Workflows can run migrations as explicit deployment steps before ECS update.

- [ ] 7.2 Define preview DB create/seed/migrate/destroy steps
  **What**: Implement or document the exact commands used by Actions to create an isolated Turso DB per preview, seed it from staging/sanitized template, write token to Secrets Manager, run migrations, and destroy it on cleanup.
  **Files likely touched**: `.github/workflows/preview.yml`, `.github/workflows/preview-cleanup.yml`, `infra/README.md`, optional scripts.
  **Validation**:
  ```sh
  grep -R "turso\|drizzle\|migrate" -n .github/workflows infra apps/server
  ```
  **Acceptance**: Preview DB lifecycle is deterministic and does not copy production data unsafely.

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
  timeout 20s bun run --cwd apps/server start &
  sleep 3
  curl -fsS http://localhost:3000/health
  ```
  **Acceptance**: `/health` returns 2xx without requiring DB/Redis availability.

- [ ] 8.4 Validate GitHub Actions syntax
  **What**: Run `actionlint` if available. If unavailable, record the blocker and use GitHub's workflow validation on PR.
  **Commands**:
  ```sh
  npx actionlint .github/workflows/*.yml || true
  ```
  **Acceptance**: Workflows pass syntax validation or the missing local tool is documented.

- [ ] 8.5 Validate Tauri config
  **What**: Confirm Tauri config parses and CSP changes do not break the desktop package.
  **Commands**:
  ```sh
  bun run --cwd apps/desktop info || true
  bun run --cwd apps/desktop typecheck || true
  ```
  **Acceptance**: Tauri config is valid when local prerequisites exist; otherwise missing toolchain is documented.

- [ ] 8.6 Validate remote deployment smoke after first staging apply
  **What**: After staging infrastructure is applied, confirm public API and web URLs.
  **Commands**:
  ```sh
  curl -fsS https://staging-api.<delegated-domain>/health
  curl -I https://staging-app.<delegated-domain>/
  ```
  **Acceptance**: Staging API health and static web shell are reachable over HTTPS.

### Phase 9 — Security and review gates

- [ ] 9.1 Run secret/state leakage audit
  **What**: Search for accidental secrets in Terraform files, workflows, env examples, docs, and generated plans.
  **Commands**:
  ```sh
  grep -R "secret_string\|secret_binary\|TURSO_AUTH_TOKEN=.*\|BETTER_AUTH_SECRET=.*\|AWS_SECRET_ACCESS_KEY=.*" -n infra .github docs apps || true
  git diff --check
  ```
  **Acceptance**: No secret values or Terraform-managed sensitive token values are present.

- [ ] 9.2 Security review required
  **What**: Request mandatory security review focused on IAM/OIDC, Secrets Manager boundaries, Turso token lifecycle, CORS, Better Auth cookie settings, Tauri CSP, S3 bucket policy, CloudFront access, and preview isolation.
  **Files likely touched**: none, unless review fixes are needed.
  **Acceptance**: Security reviewer approves or all findings are addressed before merge.

- [ ] 9.3 Quality review
  **What**: Request general implementation review for Terraform module boundaries, workflow reliability, rollback paths, and operator docs.
  **Acceptance**: Reviewer confirms the implementation matches this plan and acceptance criteria.

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
- **Terraform state secret leakage**: Never manage secret values in Terraform; audit plans/state and use Secrets Manager ARNs only.
- **Turso token lifecycle ambiguity**: Keep token creation/rotation outside Terraform and explicitly document CI/operator steps.
- **Preview data exposure**: Seed previews only from staging or sanitized template; never seed from raw production data.
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
- [ ] Remote state keys are distinct for `staging`, `production`, and `preview/pr-<number>`.
- [ ] Production and nonproduction VPCs are separate; staging/previews share nonprod VPC.
- [ ] Production and staging have Redis; previews share nonprod/staging Redis with unique prefixes.
- [ ] Server config supports `REDIS_HOST`, `REDIS_PORT`, and `REDIS_KEY_PREFIX`; ioredis/jobify/verrou keys are namespaced.
- [ ] S3 config supports bucket, region, and prefix; ECS uses task-role access rather than long-lived S3 keys where possible.
- [ ] Secrets Manager ARNs/names are managed/referenced by Terraform, but secret values are not stored in Terraform state.
- [ ] Turso databases/groups are managed by Terraform where appropriate; Turso tokens are external and stored in AWS Secrets Manager.
- [ ] Each preview has an isolated disposable Turso DB, migrated after creation and destroyed on cleanup.
- [ ] Production and staging custom domains are wired as specified.
- [ ] `apps/web` builds a static SPA with environment-specific API URL and uploads to S3 + CloudFront.
- [ ] GitHub Actions include CI gates, staging deploy, production deploy with approval, preview lifecycle, and scheduled preview cleanup.
- [ ] Docker images are pushed to ECR with immutable SHA/digest references.
- [ ] Drizzle migrations run as explicit deployment steps before ECS service update.
- [ ] Tauri CORS/trusted origins and CSP `connect-src` support staging/prod APIs.
- [ ] `/health` is unauthenticated, shallow, and suitable for ECS health checks.
- [ ] CloudWatch log retention is 30 days for staging/production and 7 days for previews.
- [ ] ADRs exist under `docs/adr/` for ECS Express/AWS infra, environment/preview strategy, and Terraform/Turso/secrets boundaries.
- [ ] Security review is completed before merge.

## Open questions / blockers before execution
1. **Delegated domain**: What exact domain or subdomain will be delegated to Route 53 for `app`, `api`, `staging-app`, and `staging-api`?
2. **AWS account/region model**: Are staging and production in one AWS account with separated roles/VPCs, or separate AWS accounts? Which region supports ECS Express Mode for this project?
3. **Terraform version/provider pin**: Confirm Terraform vs OpenTofu and exact AWS/Turso provider versions compatible with `aws_ecs_express_gateway_service`.
4. **Secrets seeding mechanism**: Decide whether Turso/Better Auth/OAuth secret values are written to AWS Secrets Manager manually, by a protected one-off workflow, or by an external secrets operator.
5. **Preview seed source**: Choose staging snapshot vs sanitized template and define who owns sanitization.
6. **S3 SDK/runtime details**: Confirm the current app S3 implementation and whether AWS SDK default credential provider is already available or must be added.
7. **Actionlint availability**: If `actionlint` is not available locally through `npx`, decide whether to install/use `rhysd/actionlint` in CI.
8. **ECS Express custom domains/TLS specifics**: Confirm exact ECS Express/CloudFront/Route 53 integration pattern in the chosen AWS region/provider version before coding modules.
