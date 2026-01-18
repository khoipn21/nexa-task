import type { Database } from '@repo/db'
import {
  attachments,
  projects,
  taskDependencies,
  taskWatchers,
  tasks,
  users,
  workflowStatuses,
  workspaceMembers,
} from '@repo/db/schema'
import type {
  CreateTaskInput,
  MoveTaskInput,
  TaskFilterInput,
  UpdateTaskInput,
} from '@repo/shared'
import { and, asc, desc, eq, gte, like, lte, sql } from 'drizzle-orm'
import { NotFoundError, ValidationError } from '../lib/errors'
import { deleteFile } from '../lib/storage'
import { computeChanges, logActivity } from './activity'
import {
  type EmailTemplateData,
  type NotificationType,
  createNotificationWithEmail,
} from './notification'
import { emitTaskEvent } from './realtime'

// Helper to notify all watchers of a task (excluding the actor)
async function notifyTaskWatchers(
  db: Database,
  taskId: string,
  actorId: string,
  notificationType: NotificationType,
  title: string,
  message: string,
  emailData: EmailTemplateData,
  entityType: 'task' | 'comment' = 'task',
) {
  // Get all watchers except the actor
  const watchers = await db.query.taskWatchers.findMany({
    where: eq(taskWatchers.taskId, taskId),
    with: { user: true },
  })

  const watchersToNotify = watchers.filter((w) => w.userId !== actorId)

  // Create notifications for each watcher (non-blocking, best effort)
  await Promise.allSettled(
    watchersToNotify.map((w) =>
      createNotificationWithEmail(
        db,
        {
          userId: w.userId,
          type: notificationType,
          title,
          message,
          entityType,
          entityId: taskId,
          data: { taskId },
        },
        emailData,
      ),
    ),
  )
}

export async function getTasksByProject(
  db: Database,
  projectId: string,
  filters: TaskFilterInput,
) {
  const {
    page,
    limit,
    statusId,
    assigneeId,
    priority,
    search,
    dueBefore,
    dueAfter,
  } = filters

  let query = db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .$dynamic()

  if (statusId) {
    query = query.where(eq(tasks.statusId, statusId))
  }
  if (assigneeId) {
    query = query.where(eq(tasks.assigneeId, assigneeId))
  }
  if (priority) {
    query = query.where(eq(tasks.priority, priority))
  }
  if (search) {
    query = query.where(like(tasks.title, `%${search}%`))
  }
  if (dueBefore) {
    query = query.where(lte(tasks.dueDate, new Date(dueBefore)))
  }
  if (dueAfter) {
    query = query.where(gte(tasks.dueDate, new Date(dueAfter)))
  }

  const offset = (page - 1) * limit

  const [taskList, countResult] = await Promise.all([
    query
      .orderBy(asc(tasks.order), desc(tasks.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(eq(tasks.projectId, projectId)),
  ])

  return {
    data: taskList,
    meta: {
      page,
      limit,
      total: countResult[0]?.count ?? 0,
    },
  }
}

export async function getTaskById(db: Database, taskId: string) {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: {
      project: true,
      status: true,
      assignee: true,
      createdBy: true,
      comments: {
        with: { user: true },
        orderBy: (comments, { desc }) => [desc(comments.createdAt)],
        limit: 20,
      },
      attachments: true,
      watchers: {
        with: { user: true },
      },
      dependencies: {
        with: { dependsOn: true },
      },
    },
  })

  if (!task) {
    throw new NotFoundError('Task', taskId)
  }

  return task
}

export async function createTask(
  db: Database,
  projectId: string,
  createdById: string,
  workspaceId: string,
  data: CreateTaskInput,
) {
  // Get default status if not provided
  let statusId = data.statusId
  if (!statusId) {
    const defaultStatus = await db.query.workflowStatuses.findFirst({
      where: and(
        eq(workflowStatuses.projectId, projectId),
        eq(workflowStatuses.isDefault, true),
      ),
    })
    statusId = defaultStatus?.id
  }

  // Get max order in status column - handle case where statusId might still be undefined
  const finalStatusId = statusId ?? ''
  const maxOrderResult = await db
    .select({ maxOrder: sql<number>`COALESCE(MAX(${tasks.order}), -1)` })
    .from(tasks)
    .where(
      and(eq(tasks.projectId, projectId), eq(tasks.statusId, finalStatusId)),
    )

  const order = (maxOrderResult[0]?.maxOrder ?? -1) + 1

  const [task] = await db
    .insert(tasks)
    .values({
      ...data,
      projectId,
      createdById,
      statusId,
      order,
    })
    .returning()

  if (!task) {
    throw new NotFoundError('Task')
  }

  // Log activity
  await logActivity(db, {
    workspaceId,
    entityType: 'task',
    entityId: task.id,
    userId: createdById,
    action: 'created',
    metadata: { title: task.title },
  })

  const result = await getTaskById(db, task.id)

  // Emit real-time event
  await emitTaskEvent({
    type: 'task:created',
    projectId,
    data: result,
    userId: createdById,
  })

  return result
}

export async function updateTask(
  db: Database,
  taskId: string,
  userId: string,
  workspaceId: string,
  data: UpdateTaskInput,
) {
  const existing = await getTaskById(db, taskId)

  const [updated] = await db
    .update(tasks)
    .set({
      ...data,
      updatedAt: new Date(),
      completedAt: data.statusId ? null : existing.completedAt, // Reset on status change
    })
    .where(eq(tasks.id, taskId))
    .returning()

  if (!updated) {
    throw new NotFoundError('Task', taskId)
  }

  // Log changes
  const changes = computeChanges(existing, data, [
    'title',
    'description',
    'priority',
    'assigneeId',
    'dueDate',
  ])
  if (changes) {
    await logActivity(db, {
      workspaceId,
      entityType: 'task',
      entityId: taskId,
      userId,
      action: 'updated',
      changes,
    })
  }

  // Log status change separately
  if (data.statusId && data.statusId !== existing.statusId) {
    await logActivity(db, {
      workspaceId,
      entityType: 'task',
      entityId: taskId,
      userId,
      action: 'status_changed',
      changes: {
        statusId: { old: existing.statusId, new: data.statusId },
      },
    })

    // Notify watchers of status change
    await notifyTaskWatchers(
      db,
      taskId,
      userId,
      'task_status_changed',
      `Task status changed: ${existing.title}`,
      `Status changed from "${existing.status?.name}" to a new status`,
      {
        taskTitle: existing.title,
        projectName: existing.project?.name,
        changeType: 'status',
        oldValue: existing.status?.name,
      },
    )
  }

  // Log assignment change
  if (
    data.assigneeId !== undefined &&
    data.assigneeId !== existing.assigneeId
  ) {
    await logActivity(db, {
      workspaceId,
      entityType: 'task',
      entityId: taskId,
      userId,
      action: 'assigned',
      changes: {
        assigneeId: { old: existing.assigneeId, new: data.assigneeId },
      },
    })

    // Notify new assignee
    if (data.assigneeId && data.assigneeId !== userId) {
      await createNotificationWithEmail(
        db,
        {
          userId: data.assigneeId,
          type: 'task_assigned',
          title: `You were assigned to: ${existing.title}`,
          message: `You have been assigned to task "${existing.title}"`,
          entityType: 'task',
          entityId: taskId,
          data: { taskId },
        },
        {
          taskTitle: existing.title,
          projectName: existing.project?.name,
        },
      )
    }
  }

  // Notify watchers if due date changed
  if (data.dueDate !== undefined && data.dueDate !== existing.dueDate) {
    await notifyTaskWatchers(
      db,
      taskId,
      userId,
      'task_status_changed',
      `Due date changed: ${existing.title}`,
      `Due date updated for task "${existing.title}"`,
      {
        taskTitle: existing.title,
        projectName: existing.project?.name,
        changeType: 'due_date',
        oldValue: existing.dueDate?.toString(),
        newValue: data.dueDate?.toString(),
      },
    )
  }

  const result = await getTaskById(db, taskId)

  // Emit real-time event
  await emitTaskEvent({
    type: 'task:updated',
    projectId: existing.projectId,
    data: { task: result, changes },
    userId,
  })

  return result
}

export async function moveTask(
  db: Database,
  taskId: string,
  userId: string,
  workspaceId: string,
  data: MoveTaskInput,
) {
  const existing = await getTaskById(db, taskId)

  // Update task position
  const [updated] = await db
    .update(tasks)
    .set({
      statusId: data.statusId,
      order: data.order,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId))
    .returning()

  // Log move
  if (data.statusId !== existing.statusId) {
    await logActivity(db, {
      workspaceId,
      entityType: 'task',
      entityId: taskId,
      userId,
      action: 'moved',
      changes: {
        statusId: { old: existing.statusId, new: data.statusId },
        order: { old: existing.order, new: data.order },
      },
    })
  }

  const result = await getTaskById(db, taskId)

  // Emit real-time event
  await emitTaskEvent({
    type: 'task:moved',
    projectId: existing.projectId,
    data: {
      taskId,
      fromStatus: existing.statusId,
      toStatus: data.statusId,
      order: data.order,
      task: result,
    },
    userId,
  })

  return result
}

export async function deleteTask(
  db: Database,
  taskId: string,
  userId: string,
  workspaceId: string,
) {
  const existing = await getTaskById(db, taskId)

  await db.delete(tasks).where(eq(tasks.id, taskId))

  // Log deletion
  await logActivity(db, {
    workspaceId,
    entityType: 'task',
    entityId: taskId,
    userId,
    action: 'deleted',
    metadata: { title: existing.title },
  })

  // Emit real-time event
  await emitTaskEvent({
    type: 'task:deleted',
    projectId: existing.projectId,
    data: { taskId, title: existing.title },
    userId,
  })
}

// Dependencies
export async function getTaskDependencies(db: Database, taskId: string) {
  return db.query.taskDependencies.findMany({
    where: eq(taskDependencies.taskId, taskId),
    with: { dependsOn: true },
  })
}

// Check for cycles using DFS - returns true if adding edge would create cycle
async function wouldCreateCycle(
  db: Database,
  fromTaskId: string,
  toTaskId: string,
): Promise<boolean> {
  // If we're trying to make A depend on B, check if B already depends on A
  // (directly or transitively)
  const visited = new Set<string>()
  const stack = [toTaskId]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue
    if (current === fromTaskId) {
      return true // Found a cycle
    }

    if (visited.has(current)) continue
    visited.add(current)

    // Get all tasks that 'current' depends on
    const deps = await db.query.taskDependencies.findMany({
      where: eq(taskDependencies.taskId, current),
    })

    for (const dep of deps) {
      if (!visited.has(dep.dependsOnId)) {
        stack.push(dep.dependsOnId)
      }
    }
  }

  return false
}

export async function addTaskDependency(
  db: Database,
  taskId: string,
  dependsOnId: string,
) {
  // Prevent self-dependency
  if (taskId === dependsOnId) {
    throw new ValidationError({ dependsOnId: 'Task cannot depend on itself' })
  }

  // Check for circular dependency (including transitive cycles)
  const wouldCycle = await wouldCreateCycle(db, taskId, dependsOnId)
  if (wouldCycle) {
    throw new ValidationError({ dependsOnId: 'Circular dependency detected' })
  }

  const [dep] = await db
    .insert(taskDependencies)
    .values({ taskId, dependsOnId })
    .returning()

  return dep
}

export async function removeTaskDependency(
  db: Database,
  taskId: string,
  dependsOnId: string,
) {
  await db
    .delete(taskDependencies)
    .where(
      and(
        eq(taskDependencies.taskId, taskId),
        eq(taskDependencies.dependsOnId, dependsOnId),
      ),
    )
}

// Watchers
export async function getTaskWatchers(db: Database, taskId: string) {
  return db.query.taskWatchers.findMany({
    where: eq(taskWatchers.taskId, taskId),
    with: { user: true },
  })
}

export async function addTaskWatcher(
  db: Database,
  taskId: string,
  userId: string,
  addedById?: string,
) {
  // Get task with project to find workspace
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { project: true },
  })

  if (!task) {
    throw new NotFoundError('Task', taskId)
  }

  // Validate user is a workspace member
  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, task.project.workspaceId),
      eq(workspaceMembers.userId, userId),
    ),
  })

  if (!member) {
    throw new ValidationError({
      userId: 'User is not a member of this workspace',
    })
  }

  const [watcher] = await db
    .insert(taskWatchers)
    .values({ taskId, userId })
    .onConflictDoNothing()
    .returning()

  // Notify user they were added as watcher (if added by someone else)
  if (watcher && addedById && addedById !== userId) {
    await createNotificationWithEmail(
      db,
      {
        userId,
        type: 'watcher_added',
        title: `You're now watching: ${task.title}`,
        message: `You were added as a watcher to task "${task.title}"`,
        entityType: 'task',
        entityId: taskId,
        data: { taskId },
      },
      {
        taskTitle: task.title,
        projectName: task.project?.name,
      },
    )
  }

  return watcher
}

export async function removeTaskWatcher(
  db: Database,
  taskId: string,
  userId: string,
) {
  await db
    .delete(taskWatchers)
    .where(
      and(eq(taskWatchers.taskId, taskId), eq(taskWatchers.userId, userId)),
    )
}

// Attachments
export async function getTaskAttachments(db: Database, taskId: string) {
  return db.query.attachments.findMany({
    where: eq(attachments.taskId, taskId),
    with: { uploadedBy: true },
  })
}

export async function addAttachment(
  db: Database,
  taskId: string,
  uploadedById: string,
  data: {
    fileName: string
    fileUrl: string
    fileSize: number
    mimeType: string
    storageKey?: string
  },
) {
  const [attachment] = await db
    .insert(attachments)
    .values({
      taskId,
      uploadedById,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      storageKey: data.storageKey,
    })
    .returning()

  return attachment
}

export async function deleteAttachment(db: Database, attachmentId: string) {
  // Get attachment to retrieve storage key
  const attachment = await db.query.attachments.findFirst({
    where: eq(attachments.id, attachmentId),
  })

  if (!attachment) {
    throw new NotFoundError('Attachment', attachmentId)
  }

  // Delete from database
  await db.delete(attachments).where(eq(attachments.id, attachmentId))

  // Delete from S3 if storage key exists (best effort, non-blocking)
  if (attachment.storageKey) {
    deleteFile(attachment.storageKey).catch((err) => {
      console.error('Failed to delete file from S3:', err)
    })
  }
}

// Activity
export async function getTaskActivity(db: Database, taskId: string) {
  return db.query.activityLogs.findMany({
    where: (logs, { eq, and }) =>
      and(eq(logs.entityType, 'task'), eq(logs.entityId, taskId)),
    with: { user: true },
    orderBy: (logs, { desc }) => [desc(logs.createdAt)],
    limit: 50,
  })
}
