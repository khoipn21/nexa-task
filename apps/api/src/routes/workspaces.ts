import { zValidator } from '@hono/zod-validator'
import {
  bulkInvitationSchema,
  createInvitationSchema,
  inviteMemberSchema,
  updateWorkspaceSchema,
} from '@repo/shared'
import { Hono } from 'hono'
import { NotFoundError, getAuthUser } from '../lib/errors'
import { created, success } from '../lib/response'
import { requireAuth, requireWorkspace } from '../middleware/auth'
import { requirePermission, requireRole } from '../middleware/rbac'
import * as invitationService from '../services/invitation'
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
  '/:id/invitations',
  requireWorkspace,
  requirePermission('workspace:invite'),
  zValidator('json', createInvitationSchema),
  async (c) => {
    const db = c.var.db
    const user = getAuthUser(c.var)
    const workspaceId = c.req.param('id')
    const { email, role } = c.req.valid('json')

    // Get workspace for clerkOrgId
    const workspace = await workspaceService.getWorkspaceById(
      db,
      workspaceId,
      user.id,
    )

    if (!workspace) {
      throw new NotFoundError('Workspace', workspaceId)
    }

    const invitation = await invitationService.createWorkspaceInvitation(db, {
      workspaceId,
      email,
      role,
      inviterId: user.id,
      clerkOrgId: workspace.clerkOrgId,
      inviterClerkId: user.clerkId,
    })

    return created(c, invitation)
  },
)

// Bulk invite members
workspaces.post(
  '/:id/invitations/bulk',
  requireWorkspace,
  requirePermission('workspace:invite'),
  zValidator('json', bulkInvitationSchema),
  async (c) => {
    const db = c.var.db
    const user = getAuthUser(c.var)
    const workspaceId = c.req.param('id')
    const { emails, role } = c.req.valid('json')

    const workspace = await workspaceService.getWorkspaceById(
      db,
      workspaceId,
      user.id,
    )

    if (!workspace) {
      throw new NotFoundError('Workspace', workspaceId)
    }

    const result = await invitationService.createBulkInvitations(db, {
      workspaceId,
      emails,
      role,
      inviterId: user.id,
      clerkOrgId: workspace.clerkOrgId,
      inviterClerkId: user.clerkId,
    })

    return created(c, result)
  },
)

// List pending invitations
workspaces.get(
  '/:id/invitations',
  requireWorkspace,
  requirePermission('workspace:invite'),
  async (c) => {
    const db = c.var.db
    const workspaceId = c.req.param('id')
    const invitations = await invitationService.getWorkspaceInvitations(
      db,
      workspaceId,
    )
    return success(c, invitations)
  },
)

// Resend invitation
workspaces.post(
  '/:id/invitations/:invitationId/resend',
  requireWorkspace,
  requirePermission('workspace:invite'),
  async (c) => {
    const db = c.var.db
    const user = getAuthUser(c.var)
    const workspaceId = c.req.param('id')
    const invitationId = c.req.param('invitationId')

    const workspace = await workspaceService.getWorkspaceById(
      db,
      workspaceId,
      user.id,
    )

    if (!workspace) {
      throw new NotFoundError('Workspace', workspaceId)
    }

    const invitation = await invitationService.resendInvitation(
      db,
      invitationId,
      workspace.clerkOrgId,
      user.clerkId,
    )

    return success(c, invitation)
  },
)

// Revoke invitation
workspaces.delete(
  '/:id/invitations/:invitationId',
  requireWorkspace,
  requirePermission('workspace:invite'),
  async (c) => {
    const db = c.var.db
    const user = getAuthUser(c.var)
    const workspaceId = c.req.param('id')
    const invitationId = c.req.param('invitationId')

    const workspace = await workspaceService.getWorkspaceById(
      db,
      workspaceId,
      user.id,
    )

    if (!workspace) {
      throw new NotFoundError('Workspace', workspaceId)
    }

    const invitation = await invitationService.revokeInvitation(
      db,
      invitationId,
      workspace.clerkOrgId,
    )

    return success(c, invitation)
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
