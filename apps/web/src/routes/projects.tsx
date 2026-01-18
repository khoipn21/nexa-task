import { CreateProjectModal } from '@/components/projects/create-project-modal'
import { ProjectList } from '@/components/projects/project-list'
import {
  Button,
  Center,
  Container,
  Group,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { useDebouncedValue, useDisclosure } from '@mantine/hooks'
import {
  IconLayoutGrid,
  IconLayoutList,
  IconPlus,
  IconSearch,
} from '@tabler/icons-react'
import { useState } from 'react'

export default function Projects() {
  const [opened, { open, close }] = useDisclosure(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch] = useDebouncedValue(search, 300)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  return (
    <Container size="lg">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" wrap="nowrap">
          <div>
            <Title order={2}>Projects</Title>
            <Text c="dimmed" size="sm">
              Manage your projects and track progress
            </Text>
          </div>
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            New Project
          </Button>
        </Group>

        {/* Search and View Toggle */}
        <Group justify="space-between">
          <TextInput
            placeholder="Search projects..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, maxWidth: 300 }}
          />

          <Group gap="xs">
            <SegmentedControl
              value={viewMode}
              onChange={(v) => setViewMode(v as 'grid' | 'list')}
              data={[
                {
                  value: 'grid',
                  label: (
                    <Tooltip label="Grid view">
                      <Center>
                        <IconLayoutGrid size={16} />
                      </Center>
                    </Tooltip>
                  ),
                },
                {
                  value: 'list',
                  label: (
                    <Tooltip label="List view">
                      <Center>
                        <IconLayoutList size={16} />
                      </Center>
                    </Tooltip>
                  ),
                },
              ]}
            />
          </Group>
        </Group>

        {/* Project List */}
        <ProjectList
          onCreate={open}
          searchQuery={debouncedSearch}
          viewMode={viewMode}
        />

        <CreateProjectModal opened={opened} onClose={close} />
      </Stack>
    </Container>
  )
}
