import type { Comment } from '@/hooks/use-comments'
import { useComments } from '@/hooks/use-comments'
import { Skeleton, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { CommentEditor } from './comment-editor'
import { CommentItem } from './comment-item'

type Props = {
  taskId: string
  currentUserId?: string
}

export function CommentsSection({ taskId, currentUserId }: Props) {
  const { data: comments, isLoading } = useComments(taskId)
  const [editingComment, setEditingComment] = useState<Comment | null>(null)

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
      <Text size="sm" fw={600}>
        Comments ({comments?.length || 0})
      </Text>

      <CommentEditor
        taskId={taskId}
        editingComment={editingComment}
        onCancelEdit={() => setEditingComment(null)}
      />

      <Stack gap="sm">
        {comments?.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            taskId={taskId}
            currentUserId={currentUserId}
            onEdit={setEditingComment}
          />
        ))}
      </Stack>
    </Stack>
  )
}
