# Actionlint Availability Finding

Date: 2026-05-22

## Check performed

From `/Users/jose/projects/hay` on branch `main`:

```sh
which actionlint || true
actionlint --version 2>/dev/null || true
```

## Finding

`actionlint` is not available in the current environment. Both commands produced no usable path or version output.

## Recommendation

Because the project plan requires workflow validation as a required, non-silent gate and no GitHub Actions workflows exist yet, add a required CI job that validates workflows without relying on this local environment.

Recommended gate:

```yaml
name: github-actions-lint

on:
  pull_request:
  push:
    branches: [main]

jobs:
  zizmor:
    name: zizmor
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - name: Run zizmor
        uses: zizmorcore/zizmor-action@v0.1.4
        with:
          persona: regular
```

This should be configured as a required branch protection check. It must fail the workflow on findings; do not make it advisory and do not mask failures with `|| true` or `continue-on-error: true`.

If strict GitHub Actions syntax validation is required later, add an `actionlint` CI step using a pinned action or container in CI even though the binary is not installed locally.

## Outcome

Local `actionlint` gate is unavailable. Use `zizmor` as the concrete required CI gate for GitHub Actions workflow validation/hardening until an `actionlint` CI runner step is added.
