import type { Database } from '@repo/db'
import { projects, tasks, workflowStatuses } from '@repo/db/schema'
import type {
  CreateProjectInput,
  CreateWorkflowStatusInput,
  UpdateProjectInput,
} from '@repo/shared'
import { and, asc, count, eq, isNotNull, ne, sql } from 'drizzle-orm'
import { NotFoundError } from '../lib/errors'

const DEFAULT_STATUSES = [
  { name: 'To Do', color: '#6b7280', order: 0, isDefault: true },
  { name: 'In Progress', color: '#3b82f6', order: 1 },
  { name: 'Review', color: '#f59e0b', order: 2 },
  { name: 'Done', color: '#10b981', order: 3, isFinal: true },
]

export async function getProjectsByWorkspace(
  db: Database,
  workspaceId: string,
) {
  const projectsList = await db.query.projects.findMany({
    where: and(
      eq(projects.workspaceId, workspaceId),
      ne(projects.status, 'deleted'),
    ),
    with: {
      createdBy: true,
    },
    orderBy: (projects, { desc }) => [desc(projects.createdAt)],
  })

  // Get task counts for all projects
  const taskCounts = await db
    .select({
      projectId: tasks.projectId,
      taskCount: count(tasks.id),
      completedTaskCount: count(tasks.completedAt),
    })
    .from(tasks)
    .where(
      sql`${tasks.projectId} IN (${sql.raw(projectsList.map((p) => `'${p.id}'`).join(',') || "''")})`,
    )
    .groupBy(tasks.projectId)

  const countsMap = new Map(
    taskCounts.map((c) => [
      c.projectId,
      { taskCount: c.taskCount, completedTaskCount: c.completedTaskCount },
    ]),
  )

  return projectsList.map((project) => ({
    ...project,
    taskCount: countsMap.get(project.id)?.taskCount ?? 0,
    completedTaskCount: countsMap.get(project.id)?.completedTaskCount ?? 0,
  }))
}

export async function getProjectById(
  db: Database,
  projectId: string,
  workspaceId: string,
) {
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.workspaceId, workspaceId),
      ne(projects.status, 'deleted'),
    ),
    with: {
      createdBy: true,
      workflowStatuses: {
        orderBy: (statuses, { asc }) => [asc(statuses.order)],
      },
    },
  })

  if (!project) {
    throw new NotFoundError('Project', projectId)
  }

  return project
}

export async function createProject(
  db: Database,
  workspaceId: string,
  createdById: string,
  data: CreateProjectInput,
) {
  // Create project
  const [project] = await db
    .insert(projects)
    .values({
      ...data,
      workspaceId,
      createdById,
    })
    .returning()

  if (!project) {
    throw new NotFoundError('Project')
  }

  // Create default workflow statuses
  await db.insert(workflowStatuses).values(
    DEFAULT_STATUSES.map((status) => ({
      ...status,
      projectId: project.id,
    })),
  )

  // Return with statuses
  return getProjectById(db, project.id, workspaceId)
}

export async function updateProject(
  db: Database,
  projectId: string,
  workspaceId: string,
  data: UpdateProjectInput,
) {
  const [updated] = await db
    .update(projects)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)),
    )
    .returning()

  if (!updated) {
    throw new NotFoundError('Project', projectId)
  }

  return updated
}

export async function deleteProject(
  db: Database,
  projectId: string,
  workspaceId: string,
) {
  // Soft delete
  return updateProject(db, projectId, workspaceId, { status: 'archived' })
}

// Workflow Status Functions
export async function getProjectStatuses(db: Database, projectId: string) {
  return db.query.workflowStatuses.findMany({
    where: eq(workflowStatuses.projectId, projectId),
    orderBy: (statuses, { asc }) => [asc(statuses.order)],
  })
}

export async function createWorkflowStatus(
  db: Database,
  projectId: string,
  data: CreateWorkflowStatusInput,
) {
  // Get max order
  const existing = await db
    .select({ maxOrder: workflowStatuses.order })
    .from(workflowStatuses)
    .where(eq(workflowStatuses.projectId, projectId))
    .orderBy(asc(workflowStatuses.order))

  const maxOrder =
    existing.length > 0 ? Math.max(...existing.map((e) => e.maxOrder)) : -1

  const [status] = await db
    .insert(workflowStatuses)
    .values({
      ...data,
      projectId,
      order: maxOrder + 1,
    })
    .returning()

  return status
}

export async function updateWorkflowStatus(
  db: Database,
  statusId: string,
  projectId: string,
  data: Partial<CreateWorkflowStatusInput>,
) {
  const [updated] = await db
    .update(workflowStatuses)
    .set(data)
    .where(
      and(
        eq(workflowStatuses.id, statusId),
        eq(workflowStatuses.projectId, projectId),
      ),
    )
    .returning()

  if (!updated) {
    throw new NotFoundError('Workflow status', statusId)
  }

  return updated
}

export async function deleteWorkflowStatus(
  db: Database,
  statusId: string,
  projectId: string,
) {
  const result = await db
    .delete(workflowStatuses)
    .where(
      and(
        eq(workflowStatuses.id, statusId),
        eq(workflowStatuses.projectId, projectId),
      ),
    )
    .returning()

  if (result.length === 0) {
    throw new NotFoundError('Workflow status', statusId)
  }

  return result[0]
}

export async function reorderStatuses(
  db: Database,
  projectId: string,
  orderedIds: string[],
) {
  // Update each status with new order
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(workflowStatuses)
        .set({ order: index })
        .where(
          and(
            eq(workflowStatuses.id, id),
            eq(workflowStatuses.projectId, projectId),
          ),
        ),
    ),
  )

  return getProjectStatuses(db, projectId)
}
