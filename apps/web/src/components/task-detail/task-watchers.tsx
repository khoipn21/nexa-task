import {
  useAddWatcher,
  useRemoveWatcher,
  useTaskWatchers,
  useToggleWatch,
} from '@/hooks/use-task-watchers'
import {
  ActionIcon,
  Avatar,
  Button,
  Group,
  Popover,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconBell, IconBellOff, IconPlus, IconX } from '@tabler/icons-react'

type Member = {
  id: string
  name: string
  email?: string
  avatarUrl?: string
}

type Props = {
  taskId: string
  currentUserId: string
  members: Member[]
  canManageWatchers?: boolean
}

export function TaskWatchers({
  taskId,
  currentUserId,
  members,
  canManageWatchers = false,
}: Props) {
  const [opened, { open, close }] = useDisclosure(false)
  const { data: watchers = [], isLoading } = useTaskWatchers(taskId)
  const { isWatching, toggle, isPending } = useToggleWatch(taskId, currentUserId)
  const addWatcher = useAddWatcher(taskId)
  const removeWatcher = useRemoveWatcher(taskId)

  // Get members who are not already watching
  const watcherIds = new Set(watchers.map((w) => w.userId))
  const availableMembers = members.filter((m) => !watcherIds.has(m.id))

  // Avatar stack - max 5 displayed
  const displayedWatchers = watchers.slice(0, 5)
  const overflowCount = watchers.length - 5

  const handleAddWatcher = (userId: string) => {
    addWatcher.mutate(userId)
  }

  const handleRemoveWatcher = (userId: string) => {
    removeWatcher.mutate(userId)
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>
        Watchers
      </Text>

      <Group gap="xs">
        {/* Watch/Unwatch button for current user */}
        <Tooltip label={isWatching ? 'Stop watching' : 'Watch this task'}>
          <ActionIcon
            variant={isWatching ? 'filled' : 'light'}
            color={isWatching ? 'blue' : 'gray'}
            onClick={toggle}
            loading={isPending}
          >
            {isWatching ? <IconBell size={16} /> : <IconBellOff size={16} />}
          </ActionIcon>
        </Tooltip>

        {/* Avatar stack with popover */}
        <Popover opened={opened} onClose={close} position="bottom-start" width={280}>
          <Popover.Target>
            <div onClick={open} style={{ cursor: 'pointer' }}>
              {isLoading ? (
                <Text size="xs" c="dimmed">Loading...</Text>
              ) : watchers.length === 0 ? (
                <Text size="xs" c="dimmed">No watchers</Text>
              ) : (
                <Avatar.Group spacing="sm">
                  {displayedWatchers.map((w) => (
                    <Tooltip key={w.userId} label={w.user.name}>
                      <Avatar
                        src={w.user.avatarUrl}
                        size="sm"
                        radius="xl"
                        color="blue"
                      >
                        {w.user.name?.charAt(0).toUpperCase()}
                      </Avatar>
                    </Tooltip>
                  ))}
                  {overflowCount > 0 && (
                    <Avatar size="sm" radius="xl" color="gray">
                      +{overflowCount}
                    </Avatar>
                  )}
                </Avatar.Group>
              )}
            </div>
          </Popover.Target>

          <Popover.Dropdown>
            <Stack gap="sm">
              <Text size="sm" fw={500}>
                Watchers ({watchers.length})
              </Text>

              {watchers.length === 0 ? (
                <Text size="xs" c="dimmed">
                  No one is watching this task
                </Text>
              ) : (
                <Stack gap="xs">
                  {watchers.map((w) => (
                    <Group key={w.userId} justify="space-between">
                      <Group gap="xs">
                        <Avatar
                          src={w.user.avatarUrl}
                          size="sm"
                          radius="xl"
                          color="blue"
                        >
                          {w.user.name?.charAt(0).toUpperCase()}
                        </Avatar>
                        <div>
                          <Text size="sm">{w.user.name}</Text>
                          <Text size="xs" c="dimmed">
                            {w.user.email}
                          </Text>
                        </div>
                      </Group>
                      {canManageWatchers && w.userId !== currentUserId && (
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={() => handleRemoveWatcher(w.userId)}
                          loading={removeWatcher.isPending}
                        >
                          <IconX size={14} />
                        </ActionIcon>
                      )}
                    </Group>
                  ))}
                </Stack>
              )}

              {/* Add watcher section - PM only */}
              {canManageWatchers && availableMembers.length > 0 && (
                <>
                  <Text size="xs" c="dimmed" mt="xs">
                    Add watcher
                  </Text>
                  <Stack gap="xs">
                    {availableMembers.slice(0, 5).map((m) => (
                      <Button
                        key={m.id}
                        variant="subtle"
                        size="xs"
                        leftSection={<IconPlus size={14} />}
                        onClick={() => handleAddWatcher(m.id)}
                        loading={addWatcher.isPending}
                        justify="flex-start"
                      >
                        {m.name}
                      </Button>
                    ))}
                    {availableMembers.length > 5 && (
                      <Text size="xs" c="dimmed">
                        +{availableMembers.length - 5} more members
                      </Text>
                    )}
                  </Stack>
                </>
              )}
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </Group>
    </div>
  )
}
