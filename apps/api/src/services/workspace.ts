import type { Database } from '@repo/db'
import { workspaceMembers, workspaces } from '@repo/db/schema'
import type { UpdateWorkspaceInput } from '@repo/shared'
import { and, eq } from 'drizzle-orm'
import { ConflictError, NotFoundError } from '../lib/errors'

export async function getWorkspacesByUserId(db: Database, userId: string) {
  const memberships = await db.query.workspaceMembers.findMany({
    where: eq(workspaceMembers.userId, userId),
    with: {
      workspace: true,
    },
  })
  return memberships.map((m) => ({
    ...m.workspace,
    role: m.role,
  }))
}

export async function getWorkspaceById(
  db: Database,
  workspaceId: string,
  userId: string,
) {
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
    with: {
      owner: true,
      members: {
        with: { user: true },
      },
      projects: {
        where: (projects, { ne }) => ne(projects.status, 'deleted'),
      },
    },
  })

  if (!workspace) {
    throw new NotFoundError('Workspace', workspaceId)
  }

  // Verify membership
  const isMember = workspace.members.some((m) => m.userId === userId)
  if (!isMember) {
    throw new NotFoundError('Workspace', workspaceId)
  }

  return workspace
}

export async function updateWorkspace(
  db: Database,
  workspaceId: string,
  data: UpdateWorkspaceInput,
) {
  const [updated] = await db
    .update(workspaces)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspaceId))
    .returning()

  if (!updated) {
    throw new NotFoundError('Workspace', workspaceId)
  }

  return updated
}

export async function getWorkspaceMembers(db: Database, workspaceId: string) {
  return db.query.workspaceMembers.findMany({
    where: eq(workspaceMembers.workspaceId, workspaceId),
    with: { user: true },
  })
}

export async function addWorkspaceMember(
  db: Database,
  workspaceId: string,
  userId: string,
  role: 'super_admin' | 'pm' | 'member' | 'guest',
) {
  // Check if already member
  const existing = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId),
    ),
  })

  if (existing) {
    throw new ConflictError('User is already a member of this workspace')
  }

  const [member] = await db
    .insert(workspaceMembers)
    .values({
      workspaceId,
      userId,
      role,
    })
    .returning()

  return member
}

export async function removeWorkspaceMember(
  db: Database,
  workspaceId: string,
  userId: string,
) {
  const result = await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    )
    .returning()

  if (result.length === 0) {
    throw new NotFoundError('Member')
  }

  return result[0]
}
