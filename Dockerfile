# syntax=docker/dockerfile:1

# --- deps ------------------------------------------------------------------
# Installs all dependencies (dev + prod) once, cached by lockfile hash. The
# runner stage later copies this stage's full node_modules verbatim so the
# Prisma CLI and tsx (used to run migrations/seed at startup) are guaranteed
# to be present without fighting pnpm's symlinked store during a pruned copy.
FROM node:20-alpine AS deps
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
FROM node:20-alpine AS runner
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
# eslint, vitest, playwright). `corepack prepare --activate` fetches and
# pins the pnpm version at build time so no network call is needed later,
# at container-exec time, to resolve it.
RUN apk add --no-cache curl && corepack enable && corepack prepare pnpm@9.15.9 --activate

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

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
