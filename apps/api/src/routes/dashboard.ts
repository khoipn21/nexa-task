import type { Database } from '@repo/db'
import {
  activityLogs,
  projects,
  tasks,
  workflowStatuses,
  workspaceMembers,
} from '@repo/db/schema'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { getAuthUser, getWorkspaceId } from '../lib/errors'
import { success } from '../lib/response'
import { requireWorkspace } from '../middleware/auth'
import type { Variables } from '../types/context'

const dashboard = new Hono<{ Variables: Variables }>()

// Get dashboard stats
dashboard.get('/dashboard/stats', requireWorkspace, async (c) => {
  const user = getAuthUser(c.var)
  const workspaceId = getWorkspaceId(user)
  const db = c.var.db

  const stats = await getDashboardStats(db, workspaceId)
  return success(c, stats)
})

// Get global activity feed
dashboard.get('/activity', requireWorkspace, async (c) => {
  const user = getAuthUser(c.var)
  const workspaceId = getWorkspaceId(user)
  const db = c.var.db

  const activities = await getRecentActivity(db, workspaceId)
  return success(c, activities)
})

// Get recent tasks
dashboard.get('/tasks/recent', requireWorkspace, async (c) => {
  const user = getAuthUser(c.var)
  const workspaceId = getWorkspaceId(user)
  const db = c.var.db

  const recentTasks = await getRecentTasks(db, workspaceId)
  return success(c, recentTasks)
})

async function getDashboardStats(db: Database, workspaceId: string) {
  // Get all projects in workspace
  const workspaceProjects = await db.query.projects.findMany({
    where: eq(projects.workspaceId, workspaceId),
    columns: { id: true },
  })

  const projectIds = workspaceProjects.map((p) => p.id)

  if (projectIds.length === 0) {
    return { openTasks: 0, completedTasks: 0, projects: 0, members: 0 }
  }

  // Get completed status IDs (statuses marked as final)
  const completedStatuses = await db.query.workflowStatuses.findMany({
    where: and(
      inArray(workflowStatuses.projectId, projectIds),
      eq(workflowStatuses.isFinal, true),
    ),
    columns: { id: true },
  })
  const completedStatusIds = completedStatuses.map((s) => s.id)

  // Count tasks
  const [taskCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed:
        completedStatusIds.length > 0
          ? sql<number>`count(*) FILTER (WHERE ${inArray(tasks.statusId, completedStatusIds)})::int`
          : sql<number>`0`,
    })
    .from(tasks)
    .where(inArray(tasks.projectId, projectIds))

  // Count members
  const [memberCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId))

  return {
    openTasks: (taskCounts?.total ?? 0) - (taskCounts?.completed ?? 0),
    completedTasks: taskCounts?.completed ?? 0,
    projects: projectIds.length,
    members: memberCount?.count ?? 0,
  }
}

async function getRecentActivity(db: Database, workspaceId: string) {
  const logs = await db.query.activityLogs.findMany({
    where: eq(activityLogs.workspaceId, workspaceId),
    with: { user: true },
    orderBy: [desc(activityLogs.createdAt)],
    limit: 20,
  })

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    targetType: log.entityType,
    targetTitle: (log.metadata as { title?: string })?.title ?? log.entityId,
    user: {
      name: log.user?.name ?? 'Unknown',
      avatarUrl: log.user?.avatarUrl,
    },
    createdAt: log.createdAt.toISOString(),
  }))
}

async function getRecentTasks(db: Database, workspaceId: string) {
  // Get projects in workspace
  const workspaceProjects = await db.query.projects.findMany({
    where: eq(projects.workspaceId, workspaceId),
    columns: { id: true },
  })

  const projectIds = workspaceProjects.map((p) => p.id)

  if (projectIds.length === 0) {
    return []
  }

  const recentTasks = await db.query.tasks.findMany({
    where: inArray(tasks.projectId, projectIds),
    orderBy: [desc(tasks.updatedAt), desc(tasks.createdAt)],
    limit: 10,
    with: {
      assignee: true,
      status: true,
    },
  })

  return recentTasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    statusId: task.statusId,
    order: task.order,
    dueDate: task.dueDate?.toISOString(),
    projectId: task.projectId,
    assignee: task.assignee
      ? {
          id: task.assignee.id,
          name: task.assignee.name,
          avatarUrl: task.assignee.avatarUrl,
        }
      : undefined,
  }))
}

export default dashboard
