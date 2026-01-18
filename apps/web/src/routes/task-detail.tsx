import { TaskDetailContent } from '@/components/task-detail/task-detail-content'
import { useProject } from '@/hooks/use-projects'
import { useTask } from '@/hooks/use-tasks'
import { useWorkflowStatuses } from '@/hooks/use-workflow-statuses'
import { useWorkspaceMembers } from '@/hooks/use-workspace'
import {
  Alert,
  Breadcrumbs,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core'
import { IconAlertCircle, IconArrowLeft, IconHome } from '@tabler/icons-react'
import { Link, useParams } from 'react-router'

export default function TaskDetail() {
  const { id: taskId } = useParams<{ id: string }>()
  const {
    data: task,
    isLoading: taskLoading,
    isError: taskError,
  } = useTask(taskId)
  const { data: project, isLoading: projectLoading } = useProject(
    task?.projectId,
  )
  const { data: statuses = [], isLoading: statusesLoading } =
    useWorkflowStatuses(task?.projectId)
  const { data: members = [] } = useWorkspaceMembers(project?.workspaceId)

  const isLoading = taskLoading || projectLoading || statusesLoading

  if (taskError) {
    return (
      <div className="p-6">
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Task Not Found"
          color="red"
        >
          The task you're looking for doesn't exist or you don't have access to
          it.
        </Alert>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with breadcrumbs */}
      <div className="h-14 border-b border-gray-200 dark:border-dark-5 flex items-center px-6 bg-white dark:bg-dark-7 shrink-0">
        {isLoading ? (
          <Skeleton height={20} width={300} />
        ) : (
          <Breadcrumbs
            separator="/"
            classNames={{
              separator: 'text-gray-400 dark:text-gray-500 mx-2',
            }}
          >
            <Link
              to="/dashboard"
              className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors text-sm"
            >
              <IconHome size={14} />
              Dashboard
            </Link>
            {project && (
              <Link
                to={`/projects/${project.id}`}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors text-sm"
              >
                {project.name}
              </Link>
            )}
            <Text size="sm" c="dimmed" truncate className="max-w-[200px]">
              {task?.title ?? 'Task'}
            </Text>
          </Breadcrumbs>
        )}

        <Link
          to={task?.projectId ? `/projects/${task.projectId}` : '/dashboard'}
          className="ml-auto flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <IconArrowLeft size={14} />
          Back
        </Link>
      </div>

      {/* Main content */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-5xl mx-auto">
          {isLoading ? (
            <Stack gap="md">
              <Skeleton height={40} width="70%" />
              <Skeleton height={20} width={100} />
              <Skeleton height={200} />
            </Stack>
          ) : task ? (
            <TaskDetailContent
              taskId={task.id}
              statuses={statuses}
              members={members}
              projectId={task.projectId}
            />
          ) : null}
        </div>
      </ScrollArea>
    </div>
  )
}
