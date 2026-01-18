import {
  useReorderStatuses,
  useWorkflowStatuses,
} from '@/hooks/use-workflow-statuses'
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Button, Group, Modal, Skeleton, Stack, Text } from '@mantine/core'
import { IconSettings } from '@tabler/icons-react'
import { useState } from 'react'
import { AddStatusForm } from './add-status-form'
import { SortableStatusItem } from './sortable-status-item'

type Props = {
  projectId: string
  opened: boolean
  onClose: () => void
}

export function WorkflowSettingsModal({ projectId, opened, onClose }: Props) {
  const { data: statuses = [], isLoading } = useWorkflowStatuses(projectId)
  const reorderStatuses = useReorderStatuses(projectId)

  // Local state for optimistic reorder
  const [localOrder, setLocalOrder] = useState<string[] | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Use local order if set, otherwise sort by order field
  const sortedStatuses = localOrder
    ? localOrder.map((id) => statuses.find((s) => s.id === id)).filter(Boolean)
    : [...statuses].sort((a, b) => a.order - b.order)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sortedStatuses.findIndex((s) => s?.id === active.id)
    const newIndex = sortedStatuses.findIndex((s) => s?.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const currentIds = sortedStatuses
      .map((s) => s?.id)
      .filter((id): id is string => id != null)
    const newOrder = arrayMove(currentIds, oldIndex, newIndex)

    // Optimistic local update
    setLocalOrder(newOrder)

    // Persist to server
    reorderStatuses.mutate(newOrder, {
      onSettled: () => {
        setLocalOrder(null) // Clear local state after server responds
      },
    })
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconSettings size={20} />
          <Text fw={500}>Workflow Settings</Text>
        </Group>
      }
      size="lg"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Manage workflow statuses for this project. Drag to reorder, click to
          edit.
        </Text>

        {isLoading ? (
          <Stack gap="xs">
            <Skeleton height={48} />
            <Skeleton height={48} />
            <Skeleton height={48} />
          </Stack>
        ) : sortedStatuses.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="md">
            No statuses defined. Add one below.
          </Text>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortedStatuses
                .map((s) => s?.id)
                .filter((id): id is string => id != null)}
              strategy={verticalListSortingStrategy}
            >
              <Stack gap="xs">
                {sortedStatuses
                  .filter(
                    (status): status is NonNullable<typeof status> =>
                      status != null,
                  )
                  .map((status) => (
                    <SortableStatusItem
                      key={status.id}
                      status={status}
                      projectId={projectId}
                    />
                  ))}
              </Stack>
            </SortableContext>
          </DndContext>
        )}

        <AddStatusForm projectId={projectId} />

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
