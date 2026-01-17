import { useMarkNotificationRead, type Notification } from '@/hooks/use-notifications'
import { Box, Group, Text, UnstyledButton } from '@mantine/core'
import {
  IconCheck,
  IconMessage,
  IconUser,
  IconAlertCircle,
  IconClock,
  IconLink,
  IconEye,
} from '@tabler/icons-react'
import { useNavigate } from 'react-router'

interface NotificationItemProps {
  notification: Notification
  onClick?: () => void
}

// Map notification type to icon
function getNotificationIcon(type: string) {
  switch (type) {
    case 'task_assigned':
      return <IconUser size={16} />
    case 'task_status_changed':
      return <IconCheck size={16} />
    case 'task_comment_added':
      return <IconMessage size={16} />
    case 'task_mentioned':
      return <IconAlertCircle size={16} />
    case 'task_due_soon':
      return <IconClock size={16} />
    case 'task_dependency_completed':
      return <IconLink size={16} />
    case 'watcher_added':
      return <IconEye size={16} />
    default:
      return <IconAlertCircle size={16} />
  }
}

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

// Get navigation path from notification
function getNavigationPath(notification: Notification): string | null {
  if (!notification.entityType || !notification.entityId) return null

  switch (notification.entityType) {
    case 'task':
      // Navigate to project with task selected
      const projectId = (notification.data?.projectId as string) || ''
      return projectId ? `/projects/${projectId}?task=${notification.entityId}` : null
    case 'project':
      return `/projects/${notification.entityId}`
    case 'comment':
      // Navigate to task that contains the comment
      const taskProjectId = (notification.data?.projectId as string) || ''
      const taskId = (notification.data?.taskId as string) || ''
      return taskProjectId && taskId
        ? `/projects/${taskProjectId}?task=${taskId}`
        : null
    default:
      return null
  }
}

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const navigate = useNavigate()
  const markRead = useMarkNotificationRead()

  const handleClick = async () => {
    // Mark as read if not already
    if (!notification.isRead) {
      markRead.mutate(notification.id)
    }

    // Navigate to entity
    const path = getNavigationPath(notification)
    if (path) {
      navigate(path)
    }

    onClick?.()
  }

  return (
    <UnstyledButton
      onClick={handleClick}
      style={{
        display: 'block',
        width: '100%',
        padding: 'var(--mantine-spacing-sm)',
        borderRadius: 0,
        backgroundColor: notification.isRead
          ? 'transparent'
          : 'var(--mantine-color-blue-light)',
      }}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <Box
          c={notification.isRead ? 'dimmed' : 'blue'}
          style={{ flexShrink: 0, marginTop: 2 }}
        >
          {getNotificationIcon(notification.type)}
        </Box>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" lineClamp={2}>
            {notification.message}
          </Text>
          <Text size="xs" c="dimmed">
            {formatRelativeTime(notification.createdAt)}
          </Text>
        </Box>
        {!notification.isRead && (
          <Box
            w={8}
            h={8}
            style={{
              borderRadius: '50%',
              backgroundColor: 'var(--mantine-color-blue-filled)',
              flexShrink: 0,
              marginTop: 6,
            }}
          />
        )}
      </Group>
    </UnstyledButton>
  )
}
