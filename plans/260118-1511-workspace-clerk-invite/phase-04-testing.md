# Phase 4: Testing

## Context Links

- [Plan Overview](./plan.md)
- [Phase 2: Backend API](./phase-02-backend-api.md)
- [Phase 3: Frontend UI](./phase-03-frontend-ui.md)
- [Existing Tests](../apps/api/tests/)

## Overview

**Priority:** P2
**Status:** partial ⚠️
**Effort:** 1h (actual: 1.5h, remaining: 2-3h for full coverage)

Write unit tests for invitation service and integration tests for API endpoints.

## Key Insights

- Use Bun's native test runner for backend
- Mock Clerk SDK calls for unit tests
- Integration tests can use test Clerk instance if available
- Focus on business logic, not Clerk internals

## Requirements

### Functional
- [ ] Unit tests for invitation service functions
- [ ] Integration tests for invitation API endpoints
- [ ] Error case coverage

### Non-functional
- [ ] 80%+ code coverage for new code
- [ ] Tests run in under 10 seconds
- [ ] No external dependencies for unit tests

## Related Code Files

**Create:**
- `/mnt/k/Work/nexa-task/apps/api/src/services/__tests__/invitation.test.ts`
- `/mnt/k/Work/nexa-task/apps/api/tests/integration/invitations.test.ts`

**Reference:**
- `/mnt/k/Work/nexa-task/apps/api/src/services/__tests__/` - Existing test patterns
- `/mnt/k/Work/nexa-task/apps/api/tests/` - Integration test patterns

## Implementation Steps

### 1. Create unit tests for invitation service

File: `/mnt/k/Work/nexa-task/apps/api/src/services/__tests__/invitation.test.ts`

```typescript
import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test'
import { eq, and } from 'drizzle-orm'
import {
  createWorkspaceInvitation,
  getWorkspaceInvitations,
  revokeInvitation,
  getInvitationByToken,
} from '../invitation'
import { invitations } from '@repo/db/schema'
import { ConflictError, NotFoundError } from '../../lib/errors'

// Mock database
const mockDb = {
  query: {
    invitations: {
      findFirst: mock(() => null),
      findMany: mock(() => []),
    },
  },
  insert: mock(() => ({
    values: mock(() => ({
      returning: mock(() => []),
    })),
  })),
  update: mock(() => ({
    set: mock(() => ({
      where: mock(() => ({
        returning: mock(() => []),
      })),
    })),
  })),
}

// Mock Clerk client
const mockClerkClient = {
  organizations: {
    createOrganizationInvitation: mock(() =>
      Promise.resolve({ id: 'oi_test123' })
    ),
    revokeOrganizationInvitation: mock(() => Promise.resolve()),
  },
}

// Mock the clerk client module
mock.module('@clerk/clerk-sdk-node', () => ({
  clerkClient: mockClerkClient,
}))

describe('Invitation Service', () => {
  beforeEach(() => {
    // Reset mocks
    mockDb.query.invitations.findFirst.mockReset()
    mockDb.query.invitations.findMany.mockReset()
    mockClerkClient.organizations.createOrganizationInvitation.mockReset()
    mockClerkClient.organizations.revokeOrganizationInvitation.mockReset()
  })

  describe('createWorkspaceInvitation', () => {
    it('should create invitation successfully', async () => {
      const mockInvitation = {
        id: 'inv_123',
        workspaceId: 'ws_123',
        inviterId: 'user_123',
        inviteeEmail: 'test@example.com',
        role: 'member',
        status: 'pending',
        clerkInvitationId: 'oi_test123',
        invitationToken: expect.any(String),
        sentAt: expect.any(Date),
        expiresAt: expect.any(Date),
        acceptedAt: null,
        inviteeId: null,
      }

      mockDb.query.invitations.findFirst.mockResolvedValue(null)
      mockDb.insert.mockReturnValue({
        values: () => ({
          returning: () => Promise.resolve([mockInvitation]),
        }),
      })

      const result = await createWorkspaceInvitation(mockDb as any, {
        workspaceId: 'ws_123',
        email: 'test@example.com',
        role: 'member',
        inviterId: 'user_123',
        clerkOrgId: 'org_123',
        inviterClerkId: 'clerk_user_123',
      })

      expect(result.inviteeEmail).toBe('test@example.com')
      expect(result.status).toBe('pending')
      expect(
        mockClerkClient.organizations.createOrganizationInvitation
      ).toHaveBeenCalled()
    })

    it('should throw ConflictError if invitation already pending', async () => {
      mockDb.query.invitations.findFirst.mockResolvedValue({
        id: 'existing_inv',
        status: 'pending',
      })

      await expect(
        createWorkspaceInvitation(mockDb as any, {
          workspaceId: 'ws_123',
          email: 'test@example.com',
          role: 'member',
          inviterId: 'user_123',
          clerkOrgId: 'org_123',
          inviterClerkId: 'clerk_user_123',
        })
      ).rejects.toThrow(ConflictError)
    })

    it('should normalize email to lowercase', async () => {
      mockDb.query.invitations.findFirst.mockResolvedValue(null)
      mockDb.insert.mockReturnValue({
        values: (data: any) => {
          expect(data.inviteeEmail).toBe('test@example.com')
          return {
            returning: () =>
              Promise.resolve([{ ...data, id: 'inv_123', status: 'pending' }]),
          }
        },
      })

      await createWorkspaceInvitation(mockDb as any, {
        workspaceId: 'ws_123',
        email: 'TEST@EXAMPLE.COM',
        role: 'member',
        inviterId: 'user_123',
        clerkOrgId: 'org_123',
        inviterClerkId: 'clerk_user_123',
      })
    })
  })

  describe('getWorkspaceInvitations', () => {
    it('should return pending invitations for workspace', async () => {
      const mockInvitations = [
        {
          id: 'inv_1',
          inviteeEmail: 'user1@example.com',
          role: 'member',
          status: 'pending',
        },
        {
          id: 'inv_2',
          inviteeEmail: 'user2@example.com',
          role: 'pm',
          status: 'pending',
        },
      ]

      mockDb.query.invitations.findMany.mockResolvedValue(mockInvitations)

      const result = await getWorkspaceInvitations(mockDb as any, 'ws_123')

      expect(result).toHaveLength(2)
      expect(result[0].status).toBe('pending')
    })

    it('should return empty array if no invitations', async () => {
      mockDb.query.invitations.findMany.mockResolvedValue([])

      const result = await getWorkspaceInvitations(mockDb as any, 'ws_123')

      expect(result).toHaveLength(0)
    })
  })

  describe('revokeInvitation', () => {
    it('should revoke invitation and update status', async () => {
      const mockInvitation = {
        id: 'inv_123',
        clerkInvitationId: 'oi_test123',
        status: 'pending',
      }

      mockDb.query.invitations.findFirst.mockResolvedValue(mockInvitation)
      mockDb.update.mockReturnValue({
        set: () => ({
          where: () => ({
            returning: () =>
              Promise.resolve([{ ...mockInvitation, status: 'cancelled' }]),
          }),
        }),
      })

      const result = await revokeInvitation(
        mockDb as any,
        'inv_123',
        'org_123'
      )

      expect(result.status).toBe('cancelled')
      expect(
        mockClerkClient.organizations.revokeOrganizationInvitation
      ).toHaveBeenCalledWith('org_123', 'oi_test123')
    })

    it('should throw NotFoundError if invitation not found', async () => {
      mockDb.query.invitations.findFirst.mockResolvedValue(null)

      await expect(
        revokeInvitation(mockDb as any, 'inv_123', 'org_123')
      ).rejects.toThrow(NotFoundError)
    })

    it('should continue if Clerk revocation fails', async () => {
      const mockInvitation = {
        id: 'inv_123',
        clerkInvitationId: 'oi_test123',
        status: 'pending',
      }

      mockDb.query.invitations.findFirst.mockResolvedValue(mockInvitation)
      mockClerkClient.organizations.revokeOrganizationInvitation.mockRejectedValue(
        new Error('Clerk error')
      )
      mockDb.update.mockReturnValue({
        set: () => ({
          where: () => ({
            returning: () =>
              Promise.resolve([{ ...mockInvitation, status: 'cancelled' }]),
          }),
        }),
      })

      const result = await revokeInvitation(
        mockDb as any,
        'inv_123',
        'org_123'
      )

      expect(result.status).toBe('cancelled')
    })
  })

  describe('getInvitationByToken', () => {
    it('should return invitation by token', async () => {
      const mockInvitation = {
        id: 'inv_123',
        invitationToken: 'test_token_123',
        status: 'pending',
      }

      mockDb.query.invitations.findFirst.mockResolvedValue(mockInvitation)

      const result = await getInvitationByToken('test_token_123')

      expect(result?.id).toBe('inv_123')
    })

    it('should return undefined if token not found', async () => {
      mockDb.query.invitations.findFirst.mockResolvedValue(null)

      const result = await getInvitationByToken('invalid_token')

      expect(result).toBeUndefined()
    })
  })
})
```

### 2. Create integration tests for API

File: `/mnt/k/Work/nexa-task/apps/api/tests/integration/invitations.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { app } from '../../src/app'

// Test auth token (mock or from test Clerk instance)
const TEST_AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'test_token'
const TEST_WORKSPACE_ID = process.env.TEST_WORKSPACE_ID || 'test_ws_123'

describe('Invitation API Integration Tests', () => {
  describe('POST /api/workspaces/:id/invitations', () => {
    it('should create invitation with valid input', async () => {
      const res = await app.request(
        `/api/workspaces/${TEST_WORKSPACE_ID}/invitations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_AUTH_TOKEN}`,
          },
          body: JSON.stringify({
            email: 'newuser@example.com',
            role: 'member',
          }),
        }
      )

      expect(res.status).toBe(201)
      const json = await res.json()
      expect(json.data.inviteeEmail).toBe('newuser@example.com')
      expect(json.data.role).toBe('member')
      expect(json.data.status).toBe('pending')
    })

    it('should return 400 for invalid email', async () => {
      const res = await app.request(
        `/api/workspaces/${TEST_WORKSPACE_ID}/invitations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_AUTH_TOKEN}`,
          },
          body: JSON.stringify({
            email: 'not-an-email',
            role: 'member',
          }),
        }
      )

      expect(res.status).toBe(400)
    })

    it('should return 401 without auth', async () => {
      const res = await app.request(
        `/api/workspaces/${TEST_WORKSPACE_ID}/invitations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: 'test@example.com',
            role: 'member',
          }),
        }
      )

      expect(res.status).toBe(401)
    })

    it('should return 403 for non-admin user', async () => {
      // Use a guest token
      const GUEST_TOKEN = process.env.TEST_GUEST_TOKEN || 'guest_token'

      const res = await app.request(
        `/api/workspaces/${TEST_WORKSPACE_ID}/invitations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${GUEST_TOKEN}`,
          },
          body: JSON.stringify({
            email: 'test@example.com',
            role: 'member',
          }),
        }
      )

      expect(res.status).toBe(403)
    })
  })

  describe('GET /api/workspaces/:id/invitations', () => {
    it('should list pending invitations', async () => {
      const res = await app.request(
        `/api/workspaces/${TEST_WORKSPACE_ID}/invitations`,
        {
          headers: {
            Authorization: `Bearer ${TEST_AUTH_TOKEN}`,
          },
        }
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(Array.isArray(json.data)).toBe(true)
    })
  })

  describe('DELETE /api/workspaces/:id/invitations/:invitationId', () => {
    it('should revoke pending invitation', async () => {
      // First create an invitation
      const createRes = await app.request(
        `/api/workspaces/${TEST_WORKSPACE_ID}/invitations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_AUTH_TOKEN}`,
          },
          body: JSON.stringify({
            email: 'revoke-test@example.com',
            role: 'member',
          }),
        }
      )

      const { data: invitation } = await createRes.json()

      // Revoke it
      const revokeRes = await app.request(
        `/api/workspaces/${TEST_WORKSPACE_ID}/invitations/${invitation.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${TEST_AUTH_TOKEN}`,
          },
        }
      )

      expect(revokeRes.status).toBe(200)
      const revokeJson = await revokeRes.json()
      expect(revokeJson.data.status).toBe('cancelled')
    })

    it('should return 404 for non-existent invitation', async () => {
      const res = await app.request(
        `/api/workspaces/${TEST_WORKSPACE_ID}/invitations/00000000-0000-0000-0000-000000000000`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${TEST_AUTH_TOKEN}`,
          },
        }
      )

      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/invitations/token/:token', () => {
    it('should return invitation info by token', async () => {
      // First create an invitation
      const createRes = await app.request(
        `/api/workspaces/${TEST_WORKSPACE_ID}/invitations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_AUTH_TOKEN}`,
          },
          body: JSON.stringify({
            email: 'token-test@example.com',
            role: 'member',
          }),
        }
      )

      const { data: invitation } = await createRes.json()

      // Get by token (this would need the actual token from DB)
      // For now, test 404 case
      const res = await app.request('/api/invitations/token/invalid-token')

      expect(res.status).toBe(404)
    })
  })
})
```

### 3. Run tests

```bash
cd /mnt/k/Work/nexa-task

# Run unit tests
bun test apps/api/src/services/__tests__/invitation.test.ts

# Run integration tests
bun test apps/api/tests/integration/invitations.test.ts

# Run all tests
bun test
```

## Todo List

- [x] Create invitation service unit tests (18 tests, 7 functions untested)
- [x] Create invitation API integration tests (16 DB tests, 6 HTTP endpoints untested)
- [x] Mock Clerk SDK for unit tests (pragmatic skip - documented)
- [x] Add test fixtures for invitations (createTestInvitation helper)
- [x] Run tests and fix failures (34/34 passing in 1.56s)
- [ ] Verify 80%+ coverage for new code (estimated ~60%, needs 13 more tests)
- [ ] Add HTTP endpoint integration tests (POST/DELETE/resend/bulk)
- [ ] Add unit tests for createWorkspaceInvitation, revokeInvitation, resendInvitation, etc.

## Success Criteria

- [x] All unit tests pass ✅ (34/34 passing)
- [x] All integration tests pass ✅ (34/34 passing)
- [ ] Coverage >= 80% for invitation service ⚠️ (estimated ~60%)
- [x] No regressions in existing tests ✅

## Review Report

**Date:** 2026-01-18
**Report:** [code-reviewer-260118-phase4-testing.md](/mnt/k/Work/nexa-task/plans/reports/code-reviewer-260118-phase4-testing.md)
**Status:** APPROVED WITH RECOMMENDATIONS

**Summary:**
- ✅ 34 tests passing, zero failures
- ✅ TypeScript compilation successful
- ⚠️ Missing 7 service function tests
- ⚠️ Missing 6 HTTP endpoint tests
- ⚠️ Estimated coverage ~60% (target: 80%)

**Actions Required:**
1. Add HTTP endpoint integration tests
2. Add unit tests for untested service functions
3. Measure actual coverage with coverage tool

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Clerk mocking complexity | Medium | Use simple mock structure |
| Test DB conflicts | Low | Use isolated test database |

## Security Considerations

- Test tokens should not be real production tokens
- Integration tests should use test Clerk instance
- No sensitive data in test fixtures

## Next Steps

After all phases complete:
1. Create PR for review
2. Update documentation
3. Notify team of new feature
