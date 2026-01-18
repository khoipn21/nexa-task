import { zValidator } from '@hono/zod-validator'
import { inviteMemberSchema, updateWorkspaceSchema } from '@repo/shared'
import { Hono } from 'hono'
import { getAuthUser } from '../lib/errors'
import { success } from '../lib/response'
import { requireAuth, requireWorkspace } from '../middleware/auth'
import { requirePermission, requireRole } from '../middleware/rbac'
import * as workspaceService from '../services/workspace'
import type { Variables } from '../types/context'

const workspaces = new Hono<{ Variables: Variables }>()

// List user's workspaces
workspaces.get('/', requireAuth, async (c) => {
  const user = getAuthUser(c.var)
  const db = c.var.db
  const result = await workspaceService.getWorkspacesByUserId(db, user.id)
  return success(c, result)
})

// Get workspace by ID
workspaces.get('/:id', requireAuth, async (c) => {
  const user = getAuthUser(c.var)
  const db = c.var.db
  const workspaceId = c.req.param('id')
  const result = await workspaceService.getWorkspaceById(
    db,
    workspaceId,
    user.id,
  )
  return success(c, result)
})

// Update workspace
workspaces.patch(
  '/:id',
  requireWorkspace,
  requirePermission('workspace:update'),
  zValidator('json', updateWorkspaceSchema),
  async (c) => {
    const db = c.var.db
    const workspaceId = c.req.param('id')
    const data = c.req.valid('json')
    const result = await workspaceService.updateWorkspace(db, workspaceId, data)
    return success(c, result)
  },
)

// List workspace members
workspaces.get('/:id/members', requireWorkspace, async (c) => {
  const db = c.var.db
  const workspaceId = c.req.param('id')
  const members = await workspaceService.getWorkspaceMembers(db, workspaceId)
  return success(c, members)
})

// Invite member (via Clerk, then add to local DB)
workspaces.post(
  '/:id/members',
  requireWorkspace,
  requirePermission('workspace:invite'),
  zValidator('json', inviteMemberSchema),
  async (c) => {
    // Note: Actual invite happens via Clerk Organizations
    // This endpoint handles post-invite local DB sync
    const { email, role } = c.req.valid('json')

    // TODO: Look up user by email, add to workspace
    // For now, return success message
    return success(c, { message: 'Invitation sent', email, role })
  },
)

// Remove member
workspaces.delete(
  '/:id/members/:userId',
  requireWorkspace,
  requireRole('super_admin', 'pm'),
  async (c) => {
    const db = c.var.db
    const workspaceId = c.req.param('id')
    const userId = c.req.param('userId')
    await workspaceService.removeWorkspaceMember(db, workspaceId, userId)
    return success(c, { message: 'Member removed' })
  },
)

export default workspaces
