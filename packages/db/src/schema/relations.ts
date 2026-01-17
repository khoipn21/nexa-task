import { relations } from 'drizzle-orm'
import { activityLogs } from './activity-logs'
import { attachments } from './attachments'
import { comments } from './comments'
import { notificationPreferences } from './notification-preferences'
import { notifications } from './notifications'
import { projects } from './projects'
import { taskDependencies } from './task-dependencies'
import { taskWatchers } from './task-watchers'
import { tasks } from './tasks'
import { userProjectPreferences } from './user-project-preferences'
import { users } from './users'
import { workflowStatuses } from './workflow-statuses'
import { workspaceMembers, workspaces } from './workspaces'

export const usersRelations = relations(users, ({ many, one }) => ({
  ownedWorkspaces: many(workspaces),
  workspaceMemberships: many(workspaceMembers),
  createdProjects: many(projects),
  assignedTasks: many(tasks, { relationName: 'assignedTasks' }),
  createdTasks: many(tasks, { relationName: 'createdTasks' }),
  comments: many(comments),
  activityLogs: many(activityLogs),
  notifications: many(notifications),
  notificationPreferences: one(notificationPreferences, {
    fields: [users.id],
    references: [notificationPreferences.userId],
  }),
  projectPreferences: many(userProjectPreferences),
}))

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, { fields: [workspaces.ownerId], references: [users.id] }),
  members: many(workspaceMembers),
  projects: many(projects),
}))

export const workspaceMembersRelations = relations(
  workspaceMembers,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceMembers.workspaceId],
      references: [workspaces.id],
    }),
    user: one(users, {
      fields: [workspaceMembers.userId],
      references: [users.id],
    }),
  }),
)

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  createdBy: one(users, {
    fields: [projects.createdById],
    references: [users.id],
  }),
  tasks: many(tasks),
  workflowStatuses: many(workflowStatuses),
}))

export const workflowStatusesRelations = relations(
  workflowStatuses,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [workflowStatuses.projectId],
      references: [projects.id],
    }),
    tasks: many(tasks),
  }),
)

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  status: one(workflowStatuses, {
    fields: [tasks.statusId],
    references: [workflowStatuses.id],
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
    relationName: 'assignedTasks',
  }),
  createdBy: one(users, {
    fields: [tasks.createdById],
    references: [users.id],
    relationName: 'createdTasks',
  }),
  comments: many(comments),
  attachments: many(attachments),
  watchers: many(taskWatchers),
  dependencies: many(taskDependencies, { relationName: 'taskDependencies' }),
  dependents: many(taskDependencies, { relationName: 'taskDependents' }),
}))

export const taskDependenciesRelations = relations(
  taskDependencies,
  ({ one }) => ({
    task: one(tasks, {
      fields: [taskDependencies.taskId],
      references: [tasks.id],
      relationName: 'taskDependencies',
    }),
    dependsOn: one(tasks, {
      fields: [taskDependencies.dependsOnId],
      references: [tasks.id],
      relationName: 'taskDependents',
    }),
  }),
)

export const taskWatchersRelations = relations(taskWatchers, ({ one }) => ({
  task: one(tasks, {
    fields: [taskWatchers.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskWatchers.userId],
    references: [users.id],
  }),
}))

export const commentsRelations = relations(comments, ({ one }) => ({
  task: one(tasks, {
    fields: [comments.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}))

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  task: one(tasks, {
    fields: [attachments.taskId],
    references: [tasks.id],
  }),
  uploadedBy: one(users, {
    fields: [attachments.uploadedById],
    references: [users.id],
  }),
}))

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}))

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}))

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationPreferences.userId],
      references: [users.id],
    }),
  }),
)

export const userProjectPreferencesRelations = relations(
  userProjectPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [userProjectPreferences.userId],
      references: [users.id],
    }),
    project: one(projects, {
      fields: [userProjectPreferences.projectId],
      references: [projects.id],
    }),
  }),
)
