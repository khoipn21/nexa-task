import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { ForbiddenError, getAuthUser } from '../lib/errors'
import { success } from '../lib/response'
import { requireAuth } from '../middleware/auth'
import {
  acceptInvitation,
  cancelInvitation,
  getInvitationByToken,
  getPendingInvitations,
} from '../services/invitation'
import type { Variables } from '../types/context'

const invitationRoutes = new Hono<{ Variables: Variables }>()

// Schema for accepting an invitation
const acceptInvitationSchema = z.object({
  token: z.string(),
})

invitationRoutes.post(
  '/accept',
  requireAuth,
  zValidator('json', acceptInvitationSchema),
  async (c) => {
    const db = c.var.db
    const user = getAuthUser(c.var)
    const { token } = c.req.valid('json')
    // Pass user email for authorization verification
    const invitation = await acceptInvitation(db, token, user.id, user.email)
    return success(c, invitation)
  },
)

// Schema for getting pending invitations
const getPendingInvitationsSchema = z.object({
  workspaceId: z.string().optional(),
})

invitationRoutes.get(
  '/pending',
  requireAuth,
  zValidator('query', getPendingInvitationsSchema),
  async (c) => {
    const db = c.var.db
    const user = getAuthUser(c.var)
    const { workspaceId } = c.req.valid('query')
    const invitations = await getPendingInvitations(db, user.id, workspaceId)
    return success(c, { invitations })
  },
)

// Schema for cancelling an invitation
const cancelInvitationSchema = z.object({
  invitationId: z.string().uuid(),
})

invitationRoutes.delete(
  '/:invitationId',
  requireAuth,
  zValidator('param', cancelInvitationSchema),
  async (c) => {
    const db = c.var.db
    const user = getAuthUser(c.var)
    const { invitationId } = c.req.valid('param')
    const invitation = await cancelInvitation(db, invitationId, user.id)
    return success(c, invitation)
  },
)

// Get invitation by token (requires auth, user must match invitee email)
invitationRoutes.get('/token/:token', requireAuth, async (c) => {
  const db = c.var.db
  const user = getAuthUser(c.var)
  const token = c.req.param('token')
  const invitation = await getInvitationByToken(db, token)

  if (!invitation) {
    return c.json({ error: 'Invitation not found' }, 404)
  }

  // Only allow viewing own invitation
  if (invitation.inviteeEmail !== user.email.toLowerCase()) {
    throw new ForbiddenError('Cannot view invitations for other users')
  }

  // Return minimal info (no sensitive data)
  return success(c, {
    id: invitation.id,
    inviteeEmail: invitation.inviteeEmail,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
  })
})

export default invitationRoutes
