import { Group, Paper, SimpleGrid, Text, ThemeIcon } from '@mantine/core'
import type { ReactNode } from 'react'

type Stat = {
  label: string
  value: number
  icon: ReactNode
  color: string
}

export function StatsCards({ stats }: { stats: Stat[] }) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
      {stats.map((stat) => (
        <Paper key={stat.label} p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                {stat.label}
              </Text>
              <Text size="xl" fw={700}>
                {stat.value}
              </Text>
            </div>
            <ThemeIcon size="xl" radius="md" color={stat.color} variant="light">
              {stat.icon}
            </ThemeIcon>
          </Group>
        </Paper>
      ))}
    </SimpleGrid>
  )
}
