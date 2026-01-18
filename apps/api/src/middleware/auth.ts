import { clerkMiddleware, getAuth } from '@hono/clerk-auth'
import { workspaceMembers, workspaces } from '@repo/db/schema'
import type { Role } from '@repo/shared'
import { and, eq } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'
import { UnauthorizedError } from '../lib/errors'
import { getUserByClerkId, syncUser } from '../services/user-sync'
import type { AuthUser, Variables } from '../types/context'

// Wrap Clerk middleware
export const clerkAuth = clerkMiddleware()

// Extract and enrich user context
export const authMiddleware = createMiddleware<{ Variables: Variables }>(
  async (c, next) => {
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

    if (!localUser) {
      throw new UnauthorizedError('User not found')
    }

    // Get workspace and role from organization
    let role: Role = 'guest'
    let workspaceId: string | null = null

    if (auth.orgId) {
      // Find workspace by Clerk org ID
      let [workspace] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.clerkOrgId, auth.orgId))
        .limit(1)

      // Auto-create workspace if it doesn't exist
      if (!workspace) {
        const orgRole = auth.orgRole || 'member'
        const isAdmin = orgRole === 'org:admin' || orgRole === 'admin'

        // Get org details from Clerk
        const clerkOrg = await clerkClient.organizations.getOrganization({
          organizationId: auth.orgId,
        })

        // Create workspace
        const [newWorkspace] = await db
          .insert(workspaces)
          .values({
            name: clerkOrg.name,
            slug: clerkOrg.slug || auth.orgId,
            clerkOrgId: auth.orgId,
            ownerId: localUser.id,
          })
          .returning()

        workspace = newWorkspace

        // Add user as member (super_admin for org admins)
        if (workspace) {
          await db.insert(workspaceMembers).values({
            workspaceId: workspace.id,
            userId: localUser.id,
            role: isAdmin ? 'super_admin' : 'member',
          })
        }
      }

      if (workspace) {
        workspaceId = workspace.id

        // Get member role
        let [membership] = await db
          .select()
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, workspace.id),
              eq(workspaceMembers.userId, localUser.id),
            ),
          )
          .limit(1)

        // Auto-add user to workspace if not a member
        if (!membership) {
          const orgRole = auth.orgRole || 'member'
          const isAdmin = orgRole === 'org:admin' || orgRole === 'admin'

          const [newMembership] = await db
            .insert(workspaceMembers)
            .values({
              workspaceId: workspace.id,
              userId: localUser.id,
              role: isAdmin ? 'super_admin' : 'member',
            })
            .returning()

          membership = newMembership
        }

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
  },
)

// Require authentication
export const requireAuth = createMiddleware<{ Variables: Variables }>(
  async (c, next) => {
    const user = c.var.user

    if (!user) {
      throw new UnauthorizedError('Authentication required')
    }

    await next()
  },
)

// Require active organization/workspace
export const requireWorkspace = createMiddleware<{ Variables: Variables }>(
  async (c, next) => {
    const user = c.var.user

    if (!user) {
      throw new UnauthorizedError('Authentication required')
    }

    if (!user.workspaceId) {
      throw new UnauthorizedError(
        'No active workspace. Please select an organization.',
      )
    }

    await next()
  },
)
