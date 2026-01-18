import { api } from '@/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type Comment = {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  user: {
    id: string
    name: string
    avatarUrl?: string
  }
}

export function useComments(taskId: string) {
  return useQuery<Comment[]>({
    queryKey: ['comments', taskId],
    queryFn: () => api.get(`/tasks/${taskId}/comments`),
    enabled: !!taskId,
  })
}

export function useCreateComment(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (content: string) =>
      api.post(`/tasks/${taskId}/comments`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', taskId] })
    },
  })
}

export function useUpdateComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api.patch(`/comments/${id}`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] })
    },
  })
}

export function useDeleteComment(taskId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (commentId: string) => api.delete(`/comments/${commentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', taskId] })
    },
  })
}
