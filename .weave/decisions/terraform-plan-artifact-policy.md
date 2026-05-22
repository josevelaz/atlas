# Terraform plan comment and artifact policy

## Status

Accepted for this deployment.

## Context

This deployment uses one AWS account in `us-east-1`. Terraform planning may reference or derive metadata for sensitive systems, including Turso, Better Auth, OAuth, and Redis authentication tokens.

Terraform plan output is therefore security-sensitive. CI must provide enough plan feedback for reviewers to understand intended infrastructure changes without exposing raw resource values, secrets, credentials, token material, or sensitive outputs.

This record documents the required policy before any Terraform workflow implementation.

## Decision

### 1. Raw plan stdout is suppressed or restricted

CI `terraform plan -out=tfplan` commands must not stream raw plan details into broadly visible workflow logs. Plan commands must either suppress stdout/stderr or redirect raw output to a restricted temporary file that is not published to reviewer-facing logs, comments, or summaries.

Acceptable command shapes include:

```sh
terraform plan -out=tfplan > /dev/null 2>&1
# or, only when the raw log file remains restricted and is not uploaded/published:
terraform plan -out=tfplan > "$RUNNER_TEMP/terraform-plan.raw.log" 2>&1
```

If plan fails, CI may print a generic failure message and should direct maintainers to rerun locally or inspect restricted runner-only diagnostics. It must not dump raw plan output into public or PR-visible logs.

### 2. Raw plan output is never published

Raw `terraform show` output must never be published to any pull request comment, GitHub Actions job summary, workflow log appendix, or other reviewer-facing CI surface.

This applies to both human-readable output and any direct rendering of full JSON plan content. Raw plans may contain provider-computed values, configuration values, environment-derived values, output values, and secret-adjacent metadata that are not safe for broad PR visibility.

### 3. PR comments and job summaries use sanitized allowlisted summaries only

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

### 4. Reviewer output comes only from the approved jq allowlist path

CI must generate all reviewer-facing Terraform output from the approved `terraform show -json tfplan | jq <allowlist>` path. No other Terraform plan/show output may be used for PR comments, job summaries, log appendices, or copied review notes.

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

### 5. Plan artifacts are private-repository-only, short-lived, and restricted

Terraform binary plan files and full JSON plan artifacts may be uploaded only when all of the following are true:

- The repository is confirmed private.
- The artifact is needed for maintainer review or follow-up automation.
- The artifact controls below are applied.

If the repository is public or privacy cannot be confirmed in CI, do not upload raw binary or full JSON plan artifacts. Store only sanitized allowlisted summaries.

Required artifact controls:

- Retention is exactly 1 day.
- Access is restricted to GitHub Actions artifact access for authorized repository collaborators.
- Artifacts must not be linked, copied, pasted, or republished into PR comments, job summaries, issues, external storage, or chat systems.
- Artifacts must not be accessible to fork PRs.

Fork-originated pull requests must not receive credentials capable of producing privileged Terraform plans, and must not be able to read binary or JSON plan artifacts from privileged workflows.

### 6. Sensitive Terraform outputs are explicitly marked sensitive

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
- CI `terraform plan -out=tfplan` stdout/stderr is suppressed or redirected to restricted runner-only files, not streamed into broadly visible workflow logs.
- Reviewer-facing CI output is generated only from `terraform show -json tfplan | jq <allowlist>` sanitized output.
- The allowlist extracts only resource types, resource action arrays, and derived summary counts.
- Resource `before` and `after` values are never emitted to PR comments or job summaries.
- Binary and JSON Terraform plan artifacts are uploaded only when the repository is confirmed private; otherwise only sanitized summaries are retained.
- Uploaded binary and JSON Terraform plan artifacts are retained exactly 1 day.
- Artifact access remains restricted through GitHub Actions artifact controls.
- Fork PRs cannot access privileged plan artifacts.
- Sensitive Terraform outputs are marked `sensitive = true`.

## Consequences

This policy preserves useful Terraform review context while avoiding broad publication of plan internals. Maintainers can see high-level add, change, and destroy intent in PR surfaces, while raw plan stdout is suppressed or restricted. Detailed binary or JSON plan artifacts are available only for confirmed-private repositories, remain short-lived and access-restricted, and are unavailable to forks.
