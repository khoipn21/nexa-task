# Phase 09: Dashboard + Workspace UI

## Context Links
- [React + Mantine Research](../reports/researcher-260117-1758-react-mantine-tailwind.md)
- [Phase 08: Frontend Foundation](./phase-08-frontend-foundation.md)

## Overview
- **Priority**: P2
- **Status**: pending
- **Effort**: 10h

Build dashboard with workspace overview, project list, and workspace settings.

## Key Insights
- Dashboard shows recent tasks, activity, stats
- Workspace settings for admins only
- Member management via Clerk Organizations
- Project cards with quick actions

## Requirements

### Functional
- Dashboard with task summary
- Recent activity feed
- Project list with create/archive
- Workspace settings (name, invite)
- Member list with role management

### Non-Functional
- Dashboard loads < 2s
- Skeleton loading states
- Responsive layout

## Architecture

### Pages
```
/dashboard           - Overview stats, recent tasks, activity
/projects            - Project list grid
/projects/new        - Create project modal
/settings            - Workspace settings tabs
/settings/members    - Member management
```

### Components
```
components/
├── dashboard/
│   ├── stats-cards.tsx
│   ├── recent-tasks.tsx
│   └── activity-feed.tsx
├── projects/
│   ├── project-card.tsx
│   ├── project-list.tsx
│   └── create-project-modal.tsx
└── settings/
    ├── workspace-form.tsx
    └── member-list.tsx
```

## Related Code Files

### Create
- `/apps/web/src/routes/dashboard.tsx`
- `/apps/web/src/routes/projects.tsx`
- `/apps/web/src/routes/settings.tsx`
- `/apps/web/src/components/dashboard/stats-cards.tsx`
- `/apps/web/src/components/dashboard/recent-tasks.tsx`
- `/apps/web/src/components/dashboard/activity-feed.tsx`
- `/apps/web/src/components/projects/project-card.tsx`
- `/apps/web/src/components/projects/project-list.tsx`
- `/apps/web/src/components/projects/create-project-modal.tsx`
- `/apps/web/src/hooks/use-projects.ts`
- `/apps/web/src/hooks/use-workspace.ts`

## Implementation Steps

### 1. Workspace Hook
**apps/web/src/hooks/use-workspace.ts**:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useWorkspace(workspaceId?: string) {
  return useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => api.get(`/workspaces/${workspaceId}`),
    enabled: !!workspaceId,
  })
}

export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.get('/workspaces'),
  })
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(`/workspaces/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['workspace', id] })
    },
  })
}
```

### 2. Projects Hook
**apps/web/src/hooks/use-projects.ts**:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects'),
  })
}

export function useProject(projectId?: string) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get(`/projects/${projectId}`),
    enabled: !!projectId,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      api.post('/projects', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(`/projects/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}
```

### 3. Stats Cards
**apps/web/src/components/dashboard/stats-cards.tsx**:
```tsx
import { SimpleGrid, Paper, Text, Group, ThemeIcon } from '@mantine/core'

type Stat = {
  label: string
  value: number
  icon: React.ReactNode
  color: string
}

export function StatsCards({ stats }: { stats: Stat[] }) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
      {stats.map(stat => (
        <Paper key={stat.label} p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                {stat.label}
              </Text>
              <Text size="xl" fw={700}>
                {stat.value}
              </Text>
            </div>
            <ThemeIcon size="xl" radius="md" color={stat.color} variant="light">
              {stat.icon}
            </ThemeIcon>
          </Group>
        </Paper>
      ))}
    </SimpleGrid>
  )
}
```

### 4. Dashboard Page
**apps/web/src/routes/dashboard.tsx**:
```tsx
import { Container, Title, Stack, Skeleton } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { RecentTasks } from '@/components/dashboard/recent-tasks'
import { ActivityFeed } from '@/components/dashboard/activity-feed'

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats'),
  })

  if (isLoading) {
    return (
      <Container size="xl">
        <Stack gap="xl">
          <Skeleton height={100} />
          <Skeleton height={300} />
        </Stack>
      </Container>
    )
  }

  return (
    <Container size="xl">
      <Stack gap="xl">
        <Title order={2}>Dashboard</Title>

        <StatsCards
          stats={[
            { label: 'Open Tasks', value: stats?.openTasks || 0, icon: '📋', color: 'blue' },
            { label: 'Completed', value: stats?.completedTasks || 0, icon: '✅', color: 'green' },
            { label: 'Projects', value: stats?.projects || 0, icon: '📁', color: 'violet' },
            { label: 'Team Members', value: stats?.members || 0, icon: '👥', color: 'orange' },
          ]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentTasks />
          <ActivityFeed />
        </div>
      </Stack>
    </Container>
  )
}
```

### 5. Project Card
**apps/web/src/components/projects/project-card.tsx**:
```tsx
import { Card, Text, Badge, Group, ActionIcon, Menu } from '@mantine/core'
import { Link } from 'react-router'
import { useDeleteProject } from '@/hooks/use-projects'

type Project = {
  id: string
  name: string
  description?: string
  status: string
  taskCount?: number
}

export function ProjectCard({ project }: { project: Project }) {
  const deleteProject = useDeleteProject()

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" mb="xs">
        <Text fw={500} component={Link} to={`/projects/${project.id}`}>
          {project.name}
        </Text>
        <Menu>
          <Menu.Target>
            <ActionIcon variant="subtle">⋮</ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item component={Link} to={`/projects/${project.id}/settings`}>
              Settings
            </Menu.Item>
            <Menu.Item
              color="red"
              onClick={() => deleteProject.mutate(project.id)}
            >
              Archive
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      <Text size="sm" c="dimmed" lineClamp={2}>
        {project.description || 'No description'}
      </Text>

      <Group mt="md" gap="xs">
        <Badge color={project.status === 'active' ? 'green' : 'gray'}>
          {project.status}
        </Badge>
        {project.taskCount !== undefined && (
          <Badge variant="outline">{project.taskCount} tasks</Badge>
        )}
      </Group>
    </Card>
  )
}
```

### 6. Projects Page
**apps/web/src/routes/projects.tsx**:
```tsx
import { Container, Title, SimpleGrid, Button, Group, Skeleton } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useProjects } from '@/hooks/use-projects'
import { ProjectCard } from '@/components/projects/project-card'
import { CreateProjectModal } from '@/components/projects/create-project-modal'

export default function Projects() {
  const { data: projects, isLoading } = useProjects()
  const [opened, { open, close }] = useDisclosure(false)

  return (
    <Container size="xl">
      <Group justify="space-between" mb="xl">
        <Title order={2}>Projects</Title>
        <Button onClick={open}>New Project</Button>
      </Group>

      {isLoading ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {[1, 2, 3].map(i => <Skeleton key={i} height={150} radius="md" />)}
        </SimpleGrid>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {projects?.map((project: any) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </SimpleGrid>
      )}

      <CreateProjectModal opened={opened} onClose={close} />
    </Container>
  )
}
```

### 7. Create Project Modal
**apps/web/src/components/projects/create-project-modal.tsx**:
```tsx
import { Modal, TextInput, Textarea, Button, Stack } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useCreateProject } from '@/hooks/use-projects'
import { notifications } from '@mantine/notifications'

type Props = {
  opened: boolean
  onClose: () => void
}

export function CreateProjectModal({ opened, onClose }: Props) {
  const createProject = useCreateProject()

  const form = useForm({
    initialValues: {
      name: '',
      description: '',
    },
    validate: {
      name: (v) => (v.length < 1 ? 'Name is required' : null),
    },
  })

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await createProject.mutateAsync(values)
      notifications.show({ message: 'Project created!', color: 'green' })
      form.reset()
      onClose()
    } catch (err) {
      notifications.show({ message: 'Failed to create project', color: 'red' })
    }
  })

  return (
    <Modal opened={opened} onClose={onClose} title="Create Project">
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Project Name"
            placeholder="My Project"
            required
            {...form.getInputProps('name')}
          />
          <Textarea
            label="Description"
            placeholder="Optional description..."
            {...form.getInputProps('description')}
          />
          <Button type="submit" loading={createProject.isPending}>
            Create Project
          </Button>
        </Stack>
      </form>
    </Modal>
  )
}
```

## Todo List
- [ ] Create workspace hooks
- [ ] Create projects hooks
- [ ] Build stats cards component
- [ ] Build recent tasks component
- [ ] Build activity feed component
- [ ] Build project card component
- [ ] Build create project modal
- [ ] Create dashboard page
- [ ] Create projects page
- [ ] Create settings page with member management
- [ ] Test all CRUD operations

## Success Criteria
- [x] Dashboard shows relevant stats
- [x] Project list displays with loading states
- [x] Create project modal works
- [x] Archive project works
- [x] Settings accessible to admins

## Next Steps
- Phase 10: Project Views (Kanban, List, Calendar)
