# Phase 2: Backend API Implementation

## Context Links

- [Plan Overview](./plan.md)
- [Phase 1: Schema](./phase-01-database-schema.md)
- [Research: Clerk Org Invites](./research/researcher-01-clerk-org-invites.md)
- [Existing Invitation Routes](../apps/api/src/routes/invitations.ts)
- [Existing Workspace Routes](../apps/api/src/routes/workspaces.ts)

## Overview

**Priority:** P1
**Status:** pending
**Effort:** 2h

Implement invitation API that creates Clerk org invitations with custom redirect URL, stores in local DB for tracking, and handles acceptance flow.

## Key Insights

From research:
- Use `clerkClient.organizations.createOrganizationInvitation()` with `redirectUrl` pointing to `/accept-invite`
- Clerk's invitation has `role` param: `org:member`, `org:admin`
- Need mapping: app roles → Clerk roles
- Clerk auto-adds user to org on ticket acceptance; app syncs via `authMiddleware`

## Requirements

### Functional
- [ ] POST `/workspaces/:id/invitations` - Create invitation (admin only)
- [ ] GET `/workspaces/:id/invitations` - List pending invitations
- [ ] DELETE `/workspaces/:id/invitations/:invitationId` - Revoke invitation
- [ ] GET `/invitations/token/:token` - Get invitation by token (public for accept page)

### Non-functional
- [ ] RBAC: Only `super_admin`, `pm` can invite
- [ ] Rate limit: 10 invitations/minute per user
- [ ] Email validation before Clerk call

## Architecture

```
POST /workspaces/:id/invitations
  ↓
1. Validate input (email, role)
2. Check user has workspace:invite permission
3. Check no duplicate pending invite for email
4. Create Clerk org invitation with redirectUrl
5. Store in local DB with clerkInvitationId
6. Return invitation details

Accept Flow (handled by authMiddleware):
- User arrives with Clerk session after ticket acceptance
- authMiddleware auto-syncs membership from Clerk org
- No explicit accept endpoint needed (Clerk handles it)
```

## Related Code Files

**Modify:**
- `/mnt/k/Work/nexa-task/apps/api/src/routes/workspaces.ts` - Add invitation endpoints
- `/mnt/k/Work/nexa-task/apps/api/src/services/invitation.ts` - Update service with Clerk integration
- `/mnt/k/Work/nexa-task/packages/shared/src/validators/workspace.ts` - Update invite schema

**Reference:**
- `/mnt/k/Work/nexa-task/apps/api/src/middleware/auth.ts` - Clerk client access
- `/mnt/k/Work/nexa-task/apps/api/src/middleware/rbac.ts` - Permission checks

## Implementation Steps

### 1. Update shared validators

File: `/mnt/k/Work/nexa-task/packages/shared/src/validators/workspace.ts`

```typescript
// Update inviteMemberSchema with more details
export const createInvitationSchema = z.object({
  email: z.string().email().transform(e => e.toLowerCase().trim()),
  role: z.enum(['super_admin', 'pm', 'member', 'guest']).default('member'),
})

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>
```

### 2. Update invitation service

File: `/mnt/k/Work/nexa-task/apps/api/src/services/invitation.ts`

Add function to create invitation with Clerk:

```typescript
import { clerkClient } from '@clerk/clerk-sdk-node'

// Map app roles to Clerk org roles
const roleToClerkRole = (role: string): string => {
  return role === 'super_admin' ? 'org:admin' : 'org:member'
}

export async function createWorkspaceInvitation(
  db: Database,
  input: {
    workspaceId: string
    email: string
    role: 'super_admin' | 'pm' | 'member' | 'guest'
    inviterId: string
    clerkOrgId: string
    inviterClerkId: string
  }
): Promise<Invitation> {
  // 1. Check for existing pending invite
  const existing = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.workspaceId, input.workspaceId),
      eq(invitations.inviteeEmail, input.email.toLowerCase()),
      eq(invitations.status, 'pending')
    ),
  })

  if (existing) {
    throw new ConflictError('Invitation already pending for this email')
  }

  // 2. Create Clerk org invitation
  const redirectUrl = `${process.env.FRONTEND_URL}/accept-invite`

  const clerkInvitation = await clerkClient.organizations.createOrganizationInvitation(
    input.clerkOrgId,
    {
      inviterUserId: input.inviterClerkId,
      emailAddress: input.email,
      role: roleToClerkRole(input.role),
      redirectUrl,
    }
  )

  // 3. Store in local DB
  const token = nanoid(32)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const [invitation] = await db
    .insert(invitations)
    .values({
      workspaceId: input.workspaceId,
      inviterId: input.inviterId,
      inviteeEmail: input.email.toLowerCase(),
      invitationToken: token,
      role: input.role,
      clerkInvitationId: clerkInvitation.id,
      expiresAt,
      status: 'pending',
    })
    .returning()

  return invitationSchema.parse(invitation)
}

export async function getWorkspaceInvitations(
  db: Database,
  workspaceId: string
): Promise<Invitation[]> {
  const results = await db.query.invitations.findMany({
    where: and(
      eq(invitations.workspaceId, workspaceId),
      eq(invitations.status, 'pending')
    ),
    with: { inviter: true },
    orderBy: (inv, { desc }) => [desc(inv.sentAt)],
  })
  return z.array(invitationSchema).parse(results)
}

export async function revokeInvitation(
  db: Database,
  invitationId: string,
  clerkOrgId: string
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
      await clerkClient.organizations.revokeOrganizationInvitation(
        clerkOrgId,
        invitation.clerkInvitationId
      )
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

  return invitationSchema.parse(updated)
}
```

### 3. Update workspace routes

File: `/mnt/k/Work/nexa-task/apps/api/src/routes/workspaces.ts`

Add invitation endpoints:

```typescript
import { createInvitationSchema } from '@repo/shared'
import * as invitationService from '../services/invitation'

// Create invitation
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
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
    })

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

    return success(c, invitation, 201)
  }
)

// List pending invitations
workspaces.get(
  '/:id/invitations',
  requireWorkspace,
  requirePermission('workspace:invite'),
  async (c) => {
    const db = c.var.db
    const workspaceId = c.req.param('id')
    const invitations = await invitationService.getWorkspaceInvitations(db, workspaceId)
    return success(c, invitations)
  }
)

// Revoke invitation
workspaces.delete(
  '/:id/invitations/:invitationId',
  requireWorkspace,
  requirePermission('workspace:invite'),
  async (c) => {
    const db = c.var.db
    const workspaceId = c.req.param('id')
    const invitationId = c.req.param('invitationId')

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
    })

    if (!workspace) {
      throw new NotFoundError('Workspace', workspaceId)
    }

    const invitation = await invitationService.revokeInvitation(
      db,
      invitationId,
      workspace.clerkOrgId
    )

    return success(c, invitation)
  }
)
```

### 4. Add public invitation lookup endpoint

File: `/mnt/k/Work/nexa-task/apps/api/src/routes/invitations.ts`

Update to add token lookup (public):

```typescript
// Get invitation by token (public, for accept page info display)
invitationRoutes.get('/token/:token', async (c) => {
  const token = c.req.param('token')
  const invitation = await getInvitationByToken(token)

  if (!invitation) {
    return c.json({ error: 'Invitation not found' }, 404)
  }

  // Return minimal info (no sensitive data)
  return c.json({
    id: invitation.id,
    inviteeEmail: invitation.inviteeEmail,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
  })
})
```

### 5. Add Clerk SDK to API

```bash
cd /mnt/k/Work/nexa-task/apps/api
bun add @clerk/clerk-sdk-node
```

## Todo List

- [ ] Add `@clerk/clerk-sdk-node` package to API
- [ ] Update `createInvitationSchema` in shared validators
- [ ] Add `createWorkspaceInvitation` function to invitation service
- [ ] Add `getWorkspaceInvitations` function to invitation service
- [ ] Add `revokeInvitation` function to invitation service
- [ ] Add POST `/workspaces/:id/invitations` endpoint
- [ ] Add GET `/workspaces/:id/invitations` endpoint
- [ ] Add DELETE `/workspaces/:id/invitations/:invitationId` endpoint
- [ ] Add GET `/invitations/token/:token` endpoint (public)
- [ ] Update invitation service Zod schema with role field
- [ ] Test invitation creation with Clerk
- [ ] Test invitation listing
- [ ] Test invitation revocation

## Success Criteria

- [ ] Can create invitation via API
- [ ] Clerk sends invitation email to invitee
- [ ] Invitation appears in pending list
- [ ] Can revoke invitation
- [ ] Revoked invitation no longer works in Clerk

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Clerk API rate limits | Medium | Add rate limiting on invitation creation |
| Clerk invitation creation fails | Medium | Return clear error, don't create local record |
| Clerk/local DB out of sync | Low | Store clerkInvitationId for reconciliation |

## Security Considerations

- Validate email format server-side
- Only super_admin can invite other super_admins
- Rate limit invitation creation
- Token lookup returns minimal info (no inviter details)
- RBAC enforced via `workspace:invite` permission

## Next Steps

After completion, proceed to [Phase 3: Frontend UI](./phase-03-frontend-ui.md)
