# Monorepo: TanStack Start + SolidJS — Scaffold & Package Decisions

## Scaffold Framework Finding

The TanStack CLI (`npx create-tsrouter-app@latest`) generates a **React** scaffold, not SolidJS.

Confirmed from `.tmp/tanstack-cli/my-tanstack-app/`:
- `package.json` deps: `react`, `react-dom`, `@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/react-query`, `@tanstack/react-form`, `@vitejs/plugin-react`
- `tsconfig.json`: `"jsx": "react-jsx"`
- `vite.config.ts`: `tanstackStart()` from `@tanstack/react-start/plugin/vite`, `viteReact()` from `@vitejs/plugin-react`
- All route files use `@tanstack/react-router` imports and React JSX patterns

**The scaffold is reference material only.** `apps/web` must be built from scratch targeting SolidJS.

---

## npm Registry Check (all packages verified as of 2026-05-21)

| Package | Latest Version | Status |
|---|---|---|
| `solid-js` | 1.9.13 | ✅ EXISTS |
| `@tanstack/solid-start` | 1.168.9 | ✅ EXISTS |
| `@tanstack/solid-router` | 1.170.6 | ✅ EXISTS |
| `@tanstack/solid-query` | 5.100.11 | ✅ EXISTS |
| `@tanstack/solid-form` | 1.32.0 | ✅ EXISTS |
| `@tanstack/solid-store` | 0.11.0 | ✅ EXISTS |
| `@tanstack/solid-hotkeys` | 0.10.0 | ✅ EXISTS |
| `@tanstack/solid-pacer` | 0.21.1 | ✅ EXISTS |
| `@tanstack/solid-virtual` | 3.13.25 | ✅ EXISTS |
| `@tanstack/solid-query-devtools` | 5.100.11 | ✅ EXISTS |
| `@tanstack/solid-router-devtools` | 1.167.0 | ✅ EXISTS |
| `@tanstack/solid-devtools` | 0.8.5 | ✅ EXISTS |
| `@tanstack/solid-router-ssr-query` | 1.167.0 | ✅ EXISTS |
| `vite-plugin-solid` | 2.11.12 | ✅ EXISTS |
| `lucide-solid` | 1.16.0 | ✅ EXISTS |
| `@tanstack/router-plugin` | 1.168.9 | ✅ EXISTS (framework-agnostic) |
| `@tanstack/devtools-vite` | 0.7.0 | ✅ EXISTS (framework-agnostic) |
| `@tanstack/store` | 0.11.0 | ✅ EXISTS (use `@tanstack/solid-store` for Solid bindings) |

---

## React → Solid Package Mapping

| React (scaffold) | Solid (final) | Notes |
|---|---|---|
| `react` | `solid-js` | Core framework |
| `react-dom` | _(none)_ | SolidJS has no separate DOM package |
| `@tanstack/react-start` | `@tanstack/solid-start` | SSR/Start framework |
| `@tanstack/react-router` | `@tanstack/solid-router` | Router |
| `@tanstack/react-query` | `@tanstack/solid-query` | Async state |
| `@tanstack/react-form` | `@tanstack/solid-form` | Forms |
| `@tanstack/react-router-ssr-query` | `@tanstack/solid-router-ssr-query` | SSR+Query integration |
| `@tanstack/react-devtools` | `@tanstack/solid-devtools` | Devtools shell |
| `@tanstack/react-query-devtools` | `@tanstack/solid-query-devtools` | Query devtools panel |
| `@tanstack/react-router-devtools` | `@tanstack/solid-router-devtools` | Router devtools panel |
| `@vitejs/plugin-react` | `vite-plugin-solid` | Vite JSX transform |
| `lucide-react` | `lucide-solid` | Icon library |
| `@types/react` | _(none)_ | SolidJS ships its own types |
| `@types/react-dom` | _(none)_ | SolidJS ships its own types |
| `@testing-library/react` | `@solidjs/testing-library` | Testing utilities |
| `@tanstack/router-plugin` | `@tanstack/router-plugin` | Same package, framework-agnostic |
| `@tanstack/devtools-vite` | `@tanstack/devtools-vite` | Same package, framework-agnostic |

---

## Final `apps/web` Package List

### dependencies
```json
{
  "solid-js": "^1.9.13",
  "@tanstack/solid-start": "latest",
  "@tanstack/solid-router": "latest",
  "@tanstack/solid-query": "latest",
  "@tanstack/solid-form": "latest",
  "@tanstack/solid-store": "latest",
  "@tanstack/solid-hotkeys": "latest",
  "@tanstack/solid-pacer": "latest",
  "@tanstack/solid-virtual": "latest",
  "@tanstack/solid-router-ssr-query": "latest",
  "@tanstack/solid-devtools": "latest",
  "@tanstack/solid-query-devtools": "latest",
  "@tanstack/solid-router-devtools": "latest",
  "@tanstack/router-plugin": "latest",
  "@tanstack/devtools-vite": "latest",
  "@tailwindcss/vite": "^4.1.18",
  "tailwindcss": "^4.1.18",
  "lucide-solid": "latest",
  "zod": "^4.3.6"
}
```

### devDependencies
```json
{
  "@biomejs/biome": "2.4.5",
  "@tailwindcss/typography": "^0.5.16",
  "@solidjs/testing-library": "latest",
  "@types/node": "^22.10.2",
  "jsdom": "^28.1.0",
  "typescript": "^6.0.2",
  "vite": "^8.0.0",
  "vite-plugin-solid": "latest",
  "vitest": "^4.1.5"
}
```

---

## tsconfig.json Deltas for SolidJS

Replace React JSX settings with SolidJS equivalents:

```diff
- "jsx": "react-jsx",
+ "jsx": "preserve",
+ "jsxImportSource": "solid-js",
```

Full SolidJS tsconfig:
```json
{
  "include": ["**/*.ts", "**/*.tsx"],
  "compilerOptions": {
    "target": "ES2022",
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "module": "ESNext",
    "paths": {
      "#/*": ["./src/*"],
      "@/*": ["./src/*"]
    },
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "skipLibCheck": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  }
}
```

---

## vite.config.ts Changes for SolidJS

```diff
- import { tanstackStart } from '@tanstack/react-start/plugin/vite'
- import viteReact from '@vitejs/plugin-react'
+ import { tanstackStart } from '@tanstack/solid-start/plugin/vite'
+ import solidPlugin from 'vite-plugin-solid'
  import { devtools } from '@tanstack/devtools-vite'
  import tailwindcss from '@tailwindcss/vite'

  const config = defineConfig({
    resolve: { tsconfigPaths: true },
-   plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
+   plugins: [devtools(), tailwindcss(), tanstackStart(), solidPlugin()],
  })
```

> **Note**: `@tanstack/router-plugin` is used internally by `@tanstack/solid-start`. The `tanstackStart()` plugin handles route tree generation. No separate `tanstackRouter({ target: 'solid' })` call is needed when using `tanstackStart()` — the Start plugin wraps the Router plugin with the correct target.

---

## Key Behavioral Differences: React → Solid

1. **No `key` prop on lists** — SolidJS uses `<For>` component instead of `.map()` with `key`
2. **No `useState`/`useEffect`** — use `createSignal`, `createEffect`, `createMemo`
3. **No `React.FC` types** — use `Component<Props>` from `solid-js`
4. **No `children: React.ReactNode`** — use `JSX.Element` or `ParentProps`
5. **`class` not `className`** — SolidJS uses standard HTML attribute names
6. **`innerHTML` not `dangerouslySetInnerHTML`** — use `innerHTML` directive
7. **Reactivity is fine-grained** — components render once; signals drive updates
8. **`<Show>` / `<For>` / `<Switch>`** — use control flow components, not ternaries/maps

---

## Route Tree Generation

The scaffold uses `routeTree.gen.ts` (auto-generated by `@tanstack/router-plugin`). This is framework-agnostic — the same file-based routing convention applies to SolidJS. The `tanstackStart()` Vite plugin handles generation automatically.

File extensions remain `.tsx` for SolidJS (SolidJS uses TSX with `jsxImportSource: "solid-js"`).

---

## Scripts (unchanged from scaffold)

```json
{
  "dev": "vite dev --port 3000",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "format": "biome format",
  "lint": "biome lint",
  "check": "biome check"
}
```
