import type { Task, TaskPriority } from '@/hooks/use-tasks'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Avatar, Badge, Group, Paper, Text, Tooltip } from '@mantine/core'
import { IconCalendar } from '@tabler/icons-react'

const priorityColors: Record<TaskPriority, string> = {
  low: 'gray',
  medium: 'blue',
  high: 'orange',
  urgent: 'red',
}

type Props = {
  task: Task
  onClick?: () => void
  isDragOverlay?: boolean
}

export function TaskCard({ task, onClick, isDragOverlay }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragOverlay ? 'grabbing' : 'grab',
  }

  const handleClick = (e: React.MouseEvent) => {
    // Only trigger click if not dragging
    if (!isDragging && onClick) {
      e.stopPropagation()
      onClick()
    }
  }

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      p="sm"
      radius="md"
      withBorder
      shadow={isDragOverlay ? 'lg' : 'xs'}
      className={`
        hover:shadow-md transition-all duration-200
        ${isDragging ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}
        ${isDragOverlay ? 'rotate-2 scale-105' : ''}
      `}
      onClick={handleClick}
    >
      <Text
        size="sm"
        fw={500}
        className="line-clamp-2 cursor-pointer hover:text-blue-600 transition-colors"
      >
        {task.title}
      </Text>

      {task.description && (
        <Text size="xs" c="dimmed" className="line-clamp-1 mt-1">
          {task.description.replace(/<[^>]*>/g, '').slice(0, 60)}
        </Text>
      )}

      <Group mt="xs" justify="space-between" wrap="nowrap">
        <Group gap="xs">
          <Badge
            size="xs"
            color={priorityColors[task.priority]}
            variant="light"
          >
            {task.priority}
          </Badge>
          {task.dueDate && (
            <Tooltip label={new Date(task.dueDate).toLocaleDateString()}>
              <Badge
                size="xs"
                variant="outline"
                leftSection={<IconCalendar size={10} />}
              >
                {new Date(task.dueDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </Badge>
            </Tooltip>
          )}
        </Group>
        {task.assignee && (
          <Tooltip label={task.assignee.name}>
            <Avatar src={task.assignee.avatarUrl} size="sm" radius="xl">
              {task.assignee.name[0]}
            </Avatar>
          </Tooltip>
        )}
      </Group>
    </Paper>
  )
}
