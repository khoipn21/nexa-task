import { InviteMemberModal } from '@/components/workspace-settings/invite-member-modal'
import { PendingInvitations } from '@/components/workspace-settings/pending-invitations'
import { useAuth } from '@/hooks/use-auth'
import { useWorkspaces } from '@/hooks/use-workspace'
import {
  Button,
  Divider,
  Paper,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconUserPlus } from '@tabler/icons-react'

type Workspace = {
  id: string
  name: string
  slug: string
  clerkOrgId: string
}

// Type guard for workspace validation
function isWorkspace(w: unknown): w is Workspace {
  return (
    typeof w === 'object' &&
    w !== null &&
    'id' in w &&
    'clerkOrgId' in w &&
    typeof (w as Workspace).id === 'string' &&
    typeof (w as Workspace).clerkOrgId === 'string'
  )
}

export default function Settings() {
  const { organization } = useAuth()
  const { data: workspaces, isLoading: workspacesLoading } = useWorkspaces()
  const [inviteOpened, { open: openInvite, close: closeInvite }] =
    useDisclosure(false)

  // Find workspace matching current Clerk org (with type safety)
  const workspaceList = Array.isArray(workspaces)
    ? workspaces.filter(isWorkspace)
    : []
  const workspace = workspaceList.find((w) => w.clerkOrgId === organization?.id)

  if (workspacesLoading) {
    return (
      <Stack gap="lg">
        <Title order={2}>Settings</Title>
        <Skeleton height={200} />
      </Stack>
    )
  }

  if (!workspace) {
    return (
      <Stack gap="lg">
        <Title order={2}>Settings</Title>
        <Paper p="md" radius="md" withBorder>
          <Text c="dimmed">
            No workspace found. Please create or join a workspace.
          </Text>
        </Paper>
      </Stack>
    )
  }

  return (
    <Stack gap="lg">
      <Title order={2}>Settings</Title>

      {/* Team Members Section */}
      <Paper p="md" radius="md" withBorder>
        <Stack gap="md">
          <div>
            <Title order={4}>Team Members</Title>
            <Text size="sm" c="dimmed">
              Invite and manage workspace members
            </Text>
          </div>

          <Button
            leftSection={<IconUserPlus size={16} />}
            onClick={openInvite}
            w="fit-content"
          >
            Invite Member
          </Button>

          <Divider />

          <div>
            <Title order={5} mb="sm">
              Pending Invitations
            </Title>
            <PendingInvitations workspaceId={workspace.id} />
          </div>
        </Stack>
      </Paper>

      {/* Invite Modal */}
      <InviteMemberModal
        workspaceId={workspace.id}
        opened={inviteOpened}
        onClose={closeInvite}
      />
    </Stack>
  )
}
