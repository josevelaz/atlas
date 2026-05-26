# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1.3.13 AS base
WORKDIR /usr/src/app

# ── install stage ────────────────────────────────────────────────────────────
# Copy workspace manifests so Bun can resolve the full workspace dependency graph
FROM base AS install

# dev deps (for typecheck / build steps)
RUN mkdir -p /temp/dev
COPY package.json bun.lock tsconfig.base.json turbo.json /temp/dev/
COPY apps/server/package.json /temp/dev/apps/server/package.json
COPY apps/web/package.json /temp/dev/apps/web/package.json
COPY apps/desktop/package.json /temp/dev/apps/desktop/package.json
RUN cd /temp/dev && bun install --frozen-lockfile

# prod deps only
RUN mkdir -p /temp/prod
COPY package.json bun.lock tsconfig.base.json turbo.json /temp/prod/
COPY apps/server/package.json /temp/prod/apps/server/package.json
COPY apps/web/package.json /temp/prod/apps/web/package.json
COPY apps/desktop/package.json /temp/prod/apps/desktop/package.json
RUN cd /temp/prod && bun install --frozen-lockfile --production

# ── prerelease (typecheck) stage ─────────────────────────────────────────────
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules ./node_modules
COPY --from=install /temp/dev/apps/server/node_modules ./apps/server/node_modules

COPY package.json bun.lock tsconfig.base.json turbo.json ./
COPY apps/server/ ./apps/server/

ENV NODE_ENV=production
RUN cd apps/server && bun x tsc --noEmit

# ── release (final) stage ────────────────────────────────────────────────────
FROM base AS release

# Copy production node_modules (workspace root + server package)
COPY --from=install /temp/prod/node_modules ./node_modules
COPY --from=install /temp/prod/apps/server/node_modules ./apps/server/node_modules

# Copy workspace root manifests needed at runtime
COPY --from=prerelease /usr/src/app/package.json ./package.json
COPY --from=prerelease /usr/src/app/bun.lock ./bun.lock
COPY --from=prerelease /usr/src/app/tsconfig.base.json ./tsconfig.base.json

# Copy server source, config, and migrations
COPY --from=prerelease /usr/src/app/apps/server/ ./apps/server/

ENV NODE_ENV=production
WORKDIR /usr/src/app/apps/server

ENTRYPOINT [ "bun", "run", "start" ]
