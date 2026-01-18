# Phase 11: Task Detail + Rich Editor

## Context Links
- [React + Mantine Research](../reports/researcher-260117-1758-react-mantine-tailwind.md)
- [Phase 10: Project Views](./phase-10-project-views.md)

## Overview
- **Priority**: P2
- **Status**: pending
- **Effort**: 10h

Build task detail view with rich text editor, metadata editing, dependencies, and watchers.

## Key Insights
- TipTap for rich text (extensible, React-friendly)
- Task detail as slide-over panel or full page
- Inline editing for fields
- Dependency graph visualization
- Auto-save with debounce

## Requirements

### Functional
- View/edit task title, description (rich text)
- Assignee, priority, due date pickers
- Status change via dropdown
- Dependencies management
- Watchers list
- Attachments list with upload

### Non-Functional
- Auto-save within 2s of edit
- Rich text loads < 500ms
- Keyboard shortcuts

## Architecture

### Components
```
components/task-detail/
├── task-detail-panel.tsx
├── task-header.tsx
├── task-editor.tsx          # TipTap rich text
├── task-sidebar.tsx         # Metadata fields
├── task-dependencies.tsx
├── task-attachments.tsx
└── task-watchers.tsx
```

## Related Code Files

### Create
- `/apps/web/src/routes/task-detail.tsx`
- `/apps/web/src/components/task-detail/task-detail-panel.tsx`
- `/apps/web/src/components/task-detail/task-header.tsx`
- `/apps/web/src/components/task-detail/task-editor.tsx`
- `/apps/web/src/components/task-detail/task-sidebar.tsx`
- `/apps/web/src/components/task-detail/task-dependencies.tsx`
- `/apps/web/src/components/task-detail/task-attachments.tsx`
- `/apps/web/src/hooks/use-debounce.ts`

## Implementation Steps

### 1. Debounce Hook
**apps/web/src/hooks/use-debounce.ts**:
```typescript
import { useEffect, useRef, useCallback } from 'react'

export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
) {
  const timeoutRef = useRef<NodeJS.Timeout>()

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    [callback, delay]
  )

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return debouncedCallback
}
```

### 2. TipTap Editor
**apps/web/src/components/task-detail/task-editor.tsx**:
```tsx
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { ActionIcon, Group, Paper } from '@mantine/core'
import { useDebouncedCallback } from '@/hooks/use-debounce'

type Props = {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

export function TaskEditor({ content, onChange, placeholder }: Props) {
  const debouncedOnChange = useDebouncedCallback(onChange, 1000)

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: placeholder || 'Add description...' }),
    ],
    content,
    onUpdate: ({ editor }) => {
      debouncedOnChange(editor.getHTML())
    },
  })

  if (!editor) return null

  return (
    <Paper className="border rounded-md">
      {/* Toolbar */}
      <Group gap="xs" p="xs" className="border-b">
        <ActionIcon
          variant={editor.isActive('bold') ? 'filled' : 'subtle'}
          onClick={() => editor.chain().focus().toggleBold().run()}
          size="sm"
        >
          B
        </ActionIcon>
        <ActionIcon
          variant={editor.isActive('italic') ? 'filled' : 'subtle'}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          size="sm"
        >
          I
        </ActionIcon>
        <ActionIcon
          variant={editor.isActive('bulletList') ? 'filled' : 'subtle'}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          size="sm"
        >
          •
        </ActionIcon>
        <ActionIcon
          variant={editor.isActive('taskList') ? 'filled' : 'subtle'}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          size="sm"
        >
          ☑
        </ActionIcon>
      </Group>

      {/* Editor */}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 min-h-[200px] focus:outline-none"
      />
    </Paper>
  )
}
```

### 3. Task Sidebar (Metadata)
**apps/web/src/components/task-detail/task-sidebar.tsx**:
```tsx
import { Stack, Select, Text, Avatar, Group, Badge } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { useUpdateTask } from '@/hooks/use-tasks'

type Props = {
  task: {
    id: string
    statusId: string
    priority: string
    assigneeId?: string
    assignee?: { id: string; name: string; avatarUrl?: string }
    dueDate?: string
  }
  statuses: { id: string; name: string; color: string }[]
  members: { id: string; name: string; avatarUrl?: string }[]
}

export function TaskSidebar({ task, statuses, members }: Props) {
  const updateTask = useUpdateTask()

  const handleUpdate = (field: string, value: any) => {
    updateTask.mutate({ id: task.id, data: { [field]: value } })
  }

  return (
    <Stack gap="md" className="w-64">
      {/* Status */}
      <div>
        <Text size="xs" c="dimmed" mb={4}>Status</Text>
        <Select
          value={task.statusId}
          onChange={(v) => handleUpdate('statusId', v)}
          data={statuses.map(s => ({
            value: s.id,
            label: s.name,
          }))}
        />
      </div>

      {/* Priority */}
      <div>
        <Text size="xs" c="dimmed" mb={4}>Priority</Text>
        <Select
          value={task.priority}
          onChange={(v) => handleUpdate('priority', v)}
          data={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'urgent', label: 'Urgent' },
          ]}
        />
      </div>

      {/* Assignee */}
      <div>
        <Text size="xs" c="dimmed" mb={4}>Assignee</Text>
        <Select
          value={task.assigneeId}
          onChange={(v) => handleUpdate('assigneeId', v)}
          data={members.map(m => ({
            value: m.id,
            label: m.name,
          }))}
          clearable
          placeholder="Unassigned"
        />
      </div>

      {/* Due Date */}
      <div>
        <Text size="xs" c="dimmed" mb={4}>Due Date</Text>
        <DatePickerInput
          value={task.dueDate ? new Date(task.dueDate) : null}
          onChange={(v) => handleUpdate('dueDate', v?.toISOString())}
          clearable
          placeholder="No due date"
        />
      </div>
    </Stack>
  )
}
```

### 4. Task Dependencies
**apps/web/src/components/task-detail/task-dependencies.tsx**:
```tsx
import { Stack, Text, Paper, Group, ActionIcon, Badge } from '@mantine/core'
import { Link } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

type Props = {
  taskId: string
}

export function TaskDependencies({ taskId }: Props) {
  const queryClient = useQueryClient()

  const { data: dependencies = [] } = useQuery({
    queryKey: ['task-dependencies', taskId],
    queryFn: () => api.get(`/tasks/${taskId}/dependencies`),
  })

  const removeDependency = useMutation({
    mutationFn: (depId: string) =>
      api.delete(`/tasks/${taskId}/dependencies/${depId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-dependencies', taskId] })
    },
  })

  return (
    <Stack gap="xs">
      <Text size="sm" fw={600}>Blocked By</Text>

      {dependencies.length === 0 ? (
        <Text size="sm" c="dimmed">No blockers</Text>
      ) : (
        dependencies.map((dep: any) => (
          <Paper key={dep.id} p="xs" withBorder>
            <Group justify="space-between">
              <Text
                size="sm"
                component={Link}
                to={`/tasks/${dep.dependsOn.id}`}
                className="hover:underline"
              >
                {dep.dependsOn.title}
              </Text>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="red"
                onClick={() => removeDependency.mutate(dep.dependsOnId)}
              >
                ×
              </ActionIcon>
            </Group>
          </Paper>
        ))
      )}

      {/* Add dependency UI would go here */}
    </Stack>
  )
}
```

### 5. Task Detail Panel
**apps/web/src/components/task-detail/task-detail-panel.tsx**:
```tsx
import { Drawer, Title, Group, Stack, Divider, TextInput } from '@mantine/core'
import { useState, useEffect } from 'react'
import { useTask, useUpdateTask } from '@/hooks/use-tasks'
import { TaskEditor } from './task-editor'
import { TaskSidebar } from './task-sidebar'
import { TaskDependencies } from './task-dependencies'
import { TaskAttachments } from './task-attachments'
import { useDebouncedCallback } from '@/hooks/use-debounce'

type Props = {
  taskId: string | null
  onClose: () => void
  statuses: any[]
  members: any[]
}

export function TaskDetailPanel({ taskId, onClose, statuses, members }: Props) {
  const { data: task, isLoading } = useTask(taskId || undefined)
  const updateTask = useUpdateTask()

  const [title, setTitle] = useState('')

  useEffect(() => {
    if (task) setTitle(task.title)
  }, [task])

  const debouncedUpdateTitle = useDebouncedCallback((value: string) => {
    if (taskId && value !== task?.title) {
      updateTask.mutate({ id: taskId, data: { title: value } })
    }
  }, 1000)

  const handleTitleChange = (value: string) => {
    setTitle(value)
    debouncedUpdateTitle(value)
  }

  const handleDescriptionChange = (html: string) => {
    if (taskId) {
      updateTask.mutate({ id: taskId, data: { description: html } })
    }
  }

  return (
    <Drawer
      opened={!!taskId}
      onClose={onClose}
      position="right"
      size="xl"
      title={null}
      padding="lg"
    >
      {task && (
        <div className="flex gap-6">
          {/* Main content */}
          <Stack className="flex-1" gap="lg">
            <TextInput
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              variant="unstyled"
              size="xl"
              className="font-bold"
              placeholder="Task title"
            />

            <TaskEditor
              content={task.description || ''}
              onChange={handleDescriptionChange}
            />

            <Divider />

            <TaskDependencies taskId={task.id} />

            <Divider />

            <TaskAttachments taskId={task.id} />
          </Stack>

          {/* Sidebar */}
          <TaskSidebar
            task={task}
            statuses={statuses}
            members={members}
          />
        </div>
      )}
    </Drawer>
  )
}
```

## Todo List
- [ ] Install TipTap packages
- [ ] Create debounce hook
- [ ] Build TipTap editor with toolbar
- [ ] Build task sidebar (metadata fields)
- [ ] Build dependencies component
- [ ] Build attachments component
- [ ] Build watchers component
- [ ] Create task detail panel/page
- [ ] Implement auto-save
- [ ] Add keyboard shortcuts

## Success Criteria
- [x] Rich text editing works
- [x] Metadata changes save automatically
- [x] Dependencies can be added/removed
- [x] Attachments upload and display
- [x] Panel closes without losing data

## Next Steps
- Phase 12: Comments + Activity Feed
