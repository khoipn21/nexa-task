# Scout Report: Shared Packages, Config & Infrastructure

**Date:** 2026-01-17
**Scope:** Shared packages, TypeScript config, Docker setup, CI/CD workflows, root config files
**Work Context:** /mnt/k/Work/nexa-task

---

## 1. Monorepo Structure

### Turborepo Configuration (`turbo.json`)
- **Build orchestration**: Tasks with dependency graph (`dependsOn: ["^build"]`)
- **Task definitions**:
  - `build` - outputs to `dist/**`, `build/**`
  - `dev` - non-cached, persistent
  - `lint`, `test`, `typecheck` - depend on build
  - `db:push`, `db:generate` - non-cached DB operations
- **Caching strategy**: Aggressive caching for builds/tests, disabled for dev/db tasks

### Workspace Setup
- **Package manager**: Bun 1.2.0
- **Workspaces**: `apps/*`, `packages/*`
- **Package references**:
  - `@repo/shared` - Shared utilities/validators
  - `@repo/db` - Database schema (Drizzle ORM)
  - `@repo/ui` - UI components (Mantine)
  - `@repo/typescript-config` - TS configs
  - `@repo/api` - Hono API server
  - `@repo/web` - Vite React SPA

### Root Scripts
- `dev`, `build`, `test`, `typecheck` - Turbo-orchestrated
- `lint`, `lint:fix`, `format` - Biome-based
- `db:push`, `db:generate` - Drizzle DB operations (filtered to `@repo/db`)
- `docker:dev`, `docker:prod` - Docker Compose commands

---

## 2. Shared Package (`@repo/shared`)

### Exports
- **Main**: `./src/index.ts`
- **Subpaths**:
  - `@repo/shared/types` - Type definitions
  - `@repo/shared/validators` - Zod schemas

### Core Types (`src/types/index.ts`)
- **User roles**: `super_admin`, `project_manager`, `member`, `guest`
- **Task priority**: `urgent`, `high`, `medium`, `low`
- **Task status**: `backlog`, `todo`, `in_progress`, `in_review`, `done`
- **API response wrappers**: `ApiResponse<T>`, `PaginatedResponse<T>`
- **Entity interfaces**: `User`, `Workspace`, `Project`, `Task`, `Comment`

### RBAC System (`src/types/auth.ts`)
- **Permissions**: Granular permissions (workspace:*, project:*, task:*, comment:*)
- **Role mappings**: `ROLE_PERMISSIONS` mapping roles to permission arrays
- **Helper functions**: `hasPermission()`, `hasAnyPermission()`, `hasAllPermissions()`

### Validators (Zod schemas)
**Workspace** (`validators/workspace.ts`):
- `createWorkspaceSchema` - name, slug (alphanumeric+hyphens), clerkOrgId
- `updateWorkspaceSchema` - name, settings (defaultProjectView, allowGuestInvites)
- `inviteMemberSchema` - email, role

**Project** (`validators/project.ts`):
- `createProjectSchema` - name (max 200), description (max 2000)
- `updateProjectSchema` - name, description, status (active/archived/deleted)
- `createWorkflowStatusSchema` - name (max 50), color (hex), isDefault, isFinal
- `reorderStatusesSchema` - ordered UUID array

**Task** (`validators/task.ts`):
- `taskFilterSchema` - statusId, assigneeId, priority, search, dueBefore/After, pagination
- `createTaskSchema` - title (max 500), description (max 50k rich text HTML), priority, statusId, assigneeId, dueDate
- `updateTaskSchema` - partial updates
- `moveTaskSchema` - statusId, order (for drag-drop)
- `addDependencySchema`, `addWatcherSchema`, `uploadAttachmentSchema`

### Dependencies
- `zod` ^3.24.0 - Schema validation

---

## 3. TypeScript Configuration

### Base Config (`@repo/typescript-config/base.json`)
- **Target**: ES2022
- **Module**: ESNext with bundler resolution
- **Strict mode**: Enabled + `noUncheckedIndexedAccess`
- **Features**: `isolatedModules`, `esModuleInterop`, `resolveJsonModule`
- **Output**: `noEmit: true`, `declaration: true`, `declarationMap: true`

### React Config (`@repo/typescript-config/react.json`)
- Extends `base.json`
- **JSX**: `react-jsx`
- **Libs**: ES2022, DOM, DOM.Iterable

### Root TS Config (`tsconfig.json`)
- **Composite project**: References all packages/apps
- **Project references**:
  - `packages/shared`, `packages/db`, `packages/ui`
  - `apps/api`, `apps/web`

---

## 4. Docker Setup

### Development (`docker-compose.dev.yml`)
- **PostgreSQL**: Port 5433, container `nexa-task-postgres`
- **Redis**: Port 6380, container `nexa-task-redis`
- **Purpose**: Isolated dev databases only (API/Web run locally)

### Full Stack (`docker-compose.yml`)
- **Services**: postgres, redis, api, web
- **API**: Built from `api.Dockerfile`, port 3001, depends on postgres+redis
- **Web**: Built from `web.Dockerfile`, port 3000 (nginx), depends on api
- **Health checks**: pg_isready, redis-cli ping
- **Volumes**: postgres_data, redis_data

### Production (`docker-compose.prod.yml`)
- **Resource limits**: postgres 512M, redis 128M, api 512M, web 128M
- **Security**: Redis with password, postgres with custom user/password
- **Images**: Pulls from `${REGISTRY}/${IMAGE_NAME}-api:${TAG}`
- **Health checks**: wget-based HTTP checks (30s interval)
- **Ports**: web exposed on 80/443

### API Dockerfile (`api.Dockerfile`)
- **Multi-stage**: base → pruner → installer → builder → runner
- **Turbo prune**: `turbo prune @repo/api --docker`
- **Production deps**: `bun install --frozen-lockfile --production`
- **Non-root user**: `app:app` (uid/gid 1001)
- **Output**: `bun run dist/index.js`
- **Health check**: wget localhost:3001/health

### Web Dockerfile (`web.Dockerfile`)
- **Multi-stage**: base → pruner → installer → builder → nginx runner
- **Build args**: `VITE_API_URL`, `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_WS_URL`
- **Output**: Static files in `/usr/share/nginx/html`
- **Server**: Nginx alpine

### Nginx Config (`nginx.conf`)
- **Gzip**: Enabled for text/css/js/json/xml/svg
- **Security headers**: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection
- **SPA routing**: `try_files $uri $uri/ /index.html`
- **Cache**: 1yr for CSS/JS/images (immutable)
- **Proxies**:
  - `/api` → `http://api:3001`
  - `/ws` → WebSocket upgrade to `http://api:3001`
- **Health**: `/health` returns 200 OK

---

## 5. CI/CD Pipelines

### CI Workflow (`.github/workflows/ci.yml`)
**Triggers**: Push/PR to `main`

**Jobs**:
1. **Lint**: `bun lint` (Biome)
2. **Type Check**: `bun run typecheck`
3. **Test**:
   - Services: postgres:16-alpine, redis:7-alpine
   - `bun run db:push` (schema migration)
   - `bun test`
4. **Build**: `bun run build` (all packages)
5. **E2E Tests**:
   - Depends on lint/typecheck/build
   - Installs Playwright chromium
   - Runs `cd apps/web && bun run test:e2e`
   - Uploads playwright-report artifact (30 days retention)

### Deploy Workflow (`.github/workflows/deploy.yml`)
**Triggers**: Push to `main`, release published

**Jobs**:
1. **Build and Push**:
   - Docker Buildx setup
   - Login to GHCR (`ghcr.io`)
   - Build/push API image (tags: sha, branch, semver)
   - Build/push Web image with build args (VITE_*)
   - GitHub Actions cache for layers

2. **Deploy Staging** (if `main` branch):
   - Placeholder for deployment commands
   - Suggested: SSH, webhook, K8s update

3. **Deploy Production** (if release):
   - Placeholder for production deployment

---

## 6. Development Tooling

### Linting (Biome)
- **Config**: `biome.json`
- **Ignores**: `dist/`, `node_modules/`, `.turbo/`
- **Features**: Organize imports, recommended rules
- **Formatter**: 2-space indent, single quotes, minimal semicolons

### Makefile
- **Commands**:
  - `make clean-port` - Kill processes on 3001, 5173

### Package Manager
- **Bun 1.2.0**: Fast JS runtime + package manager
- **Lockfile**: `bun.lock` (frozen in CI)

---

## 7. Environment Configuration

### Development (`.env.example`)
- **Database**: `postgresql://user:password@localhost:5432/nexa_task`
- **Redis**: `redis://localhost:6379`
- **Clerk Auth**: `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- **Cloudflare R2**: Bucket, account ID, endpoint, access keys, public URL
- **App**: `NODE_ENV=development`, `PORT=3001`, `FRONTEND_URL=http://localhost:5173`

### Production (`.env.production.example`)
- **Database**: SSL mode required, custom user/password
- **Redis**: Password-protected
- **Clerk**: Live keys + webhook secret
- **CORS**: `CORS_ORIGIN=https://app.nexa-task.com`
- **Frontend env vars**: `VITE_API_URL`, `VITE_WS_URL` (wss://)
- **Docker registry**: `REGISTRY=ghcr.io`, `IMAGE_NAME`, `TAG`
- **AWS S3**: Region, credentials, bucket (alternative to R2)

---

## 8. Package Dependencies Graph

```
@repo/web (React SPA)
├── @repo/shared (types, validators)
├── @repo/ui (Mantine components)
└── react, react-dom, @clerk/clerk-react, @tanstack/react-query, zustand

@repo/api (Hono server)
├── @repo/shared (types, validators)
├── @repo/db (Drizzle ORM schema)
└── hono, @clerk/backend, ioredis, @aws-sdk/client-s3

@repo/ui (shared components)
├── @mantine/core, @mantine/hooks
└── peer: react, react-dom

@repo/db (database layer)
└── drizzle-orm, postgres

@repo/shared (utilities)
└── zod
```

---

## Key Findings

1. **Monorepo tooling**: Turborepo + Bun provides fast builds with intelligent caching
2. **Type safety**: Zod schemas in `@repo/shared` enable runtime validation + TypeScript inference
3. **RBAC**: Permission system defined in shared package for consistent auth across API/Web
4. **Docker optimization**: Multi-stage builds with Turbo pruning minimize image sizes
5. **CI/CD maturity**: Full pipeline (lint → test → build → e2e) with Playwright integration
6. **Environment segregation**: Clear dev/prod config separation, R2 + S3 storage options
7. **Production-ready**: Health checks, resource limits, non-root users, nginx optimizations

---

## Unresolved Questions

1. **Storage strategy**: R2 vs S3 - which is primary? (both in .env examples)
2. **Deployment platform**: CI/CD has placeholders - target platform not specified
3. **Database migrations**: Using `db:push` (schema sync) - production migration strategy unclear
4. **Monitoring**: No observability tools (APM, logging, error tracking) configured yet
5. **Secrets management**: How are production secrets injected? (GitHub Secrets, Vault, etc.)
