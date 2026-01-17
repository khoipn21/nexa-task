import { OrganizationSwitcher, UserButton } from '@clerk/clerk-react'
import {
  AppShell,
  Burger,
  Group,
  NavLink,
  Text,
  useMantineTheme,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Link, Outlet, useLocation } from 'react-router'
import { NotificationBell } from '../notifications'

const navItems = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Projects', path: '/projects' },
  { label: 'Settings', path: '/settings' },
]

export function AppShellLayout() {
  const [opened, { toggle }] = useDisclosure()
  const location = useLocation()
  const theme = useMantineTheme()

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 250,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
            />
            <Text fw={700} size="lg" c={theme.primaryColor}>
              Nexa Task
            </Text>
          </Group>
          <Group>
            <NotificationBell />
            <OrganizationSwitcher />
            <UserButton afterSignOutUrl="/sign-in" />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            component={Link}
            to={item.path}
            label={item.label}
            active={location.pathname.startsWith(item.path)}
            mb="xs"
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
