# 02-audit-domain-db-schema.md

## Executive Summary

- Overall Status: PASS
- Required Gate Failures: 0
- Flagged Risks: 0

## Gateboard

| Gate | Status | Why it failed (<=10 words) | Exact fix target |
| --- | --- | --- | --- |
| Requirement-to-test traceability | PASS | — | — |
| Proof artifact verifiability | PASS | — | — |
| Repository standards consistency | PASS | — | — |
| Open question resolution | PASS | — | — |
| Regression-risk blind spots | PASS | — | — |
| Non-goal leakage | PASS | — | — |

## Standards Evidence Table (Required)

| Source File | Read | Standards Extracted | Conflicts |
| --- | --- | --- | --- |
| `AGENTS.md` | yes | Use Bun first; commit after each task; conventional commits | none |
| `README.md` | yes | Use root Bun DB scripts; server DB work lives in `apps/server`; migrations live in `apps/server/drizzle/` | Spec used `db:generate`/`db:migrate`; repo uses `generate`/`migrate` |
| `package.json` | yes | Bun workspace root; Turbo orchestration; root DB scripts filter to `@hay/server` | none |
| `apps/server/package.json` | yes | `generate`, `migrate`, `lint`, `typecheck` are the package-level verification commands | none |
| `biome.json` | yes | Biome is formatter/linter; tabs; organize imports on | none |
| `.github/workflows/ci.yml` | yes | CI requires `bun install --frozen-lockfile`, lint, typecheck, and migration CLI usability | none |
| `CONTRIBUTING.md` | not found | — | none |
| `.github/pull_request_template.md` | not found | — | none |
| `.pre-commit-config.yaml` | not found | — | none |

## Re-Audit Delta (Runs 2+ only)

- Changed gate statuses since previous run: `Open question resolution` changed from FAIL to PASS.
- Still-failing REQUIRED gates: none.
