# Code Review: Invitation System Implementation

**Date:** 2026-01-18
**Reviewer:** Code Review Agent
**Scope:** Invitation/workspace member management implementation

---

## Scope

**Files Reviewed:**
- `/mnt/k/Work/nexa-task/packages/db/src/schema/invitations.ts` (74 lines)
- `/mnt/k/Work/nexa-task/packages/shared/src/validators/workspace.ts` (50 lines)
- `/mnt/k/Work/nexa-task/apps/api/src/services/invitation.ts` (372 lines)
- `/mnt/k/Work/nexa-task/apps/api/src/routes/workspaces.ts` (228 lines)
- `/mnt/k/Work/nexa-task/apps/api/src/routes/invitations.ts` (102 lines)

**Total Lines:** ~826 lines analyzed
**Review Focus:** Recent invitation system changes, security, Clerk integration
**Build Status:** ✅ TypeScript checks passing

---

## Overall Assessment

Implementation is **solid with critical security issues** that require immediate attention. Code quality is good with proper separation of concerns, validation, and error handling. However, authentication bypass vulnerability in public endpoint and missing authorization checks pose **security risks**.

**Severity Distribution:**
- Critical: 2 issues
- High: 3 issues
- Medium: 4 issues
- Low: 3 issues

---

## Critical Issues

### 1. **SECURITY: Unauthenticated Public Endpoint Exposes Sensitive Data**

**Location:** `/apps/api/src/routes/invitations.ts:82-99`

```typescript
// GET /invitations/token/:token - NO AUTH REQUIRED
invitationRoutes.get('/token/:token', async (c) => {
  const db = c.var.db
  const token = c.req.param('token')
  const invitation = await getInvitationByToken(db, token)
```

**Issue:** Anyone with a token can query invitation details without authentication. Tokens are 32-char nanoid strings (not cryptographically random UUIDs), potentially brute-forceable.

**Risk:**
- Token enumeration attacks
- Information disclosure (email addresses, roles, workspace info)
- GDPR/privacy violation (exposing email without consent)

**Fix:**
```typescript
invitationRoutes.get('/token/:token', requireAuth, async (c) => {
  const db = c.var.db
  const user = getAuthUser(c.var)
  const token = c.req.param('token')
  const invitation = await getInvitationByToken(db, token)

  if (!invitation) {
    return c.json({ error: 'Invitation not found' }, 404)
  }

  // Only allow viewing own invitation
  if (invitation.inviteeEmail !== user.email) {
    throw new ForbiddenError('Cannot view other invitations')
  }

  // Return minimal info
  return c.json({
    id: invitation.id,
    inviteeEmail: invitation.inviteeEmail,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
  })
})
```

### 2. **SECURITY: Missing Authorization on Accept Invitation**

**Location:** `/apps/api/src/routes/invitations.ts:20-35`

```typescript
invitationRoutes.post('/accept', zValidator('json', acceptInvitationSchema), async (c) => {
  const user = getAuthUser(c.var)
  const { token } = c.req.valid('json')
  const invitation = await acceptInvitation(db, token, user.id)
```

**Issue:** No verification that authenticated user's email matches `invitation.inviteeEmail`. Anyone authenticated can accept any invitation if they know the token.

**Risk:**
- **Authorization bypass** - User A can accept invitation meant for User B
- Workspace infiltration via stolen/leaked tokens

**Fix:**
```typescript
// In invitation.ts service
export async function acceptInvitation(
  db: Database,
  invitationToken: string,
  inviteeUserId: string,
  inviteeEmail: string, // ADD THIS
): Promise<Invitation> {
  const invitation = await getInvitationByToken(db, invitationToken)

  if (!invitation) {
    throw new NotFoundError('Invitation', invitationToken)
  }

  // CRITICAL: Verify email match
  if (invitation.inviteeEmail !== inviteeEmail.toLowerCase().trim()) {
    throw new ForbiddenError('Invitation not addressed to this email')
  }

  if (invitation.status !== 'pending') {
    throw new ConflictError('Invitation already used or expired')
  }

  if (new Date() > new Date(invitation.expiresAt)) {
    throw new ConflictError('Invitation expired')
  }

  const [updated] = await db
    .update(invitations)
    .set({
      status: 'accepted',
      acceptedAt: new Date(),
      inviteeId: inviteeUserId,
    })
    .where(eq(invitations.invitationToken, invitationToken))
    .returning()

  return invitationSchema.parse(updated)
}
```

---

## High Priority Findings

### 3. **Missing Expiration Check on Accept**

**Location:** `/apps/api/src/services/invitation.ts:283-308`

Current `acceptInvitation` doesn't validate `expiresAt` before accepting. User can accept expired invitations.

**Fix:** Add expiration check (shown in issue #2 fix above).

### 4. **Race Condition in Bulk Invitations**

**Location:** `/apps/api/src/services/invitation.ts:244-280`

```typescript
for (const email of input.emails) {
  try {
    const invitation = await createWorkspaceInvitation(db, {...})
    created.push(invitation)
  } catch (e) {
    if (e instanceof ConflictError) {
      skipped.push(email)
    } else {
      throw e
    }
  }
}
```

**Issue:** Sequential processing is slow (20 emails = 20 sequential Clerk API calls). No transaction handling - partial failures leave inconsistent state.

**Fix:**
```typescript
export async function createBulkInvitations(
  db: Database,
  input: {...}
): Promise<{ created: Invitation[]; failed: Array<{ email: string; reason: string }> }> {
  const created: Invitation[] = []
  const failed: Array<{ email: string; reason: string }> = []

  // Process in parallel batches
  const BATCH_SIZE = 5
  for (let i = 0; i < input.emails.length; i += BATCH_SIZE) {
    const batch = input.emails.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(email =>
        createWorkspaceInvitation(db, { ...input, email })
      )
    )

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        created.push(result.value)
      } else {
        failed.push({
          email: batch[idx],
          reason: result.reason.message
        })
      }
    })
  }

  return { created, failed }
}
```

### 5. **Hardcoded Frontend URL in Environment Variable**

**Location:** `/apps/api/src/services/invitation.ts:87, 212`

```typescript
const redirectUrl = `${process.env.FRONTEND_URL}/accept-invite`
```

**Issue:**
- Hardcoded path `/accept-invite` tightly couples backend to frontend route structure
- No validation that `FRONTEND_URL` is set (runtime error if missing)
- Should support multiple redirect URLs for different client apps

**Fix:**
```typescript
// At top of service file
const FRONTEND_URL = process.env.FRONTEND_URL
if (!FRONTEND_URL) {
  throw new Error('FRONTEND_URL environment variable required')
}

function getInvitationRedirectUrl(token: string): string {
  return `${FRONTEND_URL}/accept-invite?token=${token}`
}
```

---

## Medium Priority Improvements

### 6. **Inconsistent Error Handling in Routes**

**Location:** `/apps/api/src/routes/invitations.ts:27-34, 49-55`

```typescript
try {
  const invitation = await acceptInvitation(db, token, user.id)
  return c.json(invitation, 200)
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error'
  return c.json({ error: message }, 400)
}
```

**Issue:**
- Manual try/catch inconsistent with other routes (workspaces.ts uses middleware error handling)
- All errors return 400, losing status code granularity (should be 404 for not found, 409 for conflict)
- Different pattern from workspace routes which let middleware handle errors

**Fix:** Remove try/catch, let global error middleware handle errors (ensures consistent error responses).

```typescript
invitationRoutes.post('/accept', zValidator('json', acceptInvitationSchema), async (c) => {
  const db = c.var.db
  const user = getAuthUser(c.var)
  const { token } = c.req.valid('json')

  const invitation = await acceptInvitation(db, token, user.id, user.email)
  return success(c, invitation) // Use standard response helper
})
```

### 7. **Missing Input Sanitization on Email**

**Location:** `/apps/api/src/services/invitation.ts:71-72`

```typescript
const normalizedEmail = input.email.toLowerCase().trim()
```

**Issue:** Additional email validation needed:
- No check for valid email format (relies only on Zod)
- No check for disposable email domains
- No max length enforcement (DB column is 255, but no business logic check)

**Fix:**
```typescript
function normalizeEmail(email: string): string {
  const normalized = email.toLowerCase().trim()

  // Additional validation
  if (normalized.length > 255) {
    throw new ValidationError('Email too long')
  }

  // Disposable email check (optional - needs implementation)
  // if (isDisposableEmail(normalized)) {
  //   throw new ValidationError('Disposable emails not allowed')
  // }

  return normalized
}
```

### 8. **No Rate Limiting on Invitation Endpoints**

**Location:** All invitation routes

**Issue:** No rate limiting on:
- Bulk invite endpoint (can spam 20 emails per request)
- Resend endpoint (can spam same email repeatedly)
- Accept endpoint (brute force token attempts)

**Fix:** Add rate limiting middleware:
```typescript
import { rateLimit } from '../middleware/rate-limit'

workspaces.post(
  '/:id/invitations/bulk',
  requireWorkspace,
  requirePermission('workspace:invite'),
  rateLimit({ max: 5, window: '1h' }), // 5 bulk invites per hour
  zValidator('json', bulkInvitationSchema),
  async (c) => {...}
)
```

### 9. **Missing Invitation Notification**

**Location:** `/apps/api/src/services/invitation.ts:86-96`

After creating Clerk invitation, no email notification sent from app side. Relies entirely on Clerk's email system.

**Risk:**
- No control over email content/branding
- No custom invitation metadata (project context, etc.)
- Can't track email delivery failures

**Fix:** Consider implementing custom email service alongside Clerk invitation:
```typescript
// After Clerk invitation
await emailService.sendInvitation({
  to: normalizedEmail,
  inviterName: inviter.name,
  workspaceName: workspace.name,
  invitationUrl: getInvitationRedirectUrl(token),
  role: input.role,
})
```

---

## Low Priority Suggestions

### 10. **Type Safety: Zod Schema Duplication**

**Location:** `/apps/api/src/services/invitation.ts:14-27`

Service defines own Zod schema when validators already exist in `@repo/shared/validators/workspace.ts`.

**Suggestion:** Reuse shared validators to maintain single source of truth:
```typescript
import { invitationSchema } from '@repo/shared/validators'
```

### 11. **Database Query Optimization**

**Location:** `/apps/api/src/services/invitation.ts:128-136`

```typescript
const results = await db.query.invitations.findMany({
  where: and(...),
  with: { inviter: true },
  orderBy: (inv, { desc }) => [desc(inv.sentAt)],
})
```

**Issue:** Loads full `inviter` relation when only name/email needed.

**Optimization:**
```typescript
const results = await db.query.invitations.findMany({
  where: and(...),
  with: {
    inviter: {
      columns: { id: true, name: true, email: true }
    }
  },
  orderBy: (inv, { desc }) => [desc(inv.sentAt)],
})
```

### 12. **Console.log in Production Code**

**Location:** `/apps/api/src/services/invitation.ts:162, 207, 370`

```typescript
console.error('Failed to revoke Clerk invitation:', e)
console.log(`Expired ${expiredInvitations.length} old invitations.`)
```

**Issue:** Should use structured logging service instead of console.

**Fix:**
```typescript
import { logger } from '../lib/logger'

logger.error('Failed to revoke Clerk invitation', { error: e, invitationId })
logger.info('Expired old invitations', { count: expiredInvitations.length })
```

---

## Positive Observations

✅ **Excellent separation of concerns** - Clean service/route layer split
✅ **Comprehensive Zod validation** - All inputs validated
✅ **Proper error types** - Custom error classes used correctly
✅ **Good database schema** - Proper indexes, constraints, cascade rules
✅ **Clerk integration done correctly** - Proper sync between systems
✅ **Transaction safety** - Using `.returning()` to avoid race conditions
✅ **TypeScript strict mode** - Full type safety enforced
✅ **Unique constraints** - Prevents duplicate invitations per workspace
✅ **Expiration handling** - Background job pattern for cleanup

---

## Recommended Actions

### Immediate (Before Production)
1. ⚠️ **FIX CRITICAL** - Add authentication to `/invitations/token/:token` endpoint
2. ⚠️ **FIX CRITICAL** - Add email verification in `acceptInvitation`
3. ⚠️ **FIX HIGH** - Add expiration validation in accept flow
4. ⚠️ **FIX HIGH** - Add rate limiting to invitation endpoints

### Short Term (Next Sprint)
5. Implement batch processing for bulk invitations
6. Add structured logging (replace console.*)
7. Implement custom email notifications
8. Add disposable email domain blocking

### Long Term (Nice to Have)
9. Add invitation analytics/tracking
10. Implement invitation templates
11. Add audit logging for invitation events
12. Optimize database queries with column selection

---

## Metrics

**Type Coverage:** ✅ 100% (strict mode enabled)
**Build Status:** ✅ Passing
**Linting:** ✅ No blocking issues
**Test Coverage:** ⚠️ Not verified (no tests found for invitation service)

---

## Security Checklist

- [x] SQL injection protection (Drizzle ORM parameterizes)
- [ ] **Authentication bypass** (issue #2)
- [ ] **Authorization checks** (issue #2)
- [x] Input validation (Zod schemas)
- [x] Email normalization
- [ ] Rate limiting (issue #8)
- [x] CSRF protection (token-based)
- [ ] **Data exposure** (issue #1)
- [x] Proper error messages (no stack traces leaked)
- [x] Secure token generation (nanoid)

**Security Score:** 6/10 (critical issues must be fixed)

---

## Unresolved Questions

1. **Testing:** Are there integration tests for invitation flow? None found in review.
2. **Clerk Webhook:** Is there a webhook handler to sync Clerk invitation acceptance?
3. **Invitation Limits:** Should there be per-workspace invitation limits?
4. **Token Rotation:** Should tokens be rotated on failed accept attempts?
5. **Multi-workspace:** Can user accept multiple workspace invitations simultaneously?

---

## Next Steps

1. **Developer:** Address critical security issues #1 and #2 immediately
2. **Developer:** Add expiration check and rate limiting
3. **QA:** Create test plan for invitation security scenarios
4. **DevOps:** Ensure `FRONTEND_URL` is set in all environments
5. **Code Review:** Re-review after fixes applied

---

**Review Status:** ⚠️ **CHANGES REQUIRED** - Do not merge until critical issues resolved
**Estimated Fix Time:** 2-3 hours for critical issues
