import { api } from '@/lib/api'
import {
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconSearch } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

type Task = {
  id: string
  title: string
  statusId: string | null
}

type Props = {
  opened: boolean
  onClose: () => void
  taskId: string
  projectId: string
  existingDependencyIds: string[]
}

export function TaskPickerModal({
  opened,
  onClose,
  taskId,
  projectId,
  existingDependencyIds,
}: Props) {
  const [search, setSearch] = useState('')
  const [debouncedSearch] = useDebouncedValue(search, 300)
  const queryClient = useQueryClient()

  // Fetch tasks in same project
  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['project-tasks', projectId, debouncedSearch],
    queryFn: () => {
      const params: Record<string, string> = { limit: '20' }
      if (debouncedSearch) params.search = debouncedSearch
      return api.get(`/projects/${projectId}/tasks`, params)
    },
    enabled: opened && !!projectId,
  })

  // Filter out current task and existing dependencies
  const excludeIds = new Set([taskId, ...existingDependencyIds])
  const availableTasks = tasks.filter((t) => !excludeIds.has(t.id))

  const addDependency = useMutation({
    mutationFn: (dependsOnId: string) =>
      api.post(`/tasks/${taskId}/dependencies`, { dependsOnId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-dependencies', taskId] })
      onClose()
      notifications.show({
        title: 'Blocker added',
        message: 'Task dependency created successfully',
        color: 'green',
      })
    },
    onError: (error: Error) => {
      // Handle circular dependency error from backend
      const message = error.message?.includes('circular')
        ? 'Cannot add: would create circular dependency'
        : 'Failed to add dependency'
      notifications.show({
        title: 'Error',
        message,
        color: 'red',
      })
    },
  })

  const handleSelect = (selectedTaskId: string) => {
    addDependency.mutate(selectedTaskId)
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Add Blocking Task"
      size="md"
    >
      <Stack gap="md">
        <TextInput
          placeholder="Search tasks..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          autoFocus
        />

        <Stack gap="xs" mah={300} style={{ overflowY: 'auto' }}>
          {isLoading ? (
            <Group justify="center" py="md">
              <Loader size="sm" />
            </Group>
          ) : availableTasks.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">
              {search
                ? 'No matching tasks found'
                : 'No tasks available to add as blocker'}
            </Text>
          ) : (
            availableTasks.map((task) => (
              <Paper
                key={task.id}
                p="sm"
                withBorder
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={() => handleSelect(task.id)}
              >
                <Group justify="space-between">
                  <Text size="sm" lineClamp={1}>
                    {task.title}
                  </Text>
                  <Button
                    size="xs"
                    variant="light"
                    loading={addDependency.isPending}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSelect(task.id)
                    }}
                  >
                    Add
                  </Button>
                </Group>
              </Paper>
            ))
          )}
        </Stack>
      </Stack>
    </Modal>
  )
}
