import { type Project, useProjects } from '@/hooks/use-projects'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Menu,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  ThemeIcon,
  useMantineTheme,
} from '@mantine/core'
import {
  IconArchive,
  IconDotsVertical,
  IconExternalLink,
  IconFolderPlus,
  IconSettings,
} from '@tabler/icons-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { ProjectCard } from './project-card'

type Props = {
  onCreate: () => void
  searchQuery?: string
  viewMode?: 'grid' | 'list'
}

export function ProjectList({
  onCreate,
  searchQuery = '',
  viewMode = 'grid',
}: Props) {
  const { data: projects, isLoading } = useProjects()
  const navigate = useNavigate()
  const theme = useMantineTheme()

  // Filter projects by search query
  const filteredProjects = useMemo(() => {
    if (!projects) return []
    if (!searchQuery.trim()) return projects

    const query = searchQuery.toLowerCase()
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query),
    )
  }, [projects, searchQuery])

  if (isLoading) {
    return (
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height={150} radius="md" />
        ))}
      </SimpleGrid>
    )
  }

  if (!projects?.length) {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <ThemeIcon size={64} radius="xl" variant="light" color="gray">
            <IconFolderPlus size={32} />
          </ThemeIcon>
          <Text c="dimmed" ta="center">
            No projects yet. Click "New Project" to get started.
          </Text>
          <Button onClick={onCreate} variant="light">
            New Project
          </Button>
        </Stack>
      </Center>
    )
  }

  if (filteredProjects.length === 0) {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <ThemeIcon size={64} radius="xl" variant="light" color="gray">
            <IconFolderPlus size={32} />
          </ThemeIcon>
          <Text c="dimmed" ta="center">
            No projects match your search.
          </Text>
        </Stack>
      </Center>
    )
  }

  // Grid view
  if (viewMode === 'grid') {
    return (
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {filteredProjects.map((project: Project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </SimpleGrid>
    )
  }

  // List view
  return (
    <Table highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Project</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th>Tasks</Table.Th>
          <Table.Th w={60} />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {filteredProjects.map((project: Project) => {
          const projectColor = project.color || 'blue'
          return (
            <Table.Tr
              key={project.id}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <Table.Td>
                <Group gap="sm" wrap="nowrap">
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
                  <div style={{ minWidth: 0 }}>
                    <Text fw={500} truncate>
                      {project.name}
                    </Text>
                    {project.description && (
                      <Text size="xs" c="dimmed" truncate>
                        {project.description}
                      </Text>
                    )}
                  </div>
                </Group>
              </Table.Td>
              <Table.Td>
                <Badge
                  size="sm"
                  variant={project.status === 'active' ? 'light' : 'outline'}
                  color={project.status === 'active' ? 'green' : 'gray'}
                >
                  {project.status}
                </Badge>
              </Table.Td>
              <Table.Td>
                {project.taskCount !== undefined ? (
                  <Text size="sm">{project.taskCount} tasks</Text>
                ) : (
                  <Text size="sm" c="dimmed">
                    —
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
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
                      onClick={(e) => e.stopPropagation()}
                    >
                      Archive
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Table.Td>
            </Table.Tr>
          )
        })}
      </Table.Tbody>
    </Table>
  )
}
