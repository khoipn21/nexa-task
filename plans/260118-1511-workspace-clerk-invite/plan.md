---
title: "Workspace Member Invitation with Clerk Integration"
description: "Admin-only invitation system using Clerk org invitations with custom accept flow"
status: in_progress
priority: P2
effort: 6h
branch: master
tags: [workspace, clerk, invitation, email, auth]
created: 2026-01-18
---

# Workspace Member Invitation System

## Overview

Implement workspace member invitation using Clerk organization invitations with custom redirect handling. Admins (super_admin, pm) can invite users via email; Clerk handles auth flow; app handles post-auth workspace membership.

## Architecture Decision

**Clerk Native Invitations + Local DB Tracking**
- Use `clerkClient.organizations.createOrganizationInvitation()` with custom `redirectUrl`
- Store invitations in local DB for audit trail, revocation, pending list
- Clerk sends email + handles auth; app syncs membership after acceptance
- Leverages existing `invitations` table schema (already exists)

## User Flow

```
Admin → Invite Modal → POST /workspaces/:id/invitations
  ↓
Backend → Create local invite + Clerk org invitation (with redirectUrl)
  ↓
Clerk → Sends invitation email (standard Clerk email)
  ↓
User clicks link → /accept-invite?__clerk_ticket=xxx&__clerk_status=sign_in|sign_up
  ↓
Accept page → signIn.create/signUp.create with strategy: 'ticket'
  ↓
On success → User auto-added to org by Clerk → Redirect to /dashboard
```

## Phases

| Phase | Status | Effort | Description |
|-------|--------|--------|-------------|
| [Phase 1](./phase-01-database-schema.md) | ✅ completed | 0.5h | Update invitations schema (add role, clerkInvitationId) |
| [Phase 2](./phase-02-backend-api.md) | ✅ completed | 2h | Invitation API + Clerk integration |
| [Phase 3](./phase-03-frontend-ui.md) | ✅ completed | 2.5h | Invite modal + accept-invite page |
| [Phase 4](./phase-04-testing.md) | ⚠️ partial | 1h (+ 2-3h for 80% coverage) | Unit + integration tests (34 tests, ~60% coverage) |

## Key Files

**Backend:**
- `packages/db/src/schema/invitations.ts` - Schema update
- `apps/api/src/services/invitation.ts` - Service layer update
- `apps/api/src/routes/workspaces.ts` - Invitation endpoint

**Frontend:**
- `apps/web/src/components/workspace-settings/invite-member-modal.tsx` - New
- `apps/web/src/routes/accept-invite.tsx` - New
- `apps/web/src/routes/index.tsx` - Add route

## Dependencies

- Clerk SDK (already installed: `@hono/clerk-auth`, `@clerk/clerk-react`)
- Existing `invitations` table + service
- Existing RBAC middleware (`workspace:invite` permission)

## Related Research

- [Clerk Org Invites](./research/researcher-01-clerk-org-invites.md)
- [Email Patterns](./research/researcher-02-invite-email-patterns.md)

---

## Validation Summary

**Validated:** 2026-01-18
**Questions asked:** 8

### Confirmed Decisions
- **Email sender:** Clerk's built-in email (not custom SMTP)
- **Role escalation:** No restriction (any admin can invite any role)
- **Redirect target:** /dashboard (not workspace-specific)
- **Invite expiry:** 7 days
- **DB tracking:** Yes, store in local DB for audit/revocation
- **Resend feature:** Add resend button for pending invites
- **UI location:** Add to existing /settings page (not new page)
- **Bulk invite:** Support multiple emails at once

### Action Items (Plan Updates Needed)
- [ ] **Phase 2:** Add resend invitation endpoint (POST `/workspaces/:id/invitations/:id/resend`)
- [ ] **Phase 2:** Add bulk invitation support (`emails: string[]` instead of single `email`)
- [ ] **Phase 3:** Move invite UI to existing `/settings` page instead of new workspace-settings page
- [ ] **Phase 3:** Update invite modal to support comma-separated emails or textarea input
- [ ] **Phase 3:** Add "Resend" button to pending invitations list
