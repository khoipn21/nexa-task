import { type Project, useDeleteProject } from '@/hooks/use-projects'
import {
  ActionIcon,
  Badge,
  Box,
  Card,
  Group,
  Menu,
  Progress,
  Stack,
  Text,
  Tooltip,
  useMantineTheme,
} from '@mantine/core'
import {
  IconArchive,
  IconDotsVertical,
  IconExternalLink,
  IconSettings,
} from '@tabler/icons-react'
import { Link, useNavigate } from 'react-router'

// Project color mapping for visual distinction
const PROJECT_COLORS = [
  'blue',
  'violet',
  'grape',
  'pink',
  'red',
  'orange',
  'yellow',
  'lime',
  'green',
  'teal',
  'cyan',
  'indigo',
] as const

function getProjectColor(projectId: string): string {
  // Generate consistent color from project ID
  const hash = projectId
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return PROJECT_COLORS[hash % PROJECT_COLORS.length] ?? 'blue'
}

export function ProjectCard({ project }: { project: Project }) {
  const deleteProject = useDeleteProject()
  const navigate = useNavigate()
  const theme = useMantineTheme()
  const projectColor = project.color || getProjectColor(project.id)

  // Calculate task progress
  const completedTasks = project.completedTaskCount ?? 0
  const totalTasks = project.taskCount ?? 0
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

  const handleCardClick = () => {
    navigate(`/projects/${project.id}`)
  }

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      style={{
        cursor: 'pointer',
        transition: 'all 200ms ease',
        borderTop: `3px solid ${theme.colors[projectColor]?.[5] ?? theme.colors.blue[5]}`,
      }}
      styles={{
        root: {
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: theme.shadows.md,
          },
        },
      }}
      onClick={handleCardClick}
    >
      <Stack gap="sm">
        {/* Header with title and menu */}
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <Box
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor:
                  theme.colors[projectColor]?.[5] ?? theme.colors.blue[5],
                flexShrink: 0,
              }}
            />
            <Text fw={600} truncate style={{ flex: 1 }}>
              {project.name}
            </Text>
          </Group>

          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={(e) => e.stopPropagation()}
                aria-label="Project options"
              >
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconExternalLink size={14} />}
                component={Link}
                to={`/projects/${project.id}`}
                onClick={(e) => e.stopPropagation()}
              >
                Open Project
              </Menu.Item>
              <Menu.Item
                leftSection={<IconSettings size={14} />}
                component={Link}
                to={`/projects/${project.id}/settings`}
                onClick={(e) => e.stopPropagation()}
              >
                Settings
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconArchive size={14} />}
                color="red"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteProject.mutate(project.id)
                }}
              >
                Archive
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        {/* Description */}
        <Text size="sm" c="dimmed" lineClamp={2} style={{ minHeight: 40 }}>
          {project.description || 'No description'}
        </Text>

        {/* Progress bar */}
        {totalTasks > 0 && (
          <Tooltip
            label={`${completedTasks} of ${totalTasks} tasks completed`}
            position="bottom"
          >
            <Box>
              <Progress
                value={progress}
                size="sm"
                radius="xl"
                color={progress === 100 ? 'green' : projectColor}
              />
            </Box>
          </Tooltip>
        )}

        {/* Footer with badges */}
        <Group gap="xs" mt="xs">
          <Badge
            size="sm"
            variant={project.status === 'active' ? 'light' : 'outline'}
            color={project.status === 'active' ? 'green' : 'gray'}
          >
            {project.status}
          </Badge>
          {totalTasks > 0 && (
            <Badge size="sm" variant="outline" color="gray">
              {completedTasks}/{totalTasks} tasks
            </Badge>
          )}
        </Group>
      </Stack>
    </Card>
  )
}
