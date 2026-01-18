import { api } from '@/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type WorkflowStatus = {
  id: string
  projectId: string
  name: string
  color: string
  order: number
  isDefault: boolean
  isFinal: boolean
  createdAt: string
}

export type CreateStatusInput = {
  name: string
  color?: string
  isDefault?: boolean
  isFinal?: boolean
}

export type UpdateStatusInput = Partial<CreateStatusInput>

// Fetch statuses for a project
export function useWorkflowStatuses(projectId?: string) {
  return useQuery<WorkflowStatus[]>({
    queryKey: ['workflow-statuses', projectId],
    queryFn: () => api.get(`/projects/${projectId}/statuses`),
    enabled: !!projectId,
  })
}

// Create a new status
export function useCreateStatus(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateStatusInput) =>
      api.post<WorkflowStatus>(`/projects/${projectId}/statuses`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['workflow-statuses', projectId],
      })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })
}

// Update a status
export function useUpdateStatus(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      statusId,
      data,
    }: { statusId: string; data: UpdateStatusInput }) =>
      api.patch<WorkflowStatus>(
        `/projects/${projectId}/statuses/${statusId}`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['workflow-statuses', projectId],
      })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })
}

// Delete a status
export function useDeleteStatus(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (statusId: string) =>
      api.delete(`/projects/${projectId}/statuses/${statusId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['workflow-statuses', projectId],
      })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })
}

// Reorder statuses (optimistic update)
export function useReorderStatuses(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      api.post<WorkflowStatus[]>(`/projects/${projectId}/statuses/reorder`, {
        orderedIds,
      }),
    onMutate: async (orderedIds) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ['workflow-statuses', projectId],
      })

      // Snapshot previous value
      const previousStatuses = queryClient.getQueryData<WorkflowStatus[]>([
        'workflow-statuses',
        projectId,
      ])

      // Optimistically update
      if (previousStatuses) {
        const reordered = orderedIds
          .map((id, index) => {
            const status = previousStatuses.find((s) => s.id === id)
            return status ? { ...status, order: index } : null
          })
          .filter(Boolean) as WorkflowStatus[]

        queryClient.setQueryData(['workflow-statuses', projectId], reordered)
      }

      return { previousStatuses }
    },
    onError: (_, __, context) => {
      // Rollback on error
      if (context?.previousStatuses) {
        queryClient.setQueryData(
          ['workflow-statuses', projectId],
          context.previousStatuses,
        )
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['workflow-statuses', projectId],
      })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })
}
