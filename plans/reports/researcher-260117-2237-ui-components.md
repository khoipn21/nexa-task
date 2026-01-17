# UI Components Research: Mantine 8 + @dnd-kit

**Date**: 2026-01-17
**Scope**: Workflow settings modal, watchers UI, dependency picker, file upload
**Stack**: Mantine 8.2.4, @dnd-kit/core, @dnd-kit/sortable

---

## 1. Workflow Settings Modal - Sortable Status List

### Mantine Components
- **Modal**: Standard modal wrapper with form
- **ColorInput**: Built-in color picker `<ColorInput value={color} onChange={setColor} />`
- **TextInput**: For status name/label
- **Button**: Add/Edit/Delete actions

### @dnd-kit Integration
```tsx
import { DndContext, closestCenter, PointerSensor, KeyboardSensor } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Container setup
const [statuses, setStatuses] = useState([...]);
const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
);

<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={statuses} strategy={verticalListSortingStrategy}>
    {statuses.map(status => <SortableStatusItem key={status.id} {...status} />)}
  </SortableContext>
</DndContext>

// Sortable item
function SortableStatusItem({ id, name, color }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ColorInput value={color} />
      <TextInput value={name} />
      <Button>Delete</Button>
    </div>
  );
}

// Drag handler
function handleDragEnd(event) {
  const { active, over } = event;
  if (active.id !== over.id) {
    setStatuses(items => {
      const oldIdx = items.findIndex(i => i.id === active.id);
      const newIdx = items.findIndex(i => i.id === over.id);
      return arrayMove(items, oldIdx, newIdx);
    });
  }
}
```

---

## 2. Watchers UI - User Picker & Avatar Stack

### Components
- **MultiSelect**: User picker with search `<MultiSelect searchable data={users} value={watchers} onChange={setWatchers} />`
- **Avatar.Group**: Display selected users as avatar stack
- **Button**: Subscribe/unsubscribe toggle

### Pattern
```tsx
import { MultiSelect, Avatar, Button, Group } from '@mantine/core';

const users = [
  { value: 'u1', label: 'Alice Johnson', avatar: '/avatars/alice.jpg' },
  { value: 'u2', label: 'Bob Smith', avatar: '/avatars/bob.jpg' }
];

<MultiSelect
  searchable
  data={users}
  value={selectedWatchers}
  onChange={setSelectedWatchers}
  label="Add Watchers"
/>

<Avatar.Group spacing="sm">
  {selectedWatchers.map(id => {
    const user = users.find(u => u.value === id);
    return <Avatar key={id} src={user.avatar} alt={user.label} radius="xl" />;
  })}
  {extraCount > 0 && <Avatar radius="xl">+{extraCount}</Avatar>}
</Avatar.Group>

<Button onClick={handleSubscribe}>Subscribe</Button>
```

**Note**: MultiSelect keeps dropdown open for multiple selections. Use hidden input value for form submission: `<input name="watchers" value={watchers.join(',')} />`

---

## 3. Dependency Picker - Task Search/Select

### Components
- **Combobox**: Low-level search/select (custom rendering)
- **Select**: Higher-level searchable select `<Select searchable data={tasks} />`
- **Modal**: Container for picker UI

### Search Pattern
```tsx
import { Select, Modal, Group, Text } from '@mantine/core';

const tasks = [
  { value: 't1', label: 'TASK-101: Setup auth', group: 'Backend' },
  { value: 't2', label: 'TASK-102: Design UI', group: 'Frontend' }
];

<Modal opened={pickerOpen} onClose={close}>
  <Select
    searchable
    data={tasks}
    value={selectedDep}
    onChange={setSelectedDep}
    label="Select Blocker"
  />
</Modal>

// Display current blockers
<Group>
  {blockers.map(taskId => (
    <Text key={taskId} size="sm">{getTaskLabel(taskId)}</Text>
  ))}
</Group>
```

**Advanced**: Use Combobox for custom rendering (avatars, status badges, etc.)

---

## 4. File Upload Dropzone

### Components
- **Dropzone**: Drag-drop file upload from `@mantine/dropzone`
- **Progress**: Upload progress bar
- **Group/Stack**: File list layout

### Implementation
```tsx
import { Dropzone } from '@mantine/dropzone';
import { Progress, Group, Text, Stack } from '@mantine/core';
import { useState } from 'react';

const [files, setFiles] = useState([]);
const [uploading, setUploading] = useState(false);
const [progress, setProgress] = useState(0);

<Dropzone
  onDrop={(droppedFiles) => handleUpload(droppedFiles)}
  loading={uploading}
  loaderProps={{ size: 'xl', color: 'blue' }}
  accept={['image/*', 'application/pdf']}
>
  <Text>Drop files here or click to select</Text>
</Dropzone>

{uploading && <Progress value={progress} />}

<Stack>
  {files.map(file => (
    <Group key={file.name}>
      <Text>{file.name}</Text>
      <Text size="sm" c="dimmed">{formatBytes(file.size)}</Text>
    </Group>
  ))}
</Stack>

async function handleUpload(files) {
  setUploading(true);
  // Use axios/fetch with onUploadProgress for progress tracking
  // Update setProgress() callback
  setUploading(false);
}
```

**Props**:
- `loading`: Disables dropzone during upload
- `loaderProps`: Customize loader appearance
- `accept`: File type restrictions (MIME types)
- `maxSize`: File size limit

---

## Key Integration Notes

1. **@dnd-kit + Mantine**: Spread `{...attributes} {...listeners}` on draggable elements, apply `style` with transform/transition
2. **Form Integration**: Use `form.getInputProps()` from `@mantine/form` for validation
3. **MultiSelect**: Dropdown stays open, use `hiddenValuesDivider` prop for custom separators
4. **ColorInput**: Standalone, requires `useState` hook
5. **Avatar.Group**: No wrapper divs around Avatar children, use `spacing` prop
6. **Dropzone**: From separate package `@mantine/dropzone`, needs `@mantine/notifications` for upload feedback

## Unresolved Questions
- Should sortable status items use DragOverlay for better UX during drag?
- File upload: Server endpoint pattern (presigned URLs vs direct upload)?
- Watchers: Real-time subscription updates via WebSocket or polling?
