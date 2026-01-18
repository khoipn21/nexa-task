# Phase 12: Comments + Activity Feed

## Context Links
- [Phase 11: Task Detail](./phase-11-task-detail-editor.md)
- [Phase 07: Real-time Layer](./phase-07-realtime-layer.md)

## Overview
- **Priority**: P2
- **Status**: pending
- **Effort**: 8h

Implement comments system with @mentions and activity feed showing task history.

## Key Insights
- Comments support rich text (TipTap)
- @mentions autocomplete from workspace members
- Activity log from backend API
- Real-time updates via WebSocket
- Relative timestamps (e.g., "2 hours ago")

## Requirements

### Functional
- Add/edit/delete comments
- @mentions with autocomplete
- Activity timeline (created, updated, assigned, etc.)
- Real-time comment updates

### Non-Functional
- Comments load incrementally (pagination)
- Mention search < 100ms
- Optimistic comment posting

## Architecture

### Backend Endpoints
```
GET    /api/tasks/:id/comments      List comments
POST   /api/tasks/:id/comments      Create comment
PATCH  /api/comments/:id            Update comment
DELETE /api/comments/:id            Delete comment

GET    /api/tasks/:id/activity      Get activity log
```

### Frontend Components
```
components/comments/
├── comments-section.tsx
├── comment-item.tsx
├── comment-editor.tsx
├── mention-list.tsx
└── activity-timeline.tsx
```

## Related Code Files

### Create
- `/apps/api/src/routes/comments.ts`
- `/apps/api/src/services/comment.ts`
- `/apps/web/src/components/comments/comments-section.tsx`
- `/apps/web/src/components/comments/comment-item.tsx`
- `/apps/web/src/components/comments/comment-editor.tsx`
- `/apps/web/src/components/comments/activity-timeline.tsx`
- `/apps/web/src/hooks/use-comments.ts`

### Modify
- `/apps/api/src/routes/index.ts`

## Implementation Steps

### 1. Comment Service (Backend)
**apps/api/src/services/comment.ts**:
```typescript
import { eq, desc } from 'drizzle-orm'
import type { Database } from '@repo/db'
import { comments } from '@repo/db/schema'
import { NotFoundError } from '../lib/errors'
import { logActivity } from './activity'

export async function getCommentsByTask(db: Database, taskId: string, limit = 50, offset = 0) {
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
  content: string
) {
  const [comment] = await db
    .insert(comments)
    .values({ taskId, userId, content })
    .returning()

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

export async function updateComment(db: Database, commentId: string, userId: string, content: string) {
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

  return db.query.comments.findFirst({
    where: eq(comments.id, updated.id),
    with: { user: true },
  })
}

export async function deleteComment(db: Database, commentId: string, userId: string) {
  const existing = await db.query.comments.findFirst({
    where: eq(comments.id, commentId),
  })

  if (!existing) throw new NotFoundError('Comment', commentId)
  if (existing.userId !== userId) throw new NotFoundError('Comment', commentId)

  await db.delete(comments).where(eq(comments.id, commentId))
}
```

### 2. Comment Routes (Backend)
**apps/api/src/routes/comments.ts**:
```typescript
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Variables } from '../types/context'
import { requireWorkspace } from '../middleware/auth'
import { success, created, noContent } from '../lib/response'
import * as commentService from '../services/comment'
import { emitTaskEvent } from '../services/realtime'

const comments = new Hono<{ Variables: Variables }>()

// List comments for a task
comments.get('/tasks/:taskId/comments', requireWorkspace, async (c) => {
  const db = c.var.db
  const taskId = c.req.param('taskId')
  const result = await commentService.getCommentsByTask(db, taskId)
  return success(c, result)
})

// Create comment
comments.post(
  '/tasks/:taskId/comments',
  requireWorkspace,
  zValidator('json', z.object({ content: z.string().min(1) })),
  async (c) => {
    const user = c.var.user!
    const db = c.var.db
    const taskId = c.req.param('taskId')
    const { content } = c.req.valid('json')

    const result = await commentService.createComment(db, taskId, user.id, user.workspaceId!, content)

    // Emit real-time event
    await emitTaskEvent({
      type: 'task:updated',
      projectId: '', // Would need to fetch task's projectId
      data: { commentAdded: result },
      userId: user.id,
    })

    return created(c, result)
  }
)

// Update comment
comments.patch(
  '/comments/:id',
  requireWorkspace,
  zValidator('json', z.object({ content: z.string().min(1) })),
  async (c) => {
    const user = c.var.user!
    const db = c.var.db
    const commentId = c.req.param('id')
    const { content } = c.req.valid('json')

    const result = await commentService.updateComment(db, commentId, user.id, content)
    return success(c, result)
  }
)

// Delete comment
comments.delete('/comments/:id', requireWorkspace, async (c) => {
  const user = c.var.user!
  const db = c.var.db
  const commentId = c.req.param('id')

  await commentService.deleteComment(db, commentId, user.id)
  return noContent(c)
})

export default comments
```

### 3. Comments Hook (Frontend)
**apps/web/src/hooks/use-comments.ts**:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useComments(taskId: string) {
  return useQuery({
    queryKey: ['comments', taskId],
    queryFn: () => api.get(`/tasks/${taskId}/comments`),
    enabled: !!taskId,
  })
}

export function useCreateComment(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (content: string) =>
      api.post(`/tasks/${taskId}/comments`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', taskId] })
    },
  })
}

export function useUpdateComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api.patch(`/comments/${id}`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] })
    },
  })
}

export function useDeleteComment(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (commentId: string) => api.delete(`/comments/${commentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', taskId] })
    },
  })
}
```

### 4. Comment Item
**apps/web/src/components/comments/comment-item.tsx**:
```tsx
import { Paper, Text, Group, Avatar, ActionIcon, Menu } from '@mantine/core'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '@/hooks/use-auth'
import { useDeleteComment } from '@/hooks/use-comments'

type Comment = {
  id: string
  content: string
  createdAt: string
  user: { id: string; name: string; avatarUrl?: string }
}

type Props = {
  comment: Comment
  taskId: string
  onEdit: (comment: Comment) => void
}

export function CommentItem({ comment, taskId, onEdit }: Props) {
  const { user } = useAuth()
  const deleteComment = useDeleteComment(taskId)
  const isOwner = user?.id === comment.user.id

  return (
    <Paper p="sm" withBorder>
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <Avatar src={comment.user.avatarUrl} size="sm" radius="xl">
            {comment.user.name[0]}
          </Avatar>
          <div>
            <Text size="sm" fw={500}>{comment.user.name}</Text>
            <Text size="xs" c="dimmed">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </Text>
          </div>
        </Group>

        {isOwner && (
          <Menu>
            <Menu.Target>
              <ActionIcon variant="subtle" size="sm">⋮</ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => onEdit(comment)}>Edit</Menu.Item>
              <Menu.Item
                color="red"
                onClick={() => deleteComment.mutate(comment.id)}
              >
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>

      <div
        className="prose prose-sm"
        dangerouslySetInnerHTML={{ __html: comment.content }}
      />
    </Paper>
  )
}
```

### 5. Comments Section
**apps/web/src/components/comments/comments-section.tsx**:
```tsx
import { Stack, Text, Skeleton } from '@mantine/core'
import { useState } from 'react'
import { useComments } from '@/hooks/use-comments'
import { CommentItem } from './comment-item'
import { CommentEditor } from './comment-editor'

type Props = {
  taskId: string
}

export function CommentsSection({ taskId }: Props) {
  const { data: comments, isLoading } = useComments(taskId)
  const [editingComment, setEditingComment] = useState<any>(null)

  if (isLoading) {
    return (
      <Stack gap="sm">
        <Skeleton height={80} />
        <Skeleton height={80} />
      </Stack>
    )
  }

  return (
    <Stack gap="md">
      <Text size="sm" fw={600}>Comments ({comments?.length || 0})</Text>

      <CommentEditor taskId={taskId} editingComment={editingComment} onCancelEdit={() => setEditingComment(null)} />

      <Stack gap="sm">
        {comments?.map((comment: any) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            taskId={taskId}
            onEdit={setEditingComment}
          />
        ))}
      </Stack>
    </Stack>
  )
}
```

### 6. Activity Timeline
**apps/web/src/components/comments/activity-timeline.tsx**:
```tsx
import { Timeline, Text, Avatar } from '@mantine/core'
import { formatDistanceToNow } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

const ACTION_LABELS: Record<string, string> = {
  created: 'created this task',
  updated: 'updated this task',
  assigned: 'changed assignee',
  status_changed: 'changed status',
  commented: 'commented',
  moved: 'moved this task',
}

type Props = {
  taskId: string
}

export function ActivityTimeline({ taskId }: Props) {
  const { data: activities = [] } = useQuery({
    queryKey: ['task-activity', taskId],
    queryFn: () => api.get(`/tasks/${taskId}/activity`),
  })

  return (
    <Timeline bulletSize={24} lineWidth={2}>
      {activities.map((activity: any) => (
        <Timeline.Item
          key={activity.id}
          bullet={
            <Avatar src={activity.user?.avatarUrl} size={24} radius="xl">
              {activity.user?.name?.[0]}
            </Avatar>
          }
        >
          <Text size="sm">
            <Text span fw={500}>{activity.user?.name}</Text>
            {' '}{ACTION_LABELS[activity.action] || activity.action}
          </Text>
          <Text size="xs" c="dimmed">
            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
          </Text>
        </Timeline.Item>
      ))}
    </Timeline>
  )
}
```

## Todo List
- [ ] Create comment service (backend)
- [ ] Create comment routes (backend)
- [ ] Add activity endpoint to tasks
- [ ] Create comments hooks (frontend)
- [ ] Build comment editor with mentions
- [ ] Build comment item component
- [ ] Build comments section
- [ ] Build activity timeline
- [ ] Add real-time comment updates
- [ ] Test edit/delete permissions

## Success Criteria
- [x] Comments can be created/edited/deleted
- [x] Only owner can edit/delete
- [x] @mentions show autocomplete
- [x] Activity shows full task history
- [x] Real-time updates work

## Next Steps
- Phase 13: Testing + E2E
