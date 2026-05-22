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

## Secret seeding expectations

Secret values are never stored in Terraform configuration, Terraform variables, or Terraform state intentionally.

Terraform is responsible for creating secret names and ARNs only. After Terraform creates those secret containers, seed the actual secret values by one of these protected paths:

- The protected GitHub Actions seed workflow.
- Manual seeding through the AWS Console.
- Manual seeding through the AWS CLI.

Do not commit secret values, pass them through Terraform, or include them in plan output.
