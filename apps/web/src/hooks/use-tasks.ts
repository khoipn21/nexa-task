import { api } from '@/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type Task = {
  id: string
  title: string
  description?: string
  priority: TaskPriority
  statusId: string
  order: number
  dueDate?: string
  assignee?: { id: string; name: string; avatarUrl?: string }
  projectId: string
}

export function useTasks(projectId: string, filters?: Record<string, string>) {
  return useQuery<Task[]>({
    queryKey: ['tasks', projectId, filters],
    queryFn: () => api.get(`/projects/${projectId}/tasks`, filters),
    enabled: !!projectId,
  })
}

export function useTask(taskId?: string) {
  return useQuery<Task>({
    queryKey: ['task', taskId],
    queryFn: () => api.get(`/tasks/${taskId}`),
    enabled: !!taskId,
  })
}

export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      title: string
      statusId?: string
      priority?: TaskPriority
    }) => api.post(`/projects/${projectId}/tasks`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Task> }) =>
      api.patch(`/tasks/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['task', id] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useMoveTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      statusId,
      order,
    }: { id: string; statusId: string; order: number }) =>
      api.post(`/tasks/${id}/move`, { statusId, order }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      const previous = queryClient.getQueryData(['tasks'])
      return { previous }
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['tasks'], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useRecentTasks() {
  return useQuery<Task[]>({
    queryKey: ['recent-tasks'],
    queryFn: () => api.get('/tasks/recent'),
  })
}
