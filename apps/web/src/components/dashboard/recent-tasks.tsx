import { useRecentTasks } from '@/hooks/use-tasks'
import {
  Avatar,
  Badge,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core'
import { Link } from 'react-router'

const priorityColors: Record<string, string> = {
  low: 'gray',
  medium: 'blue',
  high: 'orange',
  urgent: 'red',
}

export function RecentTasks() {
  const { data: tasks, isLoading } = useRecentTasks()

  if (isLoading) {
    return (
      <Paper p="md" radius="md" withBorder>
        <Text fw={600} mb="md">
          Recent Tasks
        </Text>
        <Stack gap="sm">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height={60} radius="sm" />
          ))}
        </Stack>
      </Paper>
    )
  }

  return (
    <Paper p="md" radius="md" withBorder>
      <Text fw={600} mb="md">
        Recent Tasks
      </Text>
      <Stack gap="sm">
        {tasks?.length === 0 && (
          <Text c="dimmed" size="sm">
            No recent tasks
          </Text>
        )}
        {tasks?.slice(0, 5).map((task) => (
          <Paper
            key={task.id}
            p="sm"
            radius="sm"
            withBorder
            component={Link}
            to={`/tasks/${task.id}`}
            className="hover:bg-gray-50 transition-colors"
          >
            <Group justify="space-between">
              <div className="flex-1 min-w-0">
                <Text size="sm" fw={500} truncate>
                  {task.title}
                </Text>
                <Badge
                  size="xs"
                  color={priorityColors[task.priority] ?? 'gray'}
                  mt={4}
                >
                  {task.priority}
                </Badge>
              </div>
              {task.assignee && (
                <Avatar src={task.assignee.avatarUrl} size="sm" radius="xl">
                  {task.assignee.name[0]}
                </Avatar>
              )}
            </Group>
          </Paper>
        ))}
      </Stack>
    </Paper>
  )
}
