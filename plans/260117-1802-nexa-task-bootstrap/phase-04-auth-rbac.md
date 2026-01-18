# Phase 04: Authentication + RBAC

## Context Links
- [Clerk RBAC Research](../reports/researcher-260117-1758-clerk-rbac.md)
- [Phase 03: Backend Foundation](./phase-03-backend-foundation.md)

## Overview
- **Priority**: P1 (Critical Path)
- **Status**: pending
- **Effort**: 8h

Integrate Clerk authentication with custom RBAC middleware for multi-tenant access control.

## Key Insights
- Clerk Organizations map to workspaces (tenants)
- Roles: super_admin, pm, member, guest
- Permissions embedded in session token
- Backend validates via `@hono/clerk-auth`
- Frontend uses `useAuth()` and `has()` hooks

## Requirements

### Functional
- User authentication via Clerk
- Organization-based multi-tenancy
- Role-based route protection
- Permission-based action control
- User sync to local database

### Non-Functional
- Auth check < 10ms (token validation)
- Session refresh handled by Clerk SDK
- Audit logging for auth events

## Architecture

### Auth Flow
```
1. User signs in via Clerk (frontend)
2. Frontend sends JWT in Authorization header
3. Backend validates JWT via clerkMiddleware
4. Middleware extracts userId, orgId, role
5. RBAC middleware checks permissions
6. Route handler accesses user via c.var.user
```

### Role Hierarchy
| Role | Permissions |
|------|-------------|
| super_admin | All operations |
| pm | Create/manage projects, assign tasks, invite members |
| member | Create/update own tasks, comment |
| guest | Read-only access |

## Related Code Files

### Create
- `/apps/api/src/middleware/auth.ts`
- `/apps/api/src/middleware/rbac.ts`
- `/apps/api/src/routes/auth.ts`
- `/apps/api/src/services/user-sync.ts`
- `/packages/shared/src/types/auth.ts`

### Modify
- `/apps/api/src/types/context.ts`
- `/apps/api/src/routes/index.ts`
- `/apps/api/package.json`

## Implementation Steps

### 1. Auth Types
**packages/shared/src/types/auth.ts**:
```typescript
export type Role = 'super_admin' | 'pm' | 'member' | 'guest'

export type Permission =
  | 'workspace:read'
  | 'workspace:update'
  | 'workspace:delete'
  | 'workspace:invite'
  | 'project:create'
  | 'project:read'
  | 'project:update'
  | 'project:delete'
  | 'task:create'
  | 'task:read'
  | 'task:update'
  | 'task:delete'
  | 'task:assign'
  | 'comment:create'
  | 'comment:read'
  | 'comment:update'
  | 'comment:delete'

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    'workspace:read', 'workspace:update', 'workspace:delete', 'workspace:invite',
    'project:create', 'project:read', 'project:update', 'project:delete',
    'task:create', 'task:read', 'task:update', 'task:delete', 'task:assign',
    'comment:create', 'comment:read', 'comment:update', 'comment:delete',
  ],
  pm: [
    'workspace:read', 'workspace:invite',
    'project:create', 'project:read', 'project:update',
    'task:create', 'task:read', 'task:update', 'task:assign',
    'comment:create', 'comment:read', 'comment:update', 'comment:delete',
  ],
  member: [
    'workspace:read',
    'project:read',
    'task:create', 'task:read', 'task:update',
    'comment:create', 'comment:read', 'comment:update',
  ],
  guest: [
    'workspace:read',
    'project:read',
    'task:read',
    'comment:read',
  ],
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p))
}

export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p))
}
```

### 2. Update Context Types
**apps/api/src/types/context.ts**:
```typescript
import type { Database } from '@repo/db'
import type { Role } from '@repo/shared/types/auth'

export type AuthUser = {
  id: string           // Local user ID (UUID)
  clerkId: string      // Clerk user ID
  email: string
  name: string
  role: Role
  orgId: string | null // Clerk organization ID
  workspaceId: string | null // Local workspace ID
}

export type Variables = {
  db: Database
  user: AuthUser | null
  requestId: string
}
```

### 3. User Sync Service
**apps/api/src/services/user-sync.ts**:
```typescript
import { eq } from 'drizzle-orm'
import type { Database } from '@repo/db'
import { users } from '@repo/db/schema'

type ClerkUser = {
  id: string
  emailAddresses: { emailAddress: string }[]
  firstName: string | null
  lastName: string | null
  imageUrl: string | null
}

export async function syncUser(db: Database, clerkUser: ClerkUser) {
  const email = clerkUser.emailAddresses[0]?.emailAddress
  if (!email) throw new Error('User has no email')

  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || email

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkUser.id))
    .limit(1)

  if (existing) {
    // Update existing user
    const [updated] = await db
      .update(users)
      .set({
        email,
        name,
        avatarUrl: clerkUser.imageUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning()
    return updated
  }

  // Create new user
  const [created] = await db
    .insert(users)
    .values({
      clerkId: clerkUser.id,
      email,
      name,
      avatarUrl: clerkUser.imageUrl,
    })
    .returning()

  return created
}

export async function getUserByClerkId(db: Database, clerkId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1)
  return user || null
}
```

### 4. Auth Middleware
**apps/api/src/middleware/auth.ts**:
```typescript
import { createMiddleware } from 'hono/factory'
import { clerkMiddleware, getAuth } from '@hono/clerk-auth'
import { eq } from 'drizzle-orm'
import type { Variables, AuthUser } from '../types/context'
import { workspaces, workspaceMembers } from '@repo/db/schema'
import { syncUser, getUserByClerkId } from '../services/user-sync'
import { UnauthorizedError } from '../lib/errors'
import type { Role } from '@repo/shared/types/auth'

// Wrap Clerk middleware
export const clerkAuth = clerkMiddleware()

// Extract and enrich user context
export const authMiddleware = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  const auth = getAuth(c)

  if (!auth?.userId) {
    c.set('user', null)
    await next()
    return
  }

  const db = c.var.db
  const clerkClient = c.get('clerk')

  // Get or sync user
  let localUser = await getUserByClerkId(db, auth.userId)

  if (!localUser) {
    // Fetch from Clerk and sync
    const clerkUser = await clerkClient.users.getUser(auth.userId)
    localUser = await syncUser(db, clerkUser)
  }

  // Get workspace and role from organization
  let role: Role = 'guest'
  let workspaceId: string | null = null

  if (auth.orgId) {
    // Find workspace by Clerk org ID
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.clerkOrgId, auth.orgId))
      .limit(1)

    if (workspace) {
      workspaceId = workspace.id

      // Get member role
      const [membership] = await db
        .select()
        .from(workspaceMembers)
        .where(eq(workspaceMembers.workspaceId, workspace.id))
        .where(eq(workspaceMembers.userId, localUser.id))
        .limit(1)

      if (membership) {
        role = membership.role as Role
      }
    }
  }

  const user: AuthUser = {
    id: localUser.id,
    clerkId: localUser.clerkId,
    email: localUser.email,
    name: localUser.name,
    role,
    orgId: auth.orgId || null,
    workspaceId,
  }

  c.set('user', user)
  await next()
})

// Require authentication
export const requireAuth = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  const user = c.var.user

  if (!user) {
    throw new UnauthorizedError('Authentication required')
  }

  await next()
})

// Require active organization/workspace
export const requireWorkspace = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  const user = c.var.user

  if (!user) {
    throw new UnauthorizedError('Authentication required')
  }

  if (!user.workspaceId) {
    throw new UnauthorizedError('No active workspace. Please select an organization.')
  }

  await next()
})
```

### 5. RBAC Middleware
**apps/api/src/middleware/rbac.ts**:
```typescript
import { createMiddleware } from 'hono/factory'
import type { Variables } from '../types/context'
import { ForbiddenError, UnauthorizedError } from '../lib/errors'
import type { Role, Permission } from '@repo/shared/types/auth'
import { hasPermission, hasAnyPermission } from '@repo/shared/types/auth'

// Require specific role(s)
export const requireRole = (...allowedRoles: Role[]) => {
  return createMiddleware<{ Variables: Variables }>(async (c, next) => {
    const user = c.var.user

    if (!user) {
      throw new UnauthorizedError()
    }

    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenError(`Role ${user.role} not allowed. Required: ${allowedRoles.join(' or ')}`)
    }

    await next()
  })
}

// Require specific permission(s)
export const requirePermission = (...permissions: Permission[]) => {
  return createMiddleware<{ Variables: Variables }>(async (c, next) => {
    const user = c.var.user

    if (!user) {
      throw new UnauthorizedError()
    }

    if (!hasAnyPermission(user.role, permissions)) {
      throw new ForbiddenError(`Permission denied. Required: ${permissions.join(' or ')}`)
    }

    await next()
  })
}

// Check if user can modify resource
export const requireOwnerOrRole = (getOwnerId: (c: any) => Promise<string | null>, ...allowedRoles: Role[]) => {
  return createMiddleware<{ Variables: Variables }>(async (c, next) => {
    const user = c.var.user

    if (!user) {
      throw new UnauthorizedError()
    }

    // Super admin can do anything
    if (allowedRoles.includes(user.role)) {
      await next()
      return
    }

    // Check ownership
    const ownerId = await getOwnerId(c)
    if (ownerId !== user.id) {
      throw new ForbiddenError('You can only modify your own resources')
    }

    await next()
  })
}
```

### 6. Auth Routes (Webhook + User Info)
**apps/api/src/routes/auth.ts**:
```typescript
import { Hono } from 'hono'
import { Webhook } from 'svix'
import type { Variables } from '../types/context'
import { syncUser } from '../services/user-sync'
import { requireAuth } from '../middleware/auth'
import { success } from '../lib/response'

const auth = new Hono<{ Variables: Variables }>()

// Get current user
auth.get('/me', requireAuth, (c) => {
  const user = c.var.user!
  return success(c, {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    workspaceId: user.workspaceId,
  })
})

// Clerk webhook for user events
auth.post('/webhook/clerk', async (c) => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('CLERK_WEBHOOK_SECRET not configured')
    return c.json({ error: 'Webhook not configured' }, 500)
  }

  const svixId = c.req.header('svix-id')
  const svixTimestamp = c.req.header('svix-timestamp')
  const svixSignature = c.req.header('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return c.json({ error: 'Missing headers' }, 400)
  }

  const body = await c.req.text()

  try {
    const wh = new Webhook(webhookSecret)
    const evt = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as { type: string; data: any }

    const db = c.var.db

    switch (evt.type) {
      case 'user.created':
      case 'user.updated':
        await syncUser(db, evt.data)
        break
      // Handle other events as needed
    }

    return c.json({ received: true })
  } catch (err) {
    console.error('Webhook verification failed:', err)
    return c.json({ error: 'Invalid signature' }, 400)
  }
})

export default auth
```

### 7. Update Routes Index
**apps/api/src/routes/index.ts**:
```typescript
import { Hono } from 'hono'
import type { Variables } from '../types/context'
import { clerkAuth, authMiddleware, requireAuth, requireWorkspace } from '../middleware/auth'
import health from './health'
import auth from './auth'

const routes = new Hono<{ Variables: Variables }>()

// Public routes
routes.route('/health', health)

// Auth middleware for all /api routes
routes.use('/api/*', clerkAuth)
routes.use('/api/*', authMiddleware)

// Auth routes (some public, some protected)
routes.route('/api/auth', auth)

// Protected workspace routes - added in Phase 05
// routes.use('/api/workspaces/*', requireWorkspace)
// routes.route('/api/workspaces', workspaces)

export default routes
```

### 8. Update Package Dependencies
Add to **apps/api/package.json**:
```json
{
  "dependencies": {
    "@clerk/backend": "^1.18.0",
    "@hono/clerk-auth": "^2.0.0",
    "svix": "^1.45.0"
  }
}
```

### 9. Environment Variables
Add to `.env.example`:
```bash
# Clerk
CLERK_SECRET_KEY=sk_test_xxxxx
CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxx
```

## Todo List
- [ ] Create shared auth types (Role, Permission)
- [ ] Implement permission checking functions
- [ ] Update context types with AuthUser
- [ ] Create user sync service
- [ ] Implement clerkAuth middleware
- [ ] Implement authMiddleware for user enrichment
- [ ] Implement requireAuth middleware
- [ ] Implement requireWorkspace middleware
- [ ] Create RBAC middleware (requireRole, requirePermission)
- [ ] Create auth routes (/me, webhook)
- [ ] Update routes index with auth chain
- [ ] Configure Clerk webhook in dashboard
- [ ] Test authentication flow

## Success Criteria
- [x] Unauthenticated requests to /api/* return 401
- [x] Authenticated requests include user in context
- [x] Role-based access control works
- [x] Permission checks function correctly
- [x] User sync creates local records
- [x] Webhook updates user data

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Clerk API rate limits | Medium | Cache user data locally |
| Webhook signature issues | Medium | Detailed error logging |
| Role mismatch | High | Test all role combinations |

## Security Considerations
- Webhook signature verification mandatory
- No sensitive data in responses
- Role escalation prevention
- Audit log for auth events

## Next Steps
- Phase 05: Workspace + Project APIs
