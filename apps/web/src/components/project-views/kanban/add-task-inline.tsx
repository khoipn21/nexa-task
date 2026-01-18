import type { TaskPriority } from '@/hooks/use-tasks'
import { useCreateTask } from '@/hooks/use-tasks'
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  Select,
  Stack,
  TextInput,
} from '@mantine/core'
import { IconPlus, IconX } from '@tabler/icons-react'
import { useState } from 'react'

const priorityOptions = [
  { value: 'low', label: 'Low', color: 'gray' },
  { value: 'medium', label: 'Medium', color: 'blue' },
  { value: 'high', label: 'High', color: 'orange' },
  { value: 'urgent', label: 'Urgent', color: 'red' },
]

type Props = {
  projectId: string
  statusId: string
}

export function AddTaskInline({ projectId, statusId }: Props) {
  const [isAdding, setIsAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const createTask = useCreateTask(projectId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    await createTask.mutateAsync({
      title: title.trim(),
      statusId,
      priority,
    })
    setTitle('')
    setPriority('medium')
    setIsAdding(false)
  }

  const handleCancel = () => {
    setTitle('')
    setPriority('medium')
    setIsAdding(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (!isAdding) {
    return (
      <Group
        gap="xs"
        className="p-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-dark-5 transition-colors"
        onClick={() => setIsAdding(true)}
      >
        <IconPlus size={16} className="text-gray-500" />
        <span className="text-sm text-gray-500">Add task</span>
      </Group>
    )
  }

  return (
    <Paper
      component="form"
      onSubmit={handleSubmit}
      p="sm"
      radius="md"
      withBorder
      className="bg-white dark:bg-dark-6"
    >
      <Stack gap="sm">
        <TextInput
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          autoFocus
          onKeyDown={handleKeyDown}
          size="sm"
          variant="filled"
        />

        <Group gap="xs">
          <Select
            value={priority}
            onChange={(val) => setPriority((val as TaskPriority) || 'medium')}
            data={priorityOptions}
            size="xs"
            w={100}
            variant="filled"
            renderOption={({ option }) => {
              const opt = priorityOptions.find((p) => p.value === option.value)
              return (
                <Badge size="xs" color={opt?.color} variant="light">
                  {option.label}
                </Badge>
              )
            }}
          />
        </Group>

        <Group gap="xs" justify="flex-end">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={handleCancel}
          >
            <IconX size={14} />
          </ActionIcon>
          <Button
            type="submit"
            size="xs"
            loading={createTask.isPending}
            disabled={!title.trim()}
            leftSection={<IconPlus size={14} />}
          >
            Add
          </Button>
        </Group>
      </Stack>
    </Paper>
  )
}
