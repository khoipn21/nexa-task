# Stage 1: Base
FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# Stage 2: Prune dependencies with turbo
FROM base AS pruner
RUN bun add -g turbo
COPY . .
RUN turbo prune @repo/api --docker

# Stage 3: Install dependencies
FROM base AS installer
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock
RUN bun install --frozen-lockfile --production

# Stage 4: Build application
FROM base AS builder
RUN bun add -g turbo
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
RUN bun run build --filter=@repo/api

# Stage 5: Production runner
FROM oven/bun:1.2-alpine AS runner
WORKDIR /app

# Security: Create non-root user
RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 app

USER app

# Copy production dependencies and built code
COPY --from=installer --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/apps/api/dist ./dist
COPY --from=builder --chown=app:app /app/packages/db ./packages/db
COPY --from=builder --chown=app:app /app/packages/shared ./packages/shared

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["bun", "run", "dist/index.js"]
