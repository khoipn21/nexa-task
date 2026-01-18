# Phase 1: Database Schema Update

## Context Links

- [Plan Overview](./plan.md)
- [Research: Email Patterns](./research/researcher-02-invite-email-patterns.md)
- [Existing Schema](../packages/db/src/schema/invitations.ts)

## Overview

**Priority:** P1 (blocking)
**Status:** pending
**Effort:** 0.5h

Update existing `invitations` table to support Clerk org invitation integration. Add `role` field and `clerk_invitation_id` for linking.

## Key Insights

- Existing schema has: id, inviterId, inviteeEmail, invitationToken, status, sentAt, expiresAt, acceptedAt, inviteeId, workspaceId
- Need to add: `role` (workspace role for invitee), `clerkInvitationId` (Clerk's invitation ID for tracking)
- Keep existing token for audit; Clerk handles actual auth token

## Requirements

### Functional
- [ ] Add `role` column (enum: super_admin, pm, member, guest)
- [ ] Add `clerkInvitationId` column (nullable, stores Clerk's `oi_xxx` ID)
- [ ] Add index on `clerkInvitationId` for lookup

### Non-functional
- [ ] Backward compatible (new columns nullable or have defaults)
- [ ] Migration runnable on existing data

## Architecture

```
invitations table:
├── id (uuid, PK)
├── workspace_id (uuid, FK)
├── inviter_id (uuid, FK)
├── invitee_email (varchar)
├── invitation_token (varchar, unique) -- local token for audit
├── status (enum: pending, accepted, expired, cancelled)
├── role (enum: super_admin, pm, member, guest) -- NEW
├── clerk_invitation_id (varchar, nullable) -- NEW
├── sent_at (timestamp)
├── expires_at (timestamp)
├── accepted_at (timestamp)
└── invitee_id (uuid, FK, nullable)
```

## Related Code Files

**Modify:**
- `/mnt/k/Work/nexa-task/packages/db/src/schema/invitations.ts`
- `/mnt/k/Work/nexa-task/packages/db/src/schema/index.ts` (if needed for re-export)

**Reference:**
- `/mnt/k/Work/nexa-task/packages/db/src/schema/workspaces.ts` (workspaceRoleEnum)

## Implementation Steps

### 1. Update invitations.ts schema

```typescript
// Add imports
import { workspaceRoleEnum } from './workspaces'

// Add to invitations table columns:
role: workspaceRoleEnum('role').notNull().default('member'),
clerkInvitationId: varchar('clerk_invitation_id', { length: 255 }),

// Add index
clerkInvitationIdIdx: index('invitations_clerk_invitation_id_idx').on(table.clerkInvitationId),
```

### 2. Update service types

Update `/mnt/k/Work/nexa-task/apps/api/src/services/invitation.ts`:
- Add `role` to `invitationSchema`
- Add `clerkInvitationId` to `invitationSchema`

### 3. Push schema changes

```bash
cd /mnt/k/Work/nexa-task
bun run db:push
```

## Todo List

- [ ] Add `role` column using existing `workspaceRoleEnum`
- [ ] Add `clerkInvitationId` varchar column (nullable)
- [ ] Add index on `clerkInvitationId`
- [ ] Update invitation service Zod schema
- [ ] Run `bun run db:push` to apply changes
- [ ] Verify with `bun run db:studio`

## Success Criteria

- [ ] Schema compiles without errors
- [ ] `bun run db:push` succeeds
- [ ] Existing invitation data (if any) preserved
- [ ] Can query invitations with new fields

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Enum import conflict | Low | Use existing `workspaceRoleEnum` from same file |
| Migration fails | Low | New columns have defaults/nullable |

## Security Considerations

- Role field must be validated on insert (prevent privilege escalation)
- Only admins should create invitations (enforced at API layer)

## Next Steps

After completion, proceed to [Phase 2: Backend API](./phase-02-backend-api.md)
