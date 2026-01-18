import { api } from '@/lib/api'
import { ActionIcon, Group, Paper, Skeleton, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconFile, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileDropzone } from './file-dropzone'

type Attachment = {
  id: string
  fileName: string
  fileUrl: string
  fileSize: number
  mimeType: string
  uploadedBy?: {
    name: string
  }
}

type Props = {
  taskId: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function TaskAttachments({ taskId }: Props) {
  const queryClient = useQueryClient()

  const { data: attachments = [], isLoading } = useQuery<Attachment[]>({
    queryKey: ['task-attachments', taskId],
    queryFn: () => api.get(`/tasks/${taskId}/attachments`),
  })

  const deleteAttachment = useMutation({
    mutationFn: (attachmentId: string) =>
      api.delete(`/attachments/${attachmentId}`),
    onMutate: async (attachmentId) => {
      await queryClient.cancelQueries({
        queryKey: ['task-attachments', taskId],
      })
      const previous = queryClient.getQueryData<Attachment[]>([
        'task-attachments',
        taskId,
      ])

      queryClient.setQueryData<Attachment[]>(
        ['task-attachments', taskId],
        (old = []) => old.filter((a) => a.id !== attachmentId),
      )

      return { previous }
    },
    onError: (_err, _attachmentId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['task-attachments', taskId], context.previous)
      }
      notifications.show({
        title: 'Failed to delete attachment',
        message: 'Could not delete file. Please try again.',
        color: 'red',
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['task-attachments', taskId] })
    },
  })

  if (isLoading) {
    return <Skeleton height={120} />
  }

  return (
    <Stack gap="md">
      <Text size="sm" fw={600}>
        Attachments ({attachments.length})
      </Text>

      {/* File upload dropzone */}
      <FileDropzone taskId={taskId} />

      {/* File list */}
      {attachments.length === 0 ? (
        <Text size="sm" c="dimmed">
          No attachments yet
        </Text>
      ) : (
        <Stack gap="xs">
          {attachments.map((attachment) => (
            <Paper key={attachment.id} p="xs" withBorder>
              <Group justify="space-between">
                <Group gap="xs">
                  <IconFile size={16} />
                  <div>
                    <Text
                      size="sm"
                      component="a"
                      href={attachment.fileUrl}
                      target="_blank"
                      className="hover:underline"
                    >
                      {attachment.fileName}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {formatFileSize(attachment.fileSize)}
                      {attachment.uploadedBy &&
                        ` • ${attachment.uploadedBy.name}`}
                    </Text>
                  </div>
                </Group>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="red"
                  onClick={() => deleteAttachment.mutate(attachment.id)}
                  loading={deleteAttachment.isPending}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
