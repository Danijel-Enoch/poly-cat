# syntax=docker/dockerfile:1
#
# Builds and runs the HoodMarkets Ponder indexer.
#
# This package has no dependencies on the other workspace packages, but the
# monorepo is pnpm-workspace-managed, so the build still needs the root
# lockfile + every workspace member's package.json to resolve correctly.
# Build from the monorepo root (not this directory):
#
#   docker build -f packages/indexer/Dockerfile -t hoodmarkets-indexer .
#   docker run --rm -p 42069:42069 --env-file packages/indexer/.env.local hoodmarkets-indexer
#
# To use a different port, set PORT in the env file (or -e PORT=<port>) and
# map the same port with -p, e.g.:
#
#   docker run --rm -p 8080:8080 -e PORT=8080 --env-file packages/indexer/.env.local hoodmarkets-indexer
#
# `ponder start` (unlike `ponder dev`) requires DATABASE_SCHEMA to be set
# explicitly — see .env.example. In production, also set DATABASE_URL to a
# real Postgres instance; without it, Ponder falls back to an on-disk PGlite
# database that won't survive a container restart or scale past one instance.

FROM node:20-alpine AS base
# Pin the exact pnpm version instead of relying on corepack to look up the
# `packageManager` field at runtime — the runner stage below intentionally
# doesn't carry the root package.json, so that lookup would otherwise fall
# back to whatever pnpm is latest (which may require a newer Node than this
# image ships, and did in practice: pnpm 11 requires Node >=22).
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/indexer/package.json packages/indexer/package.json
COPY packages/web/package.json packages/web/package.json
RUN pnpm install --filter indexer --frozen-lockfile

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/indexer/node_modules ./packages/indexer/node_modules
COPY packages/indexer ./packages/indexer
WORKDIR /app/packages/indexer

# Documentation only — EXPOSE doesn't bind or restrict anything. The actual
# port is whatever PORT resolves to at runtime (default 42069, see
# .env.example and package.json's dev/start scripts); map it explicitly with
# `-p <port>:<port> -e PORT=<port>` if you override it.
EXPOSE 42069
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider http://localhost:${PORT:-42069}/health || exit 1

CMD ["pnpm", "start"]
