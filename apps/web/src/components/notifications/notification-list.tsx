import type { Notification } from '@/hooks/use-notifications'
import { Center, Divider, Loader, Stack, Text } from '@mantine/core'
import { IconBellOff } from '@tabler/icons-react'
import { NotificationItem } from './notification-item'

interface NotificationListProps {
  notifications: Notification[]
  isLoading?: boolean
  onNotificationClick?: () => void
}

export function NotificationList({
  notifications,
  isLoading,
  onNotificationClick,
}: NotificationListProps) {
  if (isLoading) {
    return (
      <Center py="xl">
        <Loader size="sm" />
      </Center>
    )
  }

  if (notifications.length === 0) {
    return (
      <Center py="xl">
        <Stack align="center" gap="xs">
          <IconBellOff size={32} color="var(--mantine-color-dimmed)" />
          <Text size="sm" c="dimmed">
            No notifications yet
          </Text>
        </Stack>
      </Center>
    )
  }

  return (
    <Stack gap={0}>
      {notifications.map((notification, index) => (
        <div key={notification.id}>
          <NotificationItem
            notification={notification}
            onClick={onNotificationClick}
          />
          {index < notifications.length - 1 && <Divider />}
        </div>
      ))}
    </Stack>
  )
}
