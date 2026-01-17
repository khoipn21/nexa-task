# Scout Report: Backend API & Database Layer

**Work Context:** `/mnt/k/Work/nexa-task`  
**Scope:** Backend API (`apps/api/`) and Database Package (`packages/db/`)  
**Date:** 2026-01-17

---

## 1. Directory Structure

### API Backend (`apps/api/`)
```
apps/api/
├── src/
│   ├── app.ts                    # Hono app setup & middleware
│   ├── index.ts                  # Entry point, WebSocket, Redis init
│   ├── lib/                      # Utilities
│   │   ├── errors.ts
│   │   ├── redis.ts
│   │   ├── response.ts
│   │   ├── validators.ts
│   │   └── websocket.ts
│   ├── middleware/               # Authentication, RBAC, DB injection
│   │   ├── auth.ts
│   │   ├── db.ts
│   │   ├── error.ts
│   │   ├── rate-limit.ts
│   │   └── rbac.ts
│   ├── routes/                   # API route handlers
│   │   ├── auth.ts
│   │   ├── comments.ts
│   │   ├── dashboard.ts
│   │   ├── health.ts
│   │   ├── index.ts
│   │   ├── projects.ts
│   │   ├── tasks.ts
│   │   ├── workspaces.ts
│   │   └── ws.ts
│   ├── services/                 # Business logic
│   │   ├── activity.ts
│   │   ├── comment.ts
│   │   ├── project.ts
│   │   ├── realtime.ts
│   │   ├── task.ts
│   │   ├── user-sync.ts
│   │   ├── workspace.ts
│   │   └── __tests__/
│   └── types/
│       └── context.ts
├── tests/
│   ├── helpers.ts
│   ├── setup.ts
│   └── integration/
├── bunfig.toml
├── package.json
└── tsconfig.json
```

### Database Package (`packages/db/`)
```
packages/db/
├── src/
│   ├── client.ts                 # Drizzle client setup
│   ├── index.ts                  # Public exports
│   └── schema/
│       ├── index.ts
│       ├── users.ts
│       ├── workspaces.ts
│       ├── projects.ts
│       ├── tasks.ts
│       ├── workflow-statuses.ts
│       ├── task-dependencies.ts
│       ├── task-watchers.ts
│       ├── comments.ts
│       ├── attachments.ts
│       ├── activity-logs.ts
│       └── relations.ts
├── drizzle.config.ts
├── package.json
└── tsconfig.json
```

---

## 2. Technology Stack

### API Backend
- **Framework:** Hono 4.7.0 (fast edge-compatible web framework)
- **Runtime:** Bun (native TypeScript runtime)
- **Authentication:** Clerk (@hono/clerk-auth 3.1.0)
- **Validation:** Zod 3.24.0 with @hono/zod-validator
- **Database Client:** Drizzle ORM (workspace package)
- **Real-time:** 
  - Redis (ioredis 5.9.2) for pub/sub
  - Bun WebSocket for connections
- **File Storage:** AWS S3 (@aws-sdk/client-s3 3.971.0)
- **Webhooks:** Svix 1.84.1
- **Testing:** Bun native test runner

### Database
- **ORM:** Drizzle ORM 0.38.0
- **Driver:** postgres 3.4.0
- **Database:** PostgreSQL (with timezone support)
- **Migrations:** Drizzle Kit 0.30.0
- **Schema Management:** TypeScript-first schema definitions

---

## 3. Architecture Patterns

### API Structure

**Layered Architecture:**
1. **Entry Point** (`index.ts`) → Initializes Redis, WebSocket, starts server
2. **App Setup** (`app.ts`) → Configures Hono with global middleware
3. **Middleware Chain:**
   - Request ID
   - Logger
   - Security headers
   - CORS
   - Database injection (`dbMiddleware`)
   - Rate limiting (100 req/min for public endpoints)
   - Clerk authentication (`clerkAuth`)
   - User enrichment (`authMiddleware`)
   - RBAC (`requirePermission`, `requireRole`)
4. **Routes** → Delegate to services
5. **Services** → Business logic, DB queries
6. **Response Helpers** → Standardized JSON responses

**Middleware Patterns:**
- Database context injection via `c.var.db`
- User context enrichment with workspace/role
- Auto-sync Clerk users to local DB
- Auto-create workspaces from Clerk organizations
- Permission-based access control (RBAC)

**Authentication Flow:**
1. Clerk validates JWT token
2. Extract Clerk user ID and org ID
3. Sync/fetch local user from DB
4. Resolve workspace and role from org membership
5. Inject `AuthUser` into context

**Real-time Architecture:**
- WebSocket manager tracks connections by room
- Redis pub/sub for cross-instance sync
- Channels: `task:{projectId}`, `presence:{projectId}`
- Graceful degradation if Redis unavailable

---

## 4. Key Files Analysis

### `/apps/api/package.json`
**Core Dependencies:**
- `hono`: Web framework
- `@hono/clerk-auth`: Authentication
- `@hono/zod-validator`: Request validation
- `@repo/db`: Workspace database package
- `@repo/shared`: Shared types/utilities
- `ioredis`: Redis client
- `@aws-sdk/client-s3`: File storage
- `svix`: Webhook management

**Scripts:**
- `dev`: Watch mode development
- `build`: Bun bundler
- `test`: Bun test runner
- `typecheck`: TypeScript validation

### `/apps/api/src/index.ts`
- Initializes Redis connection
- Mounts WebSocket routes at `/ws`
- Starts real-time subscriptions
- Exports Bun server config (50MB max body size for uploads)

### `/apps/api/src/app.ts`
- Hono app with typed `Variables`
- Global middleware stack
- CORS configured for localhost dev
- Rate limiting on `/api/*` routes
- Error handling (custom + 404)

### `/packages/db/package.json`
**Dependencies:**
- `drizzle-orm`: ORM
- `postgres`: PostgreSQL driver

**Scripts:**
- `db:push`: Push schema to DB
- `db:generate`: Generate migrations
- `db:migrate`: Run migrations
- `db:studio`: Drizzle Studio UI

### `/packages/db/drizzle.config.ts`
- Schema: `./src/schema/index.ts`
- Output: `./drizzle` (migrations)
- Dialect: PostgreSQL
- Credentials from `DATABASE_URL` env

---

## 5. API Endpoints

### Public
- `GET /health` - Health check

### Authentication (`/api/auth`)
- Clerk webhook handlers for user sync

### Workspaces (`/api/workspaces`)
- `GET /` - List user workspaces
- `GET /:id` - Get workspace details
- `PATCH /:id` - Update workspace (requires `workspace:update`)
- `GET /:id/members` - List members
- `POST /:id/members` - Invite member (requires `workspace:invite`)
- `DELETE /:id/members/:userId` - Remove member (super_admin/pm only)

### Projects (`/api/projects`)
- CRUD operations with RBAC
- Project-scoped workflow status management

### Tasks
**Project-scoped (`/api/projects/:projectId/tasks`):**
- `GET /:projectId/tasks` - List tasks with filters
- `POST /:projectId/tasks` - Create task (requires `task:create`)

**Task-specific (`/api/tasks/:id`):**
- `GET /:id` - Get task details
- `PATCH /:id` - Update task (requires `task:update`)
- `POST /:id/move` - Move task (change status/order)
- `DELETE /:id` - Delete task (requires `task:delete`)

**Task Relations:**
- `GET/POST/DELETE /:id/dependencies` - Manage dependencies
- `GET/POST/DELETE /:id/watchers` - Manage watchers
- `GET/POST /:id/attachments` - Manage attachments
- `GET /:id/activity` - Activity logs

**Standalone:**
- `DELETE /api/attachments/:id` - Delete attachment

### Comments (`/api`)
- `GET/POST /tasks/:id/comments` - Task comments
- `PATCH/DELETE /comments/:id` - Comment operations

### Dashboard (`/api`)
- `GET /dashboard/stats` - Workspace statistics
- `GET /activity` - Recent activity
- `GET /tasks/recent` - Recent tasks

### WebSocket (`/ws`)
- Real-time task updates
- Presence tracking
- Room-based broadcasting

---

## 6. Database Schema

### Core Tables

**users**
- `id` (UUID, PK)
- `clerkId` (text, unique) - Clerk user identifier
- `email` (text, unique)
- `name` (text)
- `avatarUrl` (text, nullable)
- Timestamps: `createdAt`, `updatedAt`
- Indexes: `clerkId`, `email`

**workspaces**
- `id` (UUID, PK)
- `clerkOrgId` (text, unique) - Clerk organization ID
- `name` (text)
- `slug` (text, unique)
- `ownerId` (UUID, FK → users.id)
- `settings` (jsonb) - `WorkspaceSettings` type
- Timestamps
- Indexes: `clerkOrgId`, `slug`, `ownerId`

**workspace_members**
- `id` (UUID, PK)
- `workspaceId` (UUID, FK → workspaces.id, CASCADE)
- `userId` (UUID, FK → users.id, CASCADE)
- `role` (enum: super_admin, pm, member, guest)
- `joinedAt` (timestamp)
- Indexes: `workspaceId`, `userId`

**projects**
- `id` (UUID, PK)
- `workspaceId` (UUID, FK → workspaces.id, CASCADE)
- `name` (text)
- `description` (text, nullable)
- `status` (enum: active, archived, deleted)
- `createdById` (UUID, FK → users.id)
- Timestamps
- Indexes: `workspaceId`, `status`, composite `workspaceId+status`

**workflow_statuses**
- `id` (UUID, PK)
- `projectId` (UUID, FK → projects.id, CASCADE)
- `name` (text)
- `color` (text)
- `order` (integer)
- Timestamps
- Purpose: Custom Kanban columns per project

**tasks**
- `id` (UUID, PK)
- `projectId` (UUID, FK → projects.id, CASCADE)
- `title` (text)
- `description` (text, nullable)
- `statusId` (UUID, FK → workflow_statuses.id, SET NULL)
- `priority` (enum: low, medium, high, urgent)
- `assigneeId` (UUID, FK → users.id, SET NULL)
- `createdById` (UUID, FK → users.id)
- `order` (integer) - For sorting within status
- `dueDate` (timestamp, nullable)
- `completedAt` (timestamp, nullable)
- Timestamps
- Indexes: `projectId`, `statusId`, `assigneeId`, composite indexes for queries

**task_dependencies**
- `id` (UUID, PK)
- `taskId` (UUID, FK → tasks.id, CASCADE)
- `dependsOnId` (UUID, FK → tasks.id, CASCADE)
- `createdAt`
- Purpose: Task A depends on Task B completion

**task_watchers**
- `id` (UUID, PK)
- `taskId` (UUID, FK → tasks.id, CASCADE)
- `userId` (UUID, FK → users.id, CASCADE)
- `watchedAt`
- Purpose: Users following task updates

**comments**
- `id` (UUID, PK)
- `taskId` (UUID, FK → tasks.id, CASCADE)
- `userId` (UUID, FK → users.id)
- `content` (text)
- Timestamps
- Indexes: `taskId`, `userId`, composite `taskId+createdAt`

**attachments**
- `id` (UUID, PK)
- `taskId` (UUID, FK → tasks.id, CASCADE)
- `uploadedById` (UUID, FK → users.id)
- `fileName`, `fileUrl`, `fileSize`, `mimeType` (text/integer)
- `createdAt`
- Index: `taskId`

**activity_logs**
- `id` (UUID, PK)
- `workspaceId` (UUID)
- `entityType` (enum: workspace, project, task, comment)
- `entityId` (UUID)
- `userId` (UUID, FK → users.id)
- `action` (enum: created, updated, deleted, assigned, commented, status_changed, moved)
- `changes` (jsonb) - `ActivityChanges` type (old/new values)
- `metadata` (jsonb)
- `createdAt`
- Indexes: `workspaceId`, composite `entityType+entityId`, `userId`, `createdAt`

### Relationships (Drizzle Relations)

**Users:**
- `ownedWorkspaces` → workspaces
- `workspaceMemberships` → workspace_members
- `createdProjects` → projects
- `assignedTasks` → tasks (as assignee)
- `createdTasks` → tasks (as creator)
- `comments`, `activityLogs`

**Workspaces:**
- `owner` → users
- `members` → workspace_members
- `projects` → projects

**Projects:**
- `workspace` → workspaces
- `createdBy` → users
- `tasks`, `workflowStatuses`

**Tasks:**
- `project`, `status`, `assignee`, `createdBy`
- `comments`, `attachments`, `watchers`
- `dependencies` (tasks this task depends on)
- `dependents` (tasks that depend on this task)

### Migration Approach
- **Schema-first:** Define in TypeScript
- **Push:** `db:push` for dev (no migration files)
- **Generate:** `db:generate` creates SQL migrations
- **Migrate:** `db:migrate` applies migrations
- **Studio:** `db:studio` launches Drizzle Studio UI

---

## 7. RBAC System

### Roles (from workspace_role enum)
1. `super_admin` - Full workspace control
2. `pm` - Project management
3. `member` - Standard access
4. `guest` - Limited read access

### Permission Pattern
Permissions checked via `@repo/shared` helpers:
- `hasPermission(role, permission)` - Single permission
- `hasAnyPermission(role, permissions[])` - Any match

**Example Permissions:**
- `workspace:update`, `workspace:invite`
- `project:create`, `project:update`, `project:delete`
- `task:create`, `task:update`, `task:delete`

### Middleware Usage
```typescript
requirePermission('task:create')  // Block if user lacks permission
requireRole('super_admin', 'pm')  // Block if not in allowed roles
requireWorkspace                  // Block if no active workspace
```

---

## 8. Real-time Features

### WebSocket Manager (`lib/websocket.ts`)
- Tracks connections by `userId`
- Room-based broadcasting (e.g., project rooms)
- Methods: `joinRoom`, `leaveRoom`, `broadcast`
- Graceful handling of disconnects

### Redis Pub/Sub (`lib/redis.ts`)
- **Channels:**
  - `task:{projectId}` - Task updates
  - `presence:{projectId}` - User presence
- **Dual clients:** Main + subscription client
- **Lazy connect:** Starts on `init()`
- **Fallback:** App runs without Redis if unavailable

### Realtime Service (`services/realtime.ts`)
- Subscribes to Redis channels
- Broadcasts to WebSocket rooms
- Use case: Multi-instance API servers sync via Redis

---

## 9. Testing Infrastructure

### Test Setup
- **Runner:** Bun native test (`bun test`)
- **Config:** `bunfig.toml` with `smol = true` (reduced parallelism for DB pool)
- **Helpers:** `tests/helpers.ts`, `tests/setup.ts`
- **Unit Tests:** `services/__tests__/task.test.ts`
- **Integration:** `tests/integration/tasks.test.ts`

### Scripts
- `test`: Run all tests
- `test:watch`: Watch mode
- `test:coverage`: Coverage report

---

## 10. Configuration Files

### `/apps/api/bunfig.toml`
```toml
[test]
smol = true  # Reduced parallelism for DB pool conflicts
```

### Environment Variables (inferred)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection (defaults `redis://localhost:6379`)
- `PORT` - API port (defaults `3001`)
- `CORS_ORIGIN` - Allowed CORS origins (comma-separated)
- `CLERK_*` - Clerk authentication keys
- `AWS_*` - S3 credentials for file uploads

---

## Summary

**API Backend:**
- Hono framework on Bun runtime
- Clerk authentication with auto-sync to local DB
- RBAC with role/permission middleware
- Redis + WebSocket for real-time features
- S3 for file attachments
- Comprehensive route coverage (workspaces, projects, tasks, comments)
- Standardized response helpers
- Test infrastructure with Bun

**Database:**
- Drizzle ORM with PostgreSQL
- 10 main tables + 1 junction table
- Type-safe schema definitions
- Complex relations (dependencies, watchers, activity logs)
- Migration support via Drizzle Kit
- Enum types for status, priority, roles, actions

**Key Patterns:**
- Workspace-centric multi-tenancy
- Auto-create workspaces from Clerk orgs
- Permission-based access control
- Activity logging for audit trails
- Task dependency graph support
- Real-time collaboration via WebSocket/Redis

**File Count:**
- API: 36 files (29 TypeScript sources)
- Database: 17 files (14 schema/client files)

---

## Unresolved Questions

1. Is OpenAPI/Swagger documentation configured? (Saw `@hono/swagger-ui` dependency but no route handler)
2. What's the S3 bucket structure for attachments?
3. Are there database seeding scripts for development?
4. What's the webhook handling strategy (Svix usage patterns)?
5. Is there rate limiting per user/workspace or just global?
6. How are workflow statuses initialized for new projects?
