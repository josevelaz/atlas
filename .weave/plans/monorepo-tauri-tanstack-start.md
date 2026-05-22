# Monorepo Tauri TanStack Start Solid Migration

## TL;DR
> **Summary**: Convert the current Bun/Elysia single-package repository into a Bun workspace monorepo with `apps/server` preserving the existing API, `apps/web` as a TanStack Start SolidJS app sourced from the required TanStack CLI scratch scaffold and TanStack Intent guidance, and `apps/desktop` as a Tauri v2 shell aligned to the web app's build/dev output.
> **Estimated Effort**: Large

## Context
### Original Request
Revise the existing monorepo/Tauri/TanStack Start migration plan in place to incorporate the updated TanStack application requirements without implementing the migration.

Existing migration context to preserve:

- `apps/server` is the existing Elysia JS server, renamed as package `@hay/server`.
- `apps/web` is the TanStack Start application.
- `apps/desktop` is a Tauri v2 app using the `apps/web` production bundle as its UI.
- Bun remains the JavaScript package manager.
- Biome is the project toolchain.
- The original brief was: Create a blank TanStack Start app with no extra integrations or feature scaffolding.

Updated TanStack requirements to preserve exactly during implementation:

- The TanStack application will use SolidJS instead of React.
- Start by scaffolding the project with the TanStack CLI command exactly:
  `npx @tanstack/cli@latest create my-tanstack-app --agent --package-manager bun --toolchain biome --add-ons tanstack-query,form`
- If execution environment starts from an existing platform template/custom starter instead of TanStack CLI output, still run the TanStack CLI command in a separate scratch directory, then merge generated integrations, dependencies, config, scripts, and relevant file structure into the actual project.
- After scaffolding, run:
  `npx @tanstack/intent@latest install`
  `npx @tanstack/intent@latest list`
- Use installed TanStack Intent skills/package-shipped guidance before architectural or library-specific changes; do not guess when shipped skill can tell current pattern.
- Maintain durable context in `AGENTS.md` or equivalent, documenting: exact TanStack CLI command used, follow-up TanStack Intent commands, chosen stack and integrations, environment variables needed, deployment notes, key architectural decisions, known issues/gotchas, and next steps.
- Include and demonstrate these TanStack libraries in the project: TanStack Start, TanStack Router, TanStack Intent, TanStack CLI, TanStack Query, TanStack Form, TanStack Store, TanStack Hotkeys, TanStack Pacer, TanStack Virtual.

### Key Findings
- The repo is a normal non-bare git repository at `/Users/jose/projects/hay`. This plan edit is documentation-only, so a new worktree is not required for the plan revision; the eventual migration should still prefer a dedicated task worktree.
- Current root package is named `atlas`, uses Bun with `bun.lock`, and has root scripts for server dev/start, Drizzle, Biome linting, local Turso, and Husky.
- The existing server entrypoint is `src/index.ts`; the Elysia app factory is `src/server.ts`; Better Auth is mounted at `/api/auth/*`; `/me` is protected by `authSessionPlugin`/`requireAuth`.
- Server paths are currently package-relative: `elysia-autoload`, `@elysiajs/static`, and `drizzle.config.ts` assume the process runs from the package root. The migration must keep server scripts running from `apps/server` CWD.
- `tsconfig.json` currently has server-specific KitaJS JSX settings. Those must move to `apps/server/tsconfig.json`; the web app must use SolidJS JSX settings (`jsx: "preserve"`, `jsxImportSource: "solid-js"`) rather than React settings.
- `drizzle.config.ts` currently points to `./src/db/schema.ts` and `./drizzle`; moving it into `apps/server` preserves those paths.
- Current `.env.example` is server-oriented. In a monorepo, app-local env examples are safer; keep root env docs only for repo/compose-level guidance.
- Current default CORS origins already include `http://localhost:3001` and `http://localhost:5173`; choose one web dev port and keep Tauri `devUrl`, TanStack Start/Vite dev server, and CORS aligned.
- Context7 TanStack CLI docs confirm `tanstack create` supports add-ons, package manager selection, and Biome toolchain scaffolding. The required command does not explicitly pass `--framework Solid`, so implementation must verify the scaffolded framework before merging.
- Context7 TanStack Start docs confirm SolidJS support via `@tanstack/solid-start`, `@tanstack/solid-router`, Solid hydration entrypoints, and Solid TypeScript settings. TanStack Start is still full-stack/SSR-oriented, so static/client bundle suitability for Tauri must be proven.
- Registry research shows Solid-oriented packages exist for the requested libraries (`@tanstack/solid-start`, `@tanstack/solid-router`, `@tanstack/solid-query`, `@tanstack/solid-form`, `@tanstack/solid-store`, `@tanstack/solid-hotkeys`, `@tanstack/solid-pacer`, `@tanstack/solid-virtual`), but final package choices must follow the installed TanStack Intent/package guidance at execution time.
- Tauri `frontendDist` is relative to `apps/desktop/src-tauri/tauri.conf.json`; align it to the actual `apps/web` build output directory proven by the TanStack Start Solid build, expected to be `../../web/dist` only if that directory contains the loadable production UI entrypoint.

### Risks / Open Questions
- The exact required TanStack CLI command omits a Solid framework flag. If it generates React output, do not leave React in `apps/web`; use TanStack Intent/current TanStack docs to merge the generated integrations/config/scripts into a SolidJS TanStack Start app, or rerun an additional Solid-specific scaffold only as supporting evidence while preserving the required scratch command.
- TanStack Start Solid may emit SSR/server output rather than a purely static client artifact. Tauri production integration is not complete until the executor proves the selected `frontendDist` points at a loadable UI bundle, or documents the needed adapter/static-export/server strategy.
- TanStack Intent may install guidance files, skills, or package metadata into locations that affect repo conventions. Inspect and document the installed guidance before making web architecture choices.
- The `form` add-on naming may map to TanStack Form differently across CLI versions. Verify generated dependencies and generated code before normalizing to `@tanstack/solid-form`.
- Root `turbo run build` plus Tauri `beforeBuildCommand` can build `@hay/web` twice. Prefer safe correctness first; optimize later only after the baseline works.
- Moving `dev:db` into `apps/server` changes the local Turso DB file location from `local.db` at repo root to `apps/server/local.db` unless the command explicitly points elsewhere.
- Tauri build validation depends on local Rust/Tauri prerequisites. If unavailable, record `tauri info` output and treat full bundle validation as blocked by toolchain setup, not by repo structure.
- Future production desktop auth must explicitly handle Tauri production origins (`tauri://localhost` on macOS/Linux and `https://tauri.localhost` on Windows, subject to current Tauri docs), Better Auth `trustedOrigins`, CORS allowlists, and cookie `SameSite=None; Secure` versus same-origin API strategy. Do not assume browser-web cookie defaults work inside the production Tauri webview.
- Future production desktop hardening must add a Tauri CSP (`app.security.csp`) that restricts script/connect sources to the app UI and approved API origins before sensitive auth or token flows are enabled.

## Objectives
### Core Objective
Restructure the repository into a Bun workspace monorepo without regressing the existing Elysia server, while adding a blank TanStack Start SolidJS web app and a Tauri v2 desktop app that consumes the verified `apps/web` production UI bundle.

### Deliverables
- [ ] Root Bun workspace with `private: true`, workspaces `apps/*` and `packages/*`, `turbo.json`, and root scripts that delegate to `turbo run`.
- [ ] Existing server moved into `apps/server` with package name `@hay/server`, package-local scripts, package-local Drizzle config, and preserved runtime behavior.
- [ ] Required TanStack CLI scratch scaffold created with the exact command, followed by required TanStack Intent install/list commands.
- [ ] `apps/web` package named `@hay/web`, implemented as a blank TanStack Start SolidJS app using Bun and Biome, with generated scaffold integrations/config/scripts merged from scratch output.
- [ ] Minimal blank/no-product demonstrations for TanStack Start, Router, Intent, CLI, Query, Form, Store, Hotkeys, Pacer, and Virtual.
- [ ] New `apps/desktop` Tauri v2 skeleton with `src-tauri`, `tauri.conf.json`, default capabilities, thin `main.rs`, and app logic in `lib.rs`.
- [ ] Tauri `devUrl`, `frontendDist`, `beforeDevCommand`, and `beforeBuildCommand` aligned to the actual `apps/web` dev server and production output.
- [ ] Root `tsconfig.base.json` plus per-app `tsconfig.json` files, with server-only KitaJS JSX settings isolated to `apps/server` and SolidJS settings isolated to `apps/web`.
- [ ] Updated Biome, Turborepo, Docker, Drizzle, env examples, gitignore/dockerignore, README commands, and `AGENTS.md` durable context for the monorepo layout and TanStack decisions.
- [ ] Phase-by-phase validation commands that prove install, lint, typecheck, build, server smoke, web build, TanStack library smoke, and Tauri info/build behavior.

### Definition of Done
- [ ] The exact required TanStack CLI command has been run from a scratch location such as `.tmp/tanstack-cli`, not from the repo root.
- [ ] The exact required TanStack Intent commands have been run after scaffolding, and their guidance was inspected before web architecture/library choices were finalized.
- [ ] `apps/web` is SolidJS-based and has no remaining React framework dependency/imports unless a generated scratch artifact remains only in ignored `.tmp/**`.
- [ ] `AGENTS.md` or app-local equivalent documents the exact TanStack CLI command, Intent commands, stack/integrations, env vars, deployment notes, architecture decisions, known gotchas, and next steps.
- [ ] `bun install --frozen-lockfile` succeeds from the repo root after the migration.
- [ ] `bun run lint` succeeds from the repo root and delegates through `turbo run lint`.
- [ ] `bun run typecheck` succeeds from the repo root and delegates through `turbo run typecheck`.
- [ ] `bun run build` succeeds from the repo root and delegates through `turbo run build`.
- [ ] `BETTER_AUTH_SECRET=test BETTER_AUTH_URL=https://api.example.test CORS_ALLOWED_ORIGINS=https://app.example.test bun run --cwd apps/server start` starts the server without path errors, and `GET /` returns `Hello World`.
- [ ] `bun run --cwd apps/web build` creates the verified production UI output consumed by Tauri.
- [ ] A minimal dev/docs route or hidden smoke component compiles demonstrations of TanStack Query, Form, Store, Hotkeys, Pacer, and Virtual without adding product features.
- [ ] `bun run --cwd apps/desktop info` reports Tauri v2 versions, or clearly reports missing local prerequisites.
- [ ] If Rust/Tauri prerequisites are installed, `bun run --cwd apps/desktop build` reaches the Tauri bundling step using the verified `apps/web` production UI output.
- [ ] `docker build -t hay-server-monorepo .` succeeds or any remaining Docker issue is explicitly documented with the failing command/output.
- [ ] `git status --short` shows only intentional migration files plus pre-existing `.weave/runtime` noise that is not part of the migration.

### Guardrails (Must NOT)
- Do not replace Bun with npm, pnpm, or yarn for project package management. The required one-off `npx` TanStack commands are explicit exceptions because the user specified them exactly.
- Do not skip, alter, or “equivalent command” the required TanStack CLI scratch command.
- Do not make `apps/web` a React app; React output from the required scratch scaffold must be treated as source material to merge/convert, not as the final framework.
- Do not make architectural or library-specific TanStack choices before inspecting installed TanStack Intent/package-shipped guidance.
- Do not add product features, real domain UI, auth flows, dashboards, or non-requested integrations to the web app; keep demonstrations blank/minimal and developer-facing.
- Do not bundle or refactor the Elysia server in this migration; preserve TypeScript-at-runtime via Bun unless a separate server bundling audit is approved.
- Do not move server runtime tasks to root CWD; server scripts must execute from `apps/server` so autoload, static assets, and Drizzle relative paths remain valid.
- Do not put Solid/TanStack JSX settings in the server tsconfig or KitaJS JSX settings in the web tsconfig.
- Do not commit scratch output under `.tmp/**`, real `.env`, `.env.production`, `*.db`, `node_modules`, app `dist`, or Tauri `target` outputs.
- Do not add a broad shared package until there is actual shared code; keep `packages/*` available but empty or `.gitkeep` only.
- Do not consider desktop auth or production Tauri integration complete until the Tauri production origin, cookie/CORS behavior, and TanStack Start bundle suitability are verified.
- Do not add broad Tauri capabilities (`fs`, `shell`, `http`, etc.) or relax CSP for convenience; add only documented plugin permissions required by a concrete feature.

## TODOs

- [x] 1. Preflight the git/worktree state
  **What**: Confirm repo shape, worktree status, and whether execution is happening in a dedicated task worktree before touching project files. Because this is a broad migration, prefer a dedicated worktree/branch such as `chore/monorepo-tauri-tanstack-start-solid` unless the executor is explicitly already in the intended worktree.
  **Acceptance**: Run `git rev-parse --show-toplevel`, `git rev-parse --is-bare-repository`, `git worktree list --porcelain`, and `git status --short`; document any pre-existing untracked files and do not include `.weave/runtime/**` in the migration commit.

- [x] 2. Capture the current baseline behavior
  **What**: Validate the pre-migration app enough to distinguish migration regressions from existing issues.
  **Acceptance**: Run `bun install --frozen-lockfile`, `bun run lint`, and a baseline smoke such as `BETTER_AUTH_SECRET=test timeout 10s bun run dev` followed by `curl http://localhost:3000/` if the server stays up; record any failure before changing files.

- [x] 3. Create the required TanStack CLI scratch scaffold first
  **What**: Create an ignored scratch scaffold before modifying the real app structure. Run the command exactly as requested from a scratch parent directory so generated files land under `.tmp/tanstack-cli/my-tanstack-app`, not the repo root. If the execution environment starts from an existing platform template/custom starter, still run this scratch command and use it as the merge source of truth for generated integrations, dependencies, config, scripts, and relevant file structure.
  **Files**: `.gitignore`, `.tmp/tanstack-cli/my-tanstack-app/**`
  **Acceptance**: Run `rm -rf .tmp/tanstack-cli && mkdir -p .tmp/tanstack-cli && cd .tmp/tanstack-cli && npx @tanstack/cli@latest create my-tanstack-app --agent --package-manager bun --toolchain biome --add-ons tanstack-query,form`; confirm `.tmp/` is ignored; capture the generated `package.json`, lockfile/toolchain files, route structure, and add-on files for later merge review.

- [x] 4. Run TanStack Intent and inspect installed guidance before web decisions
  **What**: Immediately after scaffolding, run the required TanStack Intent commands from the scratch app context. Read the installed intents/package-shipped guidance before choosing package names, route layout, provider placement, Start adapter/build assumptions, or library demo patterns.
  **Files**: `.tmp/tanstack-cli/my-tanstack-app/**`, `AGENTS.md`
  **Acceptance**: From `.tmp/tanstack-cli/my-tanstack-app`, run `npx @tanstack/intent@latest install` and then `npx @tanstack/intent@latest list`; record where guidance was installed, which intents are available, and which guidance was used for TanStack Start Solid, Router, Query, Form, Store, Hotkeys, Pacer, and Virtual decisions.

- [x] 5. Gate on scaffold framework and SolidJS final target
  **What**: Inspect the scratch output for framework choice, package names, JSX settings, route tree generation, and Start build scripts. If the exact required command produced React output or omitted Solid settings, keep the generated integrations/config/scripts as reference material but convert/merge into a SolidJS final app using TanStack Intent/current docs rather than guessing.
  **Files**: `.tmp/tanstack-cli/my-tanstack-app/package.json`, `.tmp/tanstack-cli/my-tanstack-app/src/**`, `.tmp/tanstack-cli/my-tanstack-app/tsconfig.json`
  **Acceptance**: Document whether the scratch scaffold is Solid or React; before creating `apps/web`, define the final Solid package set and config deltas. Final `apps/web` must prefer Solid packages such as `solid-js`, `@tanstack/solid-start`, `@tanstack/solid-router`, `@tanstack/solid-query`, `@tanstack/solid-form`, `@tanstack/solid-store`/`@tanstack/store`, `@tanstack/solid-hotkeys`, `@tanstack/solid-pacer`, and `@tanstack/solid-virtual`, adjusted only if Intent/current package guidance says otherwise.

- [x] 6. Create the root workspace and Turborepo contract
  **What**: Convert root `package.json` into a private workspace root while keeping the root name `atlas` unless a separate product/package rename is approved. Move app-specific dependencies out of root in later tasks; keep root dev tooling only. Add Turborepo config with package-task orchestration.
  **Files**: `package.json`, `turbo.json`, `tsconfig.base.json`, `packages/.gitkeep`, `bun.lock`
  **Acceptance**: Root `package.json` has `private: true`, `workspaces: ["apps/*", "packages/*"]`, and scripts use `turbo run` (for example `build`, `dev`, `dev:server`, `dev:web`, `dev:desktop`, `lint`, `lint:fix`, `typecheck`, `start`, `dev:db`, `generate`, `push`, `migrate`, `studio`). The only non-Turbo root script should be root-only tooling such as `prepare: husky`. Run `bun install` to refresh `bun.lock` after manifest edits.

- [x] 7. Define root Turborepo tasks safely
  **What**: Configure task caching and persistence without hiding package-specific logic in root scripts. Use package scripts for task bodies. Make `dev`, `start`, `dev:db`, and `studio` non-cached/persistent. Make `build` depend on dependency builds and cache file outputs where applicable.
  **Files**: `turbo.json`, `package.json`
  **Acceptance**: `turbo.json` defines at least `build`, `typecheck`, `lint`, `lint:fix`, `dev`, `start`, `dev:db`, `generate`, `push`, `migrate`, and `studio`; root scripts call `turbo run ...` rather than package binaries directly; `bun run build -- --dry` or `bunx turbo run build --dry` shows package tasks without executing long-running dev tasks.

- [x] 8. Move the existing server into `apps/server`
  **What**: Move the current Elysia app as-is into `apps/server` and preserve relative imports. Move `public` with the server if it is used by `@elysiajs/static`. Move Drizzle migrations/config with the server so schema and migration paths remain `./src/db/schema.ts` and `./drizzle` from the package CWD.
  **Files**: `src/**`, `public/**`, `drizzle/**`, `drizzle.config.ts`, `apps/server/src/**`, `apps/server/public/**`, `apps/server/drizzle/**`, `apps/server/drizzle.config.ts`, `apps/server/package.json`, `apps/server/tsconfig.json`
  **Acceptance**: No root `src/` remains; `apps/server/src/index.ts`, `apps/server/src/server.ts`, `apps/server/src/auth.ts`, `apps/server/src/db/schema.ts`, and existing `plugins`/`routes`/`jobs`/`services` equivalents exist under `apps/server/src`; `bun run --cwd apps/server lint` and `bun run --cwd apps/server typecheck` run from the package CWD.

- [x] 9. Create the `@hay/server` package manifest and scripts
  **What**: Add `apps/server/package.json` with `name: "@hay/server"`, `private: true`, `type: "module"`, all current server runtime dependencies, and package-local scripts. Keep scripts package-relative: `dev` should be `bun --watch src/index.ts`; `start` should run `./src/index.ts`; Drizzle scripts should call `drizzle-kit` from `apps/server`.
  **Files**: `apps/server/package.json`, `package.json`, `bun.lock`
  **Acceptance**: `bun run dev:server` from root runs the `@hay/server` `dev` script through Turbo; `bun run --cwd apps/server generate -- --help` or an equivalent Drizzle help command resolves `apps/server/drizzle.config.ts`; `bun install --frozen-lockfile` succeeds after the lockfile is updated.

- [x] 10. Re-home server TypeScript and JSX settings
  **What**: Move current NodeNext/Bun/server options and KitaJS JSX factory/plugin settings into `apps/server/tsconfig.json`. Keep root `tsconfig.base.json` generic and strict, without Solid, React, or KitaJS JSX settings.
  **Files**: `tsconfig.base.json`, `tsconfig.json`, `apps/server/tsconfig.json`
  **Acceptance**: `apps/server/tsconfig.json` extends `../../tsconfig.base.json`, includes only `src` and local config files, sets `module`/`moduleResolution` appropriately for the Bun/Elysia server, includes Bun types, and contains the current `jsxFactory`, `jsxFragmentFactory`, and `@kitajs/ts-html-plugin` settings. Root `tsconfig.json`, if kept, should act only as a solution/reference or point to app configs without app-specific JSX.

- [x] 11. Adjust server env examples, local DB path, and Drizzle docs
  **What**: Move the server-specific env example into `apps/server/.env.example`; keep or replace root `.env.example` with monorepo-level guidance that points to app-local env files. Decide whether local Turso should create `apps/server/local.db` or continue using root `local.db` via an explicit path.
  **Files**: `.env.example`, `.gitignore`, `apps/server/.env.example`, `apps/server/drizzle.config.ts`, `README.md`
  **Acceptance**: `.gitignore` ignores root and app-local env/db files while allowing `!.env.example` and `!apps/*/.env.example`; README local setup tells developers to copy `apps/server/.env.example` to `apps/server/.env`; Drizzle commands run from `apps/server` and still output migrations under `apps/server/drizzle`.

- [x] 12. Create `apps/web` by merging the scratch scaffold into a SolidJS TanStack Start app
  **What**: Create `apps/web` as package `@hay/web`. Merge relevant TanStack CLI scratch output into the real package: dependencies, scripts, Biome/toolchain config where appropriate, Start/Router config, generated route conventions, Query/Form add-on setup, public/src structure, and build/dev scripts. The final implementation must be SolidJS, even if the scratch output was React. Use web dev port `3001` to avoid the server's default `3000` and to match existing CORS defaults.
  **Files**: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/src/**`, `apps/web/public/**`, `apps/web/.env.example`, `package.json`, `bun.lock`
  **Acceptance**: `apps/web/package.json` has `name: "@hay/web"`, `private: true`, Bun-compatible scripts for `dev`, `build`, `preview`, `lint`, `lint:fix`, `typecheck`, and any Intent/CLI helper scripts justified by guidance; `apps/web` uses SolidJS JSX settings and Solid TanStack packages; `bun run --cwd apps/web dev` serves on `http://localhost:3001`; no React framework imports/dependencies remain in `apps/web` unless explicitly required by current TanStack guidance and documented as a blocker.

- [x] 13. Configure TanStack Start and Router for a blank Solid app
  **What**: Keep the web app blank and minimal. Use TanStack Start + TanStack Router Solid patterns for the root route, index route, client/server entrypoints, generated route tree, and styles. Do not add product navigation or domain UI.
  **Files**: `apps/web/src/router.tsx`, `apps/web/src/routeTree.gen.ts`, `apps/web/src/routes/__root.tsx`, `apps/web/src/routes/index.tsx`, `apps/web/src/client.tsx`, `apps/web/src/ssr.tsx`, `apps/web/src/styles.css`, `apps/web/vite.config.ts`
  **Acceptance**: `bun run --cwd apps/web typecheck` recognizes generated route types; `bun run --cwd apps/web build` generates or validates the route tree; the index route renders a blank/minimal shell such as an empty page or title only, with no product features.

- [x] 14. Add minimal TanStack Query and Form demonstrations
  **What**: Add the smallest compile-time/runtime smoke for TanStack Query and TanStack Form using Solid integrations. Query should use a provider/client and a no-op/example placeholder query that does not call real backend APIs. Form should be an empty/minimal form component or dev route that proves TanStack Form wiring without product fields or submission behavior.
  **Files**: `apps/web/src/lib/tanstack/query.tsx`, `apps/web/src/lib/tanstack/form-demo.tsx`, `apps/web/src/routes/dev/tanstack-libraries.tsx`, `apps/web/src/routes/__root.tsx`
  **Acceptance**: The app compiles with Query provider wiring; the dev route or hidden smoke component demonstrates a no-op Query and minimal Form without network side effects, domain fields, auth, persistence, or product UX.

- [x] 15. Add minimal TanStack Store, Hotkeys, Pacer, and Virtual demonstrations
  **What**: Add developer-facing blank demonstrations for the remaining required TanStack libraries. Keep each demo inert/minimal: a tiny local store counter or value that is not product state, a hotkey binding that does not trigger destructive/product actions, a Pacer utility wrapper around a no-op function, and a Virtual blank/list demo with placeholder rows. Hide these under the same dev/docs route or keep them as non-exported smoke components referenced by that route.
  **Files**: `apps/web/src/lib/tanstack/store.ts`, `apps/web/src/lib/tanstack/hotkeys-demo.tsx`, `apps/web/src/lib/tanstack/pacer.ts`, `apps/web/src/lib/tanstack/virtual-demo.tsx`, `apps/web/src/routes/dev/tanstack-libraries.tsx`, `apps/web/package.json`
  **Acceptance**: `bun run --cwd apps/web typecheck` and `bun run --cwd apps/web build` prove Store, Hotkeys, Pacer, and Virtual imports compile; the route/component remains clearly developer-only/blank and introduces no product behavior.

- [x] 16. Keep TanStack CLI and TanStack Intent represented without product scaffolding
  **What**: Preserve proof that TanStack CLI and TanStack Intent were used, and optionally add Bun-compatible helper scripts only if the installed guidance recommends them. Do not make app startup depend on rerunning scaffolding.
  **Files**: `apps/web/package.json`, `AGENTS.md`, `README.md`
  **Acceptance**: Durable docs mention the exact `npx @tanstack/cli@latest create ...` command and exact Intent commands; any package scripts for Intent/CLI are non-mutating inspection helpers (for example list/show commands) and do not rerun project creation; the final app remains blank.

- [x] 17. Decide and enforce generated route tree handling
  **What**: Let TanStack Start/Router generate `apps/web/src/routeTree.gen.ts`; do not hand-author it. Prefer committing the generated file for deterministic type imports, while excluding it from manual lint/format churn if Biome causes generated-file noise.
  **Files**: `apps/web/src/routeTree.gen.ts`, `biome.json`, `.gitignore`
  **Acceptance**: After `bun run --cwd apps/web build`, `apps/web/src/routeTree.gen.ts` exists or the configured generation workflow is documented; lint/typecheck do not fail due to a missing generated route tree.

- [x] 18. Verify the TanStack Start Solid production output before desktop integration
  **What**: Prove the web build output can be loaded by Tauri before relying on it. Inspect whether TanStack Start Solid emits a static/client-loadable directory such as `apps/web/dist`, `apps/web/dist/client`, or another output. Align the desktop `frontendDist` to the proven output, not to a guessed path.
  **Acceptance**: Run `bun run --cwd apps/web build`; inspect output for an HTML entrypoint and client assets; run `bun run --cwd apps/web preview` or the current Start preview command and load/curl the preview route; document the exact output path Tauri should consume. Do not proceed to deep desktop integration if the output requires a Node/Bun SSR server rather than static/client loading without documenting the blocker and required strategy.

- [x] 19. Add the Tauri v2 desktop skeleton
  **What**: Create `apps/desktop` as package `@hay/desktop` with `@tauri-apps/cli` and `@tauri-apps/api`, plus `src-tauri` Rust files following Tauri v2 conventions: thin `main.rs`, application setup in `lib.rs`, `build.rs`, `Cargo.toml`, and default capabilities.
  **Files**: `apps/desktop/package.json`, `apps/desktop/tsconfig.json`, `apps/desktop/src-tauri/Cargo.toml`, `apps/desktop/src-tauri/build.rs`, `apps/desktop/src-tauri/src/main.rs`, `apps/desktop/src-tauri/src/lib.rs`, `apps/desktop/src-tauri/capabilities/default.json`, `apps/desktop/src-tauri/tauri.conf.json`, `apps/desktop/src-tauri/icons/**`, `bun.lock`
  **Acceptance**: `apps/desktop/src-tauri/capabilities/default.json` grants `core:default`; `main.rs` only calls the library `run()` function; `lib.rs` contains `#[cfg_attr(mobile, tauri::mobile_entry_point)] pub fn run()` and `tauri::Builder::default()`; `bun run --cwd apps/desktop info` reports Tauri v2 or missing prerequisites.

- [x] 20. Wire Tauri to the web app build and dev server
  **What**: Configure Tauri to use the TanStack Start Solid dev server in development and the verified web production UI output in production. Use `devUrl: "http://localhost:3001"`. Set `frontendDist` relative to `apps/desktop/src-tauri/tauri.conf.json` and aligned to the actual output proven in Task 18, expected `../../web/dist` only if that is the loadable production UI directory. Use Bun commands for `beforeDevCommand` and `beforeBuildCommand`.
  **Files**: `apps/desktop/src-tauri/tauri.conf.json`, `apps/desktop/package.json`, `apps/web/package.json`, `apps/web/vite.config.ts`, `package.json`, `turbo.json`
  **Acceptance**: `beforeDevCommand` starts `@hay/web` on port `3001` (for example `bun run --cwd ../web dev` from `apps/desktop` if that path is correct from Tauri's command CWD); `beforeBuildCommand` builds `@hay/web`; `frontendDist` resolves from `apps/desktop/src-tauri` to the verified `apps/web` production UI output; root `bun run dev:desktop` delegates to `turbo run dev --filter=@hay/desktop` and does not also start a second web dev server outside Tauri.

- [x] 21. Add package-level typecheck and lint tasks
  **What**: Ensure each package owns its task bodies. Server and web should use TypeScript/Biome; desktop should use Rust checks for `src-tauri` and only TypeScript checks if TS files are added later.
  **Files**: `apps/server/package.json`, `apps/web/package.json`, `apps/desktop/package.json`, `biome.json`, `turbo.json`
  **Acceptance**: `bun run lint` runs package lint tasks through Turbo; `bun run typecheck` runs server/web TypeScript checks and desktop `cargo check --manifest-path src-tauri/Cargo.toml` if Rust is installed; no root script directly invokes Biome across app internals except through `turbo run`.

- [x] 22. Update Biome configuration for the monorepo
  **What**: Keep the existing formatting style while making Biome safe for multiple apps and generated files. Avoid checking generated build output, Tauri target directories, scratch scaffolds, and generated TanStack route tree if necessary.
  **Files**: `biome.json`, `.gitignore`
  **Acceptance**: Biome ignores `apps/**/dist/**`, `apps/desktop/src-tauri/target/**`, `.tmp/**`, `node_modules/**`, and any generated TanStack route file that should not be formatted; `bun run lint` succeeds from root after generated files are present.

- [x] 23. Update Docker for the server workspace package
  **What**: Convert the Docker build to install the workspace from root but run the final server from `apps/server` CWD. Preserve Bun base image usage. Do not copy ignored local DB/env files. Ensure migrations and server source are present in the final image.
  **Files**: `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `docker-compose.dev.yml`, `package.json`, `apps/server/package.json`, `bun.lock`, `turbo.json`, `tsconfig.base.json`
  **Acceptance**: Final Docker `WORKDIR` is `/usr/src/app/apps/server` or equivalent; final entrypoint runs the `@hay/server` package `start` script from package CWD; `docker build -t hay-server-monorepo .` succeeds or produces a documented prerequisite/configuration failure.

- [x] 24. Update Drizzle and database workflow commands
  **What**: Route all Drizzle root commands through Turbo filters to `@hay/server`, while ensuring package-local commands still work directly from `apps/server`.
  **Files**: `package.json`, `apps/server/package.json`, `apps/server/drizzle.config.ts`, `README.md`
  **Acceptance**: `bun run generate` from root delegates to `turbo run generate --filter=@hay/server`; `bun run --cwd apps/server generate` uses `apps/server/drizzle.config.ts`; generated migrations land under `apps/server/drizzle`.

- [x] 25. Maintain durable TanStack and monorepo context in AGENTS.md
  **What**: Update `AGENTS.md` or an app-local equivalent with durable implementation context for future agents. Include the exact TanStack CLI command, the two exact TanStack Intent commands, chosen SolidJS/TanStack stack and integrations, required environment variables, deployment/Tauri notes, key architectural decisions, known issues/gotchas, and next steps.
  **Files**: `AGENTS.md`, `apps/web/AGENTS.md`
  **Acceptance**: Durable context explicitly states that `apps/web` is SolidJS, not React; records the scratch scaffold path and exact commands; records the selected TanStack package names; documents the Tauri `devUrl` and `frontendDist` decision; lists any unresolved Start/Tauri bundle risks and follow-up steps; explicitly tracks production desktop auth follow-ups for Tauri custom protocol origins, Better Auth trusted origins, CORS allowlists, cookie `SameSite`/`Secure` behavior, and Tauri `app.security.csp` hardening.

- [x] 26. Update README and developer workflow docs
  **What**: Rewrite setup and command examples for the monorepo layout without changing product/domain documentation. Include root commands, package-local escape hatches, TanStack scratch/Intent provenance, and the blank/no-product nature of web demos.
  **Files**: `README.md`
  **Acceptance**: README explains `bun install`, app-local env copying, `bun run dev:db`, `bun run dev` for server+web, `bun run dev:desktop` for Tauri, Drizzle commands, Docker production commands, web package commands, and where to find TanStack Intent/CLI context.

- [x] 27. Run post-move install and targeted package validation
  **What**: After all manifests and moved paths are in place, refresh dependencies and validate each package independently before full Turbo validation.
  **Acceptance**: Run `bun install`; then run `bun install --frozen-lockfile`, `bun run --cwd apps/server lint`, `bun run --cwd apps/server typecheck`, `bun run --cwd apps/web typecheck`, `bun run --cwd apps/web build`, `bun run --cwd apps/web lint`, and `bun run --cwd apps/desktop info`.

- [x] 28. Smoke test the server from its package CWD
  **What**: Verify the moved Elysia server still starts, serves `/`, and does not fail due to autoload/static/Drizzle path changes.
  **Acceptance**: Run `BETTER_AUTH_SECRET=test BETTER_AUTH_URL=https://api.example.test CORS_ALLOWED_ORIGINS=https://app.example.test timeout 10s bun run --cwd apps/server start` for production-mode startup guard coverage; separately run a development smoke with `BETTER_AUTH_SECRET=test bun run --cwd apps/server dev` and `curl http://localhost:3000/` expecting `Hello World`.

- [x] 29. Smoke test web and desktop coordination
  **What**: Verify the selected port, TanStack Start build output, and Tauri dev/build settings are aligned.
  **Acceptance**: Run `bun run --cwd apps/web dev` and confirm `http://localhost:3001` loads; stop it; run `bun run dev:desktop` and confirm Tauri starts `@hay/web` through `beforeDevCommand` without a duplicate port conflict. If Tauri prerequisites are missing, capture `bun run --cwd apps/desktop info` output. Confirm `frontendDist` points to the same production output validated in Task 18.

- [x] 30. Run full root validation
  **What**: Validate the final monorepo through root scripts only, proving Turborepo orchestration works.
  **Acceptance**: Run `bun run lint`, `bun run typecheck`, `bun run build`, `bun run dev:server` smoke, `bun run dev:web` smoke, and `bun run dev:desktop` or `bun run --cwd apps/desktop info` depending on local prerequisites.

- [x] 31. Review final diff and cleanup migration artifacts
  **What**: Ensure only intentional files changed, old root paths are gone, generated/build outputs are ignored, scratch output remains untracked, and pre-existing runtime/session files are not accidentally staged.
  **Acceptance**: Run `git status --short`, `git diff --stat`, `git diff --name-status`; confirm no `node_modules`, `.env`, `.env.production`, `*.db`, `.tmp/**`, `apps/web/dist`, or `apps/desktop/src-tauri/target` files are tracked; confirm the plan file remains at `.weave/plans/monorepo-tauri-tanstack-start.md`.

## Verification
- [x] The plan and implementation preserve the required exact TanStack CLI command and run it only in scratch before merging into `apps/web`.
- [x] The plan and implementation preserve the required exact TanStack Intent install/list commands and use installed guidance before TanStack architecture choices.
- [x] All package manifests use Bun-compatible scripts and no npm/pnpm/yarn lockfiles are introduced, except ignored scratch artifacts if generated by tools.
- [x] Root package scripts delegate to `turbo run` and package scripts contain the actual task bodies.
- [x] `apps/server` package name is `@hay/server` and current Elysia functionality is preserved.
- [x] `apps/web` package name is `@hay/web`, uses SolidJS instead of React, serves on port `3001`, and builds to the output consumed by Tauri.
- [x] `apps/web` minimally demonstrates TanStack Start, Router, Intent, CLI, Query, Form, Store, Hotkeys, Pacer, and Virtual without adding product features.
- [x] `apps/desktop` package name is `@hay/desktop`, uses Tauri v2 patterns, and points `frontendDist` to the verified `apps/web` production UI output from `src-tauri/tauri.conf.json`.
- [x] Server-only KitaJS JSX settings live only in `apps/server/tsconfig.json`; SolidJS JSX settings live only in `apps/web/tsconfig.json` or equivalent web config.
- [x] `AGENTS.md` or app-local equivalent contains durable TanStack CLI/Intent/stack/deployment/gotcha/next-step context.
- [x] `bun install --frozen-lockfile` succeeds.
- [x] `bun run lint` succeeds.
- [x] `bun run typecheck` succeeds.
- [x] `bun run build` succeeds, or any Tauri/Rust prerequisite failure is documented with exact output.
- [x] Server smoke returns `Hello World` from `/` after moving to `apps/server`.
- [x] Web production output is verified as Tauri-loadable before treating desktop integration as complete.
- [x] `bun run --cwd apps/desktop info` reports Tauri v2 or documents missing prerequisites.
- [x] Docker server image builds or has a documented Docker-specific blocker.
- [x] Final `git status --short` contains only intentional migration changes and excludes ignored runtime/build/env/scratch artifacts.
