# Hay

A monorepo containing the Hay application stack.

## Stack

| App | Path | Framework | Purpose |
|---|---|---|---|
| `@hay/web` | `apps/web/` | **SolidJS** + TanStack Start | Web frontend (SPA, static output) |
| `@hay/desktop` | `apps/desktop/` | Tauri v2 | Desktop shell (loads `apps/web` build) |
| `@hay/server` | `apps/server/` | ElysiaJS | API backend |

- **Linter** — [Biome](https://biomejs.dev/)
- **Build system** — [Turborepo](https://turbo.build/repo)

---

## Getting started

### Prerequisites

```sh
# Rust toolchain (required for Tauri desktop builds only)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Docker (required for production container builds only — not needed for local dev)
# https://docs.docker.com/get-docker/
```

> **Local database**: `bun run dev:db` uses [`sqld`](https://github.com/tursodatabase/libsql) (the libSQL server) via `bunx sqld` — no separate install required. It starts a local HTTP server on `127.0.0.1:8080` and persists data to `apps/server/local.db`.

### 1. Install dependencies

```sh
bun install
```

### 2. Set up environment variables

Each app has its own `.env.example`. Copy it to `.env` inside the app directory:

```sh
cp apps/server/.env.example apps/server/.env
```

Then open `apps/server/.env` and fill in the required values:

```sh
# Generate a secret for Better Auth
openssl rand -base64 32
# Paste the output as BETTER_AUTH_SECRET in apps/server/.env
```

`apps/web` also has an `.env.example` — copy it if you need to override web-side variables:

```sh
cp apps/web/.env.example apps/web/.env
```

### 3. Start the local database

The server uses the Turso CLI's local libSQL server for development:

```sh
# From repo root (delegates to @hay/server via Turbo)
bun run dev:db

# Package-local escape hatch
bun run --cwd apps/server dev:db
```

This starts a local libSQL server (`sqld`) on `http://127.0.0.1:8080` and persists data to `apps/server/local.db`.

No `DATABASE_AUTH_TOKEN` is needed for the local server.

For Turso Cloud, set both in `apps/server/.env`:

```sh
DATABASE_URL="libsql://your-db.turso.io"
DATABASE_AUTH_TOKEN="your-turso-auth-token"
```

### 4. Run database migrations

```sh
# From repo root (delegates to @hay/server via Turbo)
bun run generate   # generate migration files from schema changes
bun run migrate    # apply pending migrations

# Package-local escape hatch
bun run --cwd apps/server generate
bun run --cwd apps/server migrate
```

### 5. Start the dev servers

```sh
# Start server + web together (recommended)
bun run dev
```

- API server → `http://localhost:3000`
- Web dev server → `http://localhost:3001`

To start individual apps:

```sh
bun run dev:server   # API server only
bun run dev:web      # Web dev server only
```

Package-local escape hatches:

```sh
bun run --cwd apps/server dev
bun run --cwd apps/web dev
```

### 6. Start the desktop app (Tauri)

```sh
bun run dev:desktop
```

This runs `tauri dev` inside `apps/desktop`, which automatically starts the web dev server on `:3001` via `beforeDevCommand` before opening the Tauri window. You do **not** need to run `bun run dev:web` separately.

Package-local escape hatch:

```sh
bun run --cwd apps/desktop dev
```

---

## Root commands

All commands run from the repo root via Turborepo:

| Command | Description |
|---|---|
| `bun run dev` | Start server + web dev servers concurrently |
| `bun run dev:server` | Start API server only |
| `bun run dev:web` | Start web dev server only |
| `bun run dev:desktop` | Start Tauri desktop app (auto-starts web dev server) |
| `bun run dev:db` | Start local Turso libSQL server |
| `bun run build` | Build all packages |
| `bun run start` | Start production server |
| `bun run lint` | Lint all packages |
| `bun run lint:fix` | Lint and auto-fix all packages |
| `bun run typecheck` | Type-check all packages |
| `bun run generate` | Generate Drizzle migrations (`@hay/server` only) |
| `bun run push` | Push schema directly to DB (`@hay/server` only) |
| `bun run migrate` | Apply pending migrations (`@hay/server` only) |
| `bun run studio` | Open Drizzle Studio (`@hay/server` only) |

Root Drizzle commands (`generate`, `push`, `migrate`, `studio`, `dev:db`) are scoped to `@hay/server` via `--filter=@hay/server`.

---

## Apps

### `apps/server`

ElysiaJS API server. See [`apps/server/.env.example`](apps/server/.env.example) for all environment variables.

- **Port**: `3000`
- **Auth endpoints**: `http://localhost:3000/api/auth/*`
- **Drizzle schema**: `apps/server/src/db/schema.ts`
- **Migrations**: `apps/server/drizzle/`

**Package-local scripts:**

```sh
bun run --cwd apps/server dev        # start dev server
bun run --cwd apps/server generate   # generate migrations
bun run --cwd apps/server migrate    # apply migrations
bun run --cwd apps/server push       # push schema directly
bun run --cwd apps/server studio     # open Drizzle Studio
```

### `apps/web`

SolidJS + TanStack Start SPA. Builds to a fully static `dist/client/` directory — no runtime server needed.

> ⚠️ **This app is SolidJS, NOT React.** The TanStack CLI scaffold produces React output — that scaffold is reference material only. All source in `apps/web` uses SolidJS primitives, imports, and conventions.

- **Dev port**: `3001`
- **Build output**: `apps/web/dist/client/` (static SPA — serve this directory)
- **`dist/server/`** is generated at build time for prerendering only; **not needed at runtime**

**Package-local scripts:**

```sh
bun run --cwd apps/web dev        # dev server on :3001
bun run --cwd apps/web build      # production build → dist/client/
bun run --cwd apps/web preview    # preview production build
bun run --cwd apps/web typecheck  # tsc --noEmit
bun run --cwd apps/web intent:list  # list TanStack Intent skills (read-only)
```

#### Web demo routes

`http://localhost:3001/dev/tanstack-libraries` — a **blank, no-product demo page** that exercises the TanStack library integrations (Query, Form, Store, Hotkeys, Pacer, Virtual) and `solid-motionone` animations. This page contains no real product UI or data — it exists solely to verify library wiring.

### `apps/desktop`

Tauri v2 desktop shell. Loads `apps/web/dist/client/` as its frontend.

- **Dev URL**: `http://localhost:3001` (web dev server)
- **Frontend dist**: `apps/web/dist/client/` (relative: `../../web/dist/client` from `src-tauri/`)
- **`beforeDevCommand`**: automatically starts `apps/web` dev server before Tauri dev
- **`beforeBuildCommand`**: automatically builds `apps/web` before Tauri bundles

**Package-local scripts:**

```sh
bun run --cwd apps/desktop dev    # tauri dev (also starts web dev server)
bun run --cwd apps/desktop build  # tauri build
bun run --cwd apps/desktop info   # tauri info (system/environment diagnostics)
```

---

## Authentication

Authentication is handled by [Better Auth](https://www.better-auth.com/), mounted at `/api/auth/*`. The Better Auth instance is configured in `apps/server/src/auth.ts` and uses the Drizzle adapter to persist sessions and accounts in the same libSQL database as the rest of the app.

### Environment variables

| Variable               | Required | Default                 | Description                                                                  |
| ---------------------- | -------- | ----------------------- | ---------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`   | **Yes**  | —                       | Random secret for signing sessions. Generate with `openssl rand -base64 32`. |
| `BETTER_AUTH_URL`      | No       | `http://localhost:3000` | Canonical URL of this API server (no trailing slash).                        |
| `CORS_ALLOWED_ORIGINS` | No       | localhost origins       | Comma-separated list of allowed frontend origins.                            |

See [`apps/server/.env.example`](apps/server/.env.example) for the full list of variables with descriptions.

### Production requirements

- **`BETTER_AUTH_URL` must be an HTTPS URL** (e.g. `https://api.hay.example.com`). The app will refuse to start in `NODE_ENV=production` with a localhost URL.
- **`CORS_ALLOWED_ORIGINS` must not contain wildcards or localhost origins** in production. The app will refuse to start if unsafe origins are detected.
- **`BETTER_AUTH_SECRET` must be stored outside git** — use your platform's secret manager (e.g. Doppler, AWS Secrets Manager, Fly.io secrets, Vercel environment variables).
- **Cross-site frontends** (frontend on a different domain from the API) that require `SameSite=None` cookies must also serve over HTTPS and should receive an explicit CSRF review before going to production.

### Adding social providers

Social providers (Google, GitHub, Microsoft, etc.) are configured in `apps/server/src/auth.ts` via the `socialProviders` option. To enable a provider:

1. Add the provider's client ID and secret to `apps/server/.env` (see the commented-out examples in `apps/server/.env.example`).
2. Register the provider in `apps/server/src/auth.ts`:

   ```ts
   export const auth = betterAuth({
     // ...existing config...
     socialProviders: {
       google: {
         clientId: process.env.GOOGLE_CLIENT_ID!,
         clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
       },
     },
   });
   ```

3. No schema changes are needed — Better Auth handles OAuth accounts in its own tables.

---

## TanStack CLI & Intent

### Scaffold provenance

`apps/web` was bootstrapped using TanStack CLI in a scratch directory (`.tmp/tanstack-cli/`, gitignored). The exact command used:

```sh
npx @tanstack/cli@latest create my-tanstack-app \
  --agent \
  --package-manager bun \
  --toolchain biome \
  --add-ons tanstack-query,form
```

> **Note:** The scaffold output is **React**. `apps/web` was manually recreated as **SolidJS** and is the authoritative source — the scaffold directory is not used at runtime.

### TanStack Intent

[TanStack Intent](https://tanstack.com/intent) was used to enumerate available skills. Commands run in the scratch directory:

```sh
npx @tanstack/intent@latest install
npx @tanstack/intent@latest list
```

Intent v0.0.41 — 9 packages, 31 skills installed. Key finding: the `router-plugin` skill requires `target: 'solid'` in the Vite plugin config (already applied in `apps/web/vite.config.ts`). No `@tanstack/solid-start` intent skill exists; only React skills ship with the scaffold.

> **Intent skills are React-only.** Applying them will produce React code — adapt manually to SolidJS. See `AGENTS.md` and `apps/web/AGENTS.md` for full TanStack/Solid context.

### Inspect available Intent skills

From `apps/web`, run the read-only helper to list current Intent skills:

```sh
bun run --cwd apps/web intent:list
# or from inside apps/web:
bun run intent:list
```

This runs `bunx @tanstack/intent@latest list` and does **not** modify the project.

---

## Production

### Docker (server only)

The Dockerfile builds and runs `apps/server` only. Docker is **not** required for local development.

```sh
# Build the server image
docker build -t hay-server-monorepo .

# Run with docker compose (production)
docker compose up -d

# Run with docker compose (development override)
docker compose -f docker-compose.dev.yml up
```

> **Prerequisite**: Docker must be installed. See [docs.docker.com/get-docker](https://docs.docker.com/get-docker/).

### Web (static SPA)

The web app builds to a fully static directory — deploy `apps/web/dist/client/` to any static host (Cloudflare Pages, Vercel, S3, etc.):

```sh
bun run --cwd apps/web build
# Output: apps/web/dist/client/
```

### Desktop (Tauri)

```sh
bun run dev:desktop   # development
bun run --cwd apps/desktop build  # production bundle
```

The Tauri build automatically runs `bun run --cwd ../web build` before bundling.
