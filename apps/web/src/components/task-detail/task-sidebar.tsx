import type { TaskPriority } from '@/hooks/use-tasks'
import { useUpdateTask } from '@/hooks/use-tasks'
import type { WorkspaceMember } from '@/hooks/use-workspace'
import { Select, Stack, Text } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { TaskWatchers } from './task-watchers'

type TaskData = {
  id: string
  statusId: string | null
  priority: TaskPriority
  assigneeId?: string | null
  dueDate?: string | null
}

type Status = {
  id: string
  name: string
  color: string
}

type Props = {
  task: TaskData
  statuses: Status[]
  members: WorkspaceMember[]
  currentUserId?: string
  canManageWatchers?: boolean
}

export function TaskSidebar({
  task,
  statuses,
  members,
  currentUserId,
  canManageWatchers = false,
}: Props) {
  const updateTask = useUpdateTask()

  const handleUpdate = (field: string, value: unknown) => {
    updateTask.mutate({ id: task.id, data: { [field]: value } })
  }

  return (
    <Stack gap="md" className="w-64">
      {/* Status */}
      <div>
        <Text size="xs" c="dimmed" mb={4}>
          Status
        </Text>
        <Select
          value={task.statusId}
          onChange={(v) => handleUpdate('statusId', v)}
          data={statuses.map((s) => ({
            value: s.id,
            label: s.name,
          }))}
        />
      </div>

      {/* Priority */}
      <div>
        <Text size="xs" c="dimmed" mb={4}>
          Priority
        </Text>
        <Select
          value={task.priority}
          onChange={(v) => handleUpdate('priority', v)}
          data={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'urgent', label: 'Urgent' },
          ]}
        />
      </div>

      {/* Assignee */}
      <div>
        <Text size="xs" c="dimmed" mb={4}>
          Assignee
        </Text>
        <Select
          value={task.assigneeId ?? undefined}
          onChange={(v) => handleUpdate('assigneeId', v)}
          data={members.map((m) => ({
            value: m.id,
            label: m.name,
          }))}
          clearable
          placeholder="Unassigned"
        />
      </div>

      {/* Due Date */}
      <div>
        <Text size="xs" c="dimmed" mb={4}>
          Due Date
        </Text>
        <DatePickerInput
          value={task.dueDate ? new Date(task.dueDate) : null}
          onChange={(v) => {
            const isoDate = v ? new Date(v).toISOString() : null
            handleUpdate('dueDate', isoDate)
          }}
          clearable
          placeholder="No due date"
        />
      </div>

      {/* Watchers */}
      {currentUserId && (
        <TaskWatchers
          taskId={task.id}
          currentUserId={currentUserId}
          members={members}
          canManageWatchers={canManageWatchers}
        />
      )}
    </Stack>
  )
}
