import { zValidator } from '@hono/zod-validator'
import { viewModeSchema } from '@repo/shared'
import { Hono } from 'hono'
import { getAuthUser, getWorkspaceId } from '../lib/errors'
import { success } from '../lib/response'
import { requireWorkspace } from '../middleware/auth'
import * as notificationService from '../services/notification'
import * as projectService from '../services/project'
import type { Variables } from '../types/context'

const userSettingsRouter = new Hono<{ Variables: Variables }>()

// Get project view preference
userSettingsRouter.get(
  '/projects/:projectId/preference',
  requireWorkspace,
  async (c) => {
    const user = getAuthUser(c.var)
    const workspaceId = getWorkspaceId(user)
    const db = c.var.db
    const projectId = c.req.param('projectId')

    // Verify project belongs to user's workspace
    await projectService.getProjectById(db, projectId, workspaceId)

    const result = await notificationService.getProjectViewPreference(
      db,
      user.id,
      projectId,
    )
    return success(c, result)
  },
)

// Set project view preference
userSettingsRouter.patch(
  '/projects/:projectId/preference',
  requireWorkspace,
  zValidator('json', viewModeSchema),
  async (c) => {
    const user = getAuthUser(c.var)
    const workspaceId = getWorkspaceId(user)
    const db = c.var.db
    const projectId = c.req.param('projectId')
    const { viewMode } = c.req.valid('json')

    // Verify project belongs to user's workspace
    await projectService.getProjectById(db, projectId, workspaceId)

    const result = await notificationService.setProjectViewPreference(
      db,
      user.id,
      projectId,
      viewMode,
    )
    return success(c, result)
  },
)

export default userSettingsRouter
