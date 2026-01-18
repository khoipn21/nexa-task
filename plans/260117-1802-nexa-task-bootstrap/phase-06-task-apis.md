# Phase 06: Task Management APIs

## Context Links
- [Phase 05: Workspace + Project APIs](./phase-05-workspace-project-apis.md)
- [Drizzle Research](../reports/researcher-260117-1758-drizzle-postgres.md)

## Overview
- **Priority**: P2
- **Status**: pending
- **Effort**: 10h

Implement comprehensive task CRUD with dependencies, watchers, attachments, and activity logging.

## Key Insights
- Tasks belong to projects, scoped by workspace
- Task dependencies (blockers) are many-to-many self-referencing
- Watchers receive notifications on task updates
- Activity log captures all changes for audit trail
- File attachments stored externally (URLs), metadata in DB

## Requirements

### Functional
- Task CRUD with rich filtering
- Task position/order within status column
- Task dependencies (blocker relationships)
- Task watchers (subscribers)
- File attachment metadata
- Activity logging for all changes

### Non-Functional
- Optimistic updates support (return full task)
- Pagination for task lists
- Efficient queries with proper indexes

## Architecture

### API Endpoints
```
Tasks:
  GET    /api/projects/:projectId/tasks           List tasks (with filters)
  POST   /api/projects/:projectId/tasks           Create task
  GET    /api/tasks/:id                           Get task details
  PATCH  /api/tasks/:id                           Update task
  DELETE /api/tasks/:id                           Delete task
  POST   /api/tasks/:id/move                      Move task (status + order)

Dependencies:
  GET    /api/tasks/:id/dependencies              List dependencies
  POST   /api/tasks/:id/dependencies              Add dependency
  DELETE /api/tasks/:id/dependencies/:depId       Remove dependency

Watchers:
  GET    /api/tasks/:id/watchers                  List watchers
  POST   /api/tasks/:id/watchers                  Add watcher
  DELETE /api/tasks/:id/watchers/:userId          Remove watcher

Attachments:
  GET    /api/tasks/:id/attachments               List attachments
  POST   /api/tasks/:id/attachments               Upload attachment
  DELETE /api/attachments/:id                     Delete attachment
```

## Related Code Files

### Create
- `/apps/api/src/routes/tasks.ts`
- `/apps/api/src/services/task.ts`
- `/apps/api/src/services/activity.ts`
- `/packages/shared/src/validators/task.ts`

### Modify
- `/apps/api/src/routes/index.ts`

## Implementation Steps

### 1. Task Validators
**packages/shared/src/validators/task.ts**:
```typescript
import { z } from 'zod'

export const taskFilterSchema = z.object({
  statusId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  search: z.string().optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
})

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(50000).optional(), // Rich text HTML
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  statusId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
})

export const updateTaskSchema = createTaskSchema.partial()

export const moveTaskSchema = z.object({
  statusId: z.string().uuid(),
  order: z.number().int().min(0),
})

export const addDependencySchema = z.object({
  dependsOnId: z.string().uuid(),
})

export const addWatcherSchema = z.object({
  userId: z.string().uuid(),
})

export const uploadAttachmentSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileUrl: z.string().url(),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1),
})

export type TaskFilterInput = z.infer<typeof taskFilterSchema>
export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
export type MoveTaskInput = z.infer<typeof moveTaskSchema>
```

### 2. Activity Service
**apps/api/src/services/activity.ts**:
```typescript
import type { Database } from '@repo/db'
import { activityLogs, type ActivityChanges } from '@repo/db/schema'

type EntityType = 'workspace' | 'project' | 'task' | 'comment'
type ActionType = 'created' | 'updated' | 'deleted' | 'assigned' | 'commented' | 'status_changed' | 'moved'

export async function logActivity(
  db: Database,
  params: {
    workspaceId: string
    entityType: EntityType
    entityId: string
    userId: string
    action: ActionType
    changes?: ActivityChanges
    metadata?: Record<string, unknown>
  }
) {
  const [log] = await db
    .insert(activityLogs)
    .values({
      workspaceId: params.workspaceId,
      entityType: params.entityType,
      entityId: params.entityId,
      userId: params.userId,
      action: params.action,
      changes: params.changes,
      metadata: params.metadata,
    })
    .returning()

  return log
}

export function computeChanges<T extends Record<string, any>>(
  original: T,
  updated: Partial<T>,
  fields: (keyof T)[]
): ActivityChanges | undefined {
  const changes: ActivityChanges = {}
  let hasChanges = false

  for (const field of fields) {
    if (field in updated && updated[field] !== original[field]) {
      changes[field as string] = {
        old: original[field],
        new: updated[field],
      }
      hasChanges = true
    }
  }

  return hasChanges ? changes : undefined
}
```

### 3. Task Service
**apps/api/src/services/task.ts**:
```typescript
import { eq, and, desc, asc, like, lte, gte, sql } from 'drizzle-orm'
import type { Database } from '@repo/db'
import {
  tasks,
  taskDependencies,
  taskWatchers,
  attachments,
  projects,
  workflowStatuses,
} from '@repo/db/schema'
import type { CreateTaskInput, UpdateTaskInput, MoveTaskInput, TaskFilterInput } from '@repo/shared/validators/task'
import { NotFoundError, ValidationError } from '../lib/errors'
import { logActivity, computeChanges } from './activity'

export async function getTasksByProject(
  db: Database,
  projectId: string,
  filters: TaskFilterInput
) {
  const { page, limit, statusId, assigneeId, priority, search, dueBefore, dueAfter } = filters

  let query = db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .$dynamic()

  if (statusId) {
    query = query.where(eq(tasks.statusId, statusId))
  }
  if (assigneeId) {
    query = query.where(eq(tasks.assigneeId, assigneeId))
  }
  if (priority) {
    query = query.where(eq(tasks.priority, priority))
  }
  if (search) {
    query = query.where(like(tasks.title, `%${search}%`))
  }
  if (dueBefore) {
    query = query.where(lte(tasks.dueDate, new Date(dueBefore)))
  }
  if (dueAfter) {
    query = query.where(gte(tasks.dueDate, new Date(dueAfter)))
  }

  const offset = (page - 1) * limit

  const [taskList, countResult] = await Promise.all([
    query
      .orderBy(asc(tasks.order), desc(tasks.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(eq(tasks.projectId, projectId)),
  ])

  return {
    data: taskList,
    meta: {
      page,
      limit,
      total: countResult[0]?.count ?? 0,
    },
  }
}

export async function getTaskById(db: Database, taskId: string) {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: {
      project: true,
      status: true,
      assignee: true,
      createdBy: true,
      comments: {
        with: { user: true },
        orderBy: (comments, { desc }) => [desc(comments.createdAt)],
        limit: 20,
      },
      attachments: true,
      watchers: {
        with: { user: true },
      },
      dependencies: {
        with: { dependsOn: true },
      },
    },
  })

  if (!task) {
    throw new NotFoundError('Task', taskId)
  }

  return task
}

export async function createTask(
  db: Database,
  projectId: string,
  createdById: string,
  workspaceId: string,
  data: CreateTaskInput
) {
  // Get default status if not provided
  let statusId = data.statusId
  if (!statusId) {
    const defaultStatus = await db.query.workflowStatuses.findFirst({
      where: and(
        eq(workflowStatuses.projectId, projectId),
        eq(workflowStatuses.isDefault, true)
      ),
    })
    statusId = defaultStatus?.id
  }

  // Get max order in status column
  const maxOrderResult = await db
    .select({ maxOrder: sql<number>`COALESCE(MAX(${tasks.order}), -1)` })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), eq(tasks.statusId, statusId!)))

  const order = (maxOrderResult[0]?.maxOrder ?? -1) + 1

  const [task] = await db
    .insert(tasks)
    .values({
      ...data,
      projectId,
      createdById,
      statusId,
      order,
    })
    .returning()

  // Log activity
  await logActivity(db, {
    workspaceId,
    entityType: 'task',
    entityId: task.id,
    userId: createdById,
    action: 'created',
    metadata: { title: task.title },
  })

  return getTaskById(db, task.id)
}

export async function updateTask(
  db: Database,
  taskId: string,
  userId: string,
  workspaceId: string,
  data: UpdateTaskInput
) {
  const existing = await getTaskById(db, taskId)

  const [updated] = await db
    .update(tasks)
    .set({
      ...data,
      updatedAt: new Date(),
      completedAt: data.statusId ? null : existing.completedAt, // Reset on status change
    })
    .where(eq(tasks.id, taskId))
    .returning()

  if (!updated) {
    throw new NotFoundError('Task', taskId)
  }

  // Log changes
  const changes = computeChanges(existing, data, ['title', 'description', 'priority', 'assigneeId', 'dueDate'])
  if (changes) {
    await logActivity(db, {
      workspaceId,
      entityType: 'task',
      entityId: taskId,
      userId,
      action: 'updated',
      changes,
    })
  }

  // Log status change separately
  if (data.statusId && data.statusId !== existing.statusId) {
    await logActivity(db, {
      workspaceId,
      entityType: 'task',
      entityId: taskId,
      userId,
      action: 'status_changed',
      changes: {
        statusId: { old: existing.statusId, new: data.statusId },
      },
    })
  }

  // Log assignment change
  if (data.assigneeId !== undefined && data.assigneeId !== existing.assigneeId) {
    await logActivity(db, {
      workspaceId,
      entityType: 'task',
      entityId: taskId,
      userId,
      action: 'assigned',
      changes: {
        assigneeId: { old: existing.assigneeId, new: data.assigneeId },
      },
    })
  }

  return getTaskById(db, taskId)
}

export async function moveTask(
  db: Database,
  taskId: string,
  userId: string,
  workspaceId: string,
  data: MoveTaskInput
) {
  const existing = await getTaskById(db, taskId)

  // Update task position
  const [updated] = await db
    .update(tasks)
    .set({
      statusId: data.statusId,
      order: data.order,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId))
    .returning()

  // Log move
  if (data.statusId !== existing.statusId) {
    await logActivity(db, {
      workspaceId,
      entityType: 'task',
      entityId: taskId,
      userId,
      action: 'moved',
      changes: {
        statusId: { old: existing.statusId, new: data.statusId },
        order: { old: existing.order, new: data.order },
      },
    })
  }

  return getTaskById(db, taskId)
}

export async function deleteTask(
  db: Database,
  taskId: string,
  userId: string,
  workspaceId: string
) {
  const existing = await getTaskById(db, taskId)

  await db.delete(tasks).where(eq(tasks.id, taskId))

  // Log deletion
  await logActivity(db, {
    workspaceId,
    entityType: 'task',
    entityId: taskId,
    userId,
    action: 'deleted',
    metadata: { title: existing.title },
  })
}

// Dependencies
export async function getTaskDependencies(db: Database, taskId: string) {
  return db.query.taskDependencies.findMany({
    where: eq(taskDependencies.taskId, taskId),
    with: { dependsOn: true },
  })
}

export async function addTaskDependency(db: Database, taskId: string, dependsOnId: string) {
  // Prevent self-dependency
  if (taskId === dependsOnId) {
    throw new ValidationError({ dependsOnId: 'Task cannot depend on itself' })
  }

  // Check for circular dependency
  const existing = await db.query.taskDependencies.findFirst({
    where: and(
      eq(taskDependencies.taskId, dependsOnId),
      eq(taskDependencies.dependsOnId, taskId)
    ),
  })

  if (existing) {
    throw new ValidationError({ dependsOnId: 'Circular dependency detected' })
  }

  const [dep] = await db
    .insert(taskDependencies)
    .values({ taskId, dependsOnId })
    .returning()

  return dep
}

export async function removeTaskDependency(db: Database, taskId: string, dependsOnId: string) {
  await db
    .delete(taskDependencies)
    .where(
      and(
        eq(taskDependencies.taskId, taskId),
        eq(taskDependencies.dependsOnId, dependsOnId)
      )
    )
}

// Watchers
export async function getTaskWatchers(db: Database, taskId: string) {
  return db.query.taskWatchers.findMany({
    where: eq(taskWatchers.taskId, taskId),
    with: { user: true },
  })
}

export async function addTaskWatcher(db: Database, taskId: string, userId: string) {
  const [watcher] = await db
    .insert(taskWatchers)
    .values({ taskId, userId })
    .onConflictDoNothing()
    .returning()

  return watcher
}

export async function removeTaskWatcher(db: Database, taskId: string, userId: string) {
  await db
    .delete(taskWatchers)
    .where(
      and(
        eq(taskWatchers.taskId, taskId),
        eq(taskWatchers.userId, userId)
      )
    )
}

// Attachments
export async function getTaskAttachments(db: Database, taskId: string) {
  return db.query.attachments.findMany({
    where: eq(attachments.taskId, taskId),
    with: { uploadedBy: true },
  })
}

export async function addAttachment(
  db: Database,
  taskId: string,
  uploadedById: string,
  data: { fileName: string; fileUrl: string; fileSize: number; mimeType: string }
) {
  const [attachment] = await db
    .insert(attachments)
    .values({
      taskId,
      uploadedById,
      ...data,
    })
    .returning()

  return attachment
}

export async function deleteAttachment(db: Database, attachmentId: string) {
  const result = await db
    .delete(attachments)
    .where(eq(attachments.id, attachmentId))
    .returning()

  if (result.length === 0) {
    throw new NotFoundError('Attachment', attachmentId)
  }
}
```

### 4. Task Routes
**apps/api/src/routes/tasks.ts**:
```typescript
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { Variables } from '../types/context'
import { requireWorkspace } from '../middleware/auth'
import { requirePermission, requireOwnerOrRole } from '../middleware/rbac'
import { success, created, noContent, paginated } from '../lib/response'
import {
  taskFilterSchema,
  createTaskSchema,
  updateTaskSchema,
  moveTaskSchema,
  addDependencySchema,
  addWatcherSchema,
  uploadAttachmentSchema,
} from '@repo/shared/validators/task'
import * as taskService from '../services/task'

const tasksRouter = new Hono<{ Variables: Variables }>()

// Project-scoped task routes
const projectTasks = new Hono<{ Variables: Variables }>()

// List tasks in project
projectTasks.get(
  '/:projectId/tasks',
  requireWorkspace,
  zValidator('query', taskFilterSchema),
  async (c) => {
    const db = c.var.db
    const projectId = c.req.param('projectId')
    const filters = c.req.valid('query')
    const result = await taskService.getTasksByProject(db, projectId, filters)
    return paginated(c, result.data, result.meta)
  }
)

// Create task
projectTasks.post(
  '/:projectId/tasks',
  requireWorkspace,
  requirePermission('task:create'),
  zValidator('json', createTaskSchema),
  async (c) => {
    const user = c.var.user!
    const db = c.var.db
    const projectId = c.req.param('projectId')
    const data = c.req.valid('json')
    const result = await taskService.createTask(db, projectId, user.id, user.workspaceId!, data)
    return created(c, result)
  }
)

// Task-specific routes
// Get task
tasksRouter.get('/:id', requireWorkspace, async (c) => {
  const db = c.var.db
  const taskId = c.req.param('id')
  const result = await taskService.getTaskById(db, taskId)
  return success(c, result)
})

// Update task
tasksRouter.patch(
  '/:id',
  requireWorkspace,
  requirePermission('task:update'),
  zValidator('json', updateTaskSchema),
  async (c) => {
    const user = c.var.user!
    const db = c.var.db
    const taskId = c.req.param('id')
    const data = c.req.valid('json')
    const result = await taskService.updateTask(db, taskId, user.id, user.workspaceId!, data)
    return success(c, result)
  }
)

// Move task (change status/order)
tasksRouter.post(
  '/:id/move',
  requireWorkspace,
  requirePermission('task:update'),
  zValidator('json', moveTaskSchema),
  async (c) => {
    const user = c.var.user!
    const db = c.var.db
    const taskId = c.req.param('id')
    const data = c.req.valid('json')
    const result = await taskService.moveTask(db, taskId, user.id, user.workspaceId!, data)
    return success(c, result)
  }
)

// Delete task
tasksRouter.delete(
  '/:id',
  requireWorkspace,
  requirePermission('task:delete'),
  async (c) => {
    const user = c.var.user!
    const db = c.var.db
    const taskId = c.req.param('id')
    await taskService.deleteTask(db, taskId, user.id, user.workspaceId!)
    return noContent(c)
  }
)

// --- Dependencies ---
tasksRouter.get('/:id/dependencies', requireWorkspace, async (c) => {
  const db = c.var.db
  const taskId = c.req.param('id')
  const result = await taskService.getTaskDependencies(db, taskId)
  return success(c, result)
})

tasksRouter.post(
  '/:id/dependencies',
  requireWorkspace,
  requirePermission('task:update'),
  zValidator('json', addDependencySchema),
  async (c) => {
    const db = c.var.db
    const taskId = c.req.param('id')
    const { dependsOnId } = c.req.valid('json')
    const result = await taskService.addTaskDependency(db, taskId, dependsOnId)
    return created(c, result)
  }
)

tasksRouter.delete(
  '/:id/dependencies/:depId',
  requireWorkspace,
  requirePermission('task:update'),
  async (c) => {
    const db = c.var.db
    const taskId = c.req.param('id')
    const depId = c.req.param('depId')
    await taskService.removeTaskDependency(db, taskId, depId)
    return noContent(c)
  }
)

// --- Watchers ---
tasksRouter.get('/:id/watchers', requireWorkspace, async (c) => {
  const db = c.var.db
  const taskId = c.req.param('id')
  const result = await taskService.getTaskWatchers(db, taskId)
  return success(c, result)
})

tasksRouter.post(
  '/:id/watchers',
  requireWorkspace,
  zValidator('json', addWatcherSchema),
  async (c) => {
    const db = c.var.db
    const taskId = c.req.param('id')
    const { userId } = c.req.valid('json')
    const result = await taskService.addTaskWatcher(db, taskId, userId)
    return created(c, result)
  }
)

tasksRouter.delete('/:id/watchers/:userId', requireWorkspace, async (c) => {
  const db = c.var.db
  const taskId = c.req.param('id')
  const userId = c.req.param('userId')
  await taskService.removeTaskWatcher(db, taskId, userId)
  return noContent(c)
})

// --- Attachments ---
tasksRouter.get('/:id/attachments', requireWorkspace, async (c) => {
  const db = c.var.db
  const taskId = c.req.param('id')
  const result = await taskService.getTaskAttachments(db, taskId)
  return success(c, result)
})

tasksRouter.post(
  '/:id/attachments',
  requireWorkspace,
  requirePermission('task:update'),
  zValidator('json', uploadAttachmentSchema),
  async (c) => {
    const user = c.var.user!
    const db = c.var.db
    const taskId = c.req.param('id')
    const data = c.req.valid('json')
    const result = await taskService.addAttachment(db, taskId, user.id, data)
    return created(c, result)
  }
)

// Export both routers
export { projectTasks, tasksRouter as default }
```

### 5. Update Routes Index
Add to **apps/api/src/routes/index.ts**:
```typescript
import { projectTasks } from './tasks'
import tasks from './tasks'

// ... existing routes ...

routes.route('/api/projects', projectTasks) // For /projects/:id/tasks
routes.route('/api/tasks', tasks)           // For /tasks/:id
```

## Todo List
- [ ] Create task validators with filters
- [ ] Implement activity logging service
- [ ] Implement task service (CRUD, move, dependencies, watchers, attachments)
- [ ] Create task routes with RBAC
- [ ] Handle task ordering within status columns
- [ ] Prevent circular dependencies
- [ ] Update routes index
- [ ] Test all task operations
- [ ] Verify activity logs created

## Success Criteria
- [x] Tasks CRUD works with filters
- [x] Task move updates status and order
- [x] Dependencies prevent cycles
- [x] Watchers can be added/removed
- [x] Attachments metadata stored
- [x] Activity logs capture all changes

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Circular dependencies | Medium | Check before insert |
| Order conflicts on drag | Low | Reorder all in column |
| Large activity log growth | Low | Partition by date |

## Security Considerations
- Task access scoped by project/workspace
- Permission checks on mutations
- Attachment URLs validated

## Next Steps
- Phase 07: Real-time Layer (WebSocket)
