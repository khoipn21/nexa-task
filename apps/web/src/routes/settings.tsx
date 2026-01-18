import { Paper, Stack, Text, Title } from '@mantine/core'

export default function Settings() {
  return (
    <Stack gap="lg">
      <Title order={2}>Settings</Title>
      <Paper p="md" radius="md" withBorder>
        <Text c="dimmed">Settings page coming soon.</Text>
      </Paper>
    </Stack>
  )
}
