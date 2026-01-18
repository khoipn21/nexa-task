import { type Task, type TaskPriority, useTasks } from '@/hooks/use-tasks'
import {
  ActionIcon,
  Avatar,
  Badge,
  Group,
  Menu,
  Paper,
  Skeleton,
  Table,
  Text,
} from '@mantine/core'
import { IconDotsVertical } from '@tabler/icons-react'

const priorityColors: Record<TaskPriority, string> = {
  low: 'gray',
  medium: 'blue',
  high: 'orange',
  urgent: 'red',
}

type Props = {
  projectId: string
  onTaskClick?: (taskId: string) => void
}

export function TaskTable({ projectId, onTaskClick }: Props) {
  const { data: tasks, isLoading } = useTasks(projectId)

  if (isLoading) {
    return (
      <div>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} height={50} mb="sm" radius="sm" />
        ))}
      </div>
    )
  }

  if (!tasks?.length) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No tasks yet. Create your first task to get started.
      </Text>
    )
  }

  return (
    <Paper withBorder radius="md" className="overflow-hidden">
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Title</Table.Th>
            <Table.Th>Priority</Table.Th>
            <Table.Th>Assignee</Table.Th>
            <Table.Th>Due Date</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {tasks.map((task: Task) => (
            <Table.Tr
              key={task.id}
              className="cursor-pointer"
              onClick={() => onTaskClick?.(task.id)}
            >
              <Table.Td>
                <Text
                  fw={500}
                  className="hover:text-blue-600 transition-colors"
                >
                  {task.title}
                </Text>
              </Table.Td>
              <Table.Td>
                <Badge color={priorityColors[task.priority]} size="sm">
                  {task.priority}
                </Badge>
              </Table.Td>
              <Table.Td>
                {task.assignee ? (
                  <Group gap="xs">
                    <Avatar src={task.assignee.avatarUrl} size="sm" radius="xl">
                      {task.assignee.name[0]}
                    </Avatar>
                    <Text size="sm">{task.assignee.name}</Text>
                  </Group>
                ) : (
                  <Text c="dimmed" size="sm">
                    Unassigned
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                {task.dueDate ? (
                  <Text size="sm">
                    {new Date(task.dueDate).toLocaleDateString()}
                  </Text>
                ) : (
                  <Text c="dimmed" size="sm">
                    No due date
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                <Menu>
                  <Menu.Target>
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <IconDotsVertical size={16} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item onClick={() => onTaskClick?.(task.id)}>
                      View Details
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  )
}
