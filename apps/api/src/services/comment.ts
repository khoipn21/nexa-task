import type { Database } from '@repo/db'
import { comments } from '@repo/db/schema'
import { desc, eq } from 'drizzle-orm'
import { NotFoundError } from '../lib/errors'
import { logActivity } from './activity'

export async function getCommentsByTask(
  db: Database,
  taskId: string,
  limit = 50,
  offset = 0,
) {
  return db.query.comments.findMany({
    where: eq(comments.taskId, taskId),
    with: { user: true },
    orderBy: [desc(comments.createdAt)],
    limit,
    offset,
  })
}

export async function createComment(
  db: Database,
  taskId: string,
  userId: string,
  workspaceId: string,
  content: string,
) {
  const [comment] = await db
    .insert(comments)
    .values({ taskId, userId, content })
    .returning()

  if (!comment) {
    throw new Error('Failed to create comment')
  }

  // Log activity
  await logActivity(db, {
    workspaceId,
    entityType: 'task',
    entityId: taskId,
    userId,
    action: 'commented',
    metadata: { commentId: comment.id },
  })

  return db.query.comments.findFirst({
    where: eq(comments.id, comment.id),
    with: { user: true },
  })
}

export async function updateComment(
  db: Database,
  commentId: string,
  userId: string,
  content: string,
) {
  const existing = await db.query.comments.findFirst({
    where: eq(comments.id, commentId),
  })

  if (!existing) throw new NotFoundError('Comment', commentId)
  if (existing.userId !== userId) throw new NotFoundError('Comment', commentId) // Hide forbidden

  const [updated] = await db
    .update(comments)
    .set({ content, updatedAt: new Date() })
    .where(eq(comments.id, commentId))
    .returning()

  if (!updated) {
    throw new NotFoundError('Comment', commentId)
  }

  return db.query.comments.findFirst({
    where: eq(comments.id, updated.id),
    with: { user: true },
  })
}

export async function deleteComment(
  db: Database,
  commentId: string,
  userId: string,
) {
  const existing = await db.query.comments.findFirst({
    where: eq(comments.id, commentId),
  })

  if (!existing) throw new NotFoundError('Comment', commentId)
  if (existing.userId !== userId) throw new NotFoundError('Comment', commentId)

  await db.delete(comments).where(eq(comments.id, commentId))
}

export async function getCommentById(db: Database, commentId: string) {
  const comment = await db.query.comments.findFirst({
    where: eq(comments.id, commentId),
    with: { user: true, task: true },
  })

  if (!comment) throw new NotFoundError('Comment', commentId)
  return comment
}
