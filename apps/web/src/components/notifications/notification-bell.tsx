import {
  useMarkAllNotificationsRead,
  useNotificationsWithRealtime,
} from '@/hooks/use-notifications'
import {
  ActionIcon,
  Button,
  Group,
  Indicator,
  Popover,
  ScrollArea,
  Stack,
  Text,
} from '@mantine/core'
import { IconBell } from '@tabler/icons-react'
import { useState } from 'react'
import { NotificationList } from './notification-list'

export function NotificationBell() {
  const [opened, setOpened] = useState(false)
  const { data, isLoading, isConnected } = useNotificationsWithRealtime({
    limit: 10,
  })
  const markAllRead = useMarkAllNotificationsRead()

  const unreadCount = data?.unreadCount ?? 0
  const hasUnread = unreadCount > 0

  const handleMarkAllRead = () => {
    markAllRead.mutate()
  }

  return (
    <Popover
      width={360}
      position="bottom-end"
      withArrow
      shadow="md"
      opened={opened}
      onChange={setOpened}
    >
      <Popover.Target>
        <Indicator
          color="red"
          size={16}
          label={unreadCount > 99 ? '99+' : unreadCount}
          disabled={!hasUnread}
          processing={isLoading}
        >
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={() => setOpened((o) => !o)}
            aria-label={`Notifications${hasUnread ? ` (${unreadCount} unread)` : ''}`}
          >
            <IconBell size={20} />
          </ActionIcon>
        </Indicator>
      </Popover.Target>

      <Popover.Dropdown p={0}>
        <Stack gap={0}>
          <Group justify="space-between" p="sm" pb="xs">
            <Group gap="xs">
              <Text fw={600} size="sm">
                Notifications
              </Text>
              {!isConnected && (
                <Text size="xs" c="dimmed">
                  (offline)
                </Text>
              )}
            </Group>
            {hasUnread && (
              <Button
                variant="subtle"
                size="xs"
                onClick={handleMarkAllRead}
                loading={markAllRead.isPending}
              >
                Mark all read
              </Button>
            )}
          </Group>

          <ScrollArea.Autosize mah={400}>
            <NotificationList
              notifications={data?.items ?? []}
              isLoading={isLoading}
              onNotificationClick={() => setOpened(false)}
            />
          </ScrollArea.Autosize>

          {data?.hasMore && (
            <Button
              variant="subtle"
              fullWidth
              size="xs"
              component="a"
              href="/settings/notifications"
            >
              View all notifications
            </Button>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}
