import { api } from '@/lib/api'
import {
  Avatar,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'

type Activity = {
  id: string
  action: string
  targetType: string
  targetTitle: string
  user: { name: string; avatarUrl?: string }
  createdAt: string
}

const actionIcons: Record<string, string> = {
  created: '➕',
  updated: '✏️',
  deleted: '🗑️',
  completed: '✅',
  commented: '💬',
  assigned: '👤',
}

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  return `${Math.floor(diffInSeconds / 86400)}d ago`
}

export function ActivityFeed() {
  const { data: activities, isLoading } = useQuery<Activity[]>({
    queryKey: ['activity-feed'],
    queryFn: () => api.get('/activity'),
  })

  if (isLoading) {
    return (
      <Paper p="md" radius="md" withBorder>
        <Text fw={600} mb="md">
          Recent Activity
        </Text>
        <Stack gap="sm">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height={50} radius="sm" />
          ))}
        </Stack>
      </Paper>
    )
  }

  return (
    <Paper p="md" radius="md" withBorder>
      <Text fw={600} mb="md">
        Recent Activity
      </Text>
      <Stack gap="sm">
        {activities?.length === 0 && (
          <Text c="dimmed" size="sm">
            No recent activity
          </Text>
        )}
        {activities?.slice(0, 10).map((activity) => (
          <Group key={activity.id} gap="sm" wrap="nowrap">
            <Avatar src={activity.user.avatarUrl} size="sm" radius="xl">
              {activity.user.name[0]}
            </Avatar>
            <div className="flex-1 min-w-0">
              <Text size="sm">
                <Text span fw={500}>
                  {activity.user.name}
                </Text>{' '}
                {activity.action}{' '}
                <Text span fw={500}>
                  {activity.targetTitle}
                </Text>
              </Text>
              <Text size="xs" c="dimmed">
                {formatTimeAgo(activity.createdAt)}
              </Text>
            </div>
            <ThemeIcon size="sm" variant="light" color="gray">
              {actionIcons[activity.action] ?? '•'}
            </ThemeIcon>
          </Group>
        ))}
      </Stack>
    </Paper>
  )
}
