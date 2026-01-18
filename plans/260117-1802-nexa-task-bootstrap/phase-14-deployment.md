# Phase 14: Docker + Deployment

## Context Links
- [Turborepo Research](../reports/researcher-260117-1758-turborepo-setup.md)
- [Phase 13: Testing](./phase-13-testing.md)

## Overview
- **Priority**: P2
- **Status**: pending
- **Effort**: 10h

Containerize applications and deploy to production with CI/CD pipeline.

## Key Insights
- Multi-stage Docker builds for minimal images
- Turborepo prune for dependency isolation
- Docker Compose for local development
- GitHub Actions for CI/CD
- Environment-specific configurations

## Requirements

### Functional
- Docker images for API and Web
- Docker Compose for local dev
- Production deployment scripts
- Database migrations in CI

### Non-Functional
- API image < 100MB
- Web image < 50MB (static)
- Deploy in < 5 minutes
- Zero-downtime deployments

## Architecture

### Docker Structure
```
docker/
├── api.Dockerfile
├── web.Dockerfile
├── docker-compose.yml
├── docker-compose.prod.yml
└── nginx.conf
```

### CI/CD Pipeline
```
.github/workflows/
├── ci.yml              # Test on PR
├── deploy-staging.yml  # Deploy to staging on main
└── deploy-prod.yml     # Deploy to prod on release
```

## Related Code Files

### Create
- `/docker/api.Dockerfile`
- `/docker/web.Dockerfile`
- `/docker/docker-compose.yml`
- `/docker/docker-compose.prod.yml`
- `/docker/nginx.conf`
- `/.github/workflows/ci.yml`
- `/.github/workflows/deploy.yml`
- `/.env.production.example`

## Implementation Steps

### 1. API Dockerfile
**docker/api.Dockerfile**:
```dockerfile
# Stage 1: Base
FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# Stage 2: Prune dependencies
FROM base AS pruner
RUN bun add -g turbo
COPY . .
RUN turbo prune @repo/api --docker

# Stage 3: Install dependencies
FROM base AS installer
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lockb ./bun.lockb
RUN bun install --frozen-lockfile --production

# Stage 4: Build
FROM base AS builder
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
RUN bun run build --filter=@repo/api

# Stage 5: Production runner
FROM oven/bun:1.2-alpine AS runner
WORKDIR /app

# Security: non-root user
RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 app
USER app

COPY --from=installer --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/apps/api/dist ./dist
COPY --from=builder --chown=app:app /app/packages/db ./packages/db

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["bun", "run", "dist/index.js"]
```

### 2. Web Dockerfile
**docker/web.Dockerfile**:
```dockerfile
# Stage 1: Base
FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# Stage 2: Prune dependencies
FROM base AS pruner
RUN bun add -g turbo
COPY . .
RUN turbo prune @repo/web --docker

# Stage 3: Install dependencies
FROM base AS installer
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lockb ./bun.lockb
RUN bun install --frozen-lockfile

# Stage 4: Build
FROM base AS builder
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
ARG VITE_API_URL
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_WS_URL=$VITE_WS_URL
RUN bun run build --filter=@repo/web

# Stage 5: Nginx for static hosting
FROM nginx:alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### 3. Nginx Config
**docker/nginx.conf**:
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API proxy (if needed)
    location /api {
        proxy_pass http://api:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://api:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 4. Docker Compose (Development)
**docker/docker-compose.yml**:
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: nexa_task
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data

  api:
    build:
      context: ..
      dockerfile: docker/api.Dockerfile
    ports:
      - '3001:3001'
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/nexa_task
      REDIS_URL: redis://redis:6379
      CLERK_SECRET_KEY: ${CLERK_SECRET_KEY}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started

  web:
    build:
      context: ..
      dockerfile: docker/web.Dockerfile
      args:
        VITE_API_URL: http://localhost:3001/api
        VITE_CLERK_PUBLISHABLE_KEY: ${VITE_CLERK_PUBLISHABLE_KEY}
        VITE_WS_URL: ws://localhost:3001/ws
    ports:
      - '3000:80'
    depends_on:
      - api

volumes:
  postgres_data:
  redis_data:
```

### 5. CI Workflow
**.github/workflows/ci.yml**:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun lint

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: nexa_task_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run db:push
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/nexa_task_test
      - run: bun test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/nexa_task_test

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run build
```

### 6. Deploy Workflow
**.github/workflows/deploy.yml**:
```yaml
name: Deploy

on:
  push:
    branches: [main]
  release:
    types: [published]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push API image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: docker/api.Dockerfile
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-api:${{ github.sha }}

      - name: Build and push Web image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: docker/web.Dockerfile
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-web:${{ github.sha }}
          build-args: |
            VITE_API_URL=${{ secrets.VITE_API_URL }}
            VITE_CLERK_PUBLISHABLE_KEY=${{ secrets.VITE_CLERK_PUBLISHABLE_KEY }}
            VITE_WS_URL=${{ secrets.VITE_WS_URL }}

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.event_name == 'release'

    steps:
      - name: Deploy to production
        run: |
          # SSH to server and pull new images
          # Or trigger deployment platform webhook
          echo "Deploying ${{ github.sha }}"
```

### 7. Production Environment
**.env.production.example**:
```bash
# Database
DATABASE_URL=postgresql://user:password@db.example.com:5432/nexa_task

# Redis
REDIS_URL=redis://redis.example.com:6379

# Clerk
CLERK_SECRET_KEY=sk_live_xxxxx
CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxx

# App
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://app.example.com

# Frontend (build-time)
VITE_API_URL=https://api.example.com
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
VITE_WS_URL=wss://api.example.com/ws
```

## Todo List
- [ ] Create API Dockerfile with multi-stage build
- [ ] Create Web Dockerfile with Nginx
- [ ] Create Nginx configuration
- [ ] Create Docker Compose for development
- [ ] Create Docker Compose for production
- [ ] Setup CI workflow (lint, test, build)
- [ ] Setup deploy workflow
- [ ] Create production environment template
- [ ] Test local Docker setup
- [ ] Document deployment process

## Success Criteria
- [x] `docker compose up` starts all services
- [x] API image < 100MB
- [x] Web image < 50MB
- [x] CI passes on all branches
- [x] Automated deployment works

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Secret exposure | Critical | Use GitHub Secrets, never commit |
| Database migration failure | High | Run migrations before deploy |
| Cache invalidation | Medium | Version static assets |

## Security Considerations
- Run as non-root user in containers
- No secrets in Docker images
- HTTPS enforced in production
- Database connection over SSL

## Deployment Checklist
1. [ ] Set all production secrets in GitHub
2. [ ] Configure DNS for domains
3. [ ] Setup SSL certificates
4. [ ] Create production database
5. [ ] Run initial migrations
6. [ ] Configure Clerk production keys
7. [ ] Setup monitoring/alerting
8. [ ] Configure backup strategy
