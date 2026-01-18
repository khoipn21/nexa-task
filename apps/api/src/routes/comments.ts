import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { getAuthUser, getWorkspaceId } from '../lib/errors'
import { created, noContent, success } from '../lib/response'
import { requireWorkspace } from '../middleware/auth'
import * as commentService from '../services/comment'
import { emitTaskEvent } from '../services/realtime'
import type { Variables } from '../types/context'

const commentsRouter = new Hono<{ Variables: Variables }>()

const commentSchema = z.object({
  content: z.string().min(1),
})

// List comments for a task
commentsRouter.get('/tasks/:taskId/comments', requireWorkspace, async (c) => {
  const db = c.var.db
  const taskId = c.req.param('taskId')
  const result = await commentService.getCommentsByTask(db, taskId)
  return success(c, result)
})

// Create comment
commentsRouter.post(
  '/tasks/:taskId/comments',
  requireWorkspace,
  zValidator('json', commentSchema),
  async (c) => {
    const user = getAuthUser(c.var)
    const workspaceId = getWorkspaceId(user)
    const db = c.var.db
    const taskId = c.req.param('taskId')
    const { content } = c.req.valid('json')

    const result = await commentService.createComment(
      db,
      taskId,
      user.id,
      workspaceId,
      content,
    )

    // Get task to find projectId for real-time event
    const task = await db.query.tasks.findFirst({
      where: (tasks, { eq }) => eq(tasks.id, taskId),
    })

    if (task) {
      await emitTaskEvent({
        type: 'task:updated',
        projectId: task.projectId,
        data: { commentAdded: result },
        userId: user.id,
      })
    }

    return created(c, result)
  },
)

// Update comment
commentsRouter.patch(
  '/comments/:id',
  requireWorkspace,
  zValidator('json', commentSchema),
  async (c) => {
    const user = getAuthUser(c.var)
    const db = c.var.db
    const commentId = c.req.param('id')
    const { content } = c.req.valid('json')

    const result = await commentService.updateComment(
      db,
      commentId,
      user.id,
      content,
    )
    return success(c, result)
  },
)

// Delete comment
commentsRouter.delete('/comments/:id', requireWorkspace, async (c) => {
  const user = getAuthUser(c.var)
  const db = c.var.db
  const commentId = c.req.param('id')

  await commentService.deleteComment(db, commentId, user.id)
  return noContent(c)
})

export default commentsRouter
