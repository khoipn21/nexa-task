import {
  type WorkflowStatus,
  useDeleteStatus,
  useUpdateStatus,
} from '@/hooks/use-workflow-statuses'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ActionIcon,
  Badge,
  Checkbox,
  ColorInput,
  Group,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconCheck,
  IconGripVertical,
  IconPencil,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { useState } from 'react'

type Props = {
  status: WorkflowStatus
  projectId: string
  taskCount?: number
}

export function SortableStatusItem({
  status,
  projectId,
  taskCount = 0,
}: Props) {
  const [isEditing, { open: startEdit, close: endEdit }] = useDisclosure(false)
  const [editName, setEditName] = useState(status.name)
  const [editColor, setEditColor] = useState(status.color)

  const updateStatus = useUpdateStatus(projectId)
  const deleteStatus = useDeleteStatus(projectId)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: status.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleSave = () => {
    if (!editName.trim()) return
    updateStatus.mutate(
      {
        statusId: status.id,
        data: { name: editName.trim(), color: editColor },
      },
      { onSuccess: endEdit },
    )
  }

  const handleCancel = () => {
    setEditName(status.name)
    setEditColor(status.color)
    endEdit()
  }

  const handleToggleDefault = () => {
    updateStatus.mutate({
      statusId: status.id,
      data: { isDefault: !status.isDefault },
    })
  }

  const handleToggleFinal = () => {
    updateStatus.mutate({
      statusId: status.id,
      data: { isFinal: !status.isFinal },
    })
  }

  const handleDelete = () => {
    if (taskCount > 0) {
      const confirmed = window.confirm(
        `This status has ${taskCount} task(s). Deleting it will unassign those tasks. Are you sure?`,
      )
      if (confirmed) {
        deleteStatus.mutate(status.id)
      }
    } else {
      deleteStatus.mutate(status.id)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 bg-white dark:bg-dark-600 border border-gray-200 dark:border-dark-400 rounded-md"
    >
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        style={{ cursor: 'grab' }}
        {...attributes}
        {...listeners}
      >
        <IconGripVertical size={16} />
      </ActionIcon>

      {isEditing ? (
        <>
          <TextInput
            value={editName}
            onChange={(e) => setEditName(e.currentTarget.value)}
            size="xs"
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') handleCancel()
            }}
          />
          <ColorInput
            value={editColor}
            onChange={setEditColor}
            size="xs"
            w={100}
            withEyeDropper={false}
          />
          <ActionIcon
            variant="subtle"
            color="green"
            size="sm"
            onClick={handleSave}
            loading={updateStatus.isPending}
          >
            <IconCheck size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={handleCancel}
          >
            <IconX size={16} />
          </ActionIcon>
        </>
      ) : (
        <>
          <Badge color={status.color} size="sm" variant="filled" circle />
          <Text size="sm" className="flex-1">
            {status.name}
          </Text>

          <Group gap={4}>
            {status.isDefault && (
              <Badge size="xs" variant="light" color="blue">
                Default
              </Badge>
            )}
            {status.isFinal && (
              <Badge size="xs" variant="light" color="green">
                Final
              </Badge>
            )}
          </Group>

          <Tooltip label="Set as default (initial status for new tasks)">
            <Checkbox
              size="xs"
              checked={status.isDefault}
              onChange={handleToggleDefault}
              disabled={updateStatus.isPending}
            />
          </Tooltip>

          <Tooltip label="Set as final (marks task as complete)">
            <Checkbox
              size="xs"
              checked={status.isFinal}
              onChange={handleToggleFinal}
              disabled={updateStatus.isPending}
            />
          </Tooltip>

          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={startEdit}
          >
            <IconPencil size={16} />
          </ActionIcon>

          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            onClick={handleDelete}
            loading={deleteStatus.isPending}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </>
      )}
    </div>
  )
}
