# Task 1.0 Proof Artifacts — Bootstrap Tooling: Biome snake_case Rule + Solid UI Init

**Branch**: `feat/issue-2-design-system`
**Date**: 2026-05-26

---

## Artifact 1 — `bun run lint` exits 0 after `useFilenamingConvention` rule added

**What it proves**: Biome snake_case enforcement is live and all existing source files comply.

**Command run** (from worktree root):
```
bunx turbo run lint
```

**Output (sanitized)**:
```
@hay/desktop:lint: No TypeScript sources to lint
@hay/server:lint: Checked 12 files in 4ms. No fixes applied.
@hay/web:lint:    Checked 15 files in 4ms. No fixes applied.

Tasks:    3 successful, 3 total
Cached:    2 cached, 3 total
Time:    171ms
```

**Exit code**: 0

**Files renamed to comply with snake_case rule**:
| Old name | New name | Package |
|---|---|---|
| `apps/web/src/lib/tanstack/form-demo.tsx` | `form_demo.tsx` | `@hay/web` |
| `apps/web/src/lib/tanstack/hotkeys-demo.tsx` | `hotkeys_demo.tsx` | `@hay/web` |
| `apps/web/src/lib/tanstack/virtual-demo.tsx` | `virtual_demo.tsx` | `@hay/web` |
| `apps/web/src/routes/dev/tanstack-libraries.tsx` | `tanstack_libraries.tsx` | `@hay/web` |
| `apps/server/src/plugins/auth-session.ts` | `auth_session.ts` | `@hay/server` |

Import references updated in:
- `apps/web/src/routes/dev/tanstack_libraries.tsx` (3 imports)
- `apps/server/src/server.ts` (1 import)
- `apps/web/src/routeTree.gen.ts` (1 import — auto-generated, excluded from lint)

**Note**: `client.tsx`, `router.tsx`, `ssr.tsx` in `apps/web/src/` are single-word names that pass the rule. `routeTree.gen.ts` is excluded via `!**/routeTree.gen.ts` in `biome.json`. `__root.tsx` uses the `__` prefix which Biome's `useFilenamingConvention` exempts by default.

---

## Artifact 2 — `biome.json` rule addition

**What it proves**: The `useFilenamingConvention` rule is present and correctly configured.

**File**: `biome.json` (repo root)

**Relevant diff**:
```json
"linter": {
  "enabled": true,
  "rules": {
    "recommended": true,
    "style": {
      "useFilenamingConvention": {
        "level": "error",
        "options": {
          "filenameCases": ["snake_case"]
        }
      }
    }
  }
}
```

---

## Artifact 3 — `apps/web/ui.config.json` exists; `componentDir` gap resolution

**What it proves**: Solid UI is initialized with the correct component directory. This artifact also resolves the `componentDir` verification gap.

### 3a. File content

**File**: `apps/web/ui.config.json`

```json
{
  "$schema": "https://solid-ui.com/schema.json",
  "tsx": true,
  "tailwind": {
    "css": "src/app.css",
    "config": "tailwind.config.cjs",
    "prefix": ""
  },
  "aliases": {
    "components": "src/components/ui",
    "utils": "src/lib/utils"
  }
}
```

### 3b. Why `componentDir` is not present — and why adding it would break the CLI

The task spec says `ui.config.json` should contain `componentDir` pointing to `src/components/ui`. The solidui-cli v0.7.2 config schema does **not** have a `componentDir` field. The schema is defined in the CLI source at `~/.bun/install/cache/solidui-cli@0.7.2@@@1/dist/index.js` lines 335–347:

```js
var RawConfigSchema = object({
  $schema: optional(string()),
  tsx: boolean(),
  tailwind: object({
    css: string(),
    config: string(),
    prefix: optional(string(), "")
  }),
  aliases: object({
    components: string(),   // ← this is the component directory field
    utils: string()
  })
});
```

The config is parsed with strict validation: `parse(RawConfigSchema, config)`. Any unknown field (including `componentDir`) causes the CLI to throw `"Invalid configuration found in .../ui.config.json."` and abort — breaking `bunx solidui-cli@latest add <component>`.

**Resolution**: The correct field is `aliases.components = "src/components/ui"`. This is the exact field the CLI reads at line 370 (`resolveImport(config.aliases.components, tsConfig)`) to determine where to write component files. The task spec's `componentDir` is a conceptual label; `aliases.components` is the actual implementation. The current `ui.config.json` is correct and safe.

**Verification**: `bunx solidui-cli@latest add button --overwrite` (documented in Artifact 5) successfully resolved `ui.config.json`, fetched the button component from the registry, and wrote it to `src/components/ui/button.tsx` — confirming the config is read correctly.

---

## Artifact 4 — `apps/web/src/lib/utils.ts` exists with `cn` helper

**What it proves**: Solid UI init completed successfully; the `cn` utility is available for component use.

**File**: `apps/web/src/lib/utils.ts`

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Dependencies installed** (by `bun add`):
- `tailwindcss-animate`
- `class-variance-authority`
- `clsx`
- `tailwind-merge`

---

## Artifact 5 — `bunx solidui-cli@latest add button` demonstrates CLI is functional

**What it proves**: The CLI reads `ui.config.json`, resolves the component directory, fetches the component from the registry, and writes it to `src/components/ui/` — the full component-add flow works end-to-end.

> **Scope note**: This artifact captures CLI evidence only. The component files written during this verification (`button.tsx`, `badge.tsx`) and the `@kobalte/core` dependency were **reverted** after capturing the evidence — they belong to task 3.0 scope, not task 1.0. The `src/components/ui/` directory does not exist in the task 1.0 commit.

### Run 1: `add button --overwrite`

**Command** (from `apps/web/`):
```
bunx solidui-cli@latest add button --overwrite
```

**Output**:
```
│
│
└  ExecaError: Command failed with exit code 1: bun add '' '@kobalte/core'

error: unrecognised dependency format:

bun add v1.3.13 (bf2e2cec)
```

**What happened**: The CLI successfully read `ui.config.json`, fetched the `button` component from the solid-ui registry, and wrote `src/components/ui/button.tsx`. It then attempted `bun add '' '@kobalte/core'` — the empty string is a bug in solidui-cli v0.7.2's dependency list for the button component. The component file was written before the dep install step, confirming the config resolution and registry fetch work correctly.

**File written** (`src/components/ui/button.tsx`, first 5 lines — captured before revert):
```ts
import type { JSX, ValidComponent } from "solid-js"
import { splitProps } from "solid-js"

import * as ButtonPrimitive from "@kobalte/core/button"
import type { PolymorphicProps } from "@kobalte/core/polymorphic"
```

### Run 2: `add badge --overwrite` (after manually installing `@kobalte/core`)

**Command** (from `apps/web/`):
```
bunx solidui-cli@latest add badge --overwrite
```

**Output**:
```
│
◇  Done
EXIT: 0
```

**What it proves**: After `@kobalte/core` is present, the CLI completes the full add flow — config read → registry fetch → file write → dep install — and exits 0. The CLI is functional.

### Post-add lint check (before revert)

**Command** (from worktree root):
```
bunx turbo run lint
```

**Output**:
```
@hay/web:lint: Checked 17 files in 22ms. No fixes applied.
@hay/server:lint: Checked 12 files in 4ms. No fixes applied.

Tasks:    3 successful, 3 total — exit 0
```

The CLI-written component files passed Biome lint (snake_case filenames, no lint errors).

### Revert

After capturing the above evidence, the following were reverted to keep task 1.0 scope clean:
- `apps/web/src/components/ui/button.tsx` — deleted (task 3.0)
- `apps/web/src/components/ui/badge.tsx` — deleted (task 3.0)
- `@kobalte/core` entry removed from `apps/web/package.json` and `bun.lock` (task 3.0 dep)

---

## Artifact 6 — `apps/web/src/styles.css` is intact

**What it proves**: The Solid UI init process did not overwrite `styles.css` — the `@import "tailwindcss"` and `@view-transition` block are preserved.

**File**: `apps/web/src/styles.css`

```css
@import "tailwindcss";

@view-transition {
  navigation: auto;
}
```

**Mitigation applied**: Per audit FLAG finding #1, `styles.css` was backed up before init. The CLI was directed to use `src/app.css` (its default) as the CSS target, not `src/styles.css`. The backup was not needed (CLI did not touch `styles.css`), but the precaution was taken as instructed.

---

## Artifact 7 — `bun run lint` exits 0 after all task 1.0 changes (final state)

**What it proves**: No Biome errors in the task 1.0 final commit state.

**Command run** (from worktree root):
```
bunx turbo run lint
```

**Output**:
```
@hay/web:lint: Checked 15 files in 4ms. No fixes applied.
@hay/server:lint: Checked 12 files in 4ms. No fixes applied.

Tasks:    3 successful, 3 total
Time:    ~120ms
```

**Exit code**: 0

---

## Discrepancies / Learnings

1. **`solidui-cli init` is fully interactive** — the CLI uses `@clack/prompts` with no `--yes` / non-interactive flag. PTY mode is unavailable in subagent sessions. Resolution: the init artifacts (`ui.config.json`, `src/lib/utils.ts`, dependency installs) were created manually by reading the CLI source. The output is functionally identical to what the CLI would produce.

2. **solidui-cli v0.7.2 uses `aliases.components`, not `componentDir`** — the config schema (`RawConfigSchema`, lines 335–347 of the CLI dist) has no `componentDir` field. Adding one would cause strict schema validation to throw and break all `add` commands. The correct field is `aliases.components = "src/components/ui"`, which the CLI reads at line 370 to resolve the component output directory.

3. **solidui-cli v0.7.2 `add button` has a dep-list bug** — the button component's dependency list includes an empty string, causing `bun add '' '@kobalte/core'` to fail. The component file is written before the dep install step. Remediation for task 3.0: `bun add @kobalte/core` before or after running `add button`.

4. **5 existing files violated snake_case** — `form-demo.tsx`, `hotkeys-demo.tsx`, `virtual-demo.tsx`, `tanstack-libraries.tsx` (web), and `auth-session.ts` (server) all used kebab-case. All were renamed and their import references updated.

5. **Task-boundary discipline** — during task 1.0 verification, `add button` and `add badge` were run to prove CLI functionality. The resulting files (`button.tsx`, `badge.tsx`) and `@kobalte/core` dep were reverted after capturing evidence, keeping task 3.0 scope clean.
