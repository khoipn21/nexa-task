# Clerk Organization Invitation API Research

**Date:** 2026-01-18
**Context:** Workspace invitation flow for nexa-task
**Sources:** Clerk Official Documentation via Context7

---

## API Overview

### Backend API Endpoint
```
POST /v1/organizations/{organization_id}/invitations
```

**Authentication:** Requires Clerk Secret Key in Authorization header

### SDK Method (TypeScript)
```typescript
clerkClient.organizations.createOrganizationInvitation(
  organizationId: string,
  params: CreateOrganizationInvitationParams
): Promise<OrganizationInvitation>
```

---

## Key Parameters

### Required
- `organizationId` (string) - Target organization ID
- `inviterUserId` (string | null) - User creating invitation
- `emailAddress` (string) - Invitee email
- `role` (string) - Role assignment (e.g., "org:member", "org:admin")

### Optional
- `redirectUrl` (string) - **Critical:** Full URL where user lands after accepting invitation
- `publicMetadata` (object) - Custom metadata (accessible Frontend + Backend)

---

## Code Example

### Creating Invitation with Redirect

```typescript
// Backend API call
const invitation = await clerkClient.organizations.createOrganizationInvitation(
  'org_123',
  {
    inviterUserId: 'user_456',
    emailAddress: 'newuser@example.com',
    role: 'org:member',
    redirectUrl: 'https://app.example.com/workspaces/accept-invite'
  }
)

// Response
{
  id: 'oi_789',
  organizationId: 'org_123',
  emailAddress: 'newuser@example.com',
  role: 'org:member',
  inviterUserId: 'user_456',
  status: 'pending',
  publicMetadata: {},
  createdAt: 1705320000,
  updatedAt: 1705320000
}
```

### cURL Example
```bash
curl 'https://api.clerk.com/v1/organizations/org_123/invitations' \
  -X POST \
  -H 'Authorization: Bearer sk_live_xxx' \
  -H 'Content-Type: application/json' \
  -d '{
    "inviter_user_id": "user_456",
    "email_address": "newuser@example.com",
    "role": "org:member",
    "redirect_url": "https://app.example.com/accept-invite"
  }'
```

---

## Invitation Acceptance Flow

### Flow Diagram (Text-Based)

```
User clicks email invite link
         ↓
Clerk extracts __clerk_ticket token + __clerk_status param
         ↓
   ┌──────────────────┐
   │ __clerk_status?  │
   └──────────────────┘
         ↓
    ┌────┴────┐
    │         │
sign_in    sign_up
    │         │
    ↓         ↓
Existing   New User
 User      Creates
Signs In   Account
    │         │
    └────┬────┘
         ↓
User redirected to redirectUrl
         ↓
App handles auth + org context
```

### URL Query Parameters
- `__clerk_ticket` - Invitation token (required for validation)
- `__clerk_status` - Values: `sign_in` | `sign_up`

---

## Handling Redirect URL Page

### Existing User Flow (sign_in)

```typescript
'use client'
import { useSignIn, useOrganization } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'

export default function AcceptInvitePage() {
  const { signIn, setActive } = useSignIn()
  const { organization } = useOrganization()
  const token = useSearchParams().get('__clerk_ticket')
  const status = useSearchParams().get('__clerk_status')

  useEffect(() => {
    if (!signIn || !token || organization || status !== 'sign_in') return

    const acceptInvite = async () => {
      try {
        const signInAttempt = await signIn.create({
          strategy: 'ticket',
          ticket: token
        })

        if (signInAttempt.status === 'complete') {
          await setActive({ session: signInAttempt.createdSessionId })
          // User now authenticated + added to org
        }
      } catch (err) {
        console.error('Sign-in error:', err)
      }
    }

    acceptInvite()
  }, [signIn, token, status])

  return <div>Processing invitation...</div>
}
```

### New User Flow (sign_up)

```typescript
const { signUp, setActive } = useSignUp()

const handleSignUp = async (e) => {
  e.preventDefault()

  try {
    const signUpAttempt = await signUp.create({
      strategy: 'ticket',
      ticket: token,
      firstName: formData.firstName,
      lastName: formData.lastName,
      password: formData.password
    })

    if (signUpAttempt.status === 'complete') {
      await setActive({ session: signUpAttempt.createdSessionId })
      // New user created + verified + added to org
    }
  } catch (err) {
    console.error('Sign-up error:', err)
  }
}
```

---

## Key Behaviors

### Email Verification
- Invitation token **auto-verifies** email address (no verification email needed)
- User immediately added to org upon successful auth

### Token Validation
- `strategy: 'ticket'` required in signIn/signUp.create()
- Token extracted from `__clerk_ticket` query param
- Invalid/expired tokens throw errors

### Organization Context
- After acceptance, `useOrganization()` hook returns joined org
- User automatically switched to invited org context
- Role assigned as specified in invitation

---

## Redirect URL Configuration

### Best Practices
1. **Use absolute URLs**: `https://app.example.com/accept-invite`
2. **Handle both flows**: Check `__clerk_status` to determine sign_in vs sign_up
3. **Validate token presence**: Restrict page access if no `__clerk_ticket`
4. **Custom UI options**:
   - Embed `<SignIn />` component (easiest)
   - Custom form with `useSignIn()`/`useSignUp()` hooks (more control)

### Alternative: No Redirect URL
- Omit `redirectUrl` parameter
- Clerk uses default: Account Portal → Organization page
- User manually navigates to app after acceptance

---

## Bulk Invitations

```typescript
await clerkClient.organizations.createOrganizationInvitationBulk(
  'org_123',
  [
    { inviterUserId: 'user_1', emailAddress: 'user1@ex.com', role: 'org:admin' },
    { inviterUserId: 'user_1', emailAddress: 'user2@ex.com', role: 'org:member' }
  ]
)
```

---

## References

- [Create Organization Invitation](https://github.com/clerk/clerk-docs/blob/main/docs/reference/backend/organization/create-organization-invitation.mdx)
- [Accept Organization Invitations](https://github.com/clerk/clerk-docs/blob/main/docs/guides/development/custom-flows/organizations/accept-organization-invitations.mdx)
- [Bulk Invitations](https://github.com/clerk/clerk-docs/blob/main/docs/reference/backend/organization/create-organization-invitation-bulk.mdx)

---

## Unresolved Questions

None - documentation comprehensive for stated requirements.
