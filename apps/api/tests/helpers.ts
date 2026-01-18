import {
  invitations,
  projects,
  users,
  workflowStatuses,
  workspaceMembers,
  workspaces,
} from '@repo/db/schema'
import { testDb } from './setup'

export async function createTestUser(overrides = {}) {
  const result = await testDb
    .insert(users)
    .values({
      clerkId: `clerk_${Math.random().toString(36).slice(2)}`,
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      ...overrides,
    })
    .returning()
  const user = result[0]
  if (!user) throw new Error('Failed to create test user')
  return user
}

export async function createTestWorkspace(ownerId: string, overrides = {}) {
  const result = await testDb
    .insert(workspaces)
    .values({
      clerkOrgId: `org_${Math.random().toString(36).slice(2)}`,
      name: 'Test Workspace',
      slug: `test-${Date.now()}`,
      ownerId,
      ...overrides,
    })
    .returning()
  const workspace = result[0]
  if (!workspace) throw new Error('Failed to create test workspace')

  // Add owner as super_admin member
  await testDb.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId: ownerId,
    role: 'super_admin',
  })

  return workspace
}

export async function createTestProject(
  workspaceId: string,
  createdById: string,
  overrides = {},
) {
  const projectResult = await testDb
    .insert(projects)
    .values({
      workspaceId,
      createdById,
      name: 'Test Project',
      ...overrides,
    })
    .returning()
  const project = projectResult[0]
  if (!project) throw new Error('Failed to create test project')

  // Create default workflow statuses
  const statuses = await testDb
    .insert(workflowStatuses)
    .values([
      {
        projectId: project.id,
        name: 'To Do',
        color: '#6b7280',
        order: 0,
        isDefault: true,
      },
      {
        projectId: project.id,
        name: 'In Progress',
        color: '#3b82f6',
        order: 1,
      },
      {
        projectId: project.id,
        name: 'Done',
        color: '#10b981',
        order: 2,
        isFinal: true,
      },
    ])
    .returning()

  return { project, statuses }
}

export function mockAuthContext(
  user: { id: string; clerkId: string; email: string; name: string | null },
  workspace: { id: string; clerkOrgId: string },
) {
  return {
    user: {
      id: user.id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      role: 'super_admin' as const,
      orgId: workspace.clerkOrgId,
      workspaceId: workspace.id,
    },
    db: testDb,
    requestId: 'test-request',
  }
}

export async function addWorkspaceMember(
  workspaceId: string,
  userId: string,
  role: 'super_admin' | 'admin' | 'member' | 'guest' = 'member',
) {
  await testDb.insert(workspaceMembers).values({
    workspaceId,
    userId,
    role,
  })
}

export async function createTestInvitation(
  workspaceId: string,
  inviterId: string,
  overrides: {
    inviteeEmail?: string
    role?: 'super_admin' | 'pm' | 'member' | 'guest'
    status?: 'pending' | 'accepted' | 'expired' | 'cancelled'
    expiresAt?: Date
    clerkInvitationId?: string | null
  } = {},
) {
  const expiresAt =
    overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const result = await testDb
    .insert(invitations)
    .values({
      workspaceId,
      inviterId,
      inviteeEmail:
        overrides.inviteeEmail ?? `invite-${Date.now()}@example.com`,
      invitationToken: `token_${Math.random().toString(36).slice(2)}`,
      role: overrides.role ?? 'member',
      status: overrides.status ?? 'pending',
      expiresAt,
      clerkInvitationId:
        overrides.clerkInvitationId ??
        `oi_${Math.random().toString(36).slice(2)}`,
    })
    .returning()
  const invitation = result[0]
  if (!invitation) throw new Error('Failed to create test invitation')
  return invitation
}
