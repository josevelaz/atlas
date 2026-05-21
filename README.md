# Hay

A monorepo containing the Hay application stack.

### Stack

- **Server** (`apps/server`) — [ElysiaJS](https://elysiajs.com/) API with [Drizzle ORM](https://orm.drizzle.team/) ([libSQL/Turso](https://turso.tech/libsql)) and [Better Auth](https://www.better-auth.com/)
- **Linter** — [Biome](https://biomejs.dev/)
- **Build system** — [Turborepo](https://turbo.build/repo)

## Getting started

### Prerequisites

```sh
brew install tursodatabase/tap/turso
```

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

### 3. Start the local database

The server uses the Turso CLI's local libSQL server for development. Run from the `apps/server` directory (or via Turborepo):

```sh
cd apps/server && bun run dev:db
```

This starts a local Turso server and persists data to `apps/server/local.db`.

No `DATABASE_AUTH_TOKEN` is needed for the local Turso CLI server.

For Turso Cloud, set both in `apps/server/.env`:

```sh
DATABASE_URL="libsql://your-db.turso.io"
DATABASE_AUTH_TOKEN="your-turso-auth-token"
```

### 4. Run database migrations

From `apps/server`:

```sh
cd apps/server
bun run generate
bun run migrate
```

### 5. Start the dev server

```sh
bun run dev
```

Or from `apps/server` directly:

```sh
cd apps/server && bun run dev
```

The API is available at `http://localhost:3000`. Auth endpoints are at `http://localhost:3000/api/auth/*`.

---

## Apps

### `apps/server`

ElysiaJS API server. See [`apps/server/.env.example`](apps/server/.env.example) for all environment variables.

**Key scripts** (run from `apps/server`):

| Script | Description |
|---|---|
| `bun run dev` | Start dev server with hot reload |
| `bun run dev:db` | Start local Turso libSQL server (creates `local.db`) |
| `bun run generate` | Generate Drizzle migration files |
| `bun run migrate` | Apply pending migrations |
| `bun run push` | Push schema directly to DB (no migration file) |
| `bun run studio` | Open Drizzle Studio |

**Drizzle migrations** are stored under `apps/server/drizzle/` and the schema lives at `apps/server/src/db/schema.ts`.

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

### Inspect available Intent skills

From `apps/web`, run the read-only helper to list current Intent skills:

```sh
bun run intent:list
```

This runs `bunx @tanstack/intent@latest list` and does **not** modify the project.

---

## Production

```bash
docker compose up -d
```
