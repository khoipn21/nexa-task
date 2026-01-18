/**
 * Invitation Service Unit Tests
 *
 * Note: Tests that require Clerk SDK calls are skipped because mocking
 * the Clerk client at module load time is challenging with Bun's test runner.
 * These tests focus on database operations and error handling.
 *
 * For full integration testing, use a test Clerk instance with real credentials.
 */
import { beforeEach, describe, expect, it } from 'bun:test'
import '../../../tests/setup'
import {
  createTestInvitation,
  createTestUser,
  createTestWorkspace,
} from '../../../tests/helpers'
import { testDb } from '../../../tests/setup'
import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors'
import {
  acceptInvitation,
  getInvitationById,
  getInvitationByToken,
  getWorkspaceInvitations,
} from '../invitation'

describe('Invitation Service', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>

  beforeEach(async () => {
    // Create test data
    user = await createTestUser()
    workspace = await createTestWorkspace(user.id)
  })

  describe('getWorkspaceInvitations', () => {
    it('should return pending invitations for workspace', async () => {
      await createTestInvitation(workspace.id, user.id, {
        inviteeEmail: 'user1@example.com',
        role: 'member',
      })
      await createTestInvitation(workspace.id, user.id, {
        inviteeEmail: 'user2@example.com',
        role: 'pm',
      })
      // Create a cancelled invitation (should not appear)
      await createTestInvitation(workspace.id, user.id, {
        inviteeEmail: 'cancelled@example.com',
        status: 'cancelled',
      })

      const result = await getWorkspaceInvitations(testDb, workspace.id)

      expect(result).toHaveLength(2)
      expect(result.every((inv) => inv.status === 'pending')).toBe(true)
    })

    it('should return empty array if no invitations', async () => {
      const result = await getWorkspaceInvitations(testDb, workspace.id)
      expect(result).toHaveLength(0)
    })

    it('should only return invitations for specified workspace', async () => {
      // Create another workspace
      const user2 = await createTestUser({
        email: `user2-${Date.now()}@example.com`,
      })
      const workspace2 = await createTestWorkspace(user2.id)

      // Create invitations in both workspaces
      await createTestInvitation(workspace.id, user.id, {
        inviteeEmail: 'ws1@example.com',
      })
      await createTestInvitation(workspace2.id, user2.id, {
        inviteeEmail: 'ws2@example.com',
      })

      const result = await getWorkspaceInvitations(testDb, workspace.id)

      expect(result).toHaveLength(1)
      expect(result[0].inviteeEmail).toBe('ws1@example.com')
    })
  })

  describe('getInvitationByToken', () => {
    it('should return invitation by token', async () => {
      const invitation = await createTestInvitation(workspace.id, user.id)

      const result = await getInvitationByToken(
        testDb,
        invitation.invitationToken,
      )

      expect(result?.id).toBe(invitation.id)
      expect(result?.inviteeEmail).toBe(invitation.inviteeEmail)
    })

    it('should return undefined if token not found', async () => {
      const result = await getInvitationByToken(testDb, 'invalid_token')
      expect(result).toBeUndefined()
    })

    it('should return invitation regardless of status', async () => {
      const invitation = await createTestInvitation(workspace.id, user.id, {
        status: 'accepted',
      })

      const result = await getInvitationByToken(
        testDb,
        invitation.invitationToken,
      )

      expect(result?.id).toBe(invitation.id)
      expect(result?.status).toBe('accepted')
    })
  })

  describe('getInvitationById', () => {
    it('should return invitation by ID', async () => {
      const invitation = await createTestInvitation(workspace.id, user.id)

      const result = await getInvitationById(testDb, invitation.id)

      expect(result?.id).toBe(invitation.id)
      expect(result?.inviteeEmail).toBe(invitation.inviteeEmail)
    })

    it('should return undefined if ID not found', async () => {
      const result = await getInvitationById(
        testDb,
        '00000000-0000-0000-0000-000000000000',
      )
      expect(result).toBeUndefined()
    })
  })

  describe('acceptInvitation', () => {
    it('should accept invitation successfully', async () => {
      const invitee = await createTestUser({
        email: `invitee-${Date.now()}@example.com`,
      })
      const invitation = await createTestInvitation(workspace.id, user.id, {
        inviteeEmail: invitee.email,
      })

      const result = await acceptInvitation(
        testDb,
        invitation.invitationToken,
        invitee.id,
        invitee.email,
      )

      expect(result.status).toBe('accepted')
      expect(result.inviteeId).toBe(invitee.id)
      expect(result.acceptedAt).toBeDefined()
    })

    it('should throw NotFoundError if token not found', async () => {
      const invitee = await createTestUser({
        email: `invitee-${Date.now()}@example.com`,
      })

      await expect(
        acceptInvitation(testDb, 'invalid_token', invitee.id, invitee.email),
      ).rejects.toThrow(NotFoundError)
    })

    it('should throw ForbiddenError if email does not match', async () => {
      const invitee = await createTestUser({
        email: `wrong-${Date.now()}@example.com`,
      })
      const invitation = await createTestInvitation(workspace.id, user.id, {
        inviteeEmail: 'correct@example.com',
      })

      await expect(
        acceptInvitation(
          testDb,
          invitation.invitationToken,
          invitee.id,
          invitee.email,
        ),
      ).rejects.toThrow(ForbiddenError)
    })

    it('should throw ConflictError if invitation already accepted', async () => {
      const invitee = await createTestUser({
        email: `invitee-${Date.now()}@example.com`,
      })
      const invitation = await createTestInvitation(workspace.id, user.id, {
        inviteeEmail: invitee.email,
        status: 'accepted',
      })

      await expect(
        acceptInvitation(
          testDb,
          invitation.invitationToken,
          invitee.id,
          invitee.email,
        ),
      ).rejects.toThrow(ConflictError)
    })

    it('should throw ConflictError for cancelled invitation', async () => {
      const invitee = await createTestUser({
        email: `invitee-${Date.now()}@example.com`,
      })
      const invitation = await createTestInvitation(workspace.id, user.id, {
        inviteeEmail: invitee.email,
        status: 'cancelled',
      })

      await expect(
        acceptInvitation(
          testDb,
          invitation.invitationToken,
          invitee.id,
          invitee.email,
        ),
      ).rejects.toThrow(ConflictError)
    })

    it('should throw ConflictError and mark as expired if past expiry date', async () => {
      const invitee = await createTestUser({
        email: `invitee-${Date.now()}@example.com`,
      })
      const expiredDate = new Date(Date.now() - 1000) // 1 second ago
      const invitation = await createTestInvitation(workspace.id, user.id, {
        inviteeEmail: invitee.email,
        expiresAt: expiredDate,
      })

      await expect(
        acceptInvitation(
          testDb,
          invitation.invitationToken,
          invitee.id,
          invitee.email,
        ),
      ).rejects.toThrow(ConflictError)

      // Verify invitation was marked as expired
      const updated = await getInvitationById(testDb, invitation.id)
      expect(updated?.status).toBe('expired')
    })

    it('should handle case-insensitive email matching', async () => {
      const invitee = await createTestUser({
        email: `invitee-${Date.now()}@example.com`,
      })
      // Store invitation with lowercase email (same as invitee)
      const invitation = await createTestInvitation(workspace.id, user.id, {
        inviteeEmail: invitee.email.toLowerCase(),
      })

      // Accept with uppercase email should still work (service normalizes)
      const result = await acceptInvitation(
        testDb,
        invitation.invitationToken,
        invitee.id,
        invitee.email.toUpperCase(),
      )

      expect(result.status).toBe('accepted')
    })
  })

  describe('Invitation Role Handling', () => {
    it('should preserve super_admin role in invitation', async () => {
      const invitation = await createTestInvitation(workspace.id, user.id, {
        role: 'super_admin',
      })

      const result = await getInvitationById(testDb, invitation.id)
      expect(result?.role).toBe('super_admin')
    })

    it('should preserve pm role in invitation', async () => {
      const invitation = await createTestInvitation(workspace.id, user.id, {
        role: 'pm',
      })

      const result = await getInvitationById(testDb, invitation.id)
      expect(result?.role).toBe('pm')
    })

    it('should preserve guest role in invitation', async () => {
      const invitation = await createTestInvitation(workspace.id, user.id, {
        role: 'guest',
      })

      const result = await getInvitationById(testDb, invitation.id)
      expect(result?.role).toBe('guest')
    })
  })

  describe('Invitation Token Uniqueness', () => {
    it('should generate unique tokens for different invitations', async () => {
      const inv1 = await createTestInvitation(workspace.id, user.id, {
        inviteeEmail: 'user1@example.com',
      })
      const inv2 = await createTestInvitation(workspace.id, user.id, {
        inviteeEmail: 'user2@example.com',
      })

      expect(inv1.invitationToken).not.toBe(inv2.invitationToken)
    })
  })
})
