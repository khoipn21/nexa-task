import { useCreateComment, useUpdateComment } from '@/hooks/use-comments'
import { Button, Group, Paper, Textarea } from '@mantine/core'
import { useEffect, useState } from 'react'

type EditingComment = {
  id: string
  content: string
} | null

type Props = {
  taskId: string
  editingComment: EditingComment
  onCancelEdit: () => void
}

export function CommentEditor({ taskId, editingComment, onCancelEdit }: Props) {
  const [content, setContent] = useState('')
  const createComment = useCreateComment(taskId)
  const updateComment = useUpdateComment()

  useEffect(() => {
    if (editingComment) {
      setContent(editingComment.content)
    } else {
      setContent('')
    }
  }, [editingComment])

  const handleSubmit = () => {
    if (!content.trim()) return

    if (editingComment) {
      updateComment.mutate(
        { id: editingComment.id, content },
        {
          onSuccess: () => {
            setContent('')
            onCancelEdit()
          },
        },
      )
    } else {
      createComment.mutate(content, {
        onSuccess: () => {
          setContent('')
        },
      })
    }
  }

  const handleCancel = () => {
    setContent('')
    onCancelEdit()
  }

  return (
    <Paper p="sm" withBorder>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a comment..."
        minRows={2}
        autosize
        mb="sm"
      />
      <Group justify="flex-end" gap="xs">
        {editingComment && (
          <Button variant="subtle" size="xs" onClick={handleCancel}>
            Cancel
          </Button>
        )}
        <Button
          size="xs"
          onClick={handleSubmit}
          loading={createComment.isPending || updateComment.isPending}
          disabled={!content.trim()}
        >
          {editingComment ? 'Update' : 'Comment'}
        </Button>
      </Group>
    </Paper>
  )
}
