# Terraform plan comment and artifact policy

## Status

Accepted for this deployment.

## Context

This deployment uses one AWS account in `us-east-1`. Terraform planning may reference or derive metadata for sensitive systems, including Turso, Better Auth, OAuth, and Redis authentication tokens.

Terraform plan output is therefore security-sensitive. CI must provide enough plan feedback for reviewers to understand intended infrastructure changes without exposing raw resource values, secrets, credentials, token material, or sensitive outputs.

This record documents the required policy before any Terraform workflow implementation.

## Decision

### 1. Raw plan output is never published

Raw `terraform show` output must never be published to any pull request comment, GitHub Actions job summary, workflow log appendix, or other reviewer-facing CI surface.

This applies to both human-readable output and any direct rendering of full JSON plan content. Raw plans may contain provider-computed values, configuration values, environment-derived values, output values, and secret-adjacent metadata that are not safe for broad PR visibility.

### 2. PR comments and job summaries use sanitized allowlisted summaries only

Pull request comments and job summaries may include only sanitized, allowlisted Terraform summaries.

Allowed summary fields are limited to:

- Aggregate resource add, change, destroy, and no-op counts.
- Resource type names, such as `aws_ecs_service` or `aws_iam_role`.
- Resource action sets, such as `create`, `update`, `delete`, or `no-op`.

Forbidden fields include:

- Resource names if they include sensitive values.
- Attribute values.
- Terraform variable values.
- Terraform output values.
- Provider configuration values.
- Any secret, credential, token, password, OAuth material, Redis auth token, Turso token, Better Auth secret, or derived sensitive value.

### 3. Sanitization uses a strict jq allowlist

CI must generate reviewer-facing summaries from `terraform show -json` through a strict `jq` allowlist filter.

The filter may extract only:

- `resource_changes[].type`
- `resource_changes[].change.actions`
- Summary counts derived from the action arrays

The filter must never output:

- `resource_changes[].change.before`
- `resource_changes[].change.after`
- `resource_changes[].change.after_unknown`
- `resource_changes[].change.before_sensitive`
- `resource_changes[].change.after_sensitive`
- `output_changes`
- `variables`
- `planned_values`
- `configuration`

Example policy shape, not a complete implementation:

```sh
terraform show -json tfplan \
  | jq '
      .resource_changes
      | map({ type: .type, actions: .change.actions })
      | {
          counts: {
            add: map(select(.actions | index("create"))) | length,
            change: map(select(.actions | index("update"))) | length,
            destroy: map(select(.actions | index("delete"))) | length
          },
          resource_types: (map(.type) | unique | sort),
          actions_by_type: group_by(.type) | map({ type: .[0].type, actions: map(.actions) })
        }
    '
```

Any future filter change that adds fields must be reviewed as a security-sensitive change. The default posture is deny-by-default: if a field is not explicitly allowlisted here, it must not be included in PR comments or job summaries.

### 4. Plan artifacts are short-lived and restricted

Terraform binary plan files and JSON plan artifacts may be uploaded only when needed for maintainer review or follow-up automation.

Required artifact controls:

- Retention is exactly 1 day.
- Access is restricted to GitHub Actions artifact access for authorized repository collaborators.
- Artifacts must not be linked, copied, pasted, or republished into PR comments, job summaries, issues, external storage, or chat systems.
- Artifacts must not be accessible to fork PRs.

Fork-originated pull requests must not receive credentials capable of producing privileged Terraform plans, and must not be able to read binary or JSON plan artifacts from privileged workflows.

### 5. Sensitive Terraform outputs are explicitly marked sensitive

Any Terraform output that could include or derive from sensitive material must be declared with `sensitive = true`.

This includes, but is not limited to:

- Secrets Manager secret values or secret-derived values.
- Turso credentials or token-derived values.
- Better Auth secrets.
- OAuth client secrets or token material.
- Redis/ElastiCache auth tokens.
- Connection strings containing credentials.
- Passwords, signing keys, private keys, and bearer tokens.

Marking outputs as sensitive is required defense-in-depth. It does not relax the requirement to sanitize PR comments, job summaries, logs, and artifacts.

## Explicit security invariants

- Raw `terraform show` output is never published to PR comments or job summaries.
- Reviewer-facing CI output is generated only from a sanitized allowlist.
- The allowlist extracts only resource types, resource action arrays, and derived summary counts.
- Resource `before` and `after` values are never emitted to PR comments or job summaries.
- Binary and JSON Terraform plan artifacts are retained exactly 1 day.
- Artifact access remains restricted through GitHub Actions artifact controls.
- Fork PRs cannot access privileged plan artifacts.
- Sensitive Terraform outputs are marked `sensitive = true`.

## Consequences

This policy preserves useful Terraform review context while avoiding broad publication of plan internals. Maintainers can see high-level add, change, and destroy intent in PR surfaces, but detailed binary or JSON plan artifacts remain short-lived, access-restricted, and unavailable to forks.
