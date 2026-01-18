import { useDebouncedCallback } from '@/hooks/use-debounce'
import type { TaskPriority } from '@/hooks/use-tasks'
import { useTask, useUpdateTask } from '@/hooks/use-tasks'
import type { WorkspaceMember } from '@/hooks/use-workspace'
import { Alert, Divider, Skeleton, Stack, TextInput } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { TaskAttachments } from './task-attachments'
import { TaskDependencies } from './task-dependencies'
import { TaskEditor } from './task-editor'
import { TaskSidebar } from './task-sidebar'

type Status = {
  id: string
  name: string
  color: string
}

type Props = {
  taskId: string
  statuses: Status[]
  members: WorkspaceMember[]
  projectId: string
}

/**
 * Reusable task detail content - used by both TaskDetailPanel (drawer) and TaskDetailPage
 */
export function TaskDetailContent({
  taskId,
  statuses,
  members,
  projectId,
}: Props) {
  const { data: task, isLoading, isError } = useTask(taskId)
  const updateTask = useUpdateTask()

  const [title, setTitle] = useState('')

  useEffect(() => {
    if (task) setTitle(task.title)
  }, [task])

  const debouncedUpdateTitle = useDebouncedCallback((value: string) => {
    if (taskId && value !== task?.title) {
      updateTask.mutate({ id: taskId, data: { title: value } })
    }
  }, 1000)

  const handleTitleChange = (value: string) => {
    setTitle(value)
    debouncedUpdateTitle(value)
  }

  const handleDescriptionChange = (html: string) => {
    if (taskId) {
      updateTask.mutate({ id: taskId, data: { description: html } })
    }
  }

  if (isLoading) {
    return (
      <Stack gap="md">
        <Skeleton height={40} width="70%" />
        <Skeleton height={20} width={100} />
        <Skeleton height={200} />
        <Skeleton height={100} />
      </Stack>
    )
  }

  if (isError || !task) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
        Failed to load task details. Please try again.
      </Alert>
    )
  }

  return (
    <div className="flex gap-8 items-start">
      {/* Main content */}
      <Stack className="flex-1 min-w-0" gap="xl">
        <TextInput
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          variant="unstyled"
          size="xl"
          classNames={{
            input:
              'text-2xl font-bold bg-transparent p-0 m-0 h-auto focus:border-none focus:ring-0',
          }}
          placeholder="Task title"
        />

        <TaskEditor
          content={task.description || ''}
          onChange={handleDescriptionChange}
        />

        <Divider label="Dependencies" labelPosition="center" />
        <TaskDependencies taskId={task.id} projectId={projectId} />

        <Divider label="Attachments" labelPosition="center" />
        <TaskAttachments taskId={task.id} />
      </Stack>

      {/* Sidebar */}
      <div className="w-[300px] shrink-0 sticky top-0">
        <TaskSidebar
          task={{
            id: task.id,
            statusId: task.statusId,
            priority: task.priority as TaskPriority,
            assigneeId: task.assignee?.id,
            dueDate: task.dueDate,
          }}
          statuses={statuses}
          members={members}
        />
      </div>
    </div>
  )
}
