import { api } from '@/lib/api'
import { Group, Progress, Stack, Text, rem } from '@mantine/core'
import {
  Dropzone,
  type FileRejection,
  type FileWithPath,
  MIME_TYPES,
} from '@mantine/dropzone'
import { notifications } from '@mantine/notifications'
import { IconFile, IconUpload, IconX } from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024

// Accepted file types - must match backend ALLOWED_MIME_TYPES
const ACCEPTED_TYPES = [
  MIME_TYPES.png,
  MIME_TYPES.jpeg,
  MIME_TYPES.gif,
  MIME_TYPES.pdf,
  MIME_TYPES.doc,
  MIME_TYPES.docx,
  MIME_TYPES.xls,
  MIME_TYPES.xlsx,
  MIME_TYPES.zip,
  'application/x-rar-compressed',
  'text/plain',
  'text/csv',
]

type Props = {
  taskId: string
}

type UploadProgress = {
  fileName: string
  progress: number
  status: 'uploading' | 'success' | 'error'
  error?: string
}

export function FileDropzone({ taskId }: Props) {
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState<UploadProgress[]>([])

  const uploadFile = useMutation({
    mutationFn: async (file: FileWithPath) => {
      // Use multipart form data for proper file upload
      const formData = new FormData()
      formData.append('file', file)

      // Upload to server with actual file (not blob URL)
      const response = await api.upload(
        `/tasks/${taskId}/attachments`,
        formData,
      )
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-attachments', taskId] })
    },
  })

  const handleDrop = useCallback(
    async (files: FileWithPath[]) => {
      // Initialize progress tracking
      setUploading(
        files.map((f) => ({
          fileName: f.name,
          progress: 0,
          status: 'uploading' as const,
        })),
      )

      const results: { success: number; failed: string[] } = {
        success: 0,
        failed: [],
      }

      // Upload files sequentially
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (!file) continue

        try {
          // Update progress to 30% (starting upload)
          setUploading((prev) =>
            prev.map((p, idx) => (idx === i ? { ...p, progress: 30 } : p)),
          )

          await uploadFile.mutateAsync(file)

          // Update progress to 100% with success status
          setUploading((prev) =>
            prev.map((p, idx) =>
              idx === i
                ? { ...p, progress: 100, status: 'success' as const }
                : p,
            ),
          )
          results.success++
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Upload failed'
          setUploading((prev) =>
            prev.map((p, idx) =>
              idx === i
                ? { ...p, status: 'error' as const, error: message }
                : p,
            ),
          )
          results.failed.push(file.name)
        }
      }

      // Show summary notification if there were failures
      if (results.failed.length > 0) {
        notifications.show({
          title: 'Upload Summary',
          message: `${results.success} succeeded, ${results.failed.length} failed: ${results.failed.join(', ')}`,
          color: results.success > 0 ? 'yellow' : 'red',
          autoClose: 5000,
        })
      }

      // Clear progress after delay
      setTimeout(() => setUploading([]), 2000)
    },
    [uploadFile.mutateAsync],
  )

  const handleReject = useCallback((files: FileRejection[]) => {
    for (const rejection of files) {
      const errorMessages = rejection.errors.map((e) => e.message).join(', ')
      notifications.show({
        title: 'File rejected',
        message: `${rejection.file.name}: ${errorMessages}`,
        color: 'red',
      })
    }
  }, [])

  return (
    <Stack gap="xs">
      <Dropzone
        onDrop={handleDrop}
        onReject={handleReject}
        maxSize={MAX_FILE_SIZE}
        accept={ACCEPTED_TYPES}
        multiple
      >
        <Group
          justify="center"
          gap="xl"
          mih={80}
          style={{ pointerEvents: 'none' }}
        >
          <Dropzone.Accept>
            <IconUpload
              style={{
                width: rem(32),
                height: rem(32),
                color: 'var(--mantine-color-blue-6)',
              }}
              stroke={1.5}
            />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX
              style={{
                width: rem(32),
                height: rem(32),
                color: 'var(--mantine-color-red-6)',
              }}
              stroke={1.5}
            />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconFile
              style={{
                width: rem(32),
                height: rem(32),
                color: 'var(--mantine-color-dimmed)',
              }}
              stroke={1.5}
            />
          </Dropzone.Idle>

          <div>
            <Text size="sm" inline>
              Drag files here or click to select
            </Text>
            <Text size="xs" c="dimmed" inline mt={4}>
              Max 10MB per file
            </Text>
          </div>
        </Group>
      </Dropzone>

      {/* Upload progress indicators */}
      {uploading.length > 0 && (
        <Stack gap="xs">
          {uploading.map((upload) => (
            <div key={upload.fileName}>
              <Text
                size="xs"
                c={upload.status === 'error' ? 'red' : 'dimmed'}
                mb={2}
              >
                {upload.fileName}
                {upload.status === 'error' &&
                  upload.error &&
                  ` - ${upload.error}`}
              </Text>
              <Progress
                value={upload.status === 'error' ? 100 : upload.progress}
                size="sm"
                color={
                  upload.status === 'error'
                    ? 'red'
                    : upload.status === 'success'
                      ? 'green'
                      : 'blue'
                }
                animated={upload.status === 'uploading'}
              />
            </div>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
