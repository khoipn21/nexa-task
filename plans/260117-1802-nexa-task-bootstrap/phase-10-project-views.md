# Phase 10: Project Views (Kanban, List, Calendar)

## Context Links
- [React + Mantine Research](../reports/researcher-260117-1758-react-mantine-tailwind.md)
- [Phase 09: Dashboard + Workspace UI](./phase-09-dashboard-workspace-ui.md)

## Overview
- **Priority**: P2
- **Status**: pending
- **Effort**: 12h

Implement multiple project views: Kanban board with drag-drop, list view, and calendar view.

## Key Insights
- dnd-kit for drag-drop (performant, accessible)
- Kanban columns from workflow statuses
- List view with sorting/filtering
- Calendar view with FullCalendar or custom
- View state persisted in URL/localStorage

## Requirements

### Functional
- Kanban: Drag tasks between columns, reorder
- List: Sortable table with filters
- Calendar: Tasks on due dates, drag to reschedule
- Quick task creation in each view
- View switching without data refetch

### Non-Functional
- Smooth 60fps drag animations
- Optimistic updates on move
- Keyboard accessible

## Architecture

### Components
```
components/project-views/
├── kanban/
│   ├── kanban-board.tsx
│   ├── kanban-column.tsx
│   ├── task-card.tsx
│   └── add-task-inline.tsx
├── list/
│   ├── task-table.tsx
│   ├── table-filters.tsx
│   └── task-row.tsx
├── calendar/
│   ├── calendar-view.tsx
│   └── calendar-event.tsx
└── view-switcher.tsx
```

## Related Code Files

### Create
- `/apps/web/src/routes/project-detail.tsx`
- `/apps/web/src/components/project-views/kanban/kanban-board.tsx`
- `/apps/web/src/components/project-views/kanban/kanban-column.tsx`
- `/apps/web/src/components/project-views/kanban/task-card.tsx`
- `/apps/web/src/components/project-views/list/task-table.tsx`
- `/apps/web/src/components/project-views/calendar/calendar-view.tsx`
- `/apps/web/src/components/project-views/view-switcher.tsx`
- `/apps/web/src/hooks/use-tasks.ts`

## Implementation Steps

### 1. Tasks Hook
**apps/web/src/hooks/use-tasks.ts**:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useTasks(projectId: string, filters?: Record<string, string>) {
  return useQuery({
    queryKey: ['tasks', projectId, filters],
    queryFn: () => api.get(`/projects/${projectId}/tasks`, filters),
    enabled: !!projectId,
  })
}

export function useTask(taskId?: string) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: () => api.get(`/tasks/${taskId}`),
    enabled: !!taskId,
  })
}

export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { title: string; statusId?: string }) =>
      api.post(`/projects/${projectId}/tasks`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(`/tasks/${id}`, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['task', id] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useMoveTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, statusId, order }: { id: string; statusId: string; order: number }) =>
      api.post(`/tasks/${id}/move`, { statusId, order }),
    onMutate: async ({ id, statusId, order }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      const previous = queryClient.getQueryData(['tasks'])
      // Update cache optimistically...
      return { previous }
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['tasks'], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
```

### 2. Kanban Board
**apps/web/src/components/project-views/kanban/kanban-board.tsx**:
```tsx
import { DndContext, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useTasks, useMoveTask } from '@/hooks/use-tasks'
import { KanbanColumn } from './kanban-column'

type Status = { id: string; name: string; color: string }

type Props = {
  projectId: string
  statuses: Status[]
}

export function KanbanBoard({ projectId, statuses }: Props) {
  const { data: tasks = [] } = useTasks(projectId)
  const moveTask = useMoveTask()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const taskId = active.id as string
    const overId = over.id as string

    // Determine target status and position
    const targetStatus = statuses.find(s =>
      tasks.filter((t: any) => t.statusId === s.id).some((t: any) => t.id === overId)
    ) || statuses.find(s => s.id === overId)

    if (!targetStatus) return

    const columnTasks = tasks.filter((t: any) => t.statusId === targetStatus.id)
    const overIndex = columnTasks.findIndex((t: any) => t.id === overId)
    const newOrder = overIndex >= 0 ? overIndex : columnTasks.length

    moveTask.mutate({
      id: taskId,
      statusId: targetStatus.id,
      order: newOrder,
    })
  }

  // Group tasks by status
  const tasksByStatus = statuses.reduce((acc, status) => {
    acc[status.id] = tasks.filter((t: any) => t.statusId === status.id)
    return acc
  }, {} as Record<string, any[]>)

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {statuses.map(status => (
          <KanbanColumn
            key={status.id}
            status={status}
            tasks={tasksByStatus[status.id] || []}
            projectId={projectId}
          />
        ))}
      </div>
    </DndContext>
  )
}
```

### 3. Kanban Column
**apps/web/src/components/project-views/kanban/kanban-column.tsx**:
```tsx
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Paper, Text, Badge, Stack } from '@mantine/core'
import { TaskCard } from './task-card'
import { AddTaskInline } from './add-task-inline'

type Props = {
  status: { id: string; name: string; color: string }
  tasks: any[]
  projectId: string
}

export function KanbanColumn({ status, tasks, projectId }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id })

  return (
    <Paper
      ref={setNodeRef}
      className={`min-w-[280px] max-w-[280px] flex flex-col ${isOver ? 'ring-2 ring-blue-400' : ''}`}
      p="sm"
      radius="md"
      withBorder
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: status.color }}
          />
          <Text fw={600}>{status.name}</Text>
        </div>
        <Badge variant="light" size="sm">{tasks.length}</Badge>
      </div>

      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <Stack gap="xs" className="flex-1 min-h-[200px]">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </Stack>
      </SortableContext>

      <AddTaskInline projectId={projectId} statusId={status.id} />
    </Paper>
  )
}
```

### 4. Task Card (Draggable)
**apps/web/src/components/project-views/kanban/task-card.tsx**:
```tsx
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Paper, Text, Badge, Avatar, Group } from '@mantine/core'
import { Link } from 'react-router'

const priorityColors = {
  low: 'gray',
  medium: 'blue',
  high: 'orange',
  urgent: 'red',
}

type Props = {
  task: {
    id: string
    title: string
    priority: keyof typeof priorityColors
    assignee?: { name: string; avatarUrl?: string }
    dueDate?: string
  }
}

export function TaskCard({ task }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      p="sm"
      radius="sm"
      withBorder
      className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      <Text
        size="sm"
        fw={500}
        component={Link}
        to={`/tasks/${task.id}`}
        className="line-clamp-2"
      >
        {task.title}
      </Text>

      <Group mt="xs" justify="space-between">
        <Badge size="xs" color={priorityColors[task.priority]}>
          {task.priority}
        </Badge>
        {task.assignee && (
          <Avatar src={task.assignee.avatarUrl} size="sm" radius="xl">
            {task.assignee.name[0]}
          </Avatar>
        )}
      </Group>
    </Paper>
  )
}
```

### 5. View Switcher
**apps/web/src/components/project-views/view-switcher.tsx**:
```tsx
import { SegmentedControl } from '@mantine/core'
import { useSearchParams } from 'react-router'

export function ViewSwitcher() {
  const [searchParams, setSearchParams] = useSearchParams()
  const view = searchParams.get('view') || 'kanban'

  return (
    <SegmentedControl
      value={view}
      onChange={(value) => setSearchParams({ view: value })}
      data={[
        { label: 'Kanban', value: 'kanban' },
        { label: 'List', value: 'list' },
        { label: 'Calendar', value: 'calendar' },
      ]}
    />
  )
}
```

### 6. Project Detail Page
**apps/web/src/routes/project-detail.tsx**:
```tsx
import { Container, Title, Group, Skeleton, Stack } from '@mantine/core'
import { useParams, useSearchParams } from 'react-router'
import { useProject } from '@/hooks/use-projects'
import { ViewSwitcher } from '@/components/project-views/view-switcher'
import { KanbanBoard } from '@/components/project-views/kanban/kanban-board'
import { TaskTable } from '@/components/project-views/list/task-table'
import { CalendarView } from '@/components/project-views/calendar/calendar-view'

export default function ProjectDetail() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const view = searchParams.get('view') || 'kanban'
  const { data: project, isLoading } = useProject(id)

  if (isLoading) {
    return (
      <Container size="xl">
        <Skeleton height={40} mb="xl" />
        <Skeleton height={400} />
      </Container>
    )
  }

  return (
    <Container size="xl" className="h-full">
      <Stack gap="lg" className="h-full">
        <Group justify="space-between">
          <Title order={2}>{project?.name}</Title>
          <ViewSwitcher />
        </Group>

        {view === 'kanban' && (
          <KanbanBoard
            projectId={id!}
            statuses={project?.workflowStatuses || []}
          />
        )}
        {view === 'list' && <TaskTable projectId={id!} />}
        {view === 'calendar' && <CalendarView projectId={id!} />}
      </Stack>
    </Container>
  )
}
```

## Todo List
- [ ] Create tasks hooks with optimistic updates
- [ ] Implement Kanban board with dnd-kit
- [ ] Implement Kanban column component
- [ ] Implement draggable task card
- [ ] Implement inline task creation
- [ ] Implement List view with DataTable
- [ ] Implement Calendar view
- [ ] Create view switcher
- [ ] Create project detail page
- [ ] Add GSAP animations for drag

## Success Criteria
- [x] Kanban drag-drop works smoothly
- [x] Optimistic updates show immediately
- [x] List view sorts and filters
- [x] Calendar shows tasks by due date
- [x] View persists in URL

## Next Steps
- Phase 11: Task Detail + Rich Editor
