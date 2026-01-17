# Clerk RBAC Authentication Research Report

**Date:** 2026-01-17
**Focus:** Clerk + Hono backend + React frontend with RBAC multi-tenancy

---

## 1. Clerk Setup (React + Hono)

### Installation
```bash
npm i hono @hono/clerk-auth @clerk/nextjs
```

### Environment Variables
```bash
CLERK_SECRET_KEY=sk_live_xxxxx
CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
```

### Hono Middleware Integration
```typescript
import { clerkMiddleware, getAuth } from '@hono/clerk-auth'
import { Hono } from 'hono'

const app = new Hono()

// Apply globally
app.use('*', clerkMiddleware())

// Protected route example
app.get('/api/tasks', async (c) => {
  const auth = getAuth(c)
  if (!auth?.userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  return c.json({ userId: auth.userId, tasks: [] })
})

// Access Clerk Backend API
app.get('/api/user/:id', async (c) => {
  const clerkClient = c.get('clerk')
  try {
    const user = await clerkClient.users.getUser(c.req.param('id'))
    return c.json({ user })
  } catch (e) {
    return c.json({ message: 'User not found' }, 404)
  }
})
```

---

## 2. RBAC Implementation

### Custom Roles & Permissions Definition
Define types globally for type safety:

```typescript
// types/clerk.d.ts
export {}

declare global {
  interface ClerkAuthorization {
    permission:
      | 'org:task:create'
      | 'org:task:edit'
      | 'org:task:delete'
      | 'org:task:read'
      | 'org:member:invite'
      | 'org:settings:manage'
    role:
      | 'org:super_admin'
      | 'org:pm'
      | 'org:member'
      | 'org:guest'
  }
}
```

### Role Hierarchy
- **Super Admin**: Full access (all permissions)
- **PM (Project Manager)**: Task management + member invitations
- **Member**: Create/edit own tasks, read all
- **Guest**: Read-only access

### Frontend Access Control (React)
```javascript
import { useAuth, useOrganization } from '@clerk/nextjs'

function ProtectedTaskPage() {
  const { isSignedIn, has } = useAuth()
  const { organization } = useOrganization()

  // Check authentication
  if (!isSignedIn) return <p>Sign in required</p>

  // Check active organization
  if (!organization) return <p>Select organization</p>

  // Check role-based access
  if (!has({ role: 'org:pm' }) && !has({ role: 'org:super_admin' })) {
    return <p>PM or Super Admin role required</p>
  }

  // Check permission-based access
  if (!has({ permission: 'org:task:create' })) {
    return <p>Task creation permission required</p>
  }

  return <TaskCreateForm />
}
```

### Backend RBAC Middleware (Hono)
```typescript
import { Context, Next } from 'hono'
import { getAuth } from '@hono/clerk-auth'

// Role check middleware
const requireRole = (allowedRoles: string[]) => {
  return async (c: Context, next: Next) => {
    const auth = getAuth(c)

    if (!auth?.userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const clerkClient = c.get('clerk')
    const user = await clerkClient.users.getUser(auth.userId)

    // Get user's role in active organization
    const orgId = auth.orgId
    if (!orgId) {
      return c.json({ error: 'No active organization' }, 403)
    }

    const membership = user.organizationMemberships?.find(
      m => m.organization.id === orgId
    )

    const userRole = membership?.role
    if (!userRole || !allowedRoles.includes(userRole)) {
      return c.json({ error: 'Insufficient permissions' }, 403)
    }

    await next()
  }
}

// Permission check middleware
const requirePermission = (permission: string) => {
  return async (c: Context, next: Next) => {
    const auth = getAuth(c)

    if (!auth?.has || !auth.has({ permission })) {
      return c.json({ error: 'Permission denied' }, 403)
    }

    await next()
  }
}

// Usage
app.post('/api/tasks',
  requirePermission('org:task:create'),
  async (c) => {
    // Task creation logic
  }
)

app.delete('/api/workspace/:id',
  requireRole(['org:super_admin']),
  async (c) => {
    // Delete workspace
  }
)
```

---

## 3. Organization Multi-Tenancy

### Organizations as Tenants
Clerk's Organizations feature provides built-in multi-tenancy:
- Users belong to multiple organizations
- Each org has isolated data scope
- Seamless organization switching

### Data Isolation Pattern
```typescript
// Database query with tenant scope
app.get('/api/tasks', async (c) => {
  const auth = getAuth(c)
  const orgId = auth.orgId

  if (!orgId) {
    return c.json({ error: 'No active organization' }, 403)
  }

  // Query tasks scoped to organization
  const tasks = await db.query(
    'SELECT * FROM tasks WHERE organization_id = $1',
    [orgId]
  )

  return c.json({ tasks })
})
```

### Best Practices
- **Tenant-scoped permissions**: Always filter by `orgId`
- **Row-level security**: Implement RLS at database level
- **Principle of least privilege**: Grant minimum necessary permissions
- **Avoid role explosion**: Use permission bundles

---

## 4. Invitation System

### Invite Members (React Component)
```typescript
'use client'
import { useOrganization } from '@clerk/nextjs'
import { OrganizationCustomRoleKey } from '@clerk/types'
import { useState } from 'react'

export const InviteMember = () => {
  const { organization, invitations } = useOrganization({
    invitations: { pageSize: 5, keepPreviousData: true }
  })

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<OrganizationCustomRoleKey>('org:member')
  const [disabled, setDisabled] = useState(false)

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization || !email) return

    setDisabled(true)
    try {
      await organization.inviteMember({
        emailAddress: email,
        role: role
      })
      await invitations?.revalidate?.()
      setEmail('')
    } catch (err) {
      console.error('Invitation failed:', err)
    }
    setDisabled(false)
  }

  return (
    <form onSubmit={handleInvite}>
      <input
        type="email"
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <select value={role} onChange={(e) => setRole(e.target.value as OrganizationCustomRoleKey)}>
        <option value="org:guest">Guest</option>
        <option value="org:member">Member</option>
        <option value="org:pm">PM</option>
        <option value="org:super_admin">Super Admin</option>
      </select>
      <button type="submit" disabled={disabled}>
        Send Invitation
      </button>
    </form>
  )
}
```

### Email Invitations
- Clerk handles email delivery automatically
- Customizable email templates in dashboard
- Invitation expiry configuration
- Revoke pending invitations via API

---

## 5. Session Management & Security

### Session Token Integration
- Roles/permissions embedded in session token (public metadata)
- No extra network requests for auth checks
- JWT-based session validation
- Automatic token refresh

### Security Best Practices
- **HTTPS only**: Enforce in production
- **Token expiry**: Configure session lifetime (default 7 days)
- **CSRF protection**: Hono CSRF middleware recommended
- **Rate limiting**: Protect invitation/auth endpoints
- **Audit logging**: Log permission changes and access attempts

### Session Extraction (Hono)
```typescript
// Extract JWT from Authorization header
app.use('*', async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (token) {
    // Clerk middleware validates automatically
  }
  await next()
})
```

---

## 6. SSO Integration

### Supported Providers
- **Google Workspace** (SAML/OAuth)
- **Azure AD / Microsoft Entra ID** (SAML/OIDC)
- **Okta Workforce** (SAML)
- Custom SAML providers

### Enterprise SSO Setup (React)
```typescript
'use client'
import { useSignIn } from '@clerk/nextjs'

export default function SSOSignIn() {
  const { signIn, isLoaded } = useSignIn()

  const handleSSOSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!isLoaded) return

    const email = (e.target as HTMLFormElement).email.value

    try {
      await signIn.authenticateWithRedirect({
        identifier: email,
        strategy: 'enterprise_sso',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/dashboard'
      })
    } catch (err) {
      console.error('SSO failed:', err)
    }
  }

  return (
    <form onSubmit={handleSSOSignIn}>
      <input type="email" name="email" placeholder="Work email" required />
      <button>Sign in with SSO</button>
    </form>
  )
}
```

### Google Workspace SAML
1. Enable in Clerk Dashboard → SSO Connections → Add Google Workspace
2. Configure domain (e.g., `company.com`)
3. Copy ACS URL + Entity ID from Clerk
4. Add to Google Workspace SAML settings
5. Verify domain ownership

### Azure AD Configuration
- Similar process via Clerk Dashboard
- Support for OIDC and SAML protocols
- Group/role mapping from Azure to Clerk roles

### Pricing Note
Clerk Enterprise plan includes unlimited SSO connections with no per-connection fees.

---

## Implementation Checklist

- [ ] Install Clerk + Hono packages
- [ ] Configure environment variables
- [ ] Define custom roles and permissions (TypeScript types)
- [ ] Implement Hono middleware (`clerkMiddleware`, `requireRole`, `requirePermission`)
- [ ] Create React access control components
- [ ] Setup Organizations for multi-tenancy
- [ ] Implement invitation system UI
- [ ] Configure database RLS for tenant isolation
- [ ] Enable SSO providers (Google Workspace, Azure AD)
- [ ] Test role-based access across frontend/backend
- [ ] Implement audit logging
- [ ] Configure session expiry and security headers
- [ ] Setup rate limiting on auth endpoints

---

## Unresolved Questions

1. **Database choice**: PostgreSQL RLS vs middleware-only tenant isolation?
2. **Permission sync**: Real-time vs polling for permission updates across sessions?
3. **Clerk plan**: Free tier limits (5 MAU) vs Pro ($25/mo, 10k MAU) vs Enterprise (SSO)?
4. **Custom domain**: Required for production SSO?
5. **Migration strategy**: Import existing users or require re-registration?

---

**Sources:**
- Clerk Docs: /clerk/clerk-docs
- Hono Middleware: /llmstxt/hono_dev_llms-full_txt
- Web research on multi-tenant RBAC best practices (2026)
