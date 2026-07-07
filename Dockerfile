# syntax=docker/dockerfile:1
#
# Builds a container that runs packages/cron's one-shot settlement/creation
# pass. Unlike a typical app image, this isn't a long-running server —
# `docker run` executes a single pass and exits, matching how packages/cron
# is meant to be invoked (see packages/cron/README.md): by a real cron entry
# on the host, or a scheduler that runs containers on an interval (e.g. a
# Kubernetes CronJob).
#
# This package has no dependencies on the other workspace packages, but the
# monorepo is pnpm-workspace-managed, so the build still needs the root
# lockfile + every workspace member's package.json to resolve correctly.
# Build from the monorepo root, where this Dockerfile lives:
#
#   docker build -t polycat-cron .
#   docker run --rm --env-file packages/cron/.env.local polycat-cron
#
# Scheduling: add a host crontab entry (or equivalent) that runs the command
# above on an interval shorter than the shortest timeframe (5 minutes) — see
# packages/cron/README.md for why.

FROM node:20-alpine AS base
# Pin the exact pnpm version instead of relying on corepack to look up the
# `packageManager` field at runtime — the runner stage below intentionally
# doesn't carry the root package.json, so that lookup would otherwise fall
# back to whatever pnpm is latest (which may require a newer Node than this
# image ships).
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/cron/package.json packages/cron/package.json
COPY packages/web/package.json packages/web/package.json
RUN pnpm install --filter cron --frozen-lockfile

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/cron/node_modules ./packages/cron/node_modules
COPY packages/cron ./packages/cron
WORKDIR /app/packages/cron

CMD ["pnpm", "exec", "tsx", "src/run.ts"]
