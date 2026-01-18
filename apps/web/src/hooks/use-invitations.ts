import { api } from '@/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type Invitation = {
  id: string
  inviteeEmail: string
  role: 'super_admin' | 'pm' | 'member' | 'guest'
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  sentAt: string
  expiresAt: string
  inviter?: {
    name: string
    email: string
  }
}

type CreateInvitationInput = {
  email: string
  role: 'super_admin' | 'pm' | 'member' | 'guest'
}

type BulkInvitationInput = {
  emails: string[]
  role: 'super_admin' | 'pm' | 'member' | 'guest'
}

type BulkInvitationResult = {
  created: Invitation[]
  skipped: string[]
}

export function useInvitations(workspaceId?: string) {
  const queryClient = useQueryClient()

  const { data: invitations = [], isLoading } = useQuery<Invitation[]>({
    queryKey: ['invitations', workspaceId],
    queryFn: () => api.get(`/workspaces/${workspaceId}/invitations`),
    enabled: !!workspaceId,
  })

  const createInvitation = useMutation({
    mutationFn: (data: CreateInvitationInput) =>
      api.post<Invitation>(`/workspaces/${workspaceId}/invitations`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', workspaceId] })
    },
  })

  const createBulkInvitations = useMutation({
    mutationFn: (data: BulkInvitationInput) =>
      api.post<BulkInvitationResult>(
        `/workspaces/${workspaceId}/invitations/bulk`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', workspaceId] })
    },
  })

  const revokeInvitation = useMutation({
    mutationFn: (invitationId: string) =>
      api.delete<Invitation>(
        `/workspaces/${workspaceId}/invitations/${invitationId}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', workspaceId] })
    },
  })

  const resendInvitation = useMutation({
    mutationFn: (invitationId: string) =>
      api.post<Invitation>(
        `/workspaces/${workspaceId}/invitations/${invitationId}/resend`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', workspaceId] })
    },
  })

  return {
    invitations,
    isLoading,
    createInvitation,
    createBulkInvitations,
    revokeInvitation,
    resendInvitation,
  }
}

// Hook to accept an invitation (used on accept-invite page)
export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (token: string) =>
      api.post<Invitation>('/invitations/accept', { token }),
  })
}

// Hook to get invitation info by token (for accept page)
export function useInvitationByToken(token?: string) {
  return useQuery<{
    id: string
    inviteeEmail: string
    role: string
    status: string
    expiresAt: string
  }>({
    queryKey: ['invitation-token', token],
    queryFn: () => api.get(`/invitations/token/${token}`),
    enabled: !!token,
    retry: false,
  })
}
