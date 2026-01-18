import { useCreateProject } from '@/hooks/use-projects'
import {
  Box,
  Button,
  ColorSwatch,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  UnstyledButton,
  useMantineTheme,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import {
  IconBriefcase,
  IconBuildingSkyscraper,
  IconCode,
  IconDeviceDesktop,
  IconPalette,
  IconRocket,
  IconTarget,
  IconUsers,
} from '@tabler/icons-react'
import { useState } from 'react'

type Props = {
  opened: boolean
  onClose: () => void
}

// Available project colors
const PROJECT_COLORS = [
  { name: 'Blue', value: 'blue' },
  { name: 'Violet', value: 'violet' },
  { name: 'Grape', value: 'grape' },
  { name: 'Pink', value: 'pink' },
  { name: 'Red', value: 'red' },
  { name: 'Orange', value: 'orange' },
  { name: 'Yellow', value: 'yellow' },
  { name: 'Lime', value: 'lime' },
  { name: 'Green', value: 'green' },
  { name: 'Teal', value: 'teal' },
  { name: 'Cyan', value: 'cyan' },
  { name: 'Indigo', value: 'indigo' },
] as const

// Project templates for quick start
const PROJECT_TEMPLATES = [
  { icon: IconCode, label: 'Software', description: 'Dev project' },
  { icon: IconPalette, label: 'Design', description: 'Creative work' },
  { icon: IconTarget, label: 'Marketing', description: 'Campaigns' },
  { icon: IconRocket, label: 'Launch', description: 'Product launch' },
  { icon: IconUsers, label: 'Team', description: 'Team management' },
  { icon: IconBriefcase, label: 'Client', description: 'Client work' },
  { icon: IconDeviceDesktop, label: 'Product', description: 'Product dev' },
  {
    icon: IconBuildingSkyscraper,
    label: 'Enterprise',
    description: 'Large scale',
  },
] as const

export function CreateProjectModal({ opened, onClose }: Props) {
  const createProject = useCreateProject()
  const theme = useMantineTheme()
  const [selectedColor, setSelectedColor] = useState('blue')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  const form = useForm({
    initialValues: {
      name: '',
      description: '',
    },
    validate: {
      name: (v: string) => (v.length < 1 ? 'Name is required' : null),
    },
  })

  const handleTemplateSelect = (label: string) => {
    setSelectedTemplate(label)
    if (!form.values.name) {
      form.setFieldValue('name', `${label} Project`)
    }
  }

  const handleSubmit = form.onSubmit(
    async (values: { name: string; description: string }) => {
      try {
        await createProject.mutateAsync({
          ...values,
          color: selectedColor,
        })
        notifications.show({ message: 'Project created!', color: 'green' })
        form.reset()
        setSelectedColor('blue')
        setSelectedTemplate(null)
        onClose()
      } catch {
        notifications.show({
          message: 'Failed to create project',
          color: 'red',
        })
      }
    },
  )

  const handleClose = () => {
    form.reset()
    setSelectedColor('blue')
    setSelectedTemplate(null)
    onClose()
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <Box
            style={{
              width: 12,
              height: 12,
              borderRadius: 4,
              backgroundColor: theme.colors[selectedColor]?.[5],
            }}
          />
          <Text fw={600}>Create New Project</Text>
        </Group>
      }
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {/* Template Selection */}
          <Box>
            <Text size="sm" fw={500} mb="xs">
              Choose a template (optional)
            </Text>
            <SimpleGrid cols={4} spacing="xs">
              {PROJECT_TEMPLATES.map(({ icon: Icon, label, description }) => (
                <UnstyledButton
                  key={label}
                  onClick={() => handleTemplateSelect(label)}
                  style={{
                    padding: theme.spacing.sm,
                    borderRadius: theme.radius.md,
                    border: `1px solid ${
                      selectedTemplate === label
                        ? theme.colors[selectedColor]?.[5]
                        : theme.colors.gray[3]
                    }`,
                    backgroundColor:
                      selectedTemplate === label
                        ? theme.colors[selectedColor]?.[0]
                        : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                  }}
                >
                  <Stack gap={4} align="center">
                    <ThemeIcon
                      size="lg"
                      variant={selectedTemplate === label ? 'filled' : 'light'}
                      color={
                        selectedTemplate === label ? selectedColor : 'gray'
                      }
                    >
                      <Icon size={18} />
                    </ThemeIcon>
                    <Text size="xs" fw={500} ta="center">
                      {label}
                    </Text>
                    <Text size="xs" c="dimmed" ta="center">
                      {description}
                    </Text>
                  </Stack>
                </UnstyledButton>
              ))}
            </SimpleGrid>
          </Box>

          {/* Color Selection */}
          <Box>
            <Text size="sm" fw={500} mb="xs">
              Project color
            </Text>
            <Group gap="xs">
              {PROJECT_COLORS.map(({ name, value }) => (
                <ColorSwatch
                  key={value}
                  color={theme.colors[value]?.[5] ?? '#000'}
                  onClick={() => setSelectedColor(value)}
                  style={{
                    cursor: 'pointer',
                    border:
                      selectedColor === value
                        ? `2px solid ${theme.colors[value]?.[7]}`
                        : '2px solid transparent',
                  }}
                  aria-label={name}
                />
              ))}
            </Group>
          </Box>

          {/* Project Details */}
          <TextInput
            label="Project Name"
            placeholder="Enter project name"
            required
            {...form.getInputProps('name')}
          />

          <Textarea
            label="Description"
            placeholder="What is this project about? (optional)"
            minRows={3}
            {...form.getInputProps('description')}
          />

          {/* Actions */}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createProject.isPending}
              color={selectedColor}
            >
              Create Project
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
