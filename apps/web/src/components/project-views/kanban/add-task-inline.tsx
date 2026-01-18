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
  Text,
  Textarea,
  ThemeIcon,
  Transition,
} from '@mantine/core'
import { useClickOutside } from '@mantine/hooks'
import { IconFlag, IconPlus, IconX } from '@tabler/icons-react'
import { useRef, useState } from 'react'

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
  const formRef = useClickOutside(() => {
    if (!title.trim()) setIsAdding(false)
  })

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!title.trim()) return

    await createTask.mutateAsync({
      title: title.trim(),
      statusId,
      priority,
    })
    setTitle('')
    setPriority('medium')
    // Keep adding mode open for rapid entry
    const textarea = document.getElementById(`new-task-${statusId}`)
    textarea?.focus()
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="w-full">
      {!isAdding ? (
        <Button
          variant="subtle"
          color="gray"
          fullWidth
          justify="flex-start"
          leftSection={<IconPlus size={16} />}
          onClick={() => setIsAdding(true)}
          className="hover:bg-gray-100 dark:hover:bg-dark-6 text-gray-500 hover:text-gray-900 dark:text-dark-2 dark:hover:text-white transition-colors"
        >
          Add Task
        </Button>
      ) : (
        <Paper
          ref={formRef}
          p="sm"
          withBorder
          className="shadow-sm border-blue-200 dark:border-blue-800 ring-2 ring-blue-50 dark:ring-blue-900/20"
          radius="md"
        >
          <Stack gap="xs">
            <Textarea
              id={`new-task-${statusId}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              autosize
              minRows={2}
              maxRows={4}
              autoFocus
              onKeyDown={handleKeyDown}
              variant="unstyled"
              size="sm"
              styles={{ input: { padding: 0 } }}
            />

            <Group justify="space-between" align="center">
              <Select
                value={priority}
                onChange={(val) =>
                  setPriority((val as TaskPriority) || 'medium')
                }
                data={priorityOptions}
                size="xs"
                w={110}
                variant="filled"
                leftSection={<IconFlag size={12} />}
                renderOption={({ option }) => {
                  const opt = priorityOptions.find(
                    (p) => p.value === option.value,
                  )
                  return (
                    <Group gap="xs">
                      <ThemeIcon
                        size={6}
                        color={opt?.color}
                        radius="xl"
                        variant="filled"
                      >
                        <span />
                      </ThemeIcon>
                      <Text size="xs">{option.label}</Text>
                    </Group>
                  )
                }}
              />
              <Group gap={4}>
                <ActionIcon
                  size="sm"
                  color="gray"
                  variant="subtle"
                  onClick={handleCancel}
                >
                  <IconX size={14} />
                </ActionIcon>
                <Button
                  size="xs"
                  variant="filled"
                  color="blue"
                  onClick={() => handleSubmit()}
                  loading={createTask.isPending}
                  disabled={!title.trim()}
                >
                  Add
                </Button>
              </Group>
            </Group>
          </Stack>
        </Paper>
      )}
    </div>
  )
}
