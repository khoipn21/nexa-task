import { createClerkClient } from '@clerk/clerk-sdk-node'
import type { Database } from '@repo/db'
import { invitations } from '@repo/db/schema'
import { and, eq, inArray, lt } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { ConflictError, ForbiddenError, NotFoundError } from '../lib/errors'

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
})

// Zod schema for invitation details
export const invitationSchema = z.object({
  id: z.string().uuid(),
  inviterId: z.string().uuid(),
  inviteeEmail: z.string().email(),
  invitationToken: z.string(),
  status: z.enum(['pending', 'accepted', 'expired', 'cancelled']),
  role: z.enum(['super_admin', 'pm', 'member', 'guest']),
  clerkInvitationId: z.string().nullable(),
  sentAt: z.date().nullable(),
  expiresAt: z.date(),
  acceptedAt: z.date().nullable(),
  inviteeId: z.string().uuid().nullable(),
  workspaceId: z.string().uuid(),
})

export type Invitation = z.infer<typeof invitationSchema>
export type WorkspaceRole = 'super_admin' | 'pm' | 'member' | 'guest'

// Map app roles to Clerk org roles
const roleToClerkRole = (role: string): 'org:admin' | 'org:member' => {
  return role === 'super_admin' ? 'org:admin' : 'org:member'
}

// Get invitation by token
export async function getInvitationByToken(
  db: Database,
  token: string,
): Promise<Invitation | undefined> {
  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.invitationToken, token),
  })
  return invitation ? invitationSchema.parse(invitation) : undefined
}

// Get invitation by ID
export async function getInvitationById(
  db: Database,
  id: string,
): Promise<Invitation | undefined> {
  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.id, id),
  })
  return invitation ? invitationSchema.parse(invitation) : undefined
}

// Create invitation with Clerk org integration
export async function createWorkspaceInvitation(
  db: Database,
  input: {
    workspaceId: string
    email: string
    role: WorkspaceRole
    inviterId: string
    clerkOrgId: string
    inviterClerkId: string
  },
): Promise<Invitation> {
  const normalizedEmail = input.email.toLowerCase().trim()

  // Check for existing pending invite
  const existing = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.workspaceId, input.workspaceId),
      eq(invitations.inviteeEmail, normalizedEmail),
      eq(invitations.status, 'pending'),
    ),
  })

  if (existing) {
    throw new ConflictError('Invitation already pending for this email')
  }

  // Delete any cancelled/expired invitations for this email to allow re-inviting
  await db
    .delete(invitations)
    .where(
      and(
        eq(invitations.workspaceId, input.workspaceId),
        eq(invitations.inviteeEmail, normalizedEmail),
        inArray(invitations.status, ['cancelled', 'expired']),
      ),
    )

  // Create Clerk org invitation
  const redirectUrl = `${process.env.FRONTEND_URL}/accept-invite`

  const clerkInvitation =
    await clerkClient.organizations.createOrganizationInvitation({
      organizationId: input.clerkOrgId,
      inviterUserId: input.inviterClerkId,
      emailAddress: normalizedEmail,
      role: roleToClerkRole(input.role),
      redirectUrl,
    })

  // Store in local DB
  const token = nanoid(32)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const [invitation] = await db
    .insert(invitations)
    .values({
      workspaceId: input.workspaceId,
      inviterId: input.inviterId,
      inviteeEmail: normalizedEmail,
      invitationToken: token,
      role: input.role,
      clerkInvitationId: clerkInvitation.id,
      expiresAt,
      status: 'pending',
    })
    .returning()

  if (!invitation) {
    throw new Error('Failed to create invitation')
  }

  return invitationSchema.parse(invitation)
}

// Get all pending invitations for a workspace
export async function getWorkspaceInvitations(
  db: Database,
  workspaceId: string,
): Promise<Invitation[]> {
  const results = await db.query.invitations.findMany({
    where: and(
      eq(invitations.workspaceId, workspaceId),
      eq(invitations.status, 'pending'),
    ),
    with: { inviter: true },
    orderBy: (inv, { desc }) => [desc(inv.sentAt)],
  })
  return z.array(invitationSchema).parse(results)
}

// Revoke an invitation
export async function revokeInvitation(
  db: Database,
  invitationId: string,
  clerkOrgId: string,
): Promise<Invitation> {
  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.id, invitationId),
  })

  if (!invitation) {
    throw new NotFoundError('Invitation', invitationId)
  }

  // Revoke in Clerk if has clerkInvitationId
  if (invitation.clerkInvitationId) {
    try {
      await clerkClient.organizations.revokeOrganizationInvitation({
        organizationId: clerkOrgId,
        invitationId: invitation.clerkInvitationId,
      })
    } catch (e) {
      // Log but continue (invitation may already be revoked/accepted)
      console.error('Failed to revoke Clerk invitation:', e)
    }
  }

  // Update local DB
  const [updated] = await db
    .update(invitations)
    .set({ status: 'cancelled' })
    .where(eq(invitations.id, invitationId))
    .returning()

  if (!updated) {
    throw new Error('Failed to update invitation status')
  }

  return invitationSchema.parse(updated)
}

// Resend an invitation
export async function resendInvitation(
  db: Database,
  invitationId: string,
  clerkOrgId: string,
  inviterClerkId: string,
): Promise<Invitation> {
  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.id, invitationId),
  })

  if (!invitation) {
    throw new NotFoundError('Invitation', invitationId)
  }

  if (invitation.status !== 'pending') {
    throw new ConflictError('Can only resend pending invitations')
  }

  // Revoke old Clerk invitation if exists
  if (invitation.clerkInvitationId) {
    try {
      await clerkClient.organizations.revokeOrganizationInvitation({
        organizationId: clerkOrgId,
        invitationId: invitation.clerkInvitationId,
      })
    } catch (e) {
      console.error('Failed to revoke old Clerk invitation:', e)
    }
  }

  // Create new Clerk invitation
  const redirectUrl = `${process.env.FRONTEND_URL}/accept-invite`
  const clerkInvitation =
    await clerkClient.organizations.createOrganizationInvitation({
      organizationId: clerkOrgId,
      inviterUserId: inviterClerkId,
      emailAddress: invitation.inviteeEmail,
      role: roleToClerkRole(invitation.role),
      redirectUrl,
    })

  // Update local DB with new token and expiration
  const newToken = nanoid(32)
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const [updated] = await db
    .update(invitations)
    .set({
      invitationToken: newToken,
      clerkInvitationId: clerkInvitation.id,
      expiresAt: newExpiresAt,
      sentAt: new Date(),
    })
    .where(eq(invitations.id, invitationId))
    .returning()

  if (!updated) {
    throw new Error('Failed to update invitation')
  }

  return invitationSchema.parse(updated)
}

// Bulk create invitations
export async function createBulkInvitations(
  db: Database,
  input: {
    workspaceId: string
    emails: string[]
    role: WorkspaceRole
    inviterId: string
    clerkOrgId: string
    inviterClerkId: string
  },
): Promise<{ created: Invitation[]; skipped: string[] }> {
  const created: Invitation[] = []
  const skipped: string[] = []

  for (const email of input.emails) {
    try {
      const invitation = await createWorkspaceInvitation(db, {
        workspaceId: input.workspaceId,
        email,
        role: input.role,
        inviterId: input.inviterId,
        clerkOrgId: input.clerkOrgId,
        inviterClerkId: input.inviterClerkId,
      })
      created.push(invitation)
    } catch (e) {
      if (e instanceof ConflictError) {
        skipped.push(email)
      } else {
        throw e
      }
    }
  }

  return { created, skipped }
}

// Accept an invitation
export async function acceptInvitation(
  db: Database,
  invitationToken: string,
  inviteeUserId: string,
  inviteeEmail: string,
): Promise<Invitation> {
  // First, fetch the invitation to validate
  const invitation = await getInvitationByToken(db, invitationToken)

  if (!invitation) {
    throw new NotFoundError('Invitation', invitationToken)
  }

  // Verify the invitation is for this user
  if (invitation.inviteeEmail !== inviteeEmail.toLowerCase().trim()) {
    throw new ForbiddenError('Invitation not addressed to this email')
  }

  if (invitation.status !== 'pending') {
    throw new ConflictError('Invitation already used or cancelled')
  }

  // Check expiration
  if (new Date() > new Date(invitation.expiresAt)) {
    // Mark as expired
    await db
      .update(invitations)
      .set({ status: 'expired' })
      .where(eq(invitations.id, invitation.id))
    throw new ConflictError('Invitation has expired')
  }

  // Accept the invitation
  const [updated] = await db
    .update(invitations)
    .set({
      status: 'accepted',
      acceptedAt: new Date(),
      inviteeId: inviteeUserId,
    })
    .where(eq(invitations.id, invitation.id))
    .returning()

  if (!updated) {
    throw new Error('Failed to accept invitation')
  }

  return invitationSchema.parse(updated)
}

// Get pending invitations for a user
export async function getPendingInvitations(
  db: Database,
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

// Cancel an invitation
export async function cancelInvitation(
  db: Database,
  invitationId: string,
  userId: string,
): Promise<Invitation> {
  const [cancelledInvitation] = await db
    .update(invitations)
    .set({ status: 'cancelled' })
    .where(
      and(
        eq(invitations.id, invitationId),
        eq(invitations.inviterId, userId),
        eq(invitations.status, 'pending'),
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

// Expire old invitations (for cron job)
export async function expireOldInvitations(db: Database): Promise<void> {
  const now = new Date()
  const expiredInvitations = await db
    .update(invitations)
    .set({ status: 'expired' })
    .where(
      and(eq(invitations.status, 'pending'), lt(invitations.expiresAt, now)),
    )
    .returning({ id: invitations.id })

  console.log(`Expired ${expiredInvitations.length} old invitations.`)
}
