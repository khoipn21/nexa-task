import type { Task } from '@/hooks/use-tasks'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import {
  Badge,
  Box,
  Group,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core'
import { AddTaskInline } from './add-task-inline'
import { TaskCard } from './task-card'

type Props = {
  status: { id: string; name: string; color: string }
  tasks: Task[]
  projectId: string
  onTaskClick?: (taskId: string) => void
}

export function KanbanColumn({ status, tasks, projectId, onTaskClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id })

  return (
    <Box
      ref={setNodeRef}
      className={`w-full min-w-0 flex flex-col rounded-xl transition-colors duration-200 ${
        isOver
          ? 'bg-blue-50/50 dark:bg-blue-900/10 ring-2 ring-blue-200 dark:ring-blue-800'
          : 'bg-gray-50/50 dark:bg-dark-8/50 hover:bg-gray-100/50 dark:hover:bg-dark-8'
      }`}
      h="100%"
    >
      {/* Header */}
      <Group
        justify="space-between"
        p="md"
        className="cursor-grab active:cursor-grabbing"
      >
        <Group gap="xs">
          <ThemeIcon size="xs" radius="xl" color={status.color} variant="light">
            <div className="w-1.5 h-1.5 rounded-full bg-current" />
          </ThemeIcon>
          <Text
            fw={700}
            size="sm"
            c="dimmed"
            tt="uppercase"
            style={{ letterSpacing: '0.05em' }}
          >
            {status.name}
          </Text>
        </Group>
        <Badge
          variant="light"
          size="sm"
          radius="sm"
          color="gray"
          className="bg-white dark:bg-dark-7 shadow-sm"
        >
          {tasks.length}
        </Badge>
      </Group>

      {/* Task List */}
      <ScrollArea.Autosize
        mah="calc(100vh - 220px)"
        type="hover"
        offsetScrollbars
        classNames={{
          viewport: 'px-3 pb-3',
        }}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <Stack gap="md" className="min-h-[50px]">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400 dashed-border rounded-lg border-2 border-dashed border-gray-200 dark:border-dark-6">
                <Text size="sm" c="dimmed">
                  No tasks
                </Text>
              </div>
            ) : (
              tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => onTaskClick?.(task.id)}
                />
              ))
            )}
            <AddTaskInline projectId={projectId} statusId={status.id} />
          </Stack>
        </SortableContext>
      </ScrollArea.Autosize>
    </Box>
  )
}
