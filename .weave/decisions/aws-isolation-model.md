# AWS Single-Account Isolation Model

## Status

Accepted for this deployment.

## Context

This deployment uses a single AWS account in the `us-east-1` region rather than separate AWS accounts for production, staging, and preview environments. Because account-level separation is not available, isolation must be enforced through strict IAM role separation, resource naming and path boundaries, environment-specific state, and GitHub OIDC trust controls.

This record documents the required isolation model. It is a decision record only and does not define implementation code.

## Decision

### 1. Account model

- All environments run in one AWS account.
- The deployment region is `us-east-1`.
- The single-account model is compensated by environment-scoped IAM roles, resource boundaries, tags, state keys, and secrets paths.

### 2. IAM role separation

Separate IAM roles are required for each environment class:

- Production deploy role
- Staging deploy role
- Preview deploy roles

Preview roles have no access to production resources. Specifically, preview roles must not be able to read, write, list, mutate, or destroy production secrets, Terraform state, S3 buckets or prefixes, Redis resources, Turso credentials, or other production-scoped resources.

Preview roles must also be isolated from each other where practical, especially for secrets and state. A preview role for PR `<number>` may only access resources explicitly scoped to that PR preview.

### 3. Terraform state key separation

Terraform remote state must be separated by S3 backend key per environment:

- Staging: `infra/staging/terraform.tfstate`
- Production: `infra/production/terraform.tfstate`
- Preview PRs: `infra/previews/pr-<number>/terraform.tfstate`

IAM permissions for state access must be scoped so each role can access only its own state key or prefix. Preview roles must not read or write production or staging state.

### 4. Secrets Manager path separation

Secrets Manager secrets must be separated by environment path:

- Production: `/production/*`
- Staging: `/staging/*`
- Preview PRs: `/preview/pr-<number>/*`

Preview roles can only read their own preview prefix. A preview role for PR `<number>` must not access `/production/*`, `/staging/*`, or another preview's `/preview/pr-<other-number>/*` secrets.

This path-based isolation is especially important because KMS uses AWS-managed keys rather than customer-managed keys.

### 5. S3 bucket separation

S3 storage must be separated as follows:

- One production bucket for production assets and data.
- One non-production bucket for staging and previews.

The non-production bucket must use environment prefixes:

- `staging/`
- `previews/pr-<number>/`

Deploy roles must be scoped to the matching bucket and prefix:

- The production role can access the production bucket only as required for production deploys.
- The staging role can access only the staging prefix in the non-production bucket.
- A preview role can access only its own `previews/pr-<number>/` prefix in the non-production bucket.

Preview roles have no access to the production bucket.

### 6. ElastiCache / Redis separation

Redis is separated by VPC and environment class:

- The production VPC has its own production Redis deployment.
- The non-production VPC has a staging Redis deployment shared by staging and previews.

Because previews share the non-production Redis deployment, preview data must use per-environment key prefixes, such as `preview:pr-<number>:`. Staging data must use a separate staging prefix, such as `staging:`.

Preview roles and applications must not have access to production Redis connection details or production Redis network paths.

Redis/ElastiCache authentication uses IAM. ECS task roles authenticate directly to Redis/Valkey; no Redis auth token material is created, stored in Secrets Manager, or managed in Terraform state.

### 7. VPC separation

Network isolation is enforced with two VPCs in the same AWS account:

- Production VPC
- Non-production VPC

There must be no VPC peering between production and non-production VPCs. Production-only resources, including production Redis, must remain reachable only from production-scoped workloads and network paths.

### 8. Tag-conditioned permissions

All preview resources must be tagged with at least:

- `Environment=preview`
- `PR=<number>`

Cleanup permissions for preview resources must be scoped by tags so cleanup jobs can only affect resources matching the intended preview environment and PR number. Tag-conditioned permissions are a compensating control for safely creating and destroying ephemeral preview resources inside the shared account.

### 9. GitHub OIDC trust policies

GitHub OIDC trust policies must be separated per environment:

- Production OIDC trust policy
- Staging OIDC trust policy
- Preview OIDC trust policy

GitHub OIDC trust policies constrain repository, ref or protected GitHub Environment, audience, subject, and workflow identity. They cannot enforce PR labels, `head.repo.full_name`, or actor repository permissions.

Preview credential issuance still requires same-repository PRs, the exact `preview` label, and a trusted actor/deployer with write or maintainer permission, but those are mandatory workflow preflight checks that must pass before `configure-aws-credentials` runs. Fork PRs never receive AWS credentials.

Production deploys require GitHub Environment approval. The production role trust policy must be tied to the production GitHub Environment so protected environment approval is required before production AWS credentials are issued.

Protected GitHub Environment approval is the credential gate for privileged deploy workflows.

### 10. KMS model

This deployment uses AWS-managed KMS keys, not customer-managed keys (CMKs).

Because CMK-level policy separation is not used, compensating controls are mandatory:

- Strict Secrets Manager ARN and path IAM boundaries.
- Strict role separation by environment.
- No preview access to production secrets, state, buckets, Redis, Turso credentials, or other production resources.
- Environment-specific OIDC trust policies.

## Explicit security invariants

- Preview roles have no access to production resources.
- Fork PRs never receive AWS credentials.
- Production deploys require GitHub Environment approval.
- Preview secrets, state, S3 objects, and cleanup permissions are scoped to the specific PR preview.
- Production and non-production networks are separate VPCs with no peering between them.

## Consequences

This model allows a single AWS account to host production, staging, and preview deployments while reducing the blast radius of staging and preview workflows. The tradeoff is that IAM, OIDC trust policies, resource paths, prefixes, and tags become security-critical and must be reviewed whenever deployment automation changes.
