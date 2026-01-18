import type { Task } from '@/hooks/use-tasks'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Badge, Paper, ScrollArea, Stack, Text } from '@mantine/core'
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
    <Paper
      ref={setNodeRef}
      className={`min-w-[300px] max-w-[300px] flex flex-col bg-gray-50 dark:bg-dark-7 ${
        isOver ? 'ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-900/20' : ''
      }`}
      p="md"
      radius="lg"
      withBorder
      style={{ transition: 'all 200ms ease' }}
    >
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-dark-4">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full ring-2 ring-white shadow-sm"
            style={{ backgroundColor: status.color }}
          />
          <Text fw={600} size="sm">
            {status.name}
          </Text>
        </div>
        <Badge variant="filled" size="sm" radius="xl" color="gray">
          {tasks.length}
        </Badge>
      </div>

      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <ScrollArea.Autosize mah={500} offsetScrollbars>
          <Stack gap="sm" className="min-h-[150px] pr-1">
            {tasks.length === 0 && (
              <Text size="xs" c="dimmed" ta="center" py="xl">
                No tasks yet
              </Text>
            )}
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick?.(task.id)}
              />
            ))}
          </Stack>
        </ScrollArea.Autosize>
      </SortableContext>

      <div className="mt-3 pt-2 border-t border-gray-200 dark:border-dark-4">
        <AddTaskInline projectId={projectId} statusId={status.id} />
      </div>
    </Paper>
  )
}
