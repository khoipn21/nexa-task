# Phase 3: Frontend UI Implementation

## Context Links

- [Plan Overview](./plan.md)
- [Phase 2: Backend API](./phase-02-backend-api.md)
- [Research: Clerk Org Invites](./research/researcher-01-clerk-org-invites.md)
- [Existing Routes](../apps/web/src/routes/index.tsx)

## Overview

**Priority:** P1
**Status:** pending
**Effort:** 2.5h

Implement invite member modal for workspace settings and accept-invite page that handles Clerk ticket-based authentication.

## Key Insights

From research:
- Accept page receives `__clerk_ticket` and `__clerk_status` query params
- Use `useSignIn`/`useSignUp` hooks with `strategy: 'ticket'`
- `__clerk_status`: `sign_in` = existing user, `sign_up` = new user
- After successful auth, Clerk auto-adds user to org; redirect to dashboard

## Requirements

### Functional
- [ ] Invite member modal with email + role inputs
- [ ] Pending invitations list in workspace settings
- [ ] Accept invite page with Clerk auth handling
- [ ] Loading states and error handling
- [ ] Success redirect to dashboard

### Non-functional
- [ ] Mobile responsive
- [ ] Accessible (ARIA labels, keyboard navigation)
- [ ] Mantine component library consistency

## Architecture

```
Workspace Settings Page
├── Invite Member Button → Opens InviteMemberModal
├── Pending Invitations List
│   ├── Email, Role, Sent Date
│   └── Revoke Button
└── Members List (existing)

Accept Invite Page (/accept-invite)
├── Parse __clerk_ticket, __clerk_status from URL
├── Show loading state
├── If sign_in: Use useSignIn with ticket strategy
├── If sign_up: Show signup form with ticket
├── On success: Redirect to /dashboard
└── On error: Show error message
```

## Related Code Files

**Create:**
- `/mnt/k/Work/nexa-task/apps/web/src/components/workspace-settings/invite-member-modal.tsx`
- `/mnt/k/Work/nexa-task/apps/web/src/components/workspace-settings/pending-invitations.tsx`
- `/mnt/k/Work/nexa-task/apps/web/src/routes/workspace-settings.tsx`
- `/mnt/k/Work/nexa-task/apps/web/src/routes/accept-invite.tsx`
- `/mnt/k/Work/nexa-task/apps/web/src/hooks/use-invitations.ts`

**Modify:**
- `/mnt/k/Work/nexa-task/apps/web/src/routes/index.tsx` - Add routes
- `/mnt/k/Work/nexa-task/apps/web/src/routes/settings.tsx` - Link to workspace settings

## Implementation Steps

### 1. Create invitation hooks

File: `/mnt/k/Work/nexa-task/apps/web/src/hooks/use-invitations.ts`

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface Invitation {
  id: string
  inviteeEmail: string
  role: string
  status: string
  sentAt: string
  expiresAt: string
  inviter?: {
    name: string
    email: string
  }
}

interface CreateInvitationInput {
  email: string
  role: 'super_admin' | 'pm' | 'member' | 'guest'
}

export function useInvitations(workspaceId: string) {
  const queryClient = useQueryClient()

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ['invitations', workspaceId],
    queryFn: () => api.get<Invitation[]>(`/workspaces/${workspaceId}/invitations`),
    enabled: !!workspaceId,
  })

  const createInvitation = useMutation({
    mutationFn: (data: CreateInvitationInput) =>
      api.post<Invitation>(`/workspaces/${workspaceId}/invitations`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', workspaceId] })
    },
  })

  const revokeInvitation = useMutation({
    mutationFn: (invitationId: string) =>
      api.delete<Invitation>(`/workspaces/${workspaceId}/invitations/${invitationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', workspaceId] })
    },
  })

  return {
    invitations,
    isLoading,
    createInvitation,
    revokeInvitation,
  }
}
```

### 2. Create invite member modal

File: `/mnt/k/Work/nexa-task/apps/web/src/components/workspace-settings/invite-member-modal.tsx`

```tsx
import { Button, Modal, Select, Stack, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { useInvitations } from '@/hooks/use-invitations'

interface InviteMemberModalProps {
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

export function InviteMemberModal({
  workspaceId,
  opened,
  onClose,
}: InviteMemberModalProps) {
  const { createInvitation } = useInvitations(workspaceId)

  const form = useForm({
    initialValues: {
      email: '',
      role: 'member' as const,
    },
    validate: {
      email: (value) => (!value.includes('@') ? 'Invalid email' : null),
    },
  })

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await createInvitation.mutateAsync(values)
      notifications.show({
        title: 'Invitation sent',
        message: `Invitation sent to ${values.email}`,
        color: 'green',
      })
      form.reset()
      onClose()
    } catch (error: any) {
      notifications.show({
        title: 'Failed to send invitation',
        message: error.message || 'Something went wrong',
        color: 'red',
      })
    }
  })

  return (
    <Modal opened={opened} onClose={onClose} title="Invite Member">
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Email address"
            placeholder="colleague@company.com"
            required
            {...form.getInputProps('email')}
          />
          <Select
            label="Role"
            data={ROLE_OPTIONS}
            {...form.getInputProps('role')}
          />
          <Button type="submit" loading={createInvitation.isPending}>
            Send Invitation
          </Button>
        </Stack>
      </form>
    </Modal>
  )
}
```

### 3. Create pending invitations component

File: `/mnt/k/Work/nexa-task/apps/web/src/components/workspace-settings/pending-invitations.tsx`

```tsx
import { ActionIcon, Badge, Group, Paper, Stack, Text } from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import { useInvitations } from '@/hooks/use-invitations'
import { formatDistanceToNow } from 'date-fns'

interface PendingInvitationsProps {
  workspaceId: string
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'red',
  pm: 'blue',
  member: 'green',
  guest: 'gray',
}

export function PendingInvitations({ workspaceId }: PendingInvitationsProps) {
  const { invitations, isLoading, revokeInvitation } = useInvitations(workspaceId)

  if (isLoading) {
    return <Text c="dimmed">Loading invitations...</Text>
  }

  if (invitations.length === 0) {
    return <Text c="dimmed">No pending invitations</Text>
  }

  return (
    <Stack gap="xs">
      {invitations.map((invitation) => (
        <Paper key={invitation.id} p="sm" withBorder>
          <Group justify="space-between">
            <div>
              <Group gap="xs">
                <Text fw={500}>{invitation.inviteeEmail}</Text>
                <Badge color={ROLE_COLORS[invitation.role]} size="sm">
                  {invitation.role}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed">
                Sent {formatDistanceToNow(new Date(invitation.sentAt))} ago
              </Text>
            </div>
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={() => revokeInvitation.mutate(invitation.id)}
              loading={revokeInvitation.isPending}
              aria-label="Revoke invitation"
            >
              <IconX size={16} />
            </ActionIcon>
          </Group>
        </Paper>
      ))}
    </Stack>
  )
}
```

### 4. Create workspace settings page

File: `/mnt/k/Work/nexa-task/apps/web/src/routes/workspace-settings.tsx`

```tsx
import { Button, Divider, Paper, Stack, Title } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconUserPlus } from '@tabler/icons-react'
import { useOrganization } from '@clerk/clerk-react'
import { InviteMemberModal } from '@/components/workspace-settings/invite-member-modal'
import { PendingInvitations } from '@/components/workspace-settings/pending-invitations'
import { useWorkspace } from '@/hooks/use-workspace'

export default function WorkspaceSettings() {
  const { organization } = useOrganization()
  const { workspace } = useWorkspace()
  const [opened, { open, close }] = useDisclosure(false)

  if (!workspace) {
    return <div>Loading...</div>
  }

  return (
    <Stack gap="lg">
      <Title order={2}>Workspace Settings</Title>

      <Paper p="md" radius="md" withBorder>
        <Stack gap="md">
          <div>
            <Title order={4}>Invite Members</Title>
            <Button
              leftSection={<IconUserPlus size={16} />}
              onClick={open}
              mt="sm"
            >
              Invite Member
            </Button>
          </div>

          <Divider />

          <div>
            <Title order={5} mb="sm">Pending Invitations</Title>
            <PendingInvitations workspaceId={workspace.id} />
          </div>
        </Stack>
      </Paper>

      <InviteMemberModal
        workspaceId={workspace.id}
        opened={opened}
        onClose={close}
      />
    </Stack>
  )
}
```

### 5. Create accept-invite page

File: `/mnt/k/Work/nexa-task/apps/web/src/routes/accept-invite.tsx`

```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useSignIn, useSignUp, useAuth } from '@clerk/clerk-react'
import {
  Alert,
  Button,
  Center,
  Loader,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconAlertCircle, IconCheck } from '@tabler/icons-react'

export default function AcceptInvite() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isSignedIn } = useAuth()
  const { signIn, setActive: setSignInActive } = useSignIn()
  const { signUp, setActive: setSignUpActive } = useSignUp()

  const ticket = searchParams.get('__clerk_ticket')
  const status = searchParams.get('__clerk_status') // 'sign_in' or 'sign_up'

  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showSignUpForm, setShowSignUpForm] = useState(false)

  const form = useForm({
    initialValues: {
      firstName: '',
      lastName: '',
      password: '',
    },
    validate: {
      firstName: (v) => (v.length < 1 ? 'Required' : null),
      lastName: (v) => (v.length < 1 ? 'Required' : null),
      password: (v) => (v.length < 8 ? 'Min 8 characters' : null),
    },
  })

  // Handle sign_in flow (existing user)
  useEffect(() => {
    if (!signIn || !ticket || status !== 'sign_in' || isSignedIn) return

    const acceptInvite = async () => {
      setIsProcessing(true)
      setError(null)

      try {
        const result = await signIn.create({
          strategy: 'ticket',
          ticket,
        })

        if (result.status === 'complete' && result.createdSessionId) {
          await setSignInActive({ session: result.createdSessionId })
          navigate('/dashboard')
        }
      } catch (err: any) {
        console.error('Sign-in error:', err)
        setError(err.errors?.[0]?.message || 'Failed to accept invitation')
      } finally {
        setIsProcessing(false)
      }
    }

    acceptInvite()
  }, [signIn, ticket, status, isSignedIn, setSignInActive, navigate])

  // Show signup form for new users
  useEffect(() => {
    if (status === 'sign_up' && ticket && !isSignedIn) {
      setShowSignUpForm(true)
    }
  }, [status, ticket, isSignedIn])

  // Already signed in? Redirect
  useEffect(() => {
    if (isSignedIn) {
      navigate('/dashboard')
    }
  }, [isSignedIn, navigate])

  // Handle sign_up form submission
  const handleSignUp = form.onSubmit(async (values) => {
    if (!signUp || !ticket) return

    setIsProcessing(true)
    setError(null)

    try {
      const result = await signUp.create({
        strategy: 'ticket',
        ticket,
        firstName: values.firstName,
        lastName: values.lastName,
        password: values.password,
      })

      if (result.status === 'complete' && result.createdSessionId) {
        await setSignUpActive({ session: result.createdSessionId })
        navigate('/dashboard')
      }
    } catch (err: any) {
      console.error('Sign-up error:', err)
      setError(err.errors?.[0]?.message || 'Failed to create account')
    } finally {
      setIsProcessing(false)
    }
  })

  // No ticket = invalid URL
  if (!ticket) {
    return (
      <Center h="100vh">
        <Paper p="xl" radius="md" withBorder>
          <Alert icon={<IconAlertCircle />} color="red" title="Invalid Link">
            This invitation link is invalid or has expired.
          </Alert>
        </Paper>
      </Center>
    )
  }

  // Show signup form for new users
  if (showSignUpForm) {
    return (
      <Center h="100vh">
        <Paper p="xl" radius="md" withBorder w={400}>
          <Stack>
            <Title order={3}>Complete Your Account</Title>
            <Text c="dimmed" size="sm">
              Create your account to join the workspace
            </Text>

            {error && (
              <Alert icon={<IconAlertCircle />} color="red">
                {error}
              </Alert>
            )}

            <form onSubmit={handleSignUp}>
              <Stack>
                <TextInput
                  label="First Name"
                  required
                  {...form.getInputProps('firstName')}
                />
                <TextInput
                  label="Last Name"
                  required
                  {...form.getInputProps('lastName')}
                />
                <PasswordInput
                  label="Password"
                  required
                  {...form.getInputProps('password')}
                />
                <Button type="submit" loading={isProcessing}>
                  Create Account & Join
                </Button>
              </Stack>
            </form>
          </Stack>
        </Paper>
      </Center>
    )
  }

  // Processing state
  return (
    <Center h="100vh">
      <Paper p="xl" radius="md" withBorder>
        <Stack align="center" gap="md">
          {error ? (
            <>
              <Alert icon={<IconAlertCircle />} color="red" title="Error">
                {error}
              </Alert>
              <Button onClick={() => navigate('/sign-in')}>
                Go to Sign In
              </Button>
            </>
          ) : (
            <>
              <Loader size="lg" />
              <Text>Processing invitation...</Text>
            </>
          )}
        </Stack>
      </Paper>
    </Center>
  )
}
```

### 6. Update routes

File: `/mnt/k/Work/nexa-task/apps/web/src/routes/index.tsx`

Add new routes:

```tsx
import AcceptInvite from './accept-invite'
import WorkspaceSettings from './workspace-settings'

// Add to router config:
{
  path: '/accept-invite',
  element: <AcceptInvite />,
},
// Inside protected routes children:
{ path: 'workspace-settings', element: <WorkspaceSettings /> },
```

### 7. Add use-workspace hook (if not exists)

File: `/mnt/k/Work/nexa-task/apps/web/src/hooks/use-workspace.ts`

```typescript
import { useOrganization } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useWorkspace() {
  const { organization } = useOrganization()

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.get('/workspaces'),
  })

  // Find workspace matching current org
  const workspace = workspaces.find(
    (w: any) => w.clerkOrgId === organization?.id
  )

  return { workspace, workspaces }
}
```

## Todo List

- [ ] Create `use-invitations.ts` hook
- [ ] Create `invite-member-modal.tsx` component
- [ ] Create `pending-invitations.tsx` component
- [ ] Create `workspace-settings.tsx` route
- [ ] Create `accept-invite.tsx` route
- [ ] Add `/accept-invite` route to router
- [ ] Add `/workspace-settings` route to router
- [ ] Add `use-workspace.ts` hook if missing
- [ ] Add link to workspace settings in sidebar
- [ ] Test invitation flow end-to-end
- [ ] Test signup flow for new users
- [ ] Test signin flow for existing users

## Success Criteria

- [ ] Can open invite modal and send invitation
- [ ] Pending invitations show in list
- [ ] Can revoke pending invitation
- [ ] New user can complete signup via invite link
- [ ] Existing user auto-signs in via invite link
- [ ] User redirected to dashboard after acceptance
- [ ] User appears in workspace members list

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Clerk hooks not available | High | Check Clerk provider wrapping |
| Ticket expired | Medium | Show clear error message |
| User already in org | Low | Clerk handles gracefully |

## Security Considerations

- Accept page validates ticket presence
- No sensitive data in URL (token is one-time use)
- Form validates password requirements
- XSS prevented via React escaping

## Next Steps

After completion, proceed to [Phase 4: Testing](./phase-04-testing.md)
