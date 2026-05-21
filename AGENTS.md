- Always leverage bun's builtins, before utilizing node's polyfills.
- For design guidelines, reference @DESIGN.md
- After making front-end changes, utilize `npx agent-browser` to validate the ui does
not error and meets the spec requirements.

- Commit after each task
- use conventional commits with a proper description
- Once plan is finished, push commits to remote and create a pull request using
  the github cli.

---

## Monorepo Architecture

This is a **Turborepo** monorepo with the following apps:

| App | Path | Framework | Purpose |
|---|---|---|---|
| `@hay/web` | `apps/web/` | **SolidJS** + TanStack Start | Web frontend (SPA, static output) |
| `@hay/desktop` | `apps/desktop/` | Tauri v2 | Desktop shell (loads `apps/web` build) |
| `@hay/server` | `apps/server/` | ElysiaJS | API backend |

> ⚠️ **`apps/web` is SolidJS, NOT React.** The TanStack CLI scaffold produces React output — that scaffold is reference material only. All `apps/web` source uses SolidJS primitives, imports, and conventions.

---

## TanStack CLI & Intent Provenance

### Scaffold origin

`apps/web` was bootstrapped by running TanStack CLI in a scratch directory (`.tmp/tanstack-cli/`, gitignored):

```sh
npx @tanstack/cli@latest create my-tanstack-app \
  --agent \
  --package-manager bun \
  --toolchain biome \
  --add-ons tanstack-query,form
```

The scaffold produced a **React** output. `apps/web` was then manually recreated as **SolidJS** — the scaffold is **not** the source of truth for `apps/web`.

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

---

## `apps/web` — SolidJS + TanStack Stack

### Selected packages (all Solid variants)

| Package | Version | Role |
|---|---|---|
| `solid-js` | `^1.9.13` | Core framework |
| `@tanstack/solid-start` | `^1.168.9` | SSR/Start framework |
| `@tanstack/solid-router` | `^1.170.6` | File-based router |
| `@tanstack/solid-query` | `^5.100.11` | Async state management |
| `@tanstack/solid-form` | `^1.32.0` | Form management |
| `@tanstack/solid-store` | `^0.11.0` | Reactive store |
| `@tanstack/solid-hotkeys` | `^0.10.0` | Keyboard shortcuts |
| `@tanstack/solid-pacer` | `^0.21.1` | Debounce/throttle |
| `@tanstack/solid-virtual` | `^3.13.25` | Virtualised lists |
| `@tanstack/router-plugin` | `^1.168.10` | Vite route-tree codegen (framework-agnostic) |
| `vite-plugin-solid` | `^2.11.6` | Vite JSX transform for Solid |
| `solid-motionone` | `^1.0.4` | Animations (NOT `motion` — lacks `./solid` export) |
| `lucide-solid` | `^0.545.0` | Icon library |
| `tailwindcss` + `@tailwindcss/vite` | `^4.1.18` | Styling |
| `zod` | `^3.25.67` | Schema validation |

### Critical Vite config

```ts
// apps/web/vite.config.ts
plugins: [
  tailwindcss(),
  tanstackRouter({ target: "solid", autoCodeSplitting: true }),  // ← target: "solid" is REQUIRED
  tanstackStart({ spa: { enabled: true, prerender: { outputPath: "/index" } } }),
  viteSolid({ ssr: true }),  // ← must come AFTER tanstackStart
]
```

> **`target: 'solid'`** in `tanstackRouter()` is critical — the default is `'react'` and will break the build.

### SPA mode

`tanstackStart()` is configured with `spa: { enabled: true, prerender: { outputPath: '/index' } }`. This produces a fully static `dist/client/index.html` — no runtime server is needed.

### View transitions

- `defaultViewTransition: true` in `createTanStackRouter()` (`src/router.tsx`)
- `@view-transition { navigation: auto; }` in `src/styles.css`

### Animation

Use `solid-motionone@^1.0.4`. Do **not** use `motion` — it lacks a `./solid` export and will fail to import.

### Vite version

Vite is pinned to `^7.3.3` (v7 required for TanStack Start's `buildApp` post-build prerender hook).

### tsconfig.json (key settings)

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "solid-js"
  }
}
```

### React → Solid gotchas

| React | Solid |
|---|---|
| `useState` / `useEffect` | `createSignal` / `createEffect` / `createMemo` |
| `React.FC<Props>` | `Component<Props>` from `solid-js` |
| `children: React.ReactNode` | `JSX.Element` or `ParentProps` |
| `className` | `class` |
| `dangerouslySetInnerHTML` | `innerHTML` directive |
| `.map(item => <El key={...}>)` | `<For each={...}>{item => <El>}</For>` |
| `&&` / ternary for conditionals | `<Show when={...}>` |

---

## Tauri Desktop (`apps/desktop`)

### `tauri.conf.json` — key build settings

```json
{
  "build": {
    "devUrl": "http://localhost:3001",
    "frontendDist": "../../web/dist/client",
    "beforeDevCommand": "bun run --cwd ../web dev",
    "beforeBuildCommand": "bun run --cwd ../web build"
  }
}
```

- **`devUrl`**: `http://localhost:3001` — matches `apps/web` dev server port
- **`frontendDist`**: `../../web/dist/client` — relative to `apps/desktop/src-tauri/`; resolves to `apps/web/dist/client/`
- **`beforeDevCommand`**: starts the web dev server before Tauri dev
- **`beforeBuildCommand`**: builds the web SPA before Tauri bundles

### Build output

`apps/web` produces a **fully static** build in `dist/client/`:
```
dist/client/
  index.html          ← prerendered SPA shell
  assets/
    styles-*.css
    index-*.js
    tanstack-libraries-*.js
    index-*.js
```

`dist/server/` is generated at build time for prerendering only — **not needed at runtime**.

---

## Production Desktop Auth — Unresolved Risks ⚠️

These items must be addressed before shipping a production desktop build:

### 1. Tauri custom protocol origins

Tauri serves the app from a custom protocol, not `http://localhost`:

| Platform | Origin |
|---|---|
| macOS / Linux | `tauri://localhost` |
| Windows | `https://tauri.localhost` |

Any auth server (Better Auth or otherwise) must accept requests from these origins.

### 2. Better Auth `trustedOrigins`

Add Tauri origins to `trustedOrigins` in the Better Auth server config:

```ts
// apps/server/src/auth.ts (example)
export const auth = betterAuth({
  trustedOrigins: [
    "http://localhost:3001",       // web dev
    "tauri://localhost",           // macOS/Linux desktop
    "https://tauri.localhost",     // Windows desktop
  ],
})
```

### 3. CORS allowlist

The API server must allow `Origin: tauri://localhost` and `Origin: https://tauri.localhost` in its CORS configuration.

### 4. Cookie `SameSite` / `Secure` behavior

- `SameSite=Lax` cookies will be blocked on cross-origin requests from Tauri custom protocols
- Auth session cookies must be set with `SameSite=None; Secure` for desktop, or use token-based auth instead
- Verify cookie behavior on each platform before shipping

### 5. Tauri `app.security.csp` hardening

Current CSP in `tauri.conf.json`:
```json
"csp": "default-src 'self'; img-src 'self' data:"
```

This will block API calls to the backend. Before shipping:
- Add `connect-src` for the API server URL
- Add `script-src` / `style-src` as needed
- Test CSP on all target platforms

---

## Environment Variables

`apps/web/.env.example` documents required variables. Key ones:

| Variable | Purpose |
|---|---|
| _(see `.env.example`)_ | _(see `.env.example`)_ |

Never commit `.env` files. Use `.env.example` as the template.

---

## Known Issues / Gotchas

1. **TanStack Intent skills are React-only** — running `intent:list` shows skills, but applying them will produce React code. Adapt manually to Solid.
2. **`vite-plugin-solid` must come after `tanstackStart()`** in the Vite plugins array.
3. **`tanstackRouter({ target: 'solid' })`** must be explicit — omitting `target` defaults to `'react'`.
4. **`solid-motionone` not `motion`** — `motion` package lacks a `./solid` subpath export.
5. **`dist/server/` is build-time only** — do not deploy or reference it at runtime.
6. **Vite v7 required** — TanStack Start's `buildApp` prerender hook requires Vite 7+.
7. **`zod` version** — currently `^3.25.67`; Zod v4 has breaking API changes, do not upgrade without auditing all schema usage.

---

## Next Steps / Follow-ups

- [ ] Implement auth flow with Better Auth, accounting for Tauri custom protocol origins
- [ ] Add `trustedOrigins` for Tauri to Better Auth server config
- [ ] Configure CORS allowlist on `apps/server` for Tauri origins
- [ ] Audit and fix cookie `SameSite`/`Secure` settings for desktop auth
- [ ] Harden `app.security.csp` in `tauri.conf.json` with proper `connect-src`
- [ ] Test production Tauri bundle on macOS, Linux, and Windows
- [ ] Add `@tanstack/solid-query-devtools` and `@tanstack/solid-router-devtools` to dev setup
- [ ] Evaluate `@tanstack/solid-router-ssr-query` for SSR+Query integration if SSR is ever enabled
