# Codebase Summary

**Project:** Nexa Task - Project/Task Management SaaS
**Repository:** /mnt/k/Work/nexa-task
**Architecture:** Turborepo monorepo with Bun runtime

---

## Directory Structure

```
nexa-task/
├── apps/
│   ├── api/              # Hono backend API server
│   └── web/              # Vite React SPA frontend
├── packages/
│   ├── db/               # Drizzle ORM database schema
│   ├── shared/           # Shared types, validators, RBAC
│   ├── ui/               # Shared Mantine UI components
│   └── typescript-config/# Shared TypeScript configs
├── docker/               # Docker configuration files
├── plans/                # Implementation plans and reports
└── docs/                 # Project documentation
```

---

## Workspace Packages

### Apps

#### `@repo/api` (apps/api/)
**Purpose:** Backend API server with REST endpoints and WebSocket support
**Technology:** Hono 4.7 on Bun runtime
**Key Features:**
- Clerk authentication with auto-sync
- RBAC middleware system
- Redis pub/sub for real-time features
- WebSocket manager for live updates
- S3/R2 file upload support
- Email infrastructure (Nodemailer + BullMQ)
- Comprehensive test suite (32 unit tests)

**File Count:** 40 files (33 TypeScript sources)
**Structure:**
- `src/lib/` - Utilities (errors, Redis, WebSocket, validators, email, queue)
- `src/middleware/` - Auth, RBAC, DB injection, rate limiting
- `src/routes/` - API endpoints (workspaces, projects, tasks, comments, notifications)
- `src/services/` - Business logic layer (including notification service)
- `src/workers/` - Background workers (email-worker)
- `tests/` - Unit and integration tests (32 unit tests pass)

#### `@repo/web` (apps/web/)
**Purpose:** React frontend SPA with rich UI components
**Technology:** Vite + React 19 + Mantine + Tailwind CSS
**Key Features:**
- Clerk authentication integration
- TanStack Query for server state
- Drag-and-drop Kanban board (dnd-kit)
- Rich text editor (TipTap)
- Calendar view (Mantine dates)
- Real-time WebSocket connection

**File Count:** 70 files
**Component Count:** ~23 components (~1227 lines total)
**Structure:**
- `src/components/` - Feature components (comments, dashboard, projects, task-detail)
- `src/hooks/` - React Query hooks (use-tasks, use-projects, etc.)
- `src/lib/` - API client, auth sync, query setup
- `src/routes/` - Route components (dashboard, projects, settings)

---

### Packages

#### `@repo/db` (packages/db/)
**Purpose:** Database schema and ORM client
**Technology:** Drizzle ORM + PostgreSQL
**Tables:** 13 core tables + relations
- users, workspaces, workspace_members
- projects, workflow_statuses
- tasks, task_dependencies, task_watchers
- comments, attachments, activity_logs
- notifications, notification_preferences, user_project_preferences

**File Count:** 20 files (17 schema files)

#### `@repo/shared` (packages/shared/)
**Purpose:** Shared types, validators, RBAC logic, email templates
**Exports:**
- Type definitions (User, Workspace, Project, Task, etc.)
- Zod validation schemas (workspace, project, task)
- RBAC permission system with helper functions
- API response wrappers (ApiResponse, PaginatedResponse)
- React Email templates (BaseLayout, TaskAssigned, TaskUpdated, CommentAdded)

**Dependencies:** Zod 3.24, @react-email/components, React 19

#### `@repo/ui` (packages/ui/)
**Purpose:** Shared UI component library
**Current State:** Minimal (1 Button wrapper component)
**Dependencies:** Mantine core + hooks

#### `@repo/typescript-config` (packages/typescript-config/)
**Purpose:** Shared TypeScript configurations
**Configs:**
- `base.json` - Base strict TS config
- `react.json` - React-specific config

---

## Technology Stack Summary

### Backend
- **Runtime:** Bun 1.2
- **Framework:** Hono 4.7
- **ORM:** Drizzle ORM 0.38
- **Database:** PostgreSQL
- **Cache:** Redis (ioredis)
- **Auth:** Clerk (@hono/clerk-auth)
- **Validation:** Zod 3.24
- **Storage:** AWS S3 / Cloudflare R2
- **Webhooks:** Svix 1.84
- **Email:** Nodemailer (Gmail SMTP)
- **Queue:** BullMQ (Redis-backed)
- **Testing:** Bun native test runner (32 unit tests pass)

### Frontend
- **Bundler:** Vite 6.0
- **Framework:** React 19
- **Routing:** React Router 7.1
- **UI Library:** Mantine 7.16 / 8.3.12
- **CSS:** Tailwind CSS 4.0
- **Icons:** Tabler Icons React 3.36
- **State:** TanStack Query 5.64, Zustand 5.0
- **Auth:** Clerk React 5.20
- **Rich Text:** TipTap 3.15
- **Drag/Drop:** @dnd-kit
- **Animations:** GSAP 3.12
- **Testing:** Vitest 3.0, Playwright 1.57

### Infrastructure
- **Monorepo:** Turborepo
- **Package Manager:** Bun
- **Linter/Formatter:** Biome
- **Containers:** Docker with multi-stage builds
- **CI/CD:** GitHub Actions
- **Reverse Proxy:** Nginx

---

## File Organization Patterns

### Naming Conventions
- **Files:** kebab-case (e.g., `task-detail-panel.tsx`, `user-sync.ts`)
- **Components:** PascalCase exports, kebab-case files
- **Types/Interfaces:** PascalCase
- **Constants:** SCREAMING_SNAKE_CASE

### Code Structure
- **Layered architecture:** Routes → Services → Database
- **Feature-based components:** Grouped by domain (comments, dashboard, projects)
- **Middleware chain:** Request processing pipeline
- **Custom hooks pattern:** Encapsulate React Query logic

### Import Aliases
- `@repo/shared` - Shared package imports
- `@repo/db` - Database schema imports
- `@repo/ui` - UI component imports
- `@` - Frontend src alias (web app only)

---

## Database Schema Overview

### Core Entities
1. **Users** - Clerk-synced user profiles
2. **Workspaces** - Multi-tenant organizations
3. **Projects** - Workspace-scoped projects
4. **Tasks** - Project tasks with rich metadata
5. **Workflow Statuses** - Custom Kanban columns per project
6. **Comments** - Task discussions
7. **Activity Logs** - Audit trail for all changes
8. **Notifications** - In-app notifications for task events
9. **Notification Preferences** - Per-user notification settings
10. **User Project Preferences** - Per-user view mode preferences

### Relationships
- Workspaces → Projects (1:N)
- Projects → Tasks (1:N)
- Projects → Workflow Statuses (1:N)
- Tasks → Status (N:1)
- Tasks → Dependencies (N:N self-reference)
- Tasks → Watchers (N:N with users)
- Tasks → Comments (1:N)
- Tasks → Attachments (1:N)

### Key Features
- **UUIDs** for all primary keys
- **Timestamps** on all tables (createdAt, updatedAt)
- **Soft deletes** via status enum for projects
- **Cascade deletes** for workspace/project hierarchies
- **Composite indexes** for optimized queries
- **JSONB columns** for flexible metadata (settings, changes)

---

### API Endpoints Summary

### Authentication
- Clerk webhook handlers for user/org sync

### Workspaces
- List, get, update workspaces
- Manage members (invite, remove)

### Projects
- CRUD operations with RBAC
- Custom workflow status management

### Tasks
- List with filters (status, assignee, priority, search, dates)
- Create, update, delete, move (drag-drop)
- Dependencies, watchers, attachments management
- Activity log retrieval

### Comments
- Task comments CRUD

### Notifications
- GET /notifications - List notifications with pagination
- GET /notifications/unread-count - Get unread notification count
- PATCH /notifications/:id/read - Mark single notification as read
- POST /notifications/mark-all-read - Mark all notifications as read
- GET /notifications/preferences - Get user notification preferences
- PATCH /notifications/preferences - Update notification preferences

### User Settings
- GET /user-settings/projects/:projectId/preference - Get project view preference
- PATCH /user-settings/projects/:projectId/preference - Set project view preference

### Dashboard
- Workspace statistics
- Recent activity feed
- Recent tasks

### WebSocket
- Real-time task updates
- Presence tracking
- Room-based broadcasting
- Auto-join user notification rooms (`user:{userId}`)

### In-App Notifications
**Transport:** Redis pub/sub + WebSocket fallback
**Storage:** PostgreSQL notifications table
**Frontend:** TanStack Query with WebSocket invalidation

**Features:**
- Real-time notification delivery via Redis pub/sub
- Fallback to direct WebSocket if Redis unavailable
- Notification bell with unread count badge
- Click-to-navigate for task/project entities
- Mark as read (single/bulk)
- Exponential backoff reconnection (10 attempts, max 60s)
- Auto-join user rooms on WebSocket connect

**Components:**
- `NotificationBell` (Mantine Indicator + Popover)
- `NotificationItem` (icon, time, click handler)
- `NotificationList` (scrollable, loading/empty states)
- `useNotifications` hook (React Query + WebSocket)

### Email Infrastructure
**Transport:** Nodemailer with Gmail SMTP
**Queue:** BullMQ (Redis-backed)
**Templates:** React Email components (TSX)

**Features:**
- Async email delivery with retry logic (3 attempts, exponential backoff)
- Rate limiting (100 emails/min, configurable)
- Idempotency keys prevent duplicates
- Circuit breaker (5 failures → 1min cooldown)
- Connection pooling (5 max connections)
- STARTTLS enforcement
- XSS sanitization for email content
- Email injection prevention

**Templates:**
- BaseLayout (responsive HTML wrapper)
- TaskAssigned (notify assignee)
- TaskUpdated (notify watchers on status/priority changes)
- CommentAdded (notify watchers on new comments)

**Security:**
- HTML entity escaping prevents XSS
- Newline detection prevents email header injection
- Email validation (RFC 5322 compliant)
- SMTP credentials in env vars only

---

## Testing Infrastructure

### Backend Tests
- **Unit tests:** Services layer (`services/__tests__/`)
- **Integration tests:** Full HTTP request flow (`tests/integration/`)
- **Test runner:** Bun native
- **Config:** `bunfig.toml` with `smol = true` for DB pool

### Frontend Tests
- **Unit tests:** Vitest
- **E2E tests:** Playwright (chromium)
- **Reports:** Playwright HTML reports with artifact retention

### CI Pipeline
1. Lint (Biome)
2. Type check (TypeScript)
3. Unit tests (Bun test)
4. Build (Turborepo)
5. E2E tests (Playwright)

---

## Build & Development

### Monorepo Scripts
- `dev` - Turbo dev mode (all apps)
- `build` - Turbo build (all packages/apps)
- `test` - Turbo test (all packages)
- `typecheck` - TypeScript validation
- `lint` / `lint:fix` - Biome linting
- `db:push` - Push schema to DB (dev)
- `db:generate` - Generate migrations
- `docker:dev` / `docker:prod` - Docker Compose

### Package Manager
- **Bun 1.2.0** for fast installs and runtime
- **Workspace protocol** for local package references

### Turborepo Caching
- **Cached tasks:** build, test, typecheck, lint
- **Non-cached:** dev, db:push, db:generate
- **Dependency graph:** Tasks depend on `^build` completion

---

## Docker Architecture

### Development (docker-compose.dev.yml)
- PostgreSQL (port 5433)
- Redis (port 6380)
- API and Web run locally (not containerized)

### Full Stack (docker-compose.yml)
- PostgreSQL + Redis + API + Web
- Nginx reverse proxy for Web
- Health checks for all services

### Production (docker-compose.prod.yml)
- Resource limits (512M API, 128M Redis/Web)
- Security: password-protected Redis/PostgreSQL
- GHCR image registry integration
- HTTPS/TLS ready

### Multi-stage Builds
- **API:** base → pruner (turbo prune) → installer → builder → runner
- **Web:** base → pruner → installer → builder → nginx static
- **Optimization:** Non-root user, frozen lockfile, minimal layers

---

## Key Metrics

| Metric | Count |
|--------|-------|
| Total files processed | 180+ |
| Backend API files | 40 (33 TS sources) |
| Frontend web files | 70 |
| Database schema files | 20 |
| Shared package files | 16 (including 4 email templates) |
| Total lines of code | ~3.2M chars |
| Total tokens (repomix) | ~900K |
| Component count (web) | ~23 |
| Database tables | 13 core + relations |
| API routes | ~48 endpoints |
| Test files | ~14 (32 unit tests pass) |

---

## Recent Development Activity

### Bootstrap Implementation (Phase 260117-1802)
14-phase implementation plan completed:
1. Monorepo setup (Turborepo + Bun)
2. Database schema (Drizzle ORM)
3. Backend foundation (Hono + middleware)
4. Auth & RBAC (Clerk integration)
5. Workspace/Project APIs
6. Task APIs with dependencies
7. Real-time layer (WebSocket + Redis)
8. Frontend foundation (Vite + React)
9. Dashboard & Workspace UI
10. Project views (Kanban, List, Calendar)
11. Task detail & editor (TipTap)
12. Comments & activity logs
13. Testing (Bun + Playwright)
14. Deployment (Docker + CI/CD)

### Scout Reports Generated
- Backend API & Database Layer
- Frontend & UI Layer
- Shared Packages, Config & Infrastructure

---

## Configuration Files

### Root Level
- `package.json` - Workspace root config
- `turbo.json` - Turborepo task orchestration
- `biome.json` - Linter/formatter config
- `tsconfig.json` - Composite TypeScript project
- `.env.example` / `.env.production.example` - Environment templates
- `Makefile` - Utility commands

### Docker
- `docker-compose.dev.yml` - Dev databases only
- `docker-compose.yml` - Full stack
- `docker-compose.prod.yml` - Production config
- `api.Dockerfile` - API multi-stage build
- `web.Dockerfile` - Web static build
- `nginx.conf` - Reverse proxy config

### CI/CD
- `.github/workflows/ci.yml` - Continuous integration
- `.github/workflows/deploy.yml` - Container build & deploy

---

## Notes

- **Security:** 4 files excluded from repomix output (CI secrets, test setup with credentials)
- **Build optimization:** Turbo prune reduces Docker context size
- **Type safety:** End-to-end TypeScript with Zod runtime validation
- **Scalability:** Multi-instance support via Redis pub/sub
- **Developer experience:** Hot reload, fast builds, comprehensive tooling
