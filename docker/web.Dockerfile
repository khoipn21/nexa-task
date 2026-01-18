# Stage 1: Base
FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# Stage 2: Prune dependencies with turbo
FROM base AS pruner
RUN bun add -g turbo
COPY . .
RUN turbo prune @repo/web --docker

# Stage 3: Install dependencies
FROM base AS installer
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock
RUN bun install --frozen-lockfile

# Stage 4: Build application
FROM base AS builder
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .

# Build-time arguments for Vite env vars
ARG VITE_API_URL
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_WS_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_WS_URL=$VITE_WS_URL

RUN bun run build --filter=@repo/web

# Stage 5: Nginx for static hosting
FROM nginx:alpine AS runner

# Copy built static files
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
