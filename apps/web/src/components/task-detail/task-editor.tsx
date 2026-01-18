import { useDebouncedCallback } from '@/hooks/use-debounce'
import { ActionIcon, Group, Paper } from '@mantine/core'
import {
  IconBold,
  IconItalic,
  IconList,
  IconListCheck,
} from '@tabler/icons-react'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

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
      Placeholder.configure({
        placeholder: placeholder || 'Add description...',
      }),
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
          <IconBold size={16} />
        </ActionIcon>
        <ActionIcon
          variant={editor.isActive('italic') ? 'filled' : 'subtle'}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          size="sm"
        >
          <IconItalic size={16} />
        </ActionIcon>
        <ActionIcon
          variant={editor.isActive('bulletList') ? 'filled' : 'subtle'}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          size="sm"
        >
          <IconList size={16} />
        </ActionIcon>
        <ActionIcon
          variant={editor.isActive('taskList') ? 'filled' : 'subtle'}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          size="sm"
        >
          <IconListCheck size={16} />
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
