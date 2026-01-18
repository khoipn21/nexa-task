import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { invitations } from '@repo/db/schema'
import { subDays } from 'date-fns'
import { and, eq } from 'drizzle-orm'
import '../setup'
import {
  createTestInvitation,
  createTestUser,
  createTestWorkspace,
} from '../helpers'
import { testDb } from '../setup'

// Mock Clerk client for integration tests
const mockClerkClient = {
  organizations: {
    createOrganizationInvitation: mock(() =>
      Promise.resolve({ id: `oi_mock_${Date.now()}` }),
    ),
    revokeOrganizationInvitation: mock(() => Promise.resolve()),
  },
}

mock.module('@clerk/clerk-sdk-node', () => ({
  createClerkClient: () => mockClerkClient,
}))

// Note: These integration tests focus on the service layer directly
// Full API integration tests would require mocking Clerk auth middleware
// which is complex for true end-to-end testing

describe('Invitation Integration Tests', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>

  beforeEach(async () => {
    // Reset mocks
    mockClerkClient.organizations.createOrganizationInvitation.mockReset()
    mockClerkClient.organizations.revokeOrganizationInvitation.mockReset()
    mockClerkClient.organizations.createOrganizationInvitation.mockImplementation(
      () => Promise.resolve({ id: `oi_mock_${Date.now()}` }),
    )
    mockClerkClient.organizations.revokeOrganizationInvitation.mockImplementation(
      () => Promise.resolve(),
    )

    // Create test data
    user = await createTestUser()
    workspace = await createTestWorkspace(user.id)
  })

  describe('Invitation CRUD Operations', () => {
    it('should create and retrieve invitation by ID', async () => {
      const invitation = await createTestInvitation(workspace.id, user.id, {
        inviteeEmail: 'test@example.com',
        role: 'member',
      })

      // Verify in database
      const dbInvitation = await testDb.query.invitations.findFirst({
        where: eq(invitations.id, invitation.id),
      })

      expect(dbInvitation).toBeDefined()
      expect(dbInvitation?.inviteeEmail).toBe('test@example.com')
      expect(dbInvitation?.status).toBe('pending')
      expect(dbInvitation?.role).toBe('member')
    })

    it('should create and retrieve invitation by token', async () => {
      const invitation = await createTestInvitation(workspace.id, user.id)

      const dbInvitation = await testDb.query.invitations.findFirst({
        where: eq(invitations.invitationToken, invitation.invitationToken),
      })

      expect(dbInvitation).toBeDefined()
      expect(dbInvitation?.id).toBe(invitation.id)
    })

    it('should list pending invitations for workspace', async () => {
      // Create multiple invitations
      await createTestInvitation(workspace.id, user.id, {
        inviteeEmail: 'user1@example.com',
      })
      await createTestInvitation(workspace.id, user.id, {
        inviteeEmail: 'user2@example.com',
      })
      await createTestInvitation(workspace.id, user.id, {
        inviteeEmail: 'cancelled@example.com',
        status: 'cancelled',
      })

      const pendingInvitations = await testDb.query.invitations.findMany({
        where: and(
          eq(invitations.workspaceId, workspace.id),
          eq(invitations.status, 'pending'),
        ),
      })

      expect(pendingInvitations).toHaveLength(2)
    })

    it('should update invitation status to cancelled', async () => {
      const invitation = await createTestInvitation(workspace.id, user.id)

      await testDb
        .update(invitations)
        .set({ status: 'cancelled' })
        .where(eq(invitations.id, invitation.id))

      const dbInvitation = await testDb.query.invitations.findFirst({
        where: eq(invitations.id, invitation.id),
      })

      expect(dbInvitation?.status).toBe('cancelled')
    })

    it('should update invitation status to accepted with inviteeId', async () => {
      const invitee = await createTestUser({
        email: `invitee-${Date.now()}@example.com`,
      })
      const invitation = await createTestInvitation(workspace.id, user.id, {
        inviteeEmail: invitee.email,
      })

      await testDb
        .update(invitations)
        .set({
          status: 'accepted',
          inviteeId: invitee.id,
          acceptedAt: new Date(),
        })
        .where(eq(invitations.id, invitation.id))

      const dbInvitation = await testDb.query.invitations.findFirst({
        where: eq(invitations.id, invitation.id),
      })

      expect(dbInvitation?.status).toBe('accepted')
      expect(dbInvitation?.inviteeId).toBe(invitee.id)
      expect(dbInvitation?.acceptedAt).toBeDefined()
    })
  })

  describe('Invitation Expiration', () => {
    it('should create invitation with 7-day expiry', async () => {
      const invitation = await createTestInvitation(workspace.id, user.id)

      const expiresAt = new Date(invitation.expiresAt)
      const now = new Date()
      const daysDiff = Math.round(
        (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      )

      expect(daysDiff).toBeCloseTo(7, 0)
    })

    it('should identify expired invitations', async () => {
      // Create expired invitation
      const expiredDate = subDays(new Date(), 1)
      const invitation = await createTestInvitation(workspace.id, user.id, {
        expiresAt: expiredDate,
      })

      const dbInvitation = await testDb.query.invitations.findFirst({
        where: eq(invitations.id, invitation.id),
      })

      expect(dbInvitation?.expiresAt).toBeDefined()
      expect(new Date(dbInvitation?.expiresAt as string) < new Date()).toBe(
        true,
      )
    })
  })

  describe('Invitation Role Assignments', () => {
    it('should create invitation with super_admin role', async () => {
      const invitation = await createTestInvitation(workspace.id, user.id, {
        role: 'super_admin',
      })

      expect(invitation.role).toBe('super_admin')
    })

    it('should create invitation with pm role', async () => {
      const invitation = await createTestInvitation(workspace.id, user.id, {
        role: 'pm',
      })

      expect(invitation.role).toBe('pm')
    })

    it('should create invitation with guest role', async () => {
      const invitation = await createTestInvitation(workspace.id, user.id, {
        role: 'guest',
      })

      expect(invitation.role).toBe('guest')
    })
  })

  describe('Invitation Constraints', () => {
    it('should enforce unique token constraint', async () => {
      const invitation1 = await createTestInvitation(workspace.id, user.id)

      // Attempting to insert with same token should fail
      let error: Error | null = null
      try {
        await testDb.insert(invitations).values({
          workspaceId: workspace.id,
          inviterId: user.id,
          inviteeEmail: 'another@example.com',
          invitationToken: invitation1.invitationToken, // Same token
          role: 'member',
          status: 'pending',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })
      } catch (e) {
        error = e as Error
      }
      expect(error).not.toBeNull()
      expect(error?.message).toContain('unique')
    })

    it('should enforce unique email per workspace constraint', async () => {
      await createTestInvitation(workspace.id, user.id, {
        inviteeEmail: 'unique@example.com',
      })

      // Attempting to insert same email for same workspace should fail
      let error: Error | null = null
      try {
        await testDb.insert(invitations).values({
          workspaceId: workspace.id,
          inviterId: user.id,
          inviteeEmail: 'unique@example.com',
          invitationToken: `new_token_${Date.now()}`,
          role: 'member',
          status: 'pending',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })
      } catch (e) {
        error = e as Error
      }
      expect(error).not.toBeNull()
      expect(error?.message).toContain('unique')
    })

    it('should allow same email for different workspaces', async () => {
      const user2 = await createTestUser({
        email: `user2-${Date.now()}@example.com`,
      })
      const workspace2 = await createTestWorkspace(user2.id)

      await createTestInvitation(workspace.id, user.id, {
        inviteeEmail: 'shared@example.com',
      })

      const invitation2 = await createTestInvitation(workspace2.id, user2.id, {
        inviteeEmail: 'shared@example.com',
      })

      expect(invitation2.inviteeEmail).toBe('shared@example.com')
    })
  })

  describe('Invitation Relations', () => {
    it('should cascade delete when workspace is deleted', async () => {
      const invitation = await createTestInvitation(workspace.id, user.id)

      // Delete workspace (should cascade to invitation)
      const { workspaces } = await import('@repo/db/schema')
      await testDb.delete(workspaces).where(eq(workspaces.id, workspace.id))

      const dbInvitation = await testDb.query.invitations.findFirst({
        where: eq(invitations.id, invitation.id),
      })

      expect(dbInvitation).toBeUndefined()
    })

    it('should cascade delete when inviter is deleted', async () => {
      // Create a separate user for this test to avoid workspace owner constraint
      const inviter = await createTestUser({
        email: `inviter-${Date.now()}@example.com`,
      })
      const invitation = await createTestInvitation(workspace.id, inviter.id)

      // Delete the inviter user (not the workspace owner)
      const { users } = await import('@repo/db/schema')
      await testDb.delete(users).where(eq(users.id, inviter.id))

      const dbInvitation = await testDb.query.invitations.findFirst({
        where: eq(invitations.id, invitation.id),
      })

      expect(dbInvitation).toBeUndefined()
    })
  })
})
