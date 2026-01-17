# Code Standards & Conventions

**Project:** Nexa Task
**Last Updated:** 2026-01-17

---

## File Naming Conventions

### General Rules
- **Files:** kebab-case with descriptive names
- **Directories:** kebab-case, feature-based organization
- **Extensions:** `.ts` for TypeScript, `.tsx` for React components

### Examples
```
✓ Good:
  task-detail-panel.tsx
  user-sync.ts
  use-workspace.ts
  create-project-modal.tsx

✗ Bad:
  TaskDetailPanel.tsx
  UserSync.ts
  useWorkspace.ts
```

### File Size Guidelines
- **Maximum:** 200 lines per file for optimal context management
- **Recommendation:** Split large files into smaller, focused modules
- **Exceptions:** Generated files, configuration files

**When to split:**
- Component exceeds 150 lines → extract sub-components
- Service exceeds 200 lines → create separate service modules
- Utility file exceeds 100 lines → categorize into multiple files

---

## Directory Structure Standards

### Backend (`apps/api/src/`)

```
src/
├── lib/                  # Shared utilities (NO business logic)
│   ├── errors.ts         # Error classes and handlers
│   ├── redis.ts          # Redis client setup
│   ├── response.ts       # Standard response helpers
│   ├── validators.ts     # Custom Zod validators
│   └── websocket.ts      # WebSocket manager
├── middleware/           # Hono middleware functions
│   ├── auth.ts           # Authentication (Clerk + user enrichment)
│   ├── db.ts             # Database injection
│   ├── error.ts          # Global error handler
│   ├── rate-limit.ts     # Rate limiting
│   └── rbac.ts           # Permission checks
├── routes/               # API route handlers (thin controllers)
│   ├── auth.ts
│   ├── comments.ts
│   ├── dashboard.ts
│   ├── health.ts
│   ├── index.ts          # Route registration
│   ├── projects.ts
│   ├── tasks.ts
│   ├── workspaces.ts
│   └── ws.ts
├── services/             # Business logic layer
│   ├── __tests__/        # Unit tests for services
│   ├── activity.ts
│   ├── comment.ts
│   ├── project.ts
│   ├── realtime.ts
│   ├── task.ts
│   ├── user-sync.ts
│   └── workspace.ts
├── types/                # TypeScript type definitions
│   └── context.ts
├── app.ts                # Hono app setup
└── index.ts              # Entry point
```

### Frontend (`apps/web/src/`)

```
src/
├── components/           # Feature-based components
│   ├── comments/         # Comment system components
│   ├── dashboard/        # Dashboard widgets
│   ├── layouts/          # App shell layouts
│   ├── project-views/    # Kanban, list, calendar
│   ├── projects/         # Project list/card components
│   └── task-detail/      # Task editor and sidebar
├── hooks/                # React custom hooks (data fetching)
│   ├── use-auth.ts
│   ├── use-comments.ts
│   ├── use-projects.ts
│   ├── use-tasks.ts
│   └── use-workspace.ts
├── lib/                  # Client utilities
│   ├── api.ts            # API client singleton
│   ├── auth-sync.tsx     # Clerk token sync
│   └── query-client.ts   # TanStack Query setup
├── routes/               # Route components
│   ├── dashboard.tsx
│   ├── index.tsx
│   ├── project-detail.tsx
│   ├── projects.tsx
│   └── settings.tsx
├── index.css             # CSS layer imports
└── main.tsx              # App entry point
```

### Database (`packages/db/src/`)

```
src/
├── schema/               # Drizzle schema definitions
│   ├── index.ts          # Schema exports
│   ├── users.ts
│   ├── workspaces.ts
│   ├── projects.ts
│   ├── tasks.ts
│   ├── workflow-statuses.ts
│   ├── task-dependencies.ts
│   ├── task-watchers.ts
│   ├── comments.ts
│   ├── attachments.ts
│   ├── activity-logs.ts
│   └── relations.ts      # Drizzle relations
├── client.ts             # Drizzle client setup
└── index.ts              # Public exports
```

### Shared (`packages/shared/src/`)

```
src/
├── types/                # TypeScript interfaces
│   ├── auth.ts           # RBAC types and helpers
│   └── index.ts          # Core entity types
├── validators/           # Zod schemas
│   ├── index.ts
│   ├── project.ts
│   ├── task.ts
│   └── workspace.ts
└── index.ts              # Public exports
```

---

## Naming Conventions

### TypeScript

**Variables:**
```typescript
// camelCase for variables and functions
const userName = "John";
const fetchUserData = async () => {};

// PascalCase for classes and interfaces
class UserService {}
interface UserProfile {}
type TaskPriority = "low" | "medium" | "high";

// SCREAMING_SNAKE_CASE for constants
const MAX_FILE_SIZE = 50_000_000;
const DEFAULT_PAGE_SIZE = 20;
```

**React Components:**
```tsx
// PascalCase for component names (file: kebab-case)
// File: task-detail-panel.tsx
export function TaskDetailPanel() {}

// camelCase for props
interface TaskDetailPanelProps {
  taskId: string;
  onClose: () => void;
}
```

**Database Schema:**
```typescript
// snake_case for table names and columns
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  created_at: timestamp("created_at").defaultNow(),
  project_id: uuid("project_id").references(() => projects.id),
});

// camelCase for TypeScript exports
export type Task = typeof tasks.$inferSelect;
```

### API Endpoints
```
// kebab-case, plural nouns, RESTful
GET    /api/workspaces
GET    /api/workspaces/:id
POST   /api/workspaces
PATCH  /api/workspaces/:id

// Nested resources
GET    /api/projects/:id/tasks
POST   /api/projects/:id/tasks

// Actions on resources
POST   /api/tasks/:id/move
POST   /api/tasks/:id/dependencies
```

---

## TypeScript Standards

### Configuration
- **Strict mode:** Enabled in all packages
- **Target:** ES2022
- **Module:** ESNext with bundler resolution
- **Additional strict checks:** `noUncheckedIndexedAccess`

### Type Definitions

**Prefer interfaces over types for objects:**
```typescript
// ✓ Good
interface User {
  id: string;
  name: string;
}

// ✗ Avoid (unless using union/intersection)
type User = {
  id: string;
  name: string;
};
```

**Use type for unions and utility types:**
```typescript
// ✓ Good
type TaskPriority = "low" | "medium" | "high" | "urgent";
type Nullable<T> = T | null;
```

**Explicit return types for public APIs:**
```typescript
// ✓ Good
export function getUser(id: string): Promise<User | null> {
  return db.query.users.findFirst({ where: eq(users.id, id) });
}

// ✗ Avoid (implicit return type)
export function getUser(id: string) {
  return db.query.users.findFirst({ where: eq(users.id, id) });
}
```

**Use Zod for runtime validation:**
```typescript
import { z } from "zod";

// Define schema
export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  priority: z.enum(["low", "medium", "high", "urgent"]),
});

// Infer TypeScript type
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
```

---

## React Standards

### Component Structure

```tsx
// 1. Imports (grouped: external, internal, types)
import { useState } from "react";
import { Button, Paper } from "@mantine/core";
import { useTask } from "@/hooks/use-tasks";
import type { Task } from "@repo/shared";

// 2. Type definitions
interface TaskCardProps {
  task: Task;
  onUpdate: (task: Task) => void;
}

// 3. Component (functional, named export)
export function TaskCard({ task, onUpdate }: TaskCardProps) {
  // 3a. Hooks (top of component)
  const [isEditing, setIsEditing] = useState(false);
  const { updateTask } = useTask(task.id);

  // 3b. Event handlers
  const handleSave = async () => {
    await updateTask({ title: "New title" });
    setIsEditing(false);
  };

  // 3c. Render
  return (
    <Paper>
      {/* JSX */}
    </Paper>
  );
}
```

### Custom Hooks

```typescript
// File: use-tasks.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Task } from "@repo/shared";

export function useTasks(projectId: string) {
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => api.get<Task[]>(`/projects/${projectId}/tasks`),
  });

  const createTask = useMutation({
    mutationFn: (data: CreateTaskInput) =>
      api.post<Task>(`/projects/${projectId}/tasks`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
  });

  return { tasks, isLoading, createTask };
}
```

### State Management Rules

**Local state (useState):**
- Component-specific UI state (modals, forms)
- Derived state from props

**React Query (server state):**
- API data fetching
- Caching and synchronization
- Optimistic updates

**Zustand (global client state):**
- User preferences
- UI theme
- Cross-component state (not server-derived)

---

## Backend Standards

### Route Handlers (Thin Controllers)

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createTaskSchema } from "@repo/shared/validators";
import { TaskService } from "../services/task";
import { requirePermission } from "../middleware/rbac";
import { successResponse } from "../lib/response";

const app = new Hono();

app.post(
  "/projects/:id/tasks",
  requirePermission("task:create"),
  zValidator("json", createTaskSchema),
  async (c) => {
    const projectId = c.req.param("id");
    const data = c.req.valid("json");
    const user = c.var.user;

    const task = await TaskService.create(c.var.db, {
      ...data,
      projectId,
      createdById: user.id,
    });

    return successResponse(c, task, "Task created", 201);
  }
);

export default app;
```

### Service Layer (Business Logic)

```typescript
import { eq } from "drizzle-orm";
import type { DB } from "@repo/db";
import { tasks } from "@repo/db/schema";
import type { CreateTaskInput } from "@repo/shared/validators";
import { ActivityService } from "./activity";

export class TaskService {
  static async create(db: DB, input: CreateTaskInput & { createdById: string }) {
    const [task] = await db.insert(tasks).values(input).returning();

    // Log activity
    await ActivityService.log(db, {
      entityType: "task",
      entityId: task.id,
      userId: input.createdById,
      action: "created",
    });

    return task;
  }

  static async findById(db: DB, id: string) {
    return db.query.tasks.findFirst({
      where: eq(tasks.id, id),
      with: { assignee: true, createdBy: true },
    });
  }
}
```

### Error Handling

```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    public message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      `${resource}${id ? ` with id ${id}` : ""} not found`,
      "NOT_FOUND",
      404
    );
  }
}

// Usage in service
static async findById(db: DB, id: string) {
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
  if (!task) throw new NotFoundError("Task", id);
  return task;
}
```

---

## Database Standards

### Schema Definitions

```typescript
import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

// Enums first
export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

// Tables
export const tasks = pgTable(
  "tasks",
  {
    // Primary key
    id: uuid("id").primaryKey().defaultRandom(),

    // Foreign keys
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Data fields
    title: text("title").notNull(),
    priority: taskPriorityEnum("priority").notNull().default("medium"),

    // Timestamps (always include)
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Indexes
    projectIdx: index("tasks_project_idx").on(table.projectId),
    statusIdx: index("tasks_status_idx").on(table.statusId),
  })
);
```

### Query Patterns

```typescript
// Use Drizzle query builder for complex joins
const tasksWithAssignee = await db.query.tasks.findMany({
  where: eq(tasks.projectId, projectId),
  with: {
    assignee: true,
    status: true,
  },
  orderBy: [asc(tasks.order)],
});

// Use raw SQL for complex aggregations
const stats = await db.execute(sql`
  SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE completed_at IS NOT NULL) as completed
  FROM tasks
  WHERE project_id = ${projectId}
`);
```

---

## Testing Standards

### Unit Tests (Services)

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { TaskService } from "../task";
import { testDb } from "../../tests/helpers";

describe("TaskService", () => {
  beforeEach(async () => {
    await testDb.reset();
  });

  it("should create a task", async () => {
    const task = await TaskService.create(testDb, {
      projectId: "project-1",
      title: "Test task",
      createdById: "user-1",
    });

    expect(task.id).toBeDefined();
    expect(task.title).toBe("Test task");
  });

  it("should throw NotFoundError for invalid ID", async () => {
    expect(
      TaskService.findById(testDb, "invalid-id")
    ).rejects.toThrow(NotFoundError);
  });
});
```

### Integration Tests (API)

```typescript
import { describe, it, expect } from "bun:test";
import { app } from "../app";

describe("POST /api/projects/:id/tasks", () => {
  it("should create a task", async () => {
    const res = await app.request("/api/projects/project-1/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${testToken}`,
      },
      body: JSON.stringify({ title: "New task" }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.title).toBe("New task");
  });

  it("should return 401 without auth", async () => {
    const res = await app.request("/api/projects/project-1/tasks", {
      method: "POST",
      body: JSON.stringify({ title: "Test" }),
    });

    expect(res.status).toBe(401);
  });
});
```

### E2E Tests (Playwright)

```typescript
import { test, expect } from "@playwright/test";

test("should create and complete a task", async ({ page }) => {
  await page.goto("/projects/project-1");

  // Create task
  await page.getByRole("button", { name: "Add task" }).click();
  await page.getByPlaceholder("Task title").fill("Buy milk");
  await page.getByRole("button", { name: "Create" }).click();

  // Verify task appears
  await expect(page.getByText("Buy milk")).toBeVisible();

  // Drag to Done column
  const task = page.getByText("Buy milk");
  const doneColumn = page.getByTestId("column-done");
  await task.dragTo(doneColumn);

  // Verify task moved
  await expect(doneColumn.getByText("Buy milk")).toBeVisible();
});
```

---

## Code Quality Standards

### Linting & Formatting
- **Tool:** Biome (configured in `biome.json`)
- **Rules:** Recommended + organize imports
- **Format:** 2-space indent, single quotes, no semicolons
- **Pre-commit:** Run `bun lint:fix` before commits

### Type Coverage
- **Target:** 100% (strict mode enforced)
- **No `any` types** (use `unknown` if necessary)
- **No `@ts-ignore`** (fix type errors properly)

### Documentation
- **JSDoc for public APIs:**
```typescript
/**
 * Creates a new task in the specified project.
 *
 * @param db - Database client
 * @param input - Task creation data
 * @returns The created task
 * @throws {NotFoundError} If project doesn't exist
 */
export async function createTask(db: DB, input: CreateTaskInput): Promise<Task> {
  // ...
}
```

### Performance
- **Avoid N+1 queries:** Use `with` for relations
- **Paginate large datasets:** Default 20 items/page
- **Cache expensive computations:** Use React Query, Redis
- **Optimize re-renders:** Use `memo`, `useMemo`, `useCallback` judiciously

---

## Security Standards

### Input Validation
- **Always validate with Zod** on API boundaries
- **Sanitize HTML** from rich text editors
- **Validate file types** and sizes on uploads

### Authentication & Authorization
- **Check permissions** in every route (use `requirePermission`)
- **Never trust client-side data** for auth decisions
- **Validate JWT tokens** on every request

### Database
- **Use parameterized queries** (Drizzle handles this)
- **Principle of least privilege** for DB user
- **Enable row-level security** (future)

### CORS & Headers
```typescript
// app.ts
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") ?? "*",
    credentials: true,
  })
);

app.use(
  secureHeaders({
    xFrameOptions: "DENY",
    xContentTypeOptions: "nosniff",
    xXssProtection: "1; mode=block",
  })
);
```

---

## Git Commit Standards

### Conventional Commits

```
type(scope): subject

[optional body]

[optional footer]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `style` - Code style changes (formatting)
- `refactor` - Code refactoring (no functional change)
- `perf` - Performance improvement
- `test` - Adding/updating tests
- `chore` - Build/tooling changes

**Examples:**
```
feat(tasks): add drag-and-drop reordering

Implement drag-and-drop for Kanban board using dnd-kit.
Tasks can now be reordered within columns and moved between columns.

Closes #42

---

fix(auth): resolve token refresh race condition

Token refresh now uses mutex to prevent concurrent refreshes.

---

docs(readme): update deployment instructions
```

---

## Code Review Checklist

- [ ] Code follows naming conventions
- [ ] TypeScript types are explicit and correct
- [ ] Zod validation on all API inputs
- [ ] Error handling implemented
- [ ] Tests written and passing
- [ ] No security vulnerabilities
- [ ] Performance considerations addressed
- [ ] Documentation updated (if public API)
- [ ] Commit messages follow convention
- [ ] No console.log statements
- [ ] No commented-out code
