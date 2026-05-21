- Always leverage bun's builtins, before utilizing node's polyfills.
- For design guidelines, reference @DESIGN.md
- After making front-end changes, utilize `npx agent-browser` to validate the ui does
not error and meets the spec requirements.

- Commit after each task
- use conventional commits with a proper description
- Once plan is finished, push commits to remote and create a pull request using
  the github cli.

## TanStack CLI & Intent provenance

### Scaffold origin

`apps/web` was bootstrapped by running TanStack CLI in a scratch directory (`.tmp/tanstack-cli/`, gitignored):

```sh
npx @tanstack/cli@latest create my-tanstack-app \
  --agent \
  --package-manager bun \
  --toolchain biome \
  --add-ons tanstack-query,form
```

The scaffold produced a **React** output. `apps/web` was then manually recreated as **SolidJS** — the scaffold is not the source of truth for `apps/web`.

### TanStack Intent

Intent was run inside the scratch directory to enumerate available skills:

```sh
npx @tanstack/intent@latest install
npx @tanstack/intent@latest list
```

Intent v0.0.41 installed 9 packages and 31 skills. Key finding: the `router-plugin` skill requires `target: 'solid'` in the Vite plugin config — this is already applied in `apps/web/vite.config.ts`. No `@tanstack/solid-start` intent skill exists; only React skills are available in the scaffold.

### Helper script

`apps/web` exposes a non-mutating inspection helper:

```sh
# From apps/web — lists available Intent skills (read-only, does not modify the project)
bun run intent:list
```

This runs `bunx @tanstack/intent@latest list` and is safe to run at any time.
