# KMS and IAM secret isolation model

## Status

Accepted for initial deployment.

## Context

This deployment uses a single AWS account in `us-east-1`. Secrets are stored in AWS Secrets Manager under environment-scoped paths:

- Production: `/production/*`
- Staging: `/staging/*`
- Preview PRs: `/preview/pr-<number>/*`

AWS-managed KMS keys are used for Secrets Manager encryption. Customer-managed KMS keys (CMKs) are intentionally deferred for the initial deployment, so CMK-level key policies and encryption-context conditions are not part of the first implementation.

## Decision

### 1. KMS model

Secrets Manager uses AWS-managed KMS keys, not customer-managed keys.

Because AWS-managed keys do not provide the same per-application CMK policy controls, this deployment relies on IAM and Secrets Manager ARN/path boundaries as compensating controls. Broad KMS permissions are not allowed: no deployment role or ECS task role may include broad `kms:Decrypt`, and no role may rely on KMS permissions as a substitute for strict Secrets Manager resource scoping.

CMK-level encryption-context controls are explicitly deferred. The accepted tradeoff is lower initial operational complexity in exchange for making IAM path isolation, role separation, and trust-policy review security-critical.

### 2. Secrets Manager path IAM

Secret access is scoped by exact Secrets Manager ARN/path boundaries per environment:

- Production roles may access only `/production/*` secrets.
- Staging roles may access only `/staging/*` secrets.
- A preview role for PR `<number>` may access only `/preview/pr-<number>/*` secrets for that specific PR.
- Preview roles are explicitly denied access to `/production/*` and `/staging/*` secrets.

No role may use wildcard `secretsmanager:*`. Policies must grant only the specific Secrets Manager actions required by the role and must scope those actions to the role's environment-specific secret ARNs.

### 3. Deployment role separation

Production, staging, and preview deployments use separate IAM roles:

- Production deployment role.
- Staging deployment role.
- Preview deployment role scoped to a specific PR preview.

Each environment has a separate GitHub OIDC trust policy. Production, staging, and preview trust conditions must be reviewed independently so a preview workflow cannot assume production or staging credentials. OIDC trust policies constrain repository, ref or protected GitHub Environment, audience, subject, and workflow identity; PR same-repo checks, exact label checks, and actor permission checks must be enforced as workflow preflight before AWS credentials are requested.

Preview roles are per-preview security boundaries. A preview role for PR `<number>` must not access another preview's `/preview/pr-<other-number>/*` secrets.

### 4. ECS task role scoping

ECS task roles are scoped to read only the required secret ARNs for their own environment.

- Production ECS tasks may read only the production secrets required by the production service.
- Staging ECS tasks may read only the staging secrets required by the staging service.
- Preview ECS tasks may read only the preview secrets required for their specific PR preview.

ECS task roles must not use wildcard secret paths as a convenience. They must not include wildcard `secretsmanager:*` or broad `kms:Decrypt` permissions.

Preview ECS task roles cannot access production or staging secrets. This denial is both a policy invariant and a required review point for any task role or secret path change.

## Explicit security invariants

- AWS-managed KMS keys are used for initial deployment; CMKs are deferred.
- CMK-level encryption-context authorization is not available in the initial model.
- Production secret access is limited to `/production/*`.
- Staging secret access is limited to `/staging/*`.
- Preview secret access is limited to `/preview/pr-<number>/*` for the specific PR.
- Preview roles and preview ECS task roles cannot access `/production/*` or `/staging/*` secrets.
- No role may include wildcard `secretsmanager:*`.
- No role may include broad `kms:Decrypt`.
- Production, staging, and preview deployments use separate IAM roles and separate GitHub OIDC trust policies.
- ECS task roles read only the environment-specific secret ARNs required by their workload.

## Deferred tradeoff

Customer-managed KMS keys with encryption-context conditions would provide another isolation layer around secret decryption. That is intentionally deferred to keep the initial deployment smaller and simpler.

Until CMKs are introduced, the compensating controls are mandatory: strict Secrets Manager ARN/path IAM, explicit preview denies for production and staging paths, environment-specific deployment roles, environment-specific OIDC trust policies, and narrowly scoped ECS task roles.
