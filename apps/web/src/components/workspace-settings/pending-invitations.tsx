import { type Invitation, useInvitations } from '@/hooks/use-invitations'
import {
  ActionIcon,
  Badge,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconRefresh, IconX } from '@tabler/icons-react'
import { formatDistanceToNow } from 'date-fns'

type PendingInvitationsProps = {
  workspaceId: string
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'red',
  pm: 'blue',
  member: 'green',
  guest: 'gray',
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Admin',
  pm: 'PM',
  member: 'Member',
  guest: 'Guest',
}

// Safe date formatting with validation
function formatSentTime(sentAt: string | undefined): string {
  if (!sentAt) return 'recently'
  try {
    const date = new Date(sentAt)
    if (Number.isNaN(date.getTime())) return 'recently'
    return formatDistanceToNow(date, { addSuffix: true })
  } catch {
    return 'recently'
  }
}

// Map error status to safe messages (XSS protection)
function getSafeErrorMessage(error: unknown, action: string): string {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status
    if (status === 404) return 'Invitation not found'
    if (status === 403) return 'You do not have permission for this action'
  }
  return `Failed to ${action}. Please try again.`
}

export function PendingInvitations({ workspaceId }: PendingInvitationsProps) {
  const { invitations, isLoading, revokeInvitation, resendInvitation } =
    useInvitations(workspaceId)

  const handleRevoke = async (invitation: Invitation) => {
    try {
      await revokeInvitation.mutateAsync(invitation.id)
      notifications.show({
        title: 'Invitation revoked',
        message: `Invitation to ${invitation.inviteeEmail} has been cancelled`,
        color: 'green',
      })
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: getSafeErrorMessage(error, 'revoke invitation'),
        color: 'red',
      })
    }
  }

  const handleResend = async (invitation: Invitation) => {
    try {
      await resendInvitation.mutateAsync(invitation.id)
      notifications.show({
        title: 'Invitation resent',
        message: `A new invitation email has been sent to ${invitation.inviteeEmail}`,
        color: 'green',
      })
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: getSafeErrorMessage(error, 'resend invitation'),
        color: 'red',
      })
    }
  }

  if (isLoading) {
    return (
      <Stack gap="xs">
        <Skeleton height={60} />
        <Skeleton height={60} />
      </Stack>
    )
  }

  if (invitations.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        No pending invitations
      </Text>
    )
  }

  return (
    <Stack gap="xs">
      {invitations.map((invitation) => (
        <Paper key={invitation.id} p="sm" withBorder>
          <Group justify="space-between" wrap="nowrap">
            <div style={{ minWidth: 0, flex: 1 }}>
              <Group gap="xs" wrap="nowrap">
                <Text fw={500} truncate>
                  {invitation.inviteeEmail}
                </Text>
                <Badge
                  color={ROLE_COLORS[invitation.role]}
                  size="sm"
                  variant="light"
                >
                  {ROLE_LABELS[invitation.role] || invitation.role}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed">
                Sent {formatSentTime(invitation.sentAt)}
              </Text>
            </div>
            <Group gap="xs" wrap="nowrap">
              <Tooltip label="Resend invitation">
                <ActionIcon
                  variant="subtle"
                  color="blue"
                  onClick={() => handleResend(invitation)}
                  loading={resendInvitation.isPending}
                  aria-label="Resend invitation"
                >
                  <IconRefresh size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Revoke invitation">
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={() => handleRevoke(invitation)}
                  loading={revokeInvitation.isPending}
                  aria-label="Revoke invitation"
                >
                  <IconX size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Paper>
      ))}
    </Stack>
  )
}
