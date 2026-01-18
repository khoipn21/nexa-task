import { db } from '@nexa/db'
import { invitations, users, workspaces } from '@nexa/db/schema'
import { eq, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { subDays } from 'date-fns' // For handling expiration dates
import { z } from 'zod'

// Define a Zod schema for invitation details that would be returned by the service
export const invitationSchema = z.object({
  id: z.string().uuid(),
  inviterId: z.string().uuid(),
  inviteeEmail: z.string().email(),
  invitationToken: z.string(),
  status: z.enum(['pending', 'accepted', 'expired', 'cancelled']),
  sentAt: z.date(),
  expiresAt: z.date(),
  acceptedAt: z.date().nullable(),
  inviteeId: z.string().uuid().nullable(),
  workspaceId: z.string().uuid(),
})

export type Invitation = z.infer<typeof invitationSchema>

// Function to send an invitation
export async function sendInvitation(
  inviteeEmail: string,
  workspaceId: string,
  inviterId: string,
): Promise<Invitation> {
  // Check if the inviter is a member of the workspace
  // This logic might be better placed in middleware or a higher-level service
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  })

  if (!workspace) {
    throw new Error('Workspace not found.')
  }

  // Check if the invitee is already a member of the workspace
  // This would require checking workspaceMemberships, which is not directly available here
  // Assuming a separate check or unique constraint for now.

  // Generate a unique invitation token
  const invitationToken = nanoid(32) // Using nanoid for generating a URL-friendly unique token

  // Set invitation expiration (e.g., 7 days from now)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  // Save the invitation to the database
  const [newInvitation] = await db
    .insert(invitations)
    .values({
      inviteeEmail,
      workspaceId,
      inviterId,
      invitationToken,
      expiresAt,
      status: 'pending',
    })
    .returning()

  if (!newInvitation) {
    throw new Error('Failed to create invitation.')
  }

  return invitationSchema.parse(newInvitation)
}

// Function to accept an invitation
export async function acceptInvitation(
  invitationToken: string,
  inviteeUserId: string,
): Promise<Invitation> {
  const [invitation] = await db
    .update(invitations)
    .set({
      status: 'accepted',
      acceptedAt: new Date(),
      inviteeId: inviteeUserId,
    })
    .where(
      and(
        eq(invitations.invitationToken, invitationToken),
        eq(invitations.status, 'pending'), // Only accept pending invitations
        // Add a check for expiresAt > new Date() if not handled by a background job
      ),
    )
    .returning()

  if (!invitation) {
    throw new Error('Invitation not found or already accepted/expired.')
  }

  // Optionally, add the user to the workspace here
  // This would involve interacting with a workspace membership service

  return invitationSchema.parse(invitation)
}

// Function to get pending invitations for a user (as inviter) or a workspace
export async function getPendingInvitations(
  userId: string,
  workspaceId?: string,
): Promise<Invitation[]> {
  const conditions = [
    eq(invitations.status, 'pending'),
    eq(invitations.inviterId, userId),
  ]

  if (workspaceId) {
    conditions.push(eq(invitations.workspaceId, workspaceId))
  }

  const pendingInvitations = await db.query.invitations.findMany({
    where: and(...conditions),
  })

  return z.array(invitationSchema).parse(pendingInvitations)
}

// Function to cancel an invitation
export async function cancelInvitation(
  invitationId: string,
  userId: string, // User performing the cancellation (must be inviter or workspace admin)
): Promise<Invitation> {
  const [cancelledInvitation] = await db
    .update(invitations)
    .set({ status: 'cancelled' })
    .where(
      and(
        eq(invitations.id, invitationId),
        eq(invitations.inviterId, userId), // Only inviter can cancel
        eq(invitations.status, 'pending'), // Only pending invitations can be cancelled
      ),
    )
    .returning()

  if (!cancelledInvitation) {
    throw new Error(
      'Invitation not found, not pending, or you do not have permission to cancel.',
    )
  }

  return invitationSchema.parse(cancelledInvitation)
}

// Function to expire old invitations (could be run by a cron job)
export async function expireOldInvitations(): Promise<void> {
  const now = new Date()
  const expiredInvitations = await db
    .update(invitations)
    .set({ status: 'expired' })
    .where(and(eq(invitations.status, 'pending'), invitations.expiresAt < now))
    .returning({ id: invitations.id })

  console.log(`Expired ${expiredInvitations.length} old invitations.`)
}

// Function to get invitations by token
export async function getInvitationByToken(
  token: string,
): Promise<Invitation | undefined> {
  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.invitationToken, token),
  })
  return invitation ? invitationSchema.parse(invitation) : undefined
}

// Function to get invitations by ID
export async function getInvitationById(
  id: string,
): Promise<Invitation | undefined> {
  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.id, id),
  })
  return invitation ? invitationSchema.parse(invitation) : undefined
}