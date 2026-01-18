import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import {
  sendInvitation,
  acceptInvitation,
  getPendingInvitations,
  cancelInvitation,
} from '../services/invitation' // Assuming invitation service will be created

const invitationRoutes = new Hono()

// Schema for sending an invitation
const sendInvitationSchema = z.object({
  inviteeEmail: z.string().email(),
  workspaceId: z.string(), // Assuming invitations are tied to a workspace
})

invitationRoutes.post(
  '/',
  zValidator('json', sendInvitationSchema),
  async (c) => {
    const { inviteeEmail, workspaceId } = c.req.valid('json')
    try {
      const invitation = await sendInvitation(
        inviteeEmail,
        workspaceId,
        c.var.user.id,
      )
      return c.json(invitation, 201)
    } catch (error: any) {
      return c.json({ error: error.message }, 400)
    }
  },
)

// Schema for accepting an invitation
const acceptInvitationSchema = z.object({
  token: z.string(),
})

invitationRoutes.post(
  '/accept',
  zValidator('json', acceptInvitationSchema),
  async (c) => {
    const { token } = c.req.valid('json')
    try {
      const invitation = await acceptInvitation(token, c.var.user.id)
      return c.json(invitation, 200)
    } catch (error: any) {
      return c.json({ error: error.message }, 400)
    }
  },
)

// Schema for getting pending invitations
const getPendingInvitationsSchema = z.object({
  workspaceId: z.string().optional(),
})

invitationRoutes.get(
  '/pending',
  zValidator('query', getPendingInvitationsSchema),
  async (c) => {
    const { workspaceId } = c.req.valid('query')
    try {
      const invitations = await getPendingInvitations(
        c.var.user.id,
        workspaceId,
      )
      return c.json({ invitations }, 200)
    } catch (error: any) {
      return c.json({ error: error.message }, 400)
    }
  },
)

// Schema for cancelling an invitation
const cancelInvitationSchema = z.object({
  invitationId: z.string().uuid(),
})

invitationRoutes.delete(
  '/:invitationId',
  zValidator('param', cancelInvitationSchema),
  async (c) => {
    const { invitationId } = c.req.valid('param')
    try {
      const invitation = await cancelInvitation(invitationId, c.var.user.id)
      return c.json(invitation, 200)
    } catch (error: any) {
      return c.json({ error: error.message }, 400)
    }
  },
)

export default invitationRoutes
