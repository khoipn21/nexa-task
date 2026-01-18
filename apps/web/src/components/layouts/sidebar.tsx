import { OrganizationSwitcher, UserButton } from "@clerk/clerk-react";
import { dark } from "@clerk/themes";
import {
  ActionIcon,
  Group,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
  useComputedColorScheme,
} from "@mantine/core";
import {
  IconChevronLeft,
  IconChevronRight,
  IconDashboard,
  IconFolders,
  IconSettings,
} from "@tabler/icons-react";
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { NotificationBell } from "../notifications";

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: IconDashboard },
  { label: "Projects", path: "/projects", icon: IconFolders },
  { label: "Settings", path: "/settings", icon: IconSettings },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const colorScheme = useComputedColorScheme("light");

  const toggle = () => setCollapsed((c) => !c);

  return (
    <nav
      className={`
        relative flex flex-col h-full bg-white dark:bg-dark-7 border-r border-gray-200 dark:border-dark-4
        transition-all duration-300 ease-in-out z-50
        ${collapsed ? "w-[80px]" : "w-[260px]"}
      `}
    >
      {/* Header */}
      <div className="h-[60px] flex items-center px-4 border-b border-gray-200 dark:border-dark-4 shrink-0">
        <Group gap="xs" wrap="nowrap" className="overflow-hidden w-full">
          <ThemeIcon
            size={34}
            variant="gradient"
            gradient={{ from: "blue", to: "cyan" }}
            className="shrink-0"
          >
            <IconFolders size={20} />
          </ThemeIcon>

          <div
            className={`transition-opacity duration-200 ${collapsed ? "opacity-0 w-0" : "opacity-100 flex-1"}`}
          >
            <Text
              fw={900}
              size="lg"
              variant="gradient"
              gradient={{ from: "blue", to: "cyan" }}
              truncate
            >
              Nexa Task
            </Text>
          </div>
        </Group>
      </div>

      {/* Toggle Button */}
      <div className="absolute -right-3 top-[72px] z-50">
        <ActionIcon
          variant="default"
          size="xs"
          radius="xl"
          onClick={toggle}
          className="shadow-md border-gray-200 dark:border-dark-4 bg-white dark:bg-dark-6 hover:bg-gray-50 dark:hover:bg-dark-5"
        >
          {collapsed ? (
            <IconChevronRight size={12} />
          ) : (
            <IconChevronLeft size={12} />
          )}
        </ActionIcon>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <Stack gap={4} px="sm">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Tooltip
                key={item.path}
                label={item.label}
                position="right"
                offset={10}
                disabled={!collapsed}
                transitionProps={{ duration: 0 }}
              >
                <UnstyledButton
                  component={Link}
                  to={item.path}
                  className={`
                    w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors
                    ${
                      isActive
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-6 hover:text-gray-900 dark:hover:text-gray-200"
                    }
                  `}
                >
                  <item.icon size={22} stroke={1.5} className="shrink-0" />
                  {!collapsed && (
                    <Text size="sm" fw={500} className="fade-in">
                      {item.label}
                    </Text>
                  )}
                </UnstyledButton>
              </Tooltip>
            );
          })}
        </Stack>
      </ScrollArea>

      {/* Footer / User Profile */}
      <div className="p-4 border-t border-gray-200 dark:border-dark-4 shrink-0">
        <Stack gap="sm" align={collapsed ? "center" : "stretch"}>
          {collapsed ? (
            <div className="flex flex-col gap-4 items-center">
              <NotificationBell />
              <UserButton afterSignOutUrl="/sign-in" />
            </div>
          ) : (
            <>
              <Group justify="space-between">
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  Notifications
                </Text>
                <NotificationBell />
              </Group>
              <Group justify="space-between" className="overflow-hidden">
                <OrganizationSwitcher
                  hidePersonal
                  appearance={{
                    baseTheme: colorScheme === "dark" ? dark : undefined,
                    elements: {
                      rootBox: "w-full",
                      organizationSwitcherTrigger: "w-full justify-between",
                      organizationSwitcherTriggerIcon:
                        colorScheme === "dark" ? "text-white" : "text-gray-900",
                      userPreviewTextContainer:
                        colorScheme === "dark" ? "text-white" : "text-gray-900",
                      organizationPreviewTextContainer:
                        colorScheme === "dark" ? "text-white" : "text-gray-900",
                    },
                  }}
                />
              </Group>
              <Group justify="flex-start" gap="sm">
                <UserButton
                  afterSignOutUrl="/sign-in"
                  showName
                  appearance={{
                    baseTheme: colorScheme === "dark" ? dark : undefined,
                    elements: {
                      userPreviewTextContainer:
                        colorScheme === "dark" ? "text-white" : "text-gray-900",
                      userButtonTrigger:
                        colorScheme === "dark" ? "text-white" : "text-gray-900",
                    },
                  }}
                />
              </Group>
            </>
          )}
        </Stack>
      </div>
    </nav>
  );
}
