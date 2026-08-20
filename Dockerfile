# syntax=docker/dockerfile:1

# --- deps ------------------------------------------------------------------
# Installs all dependencies (dev + prod) once, cached by lockfile hash. The
# runner stage later copies this stage's full node_modules verbatim so the
# Prisma CLI and tsx (used to run migrations/seed at startup) are guaranteed
# to be present without fighting pnpm's symlinked store during a pruned copy.
#
# Node 22, matching package.json's `engines.node`. AITJ-M0-06 needs this: on
# Node 20 the pinned `testcontainers`/`undici` versions throw
# `webidl.util.markAsUncloneable is not a function` the moment
# Testcontainers talks to the Docker daemon over the mounted socket (see
# docker-compose.yml), which breaks `make test`/`make ci` for every
# integration test that starts a container.
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- builder -----------------------------------------------------------------
FROM deps AS builder
WORKDIR /app
COPY . .
# The deps stage only had package.json + the lockfile, so pnpm's Prisma
# postinstall hook had no schema to generate against; regenerate now that
# prisma/schema.prisma is present, before the type-checked Next.js build.
RUN pnpm exec prisma generate
RUN pnpm build

# --- runner ------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Asia/Kolkata
# Docker sets HOSTNAME to the container ID by default; the Next.js
# standalone server reads HOSTNAME as its bind address
# (`process.env.HOSTNAME || '0.0.0.0'`), so left unset it resolves the
# container ID to a single interface IP instead of binding all interfaces,
# and the healthcheck's `curl localhost` (loopback) then fails to connect.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# curl is required by the Docker healthcheck below; corepack provides the
# pnpm binary used by `make` targets that exec into this container (tsc,
# eslint, vitest, playwright).
RUN apk add --no-cache curl && corepack enable

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs

# Corepack's default cache lives under $HOME/.cache, which for root is
# /root — mode 0700, unreadable by the nextjs user (uid 1001) that actually
# runs `docker compose exec app pnpm ...` at exec time. Point COREPACK_HOME
# at a directory nextjs owns before pinning the version, so the download
# happens once at build time and every later exec reads the same cache
# instead of silently re-fetching pnpm from registry.npmjs.org.
ENV COREPACK_HOME=/home/nextjs/.cache/node/corepack
RUN mkdir -p /home/nextjs/.cache && chown -R nextjs:nodejs /home/nextjs
RUN corepack prepare pnpm@9.15.9 --activate

# `make lint`/`make typecheck`/`make test` exec into this same running
# container (CLAUDE.md's no-host-tooling rule), so it needs the full repo —
# configs, source, tests and dev dependencies — not just the pruned
# standalone runtime. Copy the whole build stage over first, then lay the
# standalone server output back on top so `server.js` ends up at the root
# and `.next` carries the production (not dev) server bundle.
COPY --from=builder --chown=nextjs:nodejs /app ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --chown=nextjs:nodejs docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh
# WORKDIR is created by root before the `nextjs` user exists; per-file
# --chown above covers copied content but not the /app directory entry
# itself, so tsc (incremental build info) and other tooling that writes new
# files directly under /app need this too.
RUN chown nextjs:nodejs /app

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./docker/entrypoint.sh"]
