import { useInvitations } from '@/hooks/use-invitations'
import {
  Button,
  Modal,
  Select,
  Stack,
  TextInput,
  Textarea,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { IconSend } from '@tabler/icons-react'
import { useState } from 'react'

type InviteMemberModalProps = {
  workspaceId: string
  opened: boolean
  onClose: () => void
}

const ROLE_OPTIONS = [
  { value: 'member', label: 'Member' },
  { value: 'pm', label: 'Project Manager' },
  { value: 'super_admin', label: 'Admin' },
  { value: 'guest', label: 'Guest (View Only)' },
]

// Proper email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Map error status to safe messages (XSS protection)
function getSafeErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status
    if (status === 409) return 'Email already has a pending invitation'
    if (status === 403) return 'You do not have permission to send invitations'
    if (status === 400) return 'Invalid email address'
  }
  return 'Failed to send invitation. Please try again.'
}

export function InviteMemberModal({
  workspaceId,
  opened,
  onClose,
}: InviteMemberModalProps) {
  const { createInvitation, createBulkInvitations } =
    useInvitations(workspaceId)
  const [bulkMode, setBulkMode] = useState(false)

  const form = useForm({
    initialValues: {
      email: '',
      emails: '',
      role: 'member' as const,
    },
    validate: {
      email: (value) => {
        if (bulkMode) return null
        return !EMAIL_REGEX.test(value.trim()) ? 'Invalid email format' : null
      },
      emails: (value) => {
        if (!bulkMode) return null
        const emailList = value
          .split(/[,\n]/)
          .map((e) => e.trim())
          .filter(Boolean)
        if (emailList.length === 0) return 'Enter at least one email'
        if (emailList.length > 20) return 'Maximum 20 emails at once'
        const invalid = emailList.filter((e) => !EMAIL_REGEX.test(e))
        if (invalid.length > 0)
          return `Invalid email format: ${invalid.slice(0, 3).join(', ')}${invalid.length > 3 ? '...' : ''}`
        return null
      },
    },
  })

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      if (bulkMode) {
        // Deduplicate emails
        const emails = [
          ...new Set(
            values.emails
              .split(/[,\n]/)
              .map((e) => e.trim().toLowerCase())
              .filter(Boolean),
          ),
        ]
        const result = await createBulkInvitations.mutateAsync({
          emails,
          role: values.role,
        })
        const createdCount = result.created.length
        const skippedCount = result.skipped.length
        notifications.show({
          title: 'Invitations sent',
          message: `${createdCount} sent${skippedCount > 0 ? `, ${skippedCount} skipped (already pending)` : ''}`,
          color: 'green',
        })
      } else {
        await createInvitation.mutateAsync({
          email: values.email.toLowerCase().trim(),
          role: values.role,
        })
        notifications.show({
          title: 'Invitation sent',
          message: `Invitation sent to ${values.email}`,
          color: 'green',
        })
      }
      form.reset()
      onClose()
    } catch (error) {
      notifications.show({
        title: 'Failed to send invitation',
        message: getSafeErrorMessage(error),
        color: 'red',
      })
    }
  })

  const handleClose = () => {
    form.reset()
    setBulkMode(false)
    onClose()
  }

  const isPending =
    createInvitation.isPending || createBulkInvitations.isPending

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Invite Team Members"
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          {bulkMode ? (
            <Textarea
              label="Email addresses"
              description="Enter emails separated by commas or new lines (max 20)"
              placeholder="john@example.com, jane@example.com"
              minRows={3}
              autosize
              required
              {...form.getInputProps('emails')}
            />
          ) : (
            <TextInput
              label="Email address"
              placeholder="colleague@company.com"
              required
              {...form.getInputProps('email')}
            />
          )}

          <Select
            label="Role"
            description="What permissions should this member have?"
            data={ROLE_OPTIONS}
            {...form.getInputProps('role')}
          />

          <Button
            variant="subtle"
            size="xs"
            onClick={() => setBulkMode(!bulkMode)}
            type="button"
          >
            {bulkMode ? 'Switch to single invite' : 'Invite multiple people'}
          </Button>

          <Button
            type="submit"
            loading={isPending}
            leftSection={<IconSend size={16} />}
          >
            {bulkMode ? 'Send Invitations' : 'Send Invitation'}
          </Button>
        </Stack>
      </form>
    </Modal>
  )
}
