import { api } from '@/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'

export type Watcher = {
  id: string
  userId: string
  taskId: string
  user: {
    id: string
    name: string
    email: string
    avatarUrl?: string
  }
  createdAt: string
}

// Fetch watchers for a task
export function useTaskWatchers(taskId?: string) {
  return useQuery<Watcher[]>({
    queryKey: ['task-watchers', taskId],
    queryFn: () => api.get(`/tasks/${taskId}/watchers`),
    enabled: !!taskId,
  })
}

// Add watcher to task with optimistic update
export function useAddWatcher(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) =>
      api.post<Watcher>(`/tasks/${taskId}/watchers`, { userId }),
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: ['task-watchers', taskId] })
      const previous = queryClient.getQueryData<Watcher[]>(['task-watchers', taskId])

      // Optimistically add placeholder watcher
      queryClient.setQueryData<Watcher[]>(['task-watchers', taskId], (old = []) => [
        ...old,
        {
          id: `temp-${userId}`,
          userId,
          taskId,
          user: { id: userId, name: 'Adding...', email: '' },
          createdAt: new Date().toISOString(),
        },
      ])

      return { previous }
    },
    onError: (_err, _userId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['task-watchers', taskId], context.previous)
      }
      notifications.show({
        title: 'Failed to add watcher',
        message: 'Could not add watcher. Please try again.',
        color: 'red',
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['task-watchers', taskId] })
    },
  })
}

// Remove watcher from task with optimistic update
export function useRemoveWatcher(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/tasks/${taskId}/watchers/${userId}`),
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: ['task-watchers', taskId] })
      const previous = queryClient.getQueryData<Watcher[]>(['task-watchers', taskId])

      // Optimistically remove watcher
      queryClient.setQueryData<Watcher[]>(['task-watchers', taskId], (old = []) =>
        old.filter((w) => w.userId !== userId),
      )

      return { previous }
    },
    onError: (_err, _userId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['task-watchers', taskId], context.previous)
      }
      notifications.show({
        title: 'Failed to remove watcher',
        message: 'Could not remove watcher. Please try again.',
        color: 'red',
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['task-watchers', taskId] })
    },
  })
}

// Check if current user is watching
export function useIsWatching(taskId?: string, currentUserId?: string) {
  const { data: watchers = [] } = useTaskWatchers(taskId)
  return watchers.some((w) => w.userId === currentUserId)
}

// Toggle watch status for current user with optimistic updates
export function useToggleWatch(taskId: string, currentUserId: string) {
  const queryClient = useQueryClient()
  const { data: watchers = [] } = useTaskWatchers(taskId)

  const addWatcher = useMutation({
    mutationFn: () => api.post(`/tasks/${taskId}/watchers`, { userId: currentUserId }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['task-watchers', taskId] })
      const previous = queryClient.getQueryData<Watcher[]>(['task-watchers', taskId])

      queryClient.setQueryData<Watcher[]>(['task-watchers', taskId], (old = []) => [
        ...old,
        {
          id: `temp-${currentUserId}`,
          userId: currentUserId,
          taskId,
          user: { id: currentUserId, name: 'You', email: '' },
          createdAt: new Date().toISOString(),
        },
      ])

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['task-watchers', taskId], context.previous)
      }
      notifications.show({
        title: 'Failed to watch task',
        message: 'Could not start watching. Please try again.',
        color: 'red',
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['task-watchers', taskId] })
    },
  })

  const removeWatcher = useMutation({
    mutationFn: () => api.delete(`/tasks/${taskId}/watchers/${currentUserId}`),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['task-watchers', taskId] })
      const previous = queryClient.getQueryData<Watcher[]>(['task-watchers', taskId])

      queryClient.setQueryData<Watcher[]>(['task-watchers', taskId], (old = []) =>
        old.filter((w) => w.userId !== currentUserId),
      )

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['task-watchers', taskId], context.previous)
      }
      notifications.show({
        title: 'Failed to unwatch task',
        message: 'Could not stop watching. Please try again.',
        color: 'red',
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['task-watchers', taskId] })
    },
  })

  // Compute isWatching at call time to avoid stale closure
  const getIsWatching = () => watchers.some((w) => w.userId === currentUserId)
  const isWatching = getIsWatching()

  const toggle = () => {
    // Check current state at toggle time to avoid race condition
    const currentlyWatching = getIsWatching()
    if (currentlyWatching) {
      removeWatcher.mutate()
    } else {
      addWatcher.mutate()
    }
  }

  return {
    isWatching,
    toggle,
    isPending: addWatcher.isPending || removeWatcher.isPending,
  }
}
