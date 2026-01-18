import { type Task, type TaskPriority, useTasks } from '@/hooks/use-tasks'
import { Badge, Group, Paper, Skeleton, Text } from '@mantine/core'

const priorityColors: Record<TaskPriority, string> = {
  low: 'gray',
  medium: 'blue',
  high: 'orange',
  urgent: 'red',
}

type Props = {
  projectId: string
  onTaskClick?: (taskId: string) => void
}

// Generate calendar days for current month
function getCalendarDays() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const days: Date[] = []

  // Start from the Sunday before the first day
  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - startDate.getDay())

  // End after the Saturday after the last day
  const endDate = new Date(lastDay)
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()))

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d))
  }

  return days
}

function isSameDay(date1: Date, date2: Date) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

export function CalendarView({ projectId, onTaskClick }: Props) {
  const { data: tasks, isLoading } = useTasks(projectId)
  const days = getCalendarDays()
  const now = new Date()
  const currentMonth = now.getMonth()

  if (isLoading) {
    return <Skeleton height={500} radius="md" />
  }

  // Group tasks by due date
  const tasksByDate = (tasks ?? []).reduce(
    (acc, task) => {
      if (task.dueDate) {
        const dateKey = new Date(task.dueDate).toDateString()
        acc[dateKey] = acc[dateKey] ?? []
        acc[dateKey].push(task)
      }
      return acc
    },
    {} as Record<string, Task[]>,
  )

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <Paper p="md" radius="md" withBorder>
      <Text fw={600} mb="md" ta="center">
        {now.toLocaleString('default', { month: 'long', year: 'numeric' })}
      </Text>

      {/* Week day headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <Text key={day} size="xs" fw={600} ta="center" c="dimmed">
            {day}
          </Text>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isCurrentMonth = day.getMonth() === currentMonth
          const isToday = isSameDay(day, now)
          const dayTasks = tasksByDate[day.toDateString()] ?? []

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[80px] p-1 rounded border ${
                isCurrentMonth ? 'bg-white' : 'bg-gray-50'
              } ${isToday ? 'border-blue-500 border-2' : 'border-gray-200'}`}
            >
              <Text
                size="xs"
                fw={isToday ? 700 : 400}
                c={isCurrentMonth ? 'dark' : 'dimmed'}
                mb={4}
              >
                {day.getDate()}
              </Text>
              <div className="space-y-1">
                {dayTasks.slice(0, 2).map((task) => (
                  <Group
                    key={task.id}
                    gap={4}
                    wrap="nowrap"
                    className="cursor-pointer hover:bg-gray-100 rounded px-1 transition-colors"
                    onClick={() => onTaskClick?.(task.id)}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor:
                          priorityColors[task.priority] === 'gray'
                            ? '#868e96'
                            : priorityColors[task.priority] === 'blue'
                              ? '#228be6'
                              : priorityColors[task.priority] === 'orange'
                                ? '#fd7e14'
                                : '#fa5252',
                      }}
                    />
                    <Text size="xs" truncate className="flex-1">
                      {task.title}
                    </Text>
                  </Group>
                ))}
                {dayTasks.length > 2 && (
                  <Badge size="xs" variant="light">
                    +{dayTasks.length - 2} more
                  </Badge>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Paper>
  )
}
