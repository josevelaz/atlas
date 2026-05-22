# Secrets, Turso, and preview trust model

## Status

Accepted for this deployment.

## Context

This deployment uses one AWS account in `us-east-1` with environment-scoped secret paths:

- Production: `/production/*`
- Staging: `/staging/*`
- Preview PRs: `/preview/pr-<number>/*`

Preview environments are limited to same-repository branches, are gated by the exact `preview` label, and require maintainer approval before any privileged deployment workflow can receive AWS credentials.

Terraform manages infrastructure shape, names, ARNs, IAM permissions, Turso database/group resources, and references to secrets. Terraform must not manage or store protected secret values or Turso auth tokens in state. Redis/ElastiCache uses IAM authentication, so there is no Redis token material to store in Terraform state or Secrets Manager.

## Decision

### 1. Two-workflow preview safety model

Preview automation is split into two workflows:

1. An unprivileged `pull_request` workflow runs for all PRs, including forks.
   - It receives no AWS credentials.
   - It cannot read protected environment secrets.
   - It may perform validation, linting, tests, plan-like checks that do not require privileged credentials, and status reporting.
2. A privileged preview deployment workflow runs only through `workflow_dispatch` and protected environment approval.
   - It is same-repository only.
   - Mandatory workflow preflight checks must require `head.repo.full_name == github.repository` before `configure-aws-credentials` runs.
   - Mandatory workflow preflight checks must require the exact `preview` label; similarly named labels do not qualify.
   - Mandatory workflow preflight checks must require the triggering actor/deployer to have repository write or maintainer permission.
   - It receives AWS credentials only after protected environment approval.
   - The OIDC trust policy constrains repository, ref or GitHub Environment, audience, subject, and workflow identity. It must not be described as enforcing PR labels, `head.repo.full_name`, or actor permissions; those checks happen in workflow preflight before AWS credentials are requested.

Fork PRs are non-privileged by design. They may run the unprivileged `pull_request` workflow, but they must never receive AWS credentials, protected secrets, Turso tokens, or preview deployment privileges.

### 2. Protected secret seeding

Secret values are seeded through protected, manual GitHub Actions workflows only.

Required controls:

- Manual workflow trigger.
- GitHub protected environment approval before credentials are issued.
- AWS OIDC role assumption after approval.
- Environment-scoped writes to Secrets Manager paths only:
  - `/production/*`
  - `/staging/*`
  - `/preview/pr-<number>/*`
- Audit evidence from workflow run metadata and approval history.

Terraform manages secret names, ARNs, IAM policies, and permission boundaries only. Terraform must never receive, render, output, import, or store secret values in state.

### 3. Turso token lifecycle

Terraform manages Turso database and group resources through the `celest-dev/turso` provider.

Turso auth tokens are explicitly outside Terraform:

- Tokens are created and rotated out-of-band through the Turso CLI or Turso API.
- Tokens are written to AWS Secrets Manager through the protected manual seeding or rotation workflow.
- Token values must not appear in Terraform variables, plans, state, outputs, logs, or pull request comments.
- Applications read Turso credentials from the environment-appropriate Secrets Manager path.

This keeps short-lived or revocable Turso auth material out of Terraform state while allowing Terraform to own the durable Turso resource topology.

### 4. Redis/ElastiCache IAM authentication

ElastiCache/Valkey uses IAM authentication for this deployment.

Required controls:

- ECS task roles authenticate directly to Redis/Valkey through IAM.
- Terraform configures the IAM authentication path, networking, names, ARNs, and permissions only.
- No Redis/ElastiCache auth token values are generated, seeded, rotated, stored in Secrets Manager, passed through Terraform variables/resource arguments, written to outputs, rendered into plans, or logged in CI.
- Secret seeding workflows have no Redis token lifecycle step.

Terraform may manage Redis/ElastiCache infrastructure, names, ARNs, network placement, and IAM permissions, but there is no Redis token material to manage.

### 5. Sanitized preview database seeding

Preview databases are seeded from a sanitized template database only.

Production or staging-derived live data must not be copied directly into previews. The sanitized template must exclude at least the following forbidden data classes:

- Emails.
- Names.
- OAuth IDs.
- Provider account IDs.
- Access tokens.
- Refresh tokens.
- User content.
- Auth sessions.
- Production-derived message data.
- Staging-derived message data.

Maintainers update the sanitized template only through a protected workflow that records audit evidence, including the workflow run, approver, source inputs, and sanitization process used. Any update to the template must preserve the forbidden-data exclusions above.

### 6. Same-repository preview label trust

The `preview` label is a deployment request, not a standalone authorization grant.

Privileged preview deployment requires all of the following:

- PR source repository is the same repository: `head.repo.full_name == github.repository`.
- Exact label match: `preview`.
- Actor has write or maintainer permission.
- Protected environment approval succeeds.
- AWS OIDC credentials are issued only after the previous workflow preflight checks and protected environment approval pass.

The same-repository, exact-label, and actor-permission checks are mandatory workflow preflight checks before `configure-aws-credentials` runs. The GitHub OIDC trust policy cannot inspect PR labels, `head.repo.full_name`, or actor permission; it constrains the repository, ref or protected environment, audience, subject, and workflow identity.

If any condition fails, the preview deploy workflow must not assume AWS roles, read protected secrets, seed databases, or create preview infrastructure.

## Explicit security invariants

- Fork PRs never receive AWS credentials or protected secrets.
- The unprivileged `pull_request` workflow is safe to run on all PRs.
- Privileged preview deploys are same-repository, label-gated, permission-gated, and environment-approved.
- Terraform manages secret metadata, ARNs, resource topology, and permissions only; it never manages protected secret values.
- Turso auth tokens are created and rotated outside Terraform and stored in Secrets Manager.
- Redis/ElastiCache uses IAM authentication; ECS task roles authenticate directly and no Redis token material is generated, stored, or seeded.
- Preview DBs are seeded only from sanitized templates that exclude personal data, auth material, user content, sessions, and production/staging-derived message data.

## Consequences

This model keeps secret values and revocable tokens out of Terraform state while preserving auditable, protected workflows for seeding and rotation. Preview deployments remain useful for maintainers, but fork PRs and untrusted label changes cannot escalate into AWS, Turso, Redis, or protected database access.
