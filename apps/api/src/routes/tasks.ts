import { zValidator } from '@hono/zod-validator'
import {
  addDependencySchema,
  addWatcherSchema,
  createTaskSchema,
  moveTaskSchema,
  taskFilterSchema,
  updateTaskSchema,
  uploadAttachmentSchema,
} from '@repo/shared'
import { Hono } from 'hono'
import { getAuthUser, getWorkspaceId } from '../lib/errors'
import { created, noContent, paginated, success } from '../lib/response'
import { requireWorkspace } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'
import * as taskService from '../services/task'
import type { Variables } from '../types/context'

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
  },
)

// Create task
projectTasks.post(
  '/:projectId/tasks',
  requireWorkspace,
  requirePermission('task:create'),
  zValidator('json', createTaskSchema),
  async (c) => {
    const user = getAuthUser(c.var)
    const workspaceId = getWorkspaceId(user)
    const db = c.var.db
    const projectId = c.req.param('projectId')
    const data = c.req.valid('json')
    const result = await taskService.createTask(
      db,
      projectId,
      user.id,
      workspaceId,
      data,
    )
    return created(c, result)
  },
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
    const user = getAuthUser(c.var)
    const workspaceId = getWorkspaceId(user)
    const db = c.var.db
    const taskId = c.req.param('id')
    const data = c.req.valid('json')
    const result = await taskService.updateTask(
      db,
      taskId,
      user.id,
      workspaceId,
      data,
    )
    return success(c, result)
  },
)

// Move task (change status/order)
tasksRouter.post(
  '/:id/move',
  requireWorkspace,
  requirePermission('task:update'),
  zValidator('json', moveTaskSchema),
  async (c) => {
    const user = getAuthUser(c.var)
    const workspaceId = getWorkspaceId(user)
    const db = c.var.db
    const taskId = c.req.param('id')
    const data = c.req.valid('json')
    const result = await taskService.moveTask(
      db,
      taskId,
      user.id,
      workspaceId,
      data,
    )
    return success(c, result)
  },
)

// Delete task
tasksRouter.delete(
  '/:id',
  requireWorkspace,
  requirePermission('task:delete'),
  async (c) => {
    const user = getAuthUser(c.var)
    const workspaceId = getWorkspaceId(user)
    const db = c.var.db
    const taskId = c.req.param('id')
    await taskService.deleteTask(db, taskId, user.id, workspaceId)
    return noContent(c)
  },
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
  },
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
  },
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
    const user = getAuthUser(c.var)
    const db = c.var.db
    const taskId = c.req.param('id')
    const { userId } = c.req.valid('json')
    const result = await taskService.addTaskWatcher(db, taskId, userId, user.id)
    return created(c, result)
  },
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
    const user = getAuthUser(c.var)
    const db = c.var.db
    const taskId = c.req.param('id')
    const data = c.req.valid('json')
    const result = await taskService.addAttachment(db, taskId, user.id, data)
    return created(c, result)
  },
)

// --- Activity ---
tasksRouter.get('/:id/activity', requireWorkspace, async (c) => {
  const db = c.var.db
  const taskId = c.req.param('id')
  const result = await taskService.getTaskActivity(db, taskId)
  return success(c, result)
})

// --- Standalone Attachment Delete ---
// Separate router for /attachments/:id since it's not nested under /tasks/:id
const attachmentsRouter = new Hono<{ Variables: Variables }>()

attachmentsRouter.delete(
  '/:id',
  requireWorkspace,
  requirePermission('task:update'),
  async (c) => {
    const db = c.var.db
    const attachmentId = c.req.param('id')
    await taskService.deleteAttachment(db, attachmentId)
    return noContent(c)
  },
)

// Export both routers
export { projectTasks, attachmentsRouter, tasksRouter as default }
