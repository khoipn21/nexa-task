# React + Mantine v7 + Tailwind v4 + GSAP Integration Research

**Research Date:** 2026-01-17
**Focus:** Task management UI with Kanban board, rich text editing, animations, real-time updates

---

## 1. Mantine v7 + Tailwind v4 Integration

### Key Architectural Changes

**Mantine v7:**
- Migrated from Emotion to native CSS/CSS Modules
- Provides `postcss-preset-mantine` for mixins (`@dark/@light`)
- Styles via `@import '@mantine/core/styles.layer.css'`

**Tailwind v4 (Released Jan 22, 2025):**
- CSS-first configuration (CSS variables replace `tailwind.config.js`)
- Oxide engine for performance
- Native CSS cascade layers
- `@import "tailwindcss"` directive (replaces `@tailwind`)

### Critical Configuration

**PostCSS Setup (`postcss.config.cjs`):**
```javascript
export default {
  plugins: {
    'postcss-preset-mantine': {},
    '@tailwindcss/postcss': {},
  },
};
```

**CSS Import Order (`globals.css`):**
```css
@layer theme, base, components, utilities;

@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css";

/* Import Mantine AFTER Tailwind core layers */
@import '@mantine/core/styles.layer.css';
```

**Vite Plugin (Alternative):**
```typescript
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [tailwindcss()],
});
```

### Mantine Component with Tailwind Utilities

```tsx
import { TextInput } from '@mantine/core';

function Demo() {
  return (
    <TextInput
      classNames={{
        root: 'mt-4',
        input: 'bg-blue-50 dark:bg-gray-800',
      }}
    />
  );
}
```

**Conflict Resolution:** Cascade layers ensure predictable style precedence. Tailwind utilities in `utilities` layer override Mantine defaults when applied via `classNames` prop.

---

## 2. Kanban Board with dnd-kit

### Installation
```bash
npm install @dnd-kit/core @dnd-kit/sortable
```

### Multi-Container Sortable Pattern

```tsx
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable Task Card
function TaskCard({ id, task }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {task.title}
    </div>
  );
}

// Kanban Column
function KanbanColumn({ columnId, tasks }) {
  return (
    <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
      {tasks.map(task => <TaskCard key={task.id} id={task.id} task={task} />)}
    </SortableContext>
  );
}

// Main Kanban Board
function KanbanBoard() {
  const [columns, setColumns] = useState({
    todo: [{ id: '1', title: 'Task 1' }],
    inProgress: [],
    done: [],
  });

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Find source/target columns
    const sourceCol = Object.keys(columns).find(key =>
      columns[key].some(t => t.id === active.id)
    );
    const targetCol = Object.keys(columns).find(key =>
      columns[key].some(t => t.id === over.id) || key === over.id
    );

    setColumns(prev => {
      const sourceTasks = [...prev[sourceCol]];
      const targetTasks = sourceCol === targetCol ? sourceTasks : [...prev[targetCol]];

      const oldIndex = sourceTasks.findIndex(t => t.id === active.id);
      const newIndex = targetTasks.findIndex(t => t.id === over.id);

      const [movedTask] = sourceTasks.splice(oldIndex, 1);
      targetTasks.splice(newIndex >= 0 ? newIndex : targetTasks.length, 0, movedTask);

      return {
        ...prev,
        [sourceCol]: sourceTasks,
        [targetCol]: targetTasks,
      };
    });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      {Object.entries(columns).map(([key, tasks]) => (
        <KanbanColumn key={key} columnId={key} tasks={tasks} />
      ))}
    </DndContext>
  );
}
```

---

## 3. Rich Text Editor with TipTap

### Installation
```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-task-list @tiptap/extension-task-item
```

### Task Description Editor

```tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';

function TaskEditor({ content, onChange }) {
  const editor = useEditor({
    extensions: [StarterKit, TaskList, TaskItem],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  return (
    <div>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }) {
  if (!editor) return null;

  return (
    <div className="flex gap-2 p-2 border-b">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={editor.isActive('bold') ? 'bg-blue-100' : ''}
      >
        Bold
      </button>
      <button
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        className={editor.isActive('taskList') ? 'bg-blue-100' : ''}
      >
        Checklist
      </button>
    </div>
  );
}
```

---

## 4. GSAP Animations

### Installation
```bash
npm install gsap
```

### React Integration with useGSAP Hook

```tsx
import { useRef, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(Flip);

function AnimatedKanbanCard({ task }) {
  const cardRef = useRef(null);

  useLayoutEffect(() => {
    gsap.fromTo(cardRef.current,
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
    );
  }, []);

  return <div ref={cardRef}>{task.title}</div>;
}

// Flip animation for drag reordering
function useFlipAnimation(tasks) {
  const containerRef = useRef(null);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const state = Flip.getState('.task-card');

    Flip.from(state, {
      duration: 0.5,
      ease: 'power1.inOut',
      absolute: true,
    });
  }, [tasks]);

  return containerRef;
}
```

---

## 5. TanStack Query + Real-time Updates

### Installation
```bash
npm install @tanstack/react-query
```

### WebSocket Integration Pattern

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

// Custom WebSocket hook
function useWebSocket(url, onMessage) {
  useEffect(() => {
    const ws = new WebSocket(url);
    ws.onmessage = (event) => onMessage(JSON.parse(event.data));
    return () => ws.close();
  }, [url, onMessage]);
}

// Task query with real-time updates
function useTasks() {
  const queryClient = useQueryClient();

  const { data: tasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => fetch('/api/tasks').then(r => r.json()),
    staleTime: Infinity, // WebSocket drives updates
  });

  // WebSocket listener
  useWebSocket('ws://api/tasks', (message) => {
    if (message.type === 'TASK_UPDATE') {
      queryClient.setQueryData(['tasks'], (old) =>
        old.map(t => t.id === message.task.id ? message.task : t)
      );
    }
  });

  // Optimistic mutation
  const updateTask = useMutation({
    mutationFn: (task) => fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify(task),
    }),
    onMutate: async (newTask) => {
      await queryClient.cancelQueries(['tasks']);
      const previous = queryClient.getQueryData(['tasks']);

      queryClient.setQueryData(['tasks'], (old) =>
        old.map(t => t.id === newTask.id ? { ...t, ...newTask } : t)
      );

      return { previous };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['tasks'], context.previous);
    },
  });

  return { tasks, updateTask };
}
```

---

## 6. React Router v7

### Data Loading Pattern

```tsx
import { createBrowserRouter, useLoaderData } from 'react-router';

const router = createBrowserRouter([
  {
    path: '/board/:boardId',
    loader: async ({ params }) => {
      const board = await fetch(`/api/boards/${params.boardId}`).then(r => r.json());
      return { board };
    },
    Component: BoardView,
  },
]);

function BoardView() {
  const { board } = useLoaderData();
  return <KanbanBoard board={board} />;
}
```

---

## Integration Summary

**Tech Stack:**
- Mantine v7 (components) + Tailwind v4 (utilities)
- dnd-kit (drag-drop)
- TipTap (rich text)
- GSAP (animations)
- TanStack Query (server state + WebSocket)
- React Router v7 (routing)

**Critical Patterns:**
1. CSS cascade layers prevent Mantine/Tailwind conflicts
2. dnd-kit multi-container sortable for Kanban columns
3. TipTap with task-list extension for checklists
4. GSAP Flip plugin for smooth drag animations
5. WebSocket invalidates TanStack Query cache for real-time sync
6. Optimistic updates with rollback on error

**Unresolved Questions:**
- Specific WebSocket library preference (native WebSocket vs Socket.io)?
- Persistence layer (REST API vs GraphQL vs tRPC)?
- State management beyond TanStack Query (Zustand/Jotai for UI state)?
