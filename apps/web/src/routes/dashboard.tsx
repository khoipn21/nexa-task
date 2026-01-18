import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { RecentTasks } from '@/components/dashboard/recent-tasks'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { useDashboardStats } from '@/hooks/use-workspace'
import {
  Container,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import {
  IconCheckbox,
  IconChecklist,
  IconFolder,
  IconUsers,
} from '@tabler/icons-react'

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats()

  if (isLoading) {
    return (
      <Container size="lg">
        <Stack gap="lg">
          <div>
            <Title order={2}>Dashboard</Title>
            <Text c="dimmed" size="sm">
              Welcome to Nexa Task
            </Text>
          </div>
          <Skeleton height={100} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton height={300} />
            <Skeleton height={300} />
          </div>
        </Stack>
      </Container>
    )
  }

  return (
    <Container size="lg">
      <Stack gap="lg">
        <div>
          <Title order={2}>Dashboard</Title>
          <Text c="dimmed" size="sm">
            Welcome to Nexa Task
          </Text>
        </div>

        <StatsCards
          stats={[
            {
              label: 'Open Tasks',
              value: stats?.openTasks ?? 0,
              icon: (
                <ThemeIcon size="lg" variant="light" color="blue">
                  <IconChecklist size={20} />
                </ThemeIcon>
              ),
              color: 'blue',
            },
            {
              label: 'Completed',
              value: stats?.completedTasks ?? 0,
              icon: (
                <ThemeIcon size="lg" variant="light" color="green">
                  <IconCheckbox size={20} />
                </ThemeIcon>
              ),
              color: 'green',
            },
            {
              label: 'Projects',
              value: stats?.projects ?? 0,
              icon: (
                <ThemeIcon size="lg" variant="light" color="violet">
                  <IconFolder size={20} />
                </ThemeIcon>
              ),
              color: 'violet',
            },
            {
              label: 'Team Members',
              value: stats?.members ?? 0,
              icon: (
                <ThemeIcon size="lg" variant="light" color="orange">
                  <IconUsers size={20} />
                </ThemeIcon>
              ),
              color: 'orange',
            },
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
