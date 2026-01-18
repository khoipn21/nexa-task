import { type Project, useDeleteProject } from "@/hooks/use-projects";
import { Menu, Progress, Tooltip } from "@mantine/core";
import {
  IconArchive,
  IconDotsVertical,
  IconExternalLink,
  IconSettings,
} from "@tabler/icons-react";
import { Link, useNavigate } from "react-router";

// Project color mapping for visual distinction
const PROJECT_COLORS: Record<string, { border: string; dot: string; progress: string }> = {
  blue: { border: "border-t-blue-500", dot: "bg-blue-500", progress: "blue" },
  violet: { border: "border-t-violet-500", dot: "bg-violet-500", progress: "violet" },
  grape: { border: "border-t-purple-500", dot: "bg-purple-500", progress: "grape" },
  pink: { border: "border-t-pink-500", dot: "bg-pink-500", progress: "pink" },
  red: { border: "border-t-red-500", dot: "bg-red-500", progress: "red" },
  orange: { border: "border-t-orange-500", dot: "bg-orange-500", progress: "orange" },
  yellow: { border: "border-t-yellow-500", dot: "bg-yellow-500", progress: "yellow" },
  lime: { border: "border-t-lime-500", dot: "bg-lime-500", progress: "lime" },
  green: { border: "border-t-green-500", dot: "bg-green-500", progress: "green" },
  teal: { border: "border-t-teal-500", dot: "bg-teal-500", progress: "teal" },
  cyan: { border: "border-t-cyan-500", dot: "bg-cyan-500", progress: "cyan" },
  indigo: { border: "border-t-indigo-500", dot: "bg-indigo-500", progress: "indigo" },
};

const COLOR_KEYS = Object.keys(PROJECT_COLORS);

function getProjectColor(projectId: string): string {
  const hash = projectId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return COLOR_KEYS[hash % COLOR_KEYS.length] ?? "blue";
}

export function ProjectCard({ project }: { project: Project }) {
  const deleteProject = useDeleteProject();
  const navigate = useNavigate();
  const colorKey = project.color || getProjectColor(project.id);
  const colors = PROJECT_COLORS[colorKey] ?? PROJECT_COLORS.blue!;

  const completedTasks = project.completedTaskCount ?? 0;
  const totalTasks = project.taskCount ?? 0;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <div
      onClick={() => navigate(`/projects/${project.id}`)}
      className={`
        group relative cursor-pointer rounded-xl border-t-[3px] ${colors.border}
        bg-white dark:bg-dark-7 border border-gray-200 dark:border-dark-5
        p-5 shadow-sm transition-all duration-200
        hover:-translate-y-0.5 hover:shadow-md
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
            {project.name}
          </h3>
        </div>

        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100
                dark:hover:text-gray-300 dark:hover:bg-dark-5 transition-colors opacity-0 group-hover:opacity-100"
              aria-label="Project options"
            >
              <IconDotsVertical size={16} />
            </button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconExternalLink size={14} />}
              component={Link}
              to={`/projects/${project.id}`}
              onClick={(e) => e.stopPropagation()}
            >
              Open Project
            </Menu.Item>
            <Menu.Item
              leftSection={<IconSettings size={14} />}
              component={Link}
              to={`/projects/${project.id}/settings`}
              onClick={(e) => e.stopPropagation()}
            >
              Settings
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              leftSection={<IconArchive size={14} />}
              color="red"
              onClick={(e) => {
                e.stopPropagation();
                deleteProject.mutate(project.id);
              }}
            >
              Archive
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 min-h-[40px] mb-4">
        {project.description || "No description"}
      </p>

      {/* Progress bar */}
      {totalTasks > 0 && (
        <Tooltip label={`${completedTasks} of ${totalTasks} tasks completed`} position="bottom">
          <div className="mb-4">
            <Progress
              value={progress}
              size="sm"
              radius="xl"
              color={progress === 100 ? "green" : colors.progress}
            />
          </div>
        </Tooltip>
      )}

      {/* Footer badges */}
      <div className="flex items-center gap-2">
        <span
          className={`
            inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium
            ${project.status === "active"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-gray-100 text-gray-600 dark:bg-dark-5 dark:text-gray-400"
            }
          `}
        >
          {project.status}
        </span>
        {totalTasks > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium
            bg-gray-100 text-gray-600 dark:bg-dark-5 dark:text-gray-400 border border-gray-200 dark:border-dark-4">
            {completedTasks}/{totalTasks} tasks
          </span>
        )}
      </div>
    </div>
  );
}
