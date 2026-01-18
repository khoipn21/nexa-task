import { WorkflowSettingsModal } from '@/components/project-settings/workflow-settings-modal'
import { CalendarView } from '@/components/project-views/calendar/calendar-view'
import { KanbanBoard } from '@/components/project-views/kanban/kanban-board'
import { TaskTable } from '@/components/project-views/list/task-table'
import { ViewSwitcher } from '@/components/project-views/view-switcher'
import { TaskDetailPanel } from '@/components/task-detail/task-detail-panel'
import { useProject } from '@/hooks/use-projects'
import { useViewPreference } from '@/hooks/use-view-preference'
import { useWorkspaceMembers } from '@/hooks/use-workspace'
import {
  ActionIcon,
  Container,
  Group,
  Skeleton,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconSettings } from '@tabler/icons-react'
import { useState } from 'react'
import { useParams } from 'react-router'

// Default workflow statuses if project doesn't have them yet
const defaultStatuses = [
  { id: 'backlog', name: 'Backlog', color: '#868e96' },
  { id: 'todo', name: 'To Do', color: '#228be6' },
  { id: 'in-progress', name: 'In Progress', color: '#fab005' },
  { id: 'review', name: 'Review', color: '#be4bdb' },
  { id: 'done', name: 'Done', color: '#40c057' },
]

export default function ProjectDetail() {
  const { id } = useParams()
  const { data: project, isLoading } = useProject(id)
  const { viewMode } = useViewPreference(id)
  const { data: members = [] } = useWorkspaceMembers(project?.workspaceId)
  const [settingsOpened, { open: openSettings, close: closeSettings }] =
    useDisclosure(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId)
  }

  const handleCloseTaskDetail = () => {
    setSelectedTaskId(null)
  }

  if (isLoading) {
    return (
      <Container size="lg">
        <Skeleton height={40} mb="xl" />
        <Skeleton height={400} />
      </Container>
    )
  }

  if (!project) {
    return (
      <Container size="lg">
        <Text c="dimmed">Project not found</Text>
      </Container>
    )
  }

  const statuses = project.workflowStatuses?.length
    ? project.workflowStatuses
    : defaultStatuses

  return (
    <Container size="lg" className="h-full">
      <Stack gap="lg" className="h-full">
        <Group justify="space-between">
          <div>
            <Title order={2}>{project.name}</Title>
            {project.description && (
              <Text c="dimmed" size="sm">
                {project.description}
              </Text>
            )}
          </div>
          {id && (
            <Group gap="sm">
              <ViewSwitcher projectId={id} />
              <Tooltip label="Workflow settings">
                <ActionIcon variant="subtle" size="lg" onClick={openSettings}>
                  <IconSettings size={20} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}
        </Group>

        {viewMode === 'kanban' && id && (
          <KanbanBoard
            projectId={id}
            statuses={statuses}
            onTaskClick={handleTaskClick}
          />
        )}
        {viewMode === 'list' && id && (
          <TaskTable projectId={id} onTaskClick={handleTaskClick} />
        )}
        {viewMode === 'calendar' && id && (
          <CalendarView projectId={id} onTaskClick={handleTaskClick} />
        )}
      </Stack>

      {id && (
        <WorkflowSettingsModal
          projectId={id}
          opened={settingsOpened}
          onClose={closeSettings}
        />
      )}

      {id && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={handleCloseTaskDetail}
          statuses={statuses}
          members={members}
          projectId={id}
        />
      )}
    </Container>
  )
}
