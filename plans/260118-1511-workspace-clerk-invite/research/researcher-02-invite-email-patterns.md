# Research Report: Invitation Email Systems with Clerk Integration

**Date:** 2026-01-18
**Author:** researcher-02
**Topic:** Custom email invitation patterns, security, and database schema

---

## Executive Summary

Custom invitation systems with Clerk require managing invitations outside Clerk's built-in flow to support custom emails, pending user tracking, and workspace-specific logic. Key pattern: store invitations in app DB, send custom emails with secure tokens, handle acceptance via Clerk signup/signin.

---

## 1. Clerk Organization Invitation Patterns

### Built-in vs Custom Invitations

**Clerk Native Approach:**
- `organization.createInvitation()` API creates invitations
- Clerk sends standardized emails via their infrastructure
- Limited customization of email content/branding
- Automatic handling of invitation acceptance

**Custom Email Pattern (Recommended for this use case):**
- App DB stores invitation records with custom tokens
- App sends emails via own provider (Resend, SendGrid, etc.)
- Full control over email design, content, timing
- Clerk used only for final authentication after acceptance
- Supports inviting non-existent users (pending state)

### Clerk API Integration

```typescript
// After user accepts invite and signs up/in with Clerk
const { userId } = await clerkClient.users.getUser(clerkUserId);

// Add to organization
await clerkClient.organizations.createOrganizationMembership({
  organizationId: workspaceId,
  userId: userId,
  role: invitationRole
});
```

**Key Point:** Clerk handles authentication, app handles invitation logic.

---

## 2. Database Schema Recommendations

### Core Tables

**workspace_invitations**
```sql
CREATE TABLE workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL, -- 'admin', 'member', 'viewer'
  token VARCHAR(255) NOT NULL UNIQUE, -- Secure random token
  invited_by UUID NOT NULL REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'accepted', 'expired', 'revoked'
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  accepted_by UUID REFERENCES users(id), -- Clerk user who accepted
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Prevent duplicate pending invitations
  CONSTRAINT unique_pending_invite UNIQUE (workspace_id, email, status)
    WHERE status = 'pending'
);

CREATE INDEX idx_invitations_token ON workspace_invitations(token);
CREATE INDEX idx_invitations_email ON workspace_invitations(email);
CREATE INDEX idx_invitations_workspace ON workspace_invitations(workspace_id);
CREATE INDEX idx_invitations_status ON workspace_invitations(status, expires_at);
```

### Key Schema Design Decisions

1. **Token Storage:** Plain secure random tokens (not JWTs) stored in DB
   - 32+ byte random strings (URL-safe base64)
   - Single-use, invalidated on acceptance
   - Indexed for fast lookup

2. **Email Normalization:** Store emails in lowercase
   - Prevents duplicate invites via case variations
   - Matches Clerk's email normalization

3. **Expiration:** Timestamp-based with background cleanup
   - Typical: 7 days for workspace invites
   - Indexed for efficient cleanup queries

4. **Status Tracking:** Explicit status field
   - `pending`: Awaiting acceptance
   - `accepted`: User joined workspace
   - `expired`: Past expiration timestamp
   - `revoked`: Manually cancelled by admin

5. **Audit Trail:** Track who invited and who accepted
   - `invited_by`: Original inviter
   - `accepted_by`: Clerk user ID who redeemed
   - Timestamps for compliance/debugging

---

## 3. Invitation Token Security

### Token Generation

```typescript
import { randomBytes } from 'crypto';

function generateInviteToken(): string {
  // 32 bytes = 256 bits of entropy
  return randomBytes(32).toString('base64url');
}
```

**Security Properties:**
- Cryptographically random (use `crypto.randomBytes`, not `Math.random()`)
- URL-safe encoding (base64url)
- Minimum 128 bits entropy (16 bytes), recommended 256 bits (32 bytes)
- Single-use (invalidate on acceptance)
- Time-bound expiration

### Link Structure

```
https://app.example.com/accept-invite?token=<TOKEN>
```

**Security Considerations:**
- Use HTTPS only (prevent token interception)
- Don't include workspace ID or email in URL (token is sufficient)
- Keep tokens in query params (simpler for email links)
- Validate token server-side before any action

### Validation Flow

```typescript
async function validateInviteToken(token: string) {
  const invite = await db.query(`
    SELECT * FROM workspace_invitations
    WHERE token = $1
    AND status = 'pending'
    AND expires_at > NOW()
  `, [token]);

  if (!invite) {
    throw new Error('Invalid or expired invitation');
  }

  return invite;
}
```

---

## 4. Invitation Expiration & Revocation

### Expiration Strategy

**Time-based expiration:**
- Set `expires_at` on creation (7-14 days typical)
- Check on token validation
- Background job to cleanup expired invites

```sql
-- Cleanup job (run daily)
UPDATE workspace_invitations
SET status = 'expired'
WHERE status = 'pending'
AND expires_at < NOW();
```

### Manual Revocation

```typescript
async function revokeInvitation(inviteId: string, revokedBy: string) {
  await db.query(`
    UPDATE workspace_invitations
    SET status = 'revoked', updated_at = NOW()
    WHERE id = $1
    AND status = 'pending'
  `, [inviteId]);
}
```

**UI/UX Patterns:**
- Admins can revoke pending invites
- Show revocation in audit log
- Prevent re-invitation without explicit action

---

## 5. Handling Pending Invites for Non-Existent Users

### Pattern: Email-First Invitation

**Flow:**
1. Admin invites `user@example.com` (doesn't have account yet)
2. System creates invitation record, sends email
3. User clicks link → lands on signup/signin page
4. After Clerk auth completes → validate token → add to workspace
5. Mark invitation as accepted

### Implementation Pattern

```typescript
// Accept invite endpoint
async function acceptInvitation(token: string, clerkUserId: string) {
  // Validate token
  const invite = await validateInviteToken(token);

  // Get Clerk user email
  const clerkUser = await clerkClient.users.getUser(clerkUserId);

  // Verify email matches invitation
  const userEmail = clerkUser.emailAddresses
    .find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress;

  if (userEmail?.toLowerCase() !== invite.email.toLowerCase()) {
    throw new Error('Email mismatch');
  }

  // Add to workspace (Clerk organization)
  await clerkClient.organizations.createOrganizationMembership({
    organizationId: invite.workspace_id,
    userId: clerkUserId,
    role: invite.role
  });

  // Mark invitation as accepted
  await db.query(`
    UPDATE workspace_invitations
    SET status = 'accepted',
        accepted_at = NOW(),
        accepted_by = $1
    WHERE id = $2
  `, [clerkUserId, invite.id]);

  return { workspaceId: invite.workspace_id };
}
```

### Edge Cases

1. **User already has account with different email:**
   - Show error: "This invite is for user@example.com"
   - Allow user to add email to Clerk account or use correct account

2. **Invitation already accepted:**
   - Redirect to workspace with notice
   - Don't error, smooth UX

3. **User already in workspace:**
   - Check membership before accepting
   - Update role if invitation has higher permissions

---

## 6. Email Template Best Practices

### Content Structure

```html
Subject: [Inviter Name] invited you to [Workspace Name]

Hi there,

[Inviter Name] has invited you to join [Workspace Name] on [App Name].

[CTA Button: Accept Invitation]
Link: https://app.example.com/accept-invite?token=<TOKEN>

This invitation expires in 7 days.

---
Questions? Reply to this email or contact support@example.com
```

### Design Principles

- **Clear CTA:** Prominent "Accept Invitation" button
- **Context:** Who invited, what workspace, what role
- **Expiration:** Communicate time limit
- **Security note:** "If you didn't expect this, ignore it"
- **Mobile-friendly:** Responsive design
- **Accessible:** Proper text/background contrast

### Provider Recommendations

- **Resend:** Modern API, React Email templates, great DX
- **SendGrid:** Robust, scalable, template engine
- **Postmark:** Fast delivery, transactional focus

---

## 7. Code Pattern Summary

### Complete Flow

```typescript
// 1. Create invitation
async function createInvitation(data: {
  workspaceId: string;
  email: string;
  role: string;
  invitedBy: string;
}) {
  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invite = await db.insert('workspace_invitations', {
    workspace_id: data.workspaceId,
    email: data.email.toLowerCase(),
    role: data.role,
    token,
    invited_by: data.invitedBy,
    expires_at: expiresAt
  });

  // Send email (async)
  await sendInvitationEmail({
    to: data.email,
    inviterName: await getInviterName(data.invitedBy),
    workspaceName: await getWorkspaceName(data.workspaceId),
    inviteUrl: `https://app.example.com/accept-invite?token=${token}`
  });

  return invite;
}

// 2. Accept invitation (called after Clerk auth)
// See section 5 for full implementation
```

---

## Security Checklist

- [ ] Use cryptographically random tokens (crypto.randomBytes)
- [ ] Store tokens securely in database (indexed, unique)
- [ ] Enforce HTTPS for all invitation links
- [ ] Set reasonable expiration (7-14 days)
- [ ] Validate email match on acceptance
- [ ] Single-use tokens (invalidate on acceptance)
- [ ] Rate limit invitation creation per workspace
- [ ] Audit log for invitation actions
- [ ] Prevent token reuse after expiration/revocation
- [ ] Sanitize email inputs (lowercase, trim)

---

## References

- Clerk Organizations API: `/clerk/clerk-docs` (Context7)
- Token security: Industry standard 256-bit random tokens
- Database patterns: PostgreSQL partial unique indexes
- Email best practices: Transactional email standards

---

## Unresolved Questions

None. Pattern is well-established and battle-tested.
