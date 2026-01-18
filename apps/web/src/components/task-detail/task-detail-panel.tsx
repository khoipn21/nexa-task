import { useTask } from '@/hooks/use-tasks'
import type { WorkspaceMember } from '@/hooks/use-workspace'
import { Box, Drawer, Group, ScrollArea, Text, ThemeIcon } from '@mantine/core'
import { IconCheck, IconLayoutSidebarRightCollapse } from '@tabler/icons-react'
import { TaskDetailContent } from './task-detail-content'

type Status = {
  id: string
  name: string
  color: string
}

type Props = {
  taskId: string | null
  onClose: () => void
  statuses: Status[]
  members: WorkspaceMember[]
  projectId: string
}

/**
 * Task detail drawer panel - used in project pages for quick task editing
 */
export function TaskDetailPanel({
  taskId,
  onClose,
  statuses,
  members,
  projectId,
}: Props) {
  const { data: task } = useTask(taskId || undefined)

  return (
    <Drawer
      opened={!!taskId}
      onClose={onClose}
      position="right"
      size="50%"
      padding={0}
      withCloseButton={false}
      classNames={{
        body: 'h-full flex flex-col',
        content: 'rounded-l-2xl overflow-hidden',
      }}
      overlayProps={{ opacity: 0.3, blur: 2 }}
    >
      {/* Header */}
      <div className="h-14 border-b border-gray-200 dark:border-dark-4 flex items-center justify-between px-6 bg-gray-50/50 dark:bg-dark-7/50 backdrop-blur-md sticky top-0 z-10">
        <Group>
          <ThemeIcon variant="light" color="blue" size="sm" radius="md">
            <IconCheck size={14} />
          </ThemeIcon>
          <Text size="sm" fw={500} c="dimmed">
            {task?.statusId
              ? statuses.find((s) => s.id === task.statusId)?.name
              : 'Task Detail'}
          </Text>
        </Group>
        <Box
          onClick={onClose}
          className="cursor-pointer text-gray-400 hover:text-gray-700 dark:text-dark-2 dark:hover:text-white transition-colors p-1 rounded-md hover:bg-gray-200 dark:hover:bg-dark-6"
        >
          <IconLayoutSidebarRightCollapse size={20} />
        </Box>
      </div>

      <ScrollArea className="flex-1 bg-white dark:bg-dark-7">
        <div className="p-6">
          {taskId && (
            <TaskDetailContent
              taskId={taskId}
              statuses={statuses}
              members={members}
              projectId={projectId}
            />
          )}
        </div>
      </ScrollArea>
    </Drawer>
  )
}
