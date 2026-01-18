import { OrganizationSwitcher, UserButton } from '@clerk/clerk-react'
import { dark } from '@clerk/themes'
import {
  ActionIcon,
  Collapse,
  Group,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
  useComputedColorScheme,
} from '@mantine/core'
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconDashboard,
  IconFolder,
  IconFolders,
  IconSettings,
} from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useProjects } from '../../hooks/use-projects'
import { NotificationBell } from '../notifications'

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: IconDashboard },
  { label: 'Projects', path: '/projects', icon: IconFolders, hasSubmenu: true },
  { label: 'Settings', path: '/settings', icon: IconSettings },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [projectsOpen, setProjectsOpen] = useState(true)
  const location = useLocation()
  const colorScheme = useComputedColorScheme('light')
  const { data: projects = [] } = useProjects()

  // Get 3 most recent projects (assuming default sort is relevant, or just take first 3)
  const recentProjects = projects.slice(0, 3)

  const toggle = () => setCollapsed((c) => !c)

  // Auto-collapse submenus when sidebar collapses
  useEffect(() => {
    if (collapsed) {
      setProjectsOpen(false)
    }
  }, [collapsed])

  return (
    <nav
      className={`
        relative flex flex-col h-full bg-white dark:bg-dark-7 border-r border-gray-200 dark:border-dark-4
        transition-all duration-300 ease-in-out z-50
        ${collapsed ? 'w-[80px]' : 'w-[260px]'}
      `}
    >
      {/* Header */}
      <div className="h-[70px] flex items-center px-5 border-b border-gray-200 dark:border-dark-4 shrink-0">
        <Group gap="sm" wrap="nowrap" className="overflow-hidden w-full">
          <ThemeIcon
            size={40}
            variant="gradient"
            gradient={{ from: 'blue', to: 'cyan' }}
            className="shrink-0 rounded-xl"
          >
            <IconFolders size={24} />
          </ThemeIcon>

          <div
            className={`transition-opacity duration-200 ${collapsed ? 'opacity-0 w-0' : 'opacity-100 flex-1'}`}
          >
            <Text
              fw={900}
              size="xl"
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
              truncate
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              Nexa Task
            </Text>
          </div>
        </Group>
      </div>

      {/* Toggle Button */}
      <div className="absolute -right-3 top-[80px] z-50">
        <ActionIcon
          variant="default"
          size="sm"
          radius="xl"
          onClick={toggle}
          className="shadow-md border-gray-200 dark:border-dark-4 bg-white dark:bg-dark-6 hover:bg-gray-50 dark:hover:bg-dark-5 transition-transform hover:scale-110"
        >
          {collapsed ? (
            <IconChevronRight size={14} />
          ) : (
            <IconChevronLeft size={14} />
          )}
        </ActionIcon>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-6 px-3">
        <Stack gap={6}>
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              location.pathname.startsWith(`${item.path}/`)
            const isProjects = item.label === 'Projects'

            return (
              <div key={item.path}>
                <Tooltip
                  label={item.label}
                  position="right"
                  offset={10}
                  disabled={!collapsed}
                  transitionProps={{ duration: 0 }}
                >
                  <div className="relative">
                    <UnstyledButton
                      component={Link}
                      to={item.path}
                      className={`
                        w-full flex items-center gap-3 p-3.5 rounded-xl transition-all duration-200 group
                        ${
                          isActive
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-6 hover:text-gray-900 dark:hover:text-gray-200'
                        }
                      `}
                    >
                      <item.icon
                        size={24}
                        stroke={1.5}
                        className={`shrink-0 transition-colors ${isActive ? 'text-blue-600 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200'}`}
                      />
                      {!collapsed && (
                        <div className="flex-1 flex items-center justify-between">
                          <Text size="md" fw={500} className="fade-in">
                            {item.label}
                          </Text>
                          {isProjects && (
                            <ActionIcon
                              variant="transparent"
                              size="sm"
                              className="text-gray-400 hover:text-gray-600"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setProjectsOpen(!projectsOpen)
                              }}
                            >
                              <IconChevronDown
                                size={16}
                                className={`transition-transform duration-200 ${projectsOpen ? 'rotate-180' : ''}`}
                              />
                            </ActionIcon>
                          )}
                        </div>
                      )}
                    </UnstyledButton>
                  </div>
                </Tooltip>

                {/* Submenu for Projects */}
                {isProjects && !collapsed && (
                  <Collapse in={projectsOpen}>
                    <Stack
                      gap={2}
                      mt={4}
                      pl={10}
                      className="border-l-2 border-gray-100 dark:border-dark-4 ml-6 transition-all duration-200"
                    >
                      {recentProjects.map((project) => (
                        <UnstyledButton
                          key={project.id}
                          component={Link}
                          to={`/projects/${project.id}`}
                          className={`
                            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                            ${
                              location.pathname === `/projects/${project.id}`
                                ? 'bg-blue-50/50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-300'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-6 hover:text-gray-900 dark:hover:text-gray-200'
                            }
                          `}
                        >
                          <ThemeIcon
                            size={20}
                            variant="light"
                            color="gray"
                            className="bg-transparent text-current"
                          >
                            <IconFolder size={14} />
                          </ThemeIcon>
                          <Text size="sm" truncate>
                            {project.name}
                          </Text>
                        </UnstyledButton>
                      ))}
                      <UnstyledButton
                        component={Link}
                        to="/projects"
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-blue-600 uppercase tracking-wider mt-1 hover:bg-gray-50 dark:hover:bg-dark-6 transition-colors"
                      >
                        View all projects
                      </UnstyledButton>
                    </Stack>
                  </Collapse>
                )}
              </div>
            )
          })}
        </Stack>
      </ScrollArea>

      {/* Footer / User Profile */}
      <div className="p-4 border-t border-gray-200 dark:border-dark-4 shrink-0 bg-gray-50/50 dark:bg-dark-8/50">
        <Stack gap="sm" align={collapsed ? 'center' : 'stretch'}>
          {collapsed ? (
            <div className="flex flex-col gap-4 items-center">
              <NotificationBell />
              <UserButton afterSignOutUrl="/sign-in" />
            </div>
          ) : (
            <>
              <Group justify="space-between" className="px-1">
                <Text
                  size="xs"
                  fw={700}
                  c="dimmed"
                  tt="uppercase"
                  style={{ letterSpacing: '0.05em' }}
                >
                  Notifications
                </Text>
                <NotificationBell />
              </Group>
              <div className="bg-white dark:bg-dark-6 p-2 rounded-xl shadow-sm border border-gray-200 dark:border-dark-4">
                <Group justify="space-between" className="overflow-hidden">
                  <OrganizationSwitcher
                    hidePersonal
                    appearance={{
                      baseTheme: colorScheme === 'dark' ? dark : undefined,
                      elements: {
                        rootBox: 'w-full',
                        organizationSwitcherTrigger:
                          'w-full justify-between hover:bg-transparent',
                        organizationSwitcherTriggerIcon:
                          colorScheme === 'dark'
                            ? 'text-gray-300'
                            : 'text-gray-600',
                        userPreviewTextContainer:
                          colorScheme === 'dark'
                            ? 'text-white'
                            : 'text-gray-900',
                        organizationPreviewTextContainer:
                          colorScheme === 'dark'
                            ? 'text-white'
                            : 'text-gray-900 font-medium',
                      },
                    }}
                  />
                </Group>
                <div className="my-2 border-t border-gray-100 dark:border-dark-4" />
                <Group justify="flex-start" gap="sm">
                  <UserButton
                    afterSignOutUrl="/sign-in"
                    showName
                    appearance={{
                      baseTheme: colorScheme === 'dark' ? dark : undefined,
                      elements: {
                        userPreviewTextContainer:
                          colorScheme === 'dark'
                            ? 'text-white font-medium'
                            : 'text-gray-900 font-medium',
                        userButtonTrigger:
                          'w-full p-1 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-5 transition-colors',
                        userButtonBox: 'flex-row-reverse justify-end gap-3',
                        userButtonOuterIdentifier: 'text-sm',
                      },
                    }}
                  />
                </Group>
              </div>
            </>
          )}
        </Stack>
      </div>
    </nav>
  )
}
