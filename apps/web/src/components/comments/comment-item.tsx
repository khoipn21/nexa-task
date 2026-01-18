import type { Comment } from '@/hooks/use-comments'
import { useDeleteComment } from '@/hooks/use-comments'
import { ActionIcon, Avatar, Group, Menu, Paper, Text } from '@mantine/core'
import { IconDots, IconEdit, IconTrash } from '@tabler/icons-react'
import { formatDistanceToNow } from 'date-fns'

type Props = {
  comment: Comment
  taskId: string
  currentUserId?: string
  onEdit: (comment: Comment) => void
}

export function CommentItem({ comment, taskId, currentUserId, onEdit }: Props) {
  const deleteComment = useDeleteComment(taskId)
  const isOwner = currentUserId === comment.user.id

  return (
    <Paper p="sm" withBorder>
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <Avatar src={comment.user.avatarUrl} size="sm" radius="xl">
            {comment.user.name[0]}
          </Avatar>
          <div>
            <Text size="sm" fw={500}>
              {comment.user.name}
            </Text>
            <Text size="xs" c="dimmed">
              {formatDistanceToNow(new Date(comment.createdAt), {
                addSuffix: true,
              })}
            </Text>
          </div>
        </Group>

        {isOwner && (
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" size="sm">
                <IconDots size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconEdit size={14} />}
                onClick={() => onEdit(comment)}
              >
                Edit
              </Menu.Item>
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={14} />}
                onClick={() => deleteComment.mutate(comment.id)}
              >
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>

      <Text size="sm" className="whitespace-pre-wrap">
        {comment.content}
      </Text>
    </Paper>
  )
}
