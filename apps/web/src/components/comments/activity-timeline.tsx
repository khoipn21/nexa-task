import { api } from '@/lib/api'
import { Avatar, Skeleton, Text, Timeline } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'

const ACTION_LABELS: Record<string, string> = {
  created: 'created this task',
  updated: 'updated this task',
  assigned: 'changed assignee',
  status_changed: 'changed status',
  commented: 'commented',
  moved: 'moved this task',
  deleted: 'deleted this task',
}

type Activity = {
  id: string
  action: string
  createdAt: string
  user?: {
    id: string
    name: string
    avatarUrl?: string
  }
  changes?: Record<string, { old: unknown; new: unknown }>
}

type Props = {
  taskId: string
}

export function ActivityTimeline({ taskId }: Props) {
  const { data: activities = [], isLoading } = useQuery<Activity[]>({
    queryKey: ['task-activity', taskId],
    queryFn: () => api.get(`/tasks/${taskId}/activity`),
  })

  if (isLoading) {
    return <Skeleton height={100} />
  }

  if (activities.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No activity yet
      </Text>
    )
  }

  return (
    <Timeline bulletSize={24} lineWidth={2}>
      {activities.map((activity) => (
        <Timeline.Item
          key={activity.id}
          bullet={
            <Avatar src={activity.user?.avatarUrl} size={24} radius="xl">
              {activity.user?.name?.[0]}
            </Avatar>
          }
        >
          <Text size="sm">
            <Text span fw={500}>
              {activity.user?.name}
            </Text>{' '}
            {ACTION_LABELS[activity.action] || activity.action}
          </Text>
          <Text size="xs" c="dimmed">
            {formatDistanceToNow(new Date(activity.createdAt), {
              addSuffix: true,
            })}
          </Text>
        </Timeline.Item>
      ))}
    </Timeline>
  )
}
