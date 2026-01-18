import { zValidator } from '@hono/zod-validator'
import {
  createProjectSchema,
  createWorkflowStatusSchema,
  reorderStatusesSchema,
  updateProjectSchema,
  updateWorkflowStatusSchema,
} from '@repo/shared'
import { Hono } from 'hono'
import { getAuthUser, getWorkspaceId } from '../lib/errors'
import { created, noContent, success } from '../lib/response'
import { requireWorkspace } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'
import * as projectService from '../services/project'
import type { Variables } from '../types/context'

const projects = new Hono<{ Variables: Variables }>()

// List projects
projects.get('/', requireWorkspace, async (c) => {
  const user = getAuthUser(c.var)
  const workspaceId = getWorkspaceId(user)
  const db = c.var.db
  const result = await projectService.getProjectsByWorkspace(db, workspaceId)
  return success(c, result)
})

// Create project
projects.post(
  '/',
  requireWorkspace,
  requirePermission('project:create'),
  zValidator('json', createProjectSchema),
  async (c) => {
    const user = getAuthUser(c.var)
    const workspaceId = getWorkspaceId(user)
    const db = c.var.db
    const data = c.req.valid('json')
    const result = await projectService.createProject(
      db,
      workspaceId,
      user.id,
      data,
    )
    return created(c, result)
  },
)

// Get project
projects.get('/:id', requireWorkspace, async (c) => {
  const user = getAuthUser(c.var)
  const workspaceId = getWorkspaceId(user)
  const db = c.var.db
  const projectId = c.req.param('id')
  const result = await projectService.getProjectById(db, projectId, workspaceId)
  return success(c, result)
})

// Update project
projects.patch(
  '/:id',
  requireWorkspace,
  requirePermission('project:update'),
  zValidator('json', updateProjectSchema),
  async (c) => {
    const user = getAuthUser(c.var)
    const workspaceId = getWorkspaceId(user)
    const db = c.var.db
    const projectId = c.req.param('id')
    const data = c.req.valid('json')
    const result = await projectService.updateProject(
      db,
      projectId,
      workspaceId,
      data,
    )
    return success(c, result)
  },
)

// Delete (archive) project
projects.delete(
  '/:id',
  requireWorkspace,
  requirePermission('project:delete'),
  async (c) => {
    const user = getAuthUser(c.var)
    const workspaceId = getWorkspaceId(user)
    const db = c.var.db
    const projectId = c.req.param('id')
    await projectService.deleteProject(db, projectId, workspaceId)
    return noContent(c)
  },
)

// --- Workflow Statuses ---

// List statuses
projects.get('/:id/statuses', requireWorkspace, async (c) => {
  const db = c.var.db
  const projectId = c.req.param('id')
  const result = await projectService.getProjectStatuses(db, projectId)
  return success(c, result)
})

// Create status
projects.post(
  '/:id/statuses',
  requireWorkspace,
  requirePermission('project:update'),
  zValidator('json', createWorkflowStatusSchema),
  async (c) => {
    const db = c.var.db
    const projectId = c.req.param('id')
    const data = c.req.valid('json')
    const result = await projectService.createWorkflowStatus(
      db,
      projectId,
      data,
    )
    return created(c, result)
  },
)

// Update status
projects.patch(
  '/:id/statuses/:statusId',
  requireWorkspace,
  requirePermission('project:update'),
  zValidator('json', updateWorkflowStatusSchema),
  async (c) => {
    const db = c.var.db
    const projectId = c.req.param('id')
    const statusId = c.req.param('statusId')
    const data = c.req.valid('json')
    const result = await projectService.updateWorkflowStatus(
      db,
      statusId,
      projectId,
      data,
    )
    return success(c, result)
  },
)

// Delete status
projects.delete(
  '/:id/statuses/:statusId',
  requireWorkspace,
  requirePermission('project:update'),
  async (c) => {
    const db = c.var.db
    const projectId = c.req.param('id')
    const statusId = c.req.param('statusId')
    await projectService.deleteWorkflowStatus(db, statusId, projectId)
    return noContent(c)
  },
)

// Reorder statuses
projects.post(
  '/:id/statuses/reorder',
  requireWorkspace,
  requirePermission('project:update'),
  zValidator('json', reorderStatusesSchema),
  async (c) => {
    const db = c.var.db
    const projectId = c.req.param('id')
    const { orderedIds } = c.req.valid('json')
    const result = await projectService.reorderStatuses(
      db,
      projectId,
      orderedIds,
    )
    return success(c, result)
  },
)

export default projects
