import { useCreateStatus } from '@/hooks/use-workflow-statuses'
import { ActionIcon, ColorInput, Group, TextInput } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { useState } from 'react'

type Props = {
  projectId: string
}

const DEFAULT_COLOR = '#6366f1'

export function AddStatusForm({ projectId }: Props) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)

  const createStatus = useCreateStatus(projectId)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    createStatus.mutate(
      { name: name.trim(), color },
      {
        onSuccess: () => {
          setName('')
          setColor(DEFAULT_COLOR)
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <Group gap="xs">
        <TextInput
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="New status name..."
          size="sm"
          className="flex-1"
        />
        <ColorInput
          value={color}
          onChange={setColor}
          size="sm"
          w={100}
          withEyeDropper={false}
        />
        <ActionIcon
          type="submit"
          variant="filled"
          color="blue"
          size="lg"
          loading={createStatus.isPending}
          disabled={!name.trim()}
        >
          <IconPlus size={18} />
        </ActionIcon>
      </Group>
    </form>
  )
}
