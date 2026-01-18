import { api } from '@/lib/api'
import {
  ActionIcon,
  Button,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { TaskPickerModal } from './task-picker-modal'

type Dependency = {
  id: string
  dependsOnId: string
  dependsOn: {
    id: string
    title: string
  }
}

type Props = {
  taskId: string
  projectId: string
}

export function TaskDependencies({ taskId, projectId }: Props) {
  const queryClient = useQueryClient()
  const [modalOpened, { open: openModal, close: closeModal }] =
    useDisclosure(false)

  const { data: dependencies = [], isLoading } = useQuery<Dependency[]>({
    queryKey: ['task-dependencies', taskId],
    queryFn: () => api.get(`/tasks/${taskId}/dependencies`),
  })

  const removeDependency = useMutation({
    mutationFn: (depId: string) =>
      api.delete(`/tasks/${taskId}/dependencies/${depId}`),
    onMutate: async (depId) => {
      await queryClient.cancelQueries({
        queryKey: ['task-dependencies', taskId],
      })
      const previous = queryClient.getQueryData<Dependency[]>([
        'task-dependencies',
        taskId,
      ])

      queryClient.setQueryData<Dependency[]>(
        ['task-dependencies', taskId],
        (old = []) => old.filter((d) => d.dependsOnId !== depId),
      )

      return { previous }
    },
    onError: (_err, _depId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ['task-dependencies', taskId],
          context.previous,
        )
      }
      notifications.show({
        title: 'Failed to remove blocker',
        message: 'Could not remove dependency. Please try again.',
        color: 'red',
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['task-dependencies', taskId] })
    },
  })

  const existingDependencyIds = dependencies.map((d) => d.dependsOnId)

  if (isLoading) {
    return <Skeleton height={60} />
  }

  return (
    <>
      <Stack gap="xs">
        <Group justify="space-between">
          <Text size="sm" fw={600}>
            Blocked By
          </Text>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={openModal}
          >
            Add Blocker
          </Button>
        </Group>

        {dependencies.length === 0 ? (
          <Text size="sm" c="dimmed">
            No blockers
          </Text>
        ) : (
          dependencies.map((dep) => (
            <Paper key={dep.id} p="xs" withBorder>
              <Group justify="space-between">
                <Text
                  size="sm"
                  component={Link}
                  to={`/tasks/${dep.dependsOn.id}`}
                  className="hover:underline"
                >
                  {dep.dependsOn.title}
                </Text>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="red"
                  onClick={() => removeDependency.mutate(dep.dependsOnId)}
                  loading={removeDependency.isPending}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
            </Paper>
          ))
        )}
      </Stack>

      <TaskPickerModal
        opened={modalOpened}
        onClose={closeModal}
        taskId={taskId}
        projectId={projectId}
        existingDependencyIds={existingDependencyIds}
      />
    </>
  )
}
