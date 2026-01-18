# Phase 02: Database Schema

## Context Links
- [Drizzle Research](../reports/researcher-260117-1758-drizzle-postgres.md)
- [Phase 01: Monorepo Setup](./phase-01-monorepo-setup.md)

## Overview
- **Priority**: P1 (Critical Path)
- **Status**: pending
- **Effort**: 6h

Design and implement PostgreSQL schema with Drizzle ORM for multi-tenant task management.

## Key Insights
- UUID primary keys prevent enumeration attacks
- JSONB for flexible settings/metadata
- Cascade deletes for referential integrity
- Composite indexes on common filter patterns
- Soft delete via status field for archival

## Requirements

### Functional
- Multi-tenant data isolation via workspace_id
- Task dependencies (many-to-many self-referencing)
- Custom workflow statuses per project
- Activity audit log for all changes
- File attachments metadata storage

### Non-Functional
- Query performance < 50ms for common operations
- Type-safe queries via Drizzle ORM
- Migration versioning for production deploys

## Architecture

### Entity Relationship
```
Workspace (tenant)
├── Project
│   ├── WorkflowStatus (custom columns)
│   └── Task
│       ├── TaskDependency (blockers)
│       ├── Comment
│       ├── Attachment
│       └── TaskWatcher (subscribers)
└── WorkspaceMember (user-workspace mapping)

ActivityLog (audit trail across all entities)
```

## Related Code Files

### Create
- `/packages/db/src/schema/users.ts`
- `/packages/db/src/schema/workspaces.ts`
- `/packages/db/src/schema/projects.ts`
- `/packages/db/src/schema/workflow-statuses.ts`
- `/packages/db/src/schema/tasks.ts`
- `/packages/db/src/schema/task-dependencies.ts`
- `/packages/db/src/schema/task-watchers.ts`
- `/packages/db/src/schema/comments.ts`
- `/packages/db/src/schema/attachments.ts`
- `/packages/db/src/schema/activity-logs.ts`
- `/packages/db/src/schema/relations.ts`
- `/packages/db/src/schema/index.ts`
- `/packages/db/src/index.ts`
- `/packages/db/drizzle.config.ts`

## Implementation Steps

### 1. Users Schema
**packages/db/src/schema/users.ts**:
```typescript
import { pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('users_clerk_id_idx').on(t.clerkId),
  index('users_email_idx').on(t.email),
])
```

### 2. Workspaces Schema
**packages/db/src/schema/workspaces.ts**:
```typescript
import { pgTable, text, timestamp, uuid, jsonb, index, pgEnum } from 'drizzle-orm/pg-core'
import { users } from './users'

export const workspaceRoleEnum = pgEnum('workspace_role', [
  'super_admin',
  'pm',
  'member',
  'guest'
])

export type WorkspaceSettings = {
  defaultProjectView?: 'kanban' | 'list' | 'calendar'
  allowGuestInvites?: boolean
}

export const workspaces = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkOrgId: text('clerk_org_id').notNull().unique(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  settings: jsonb('settings').$type<WorkspaceSettings>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('workspaces_clerk_org_idx').on(t.clerkOrgId),
  index('workspaces_slug_idx').on(t.slug),
  index('workspaces_owner_idx').on(t.ownerId),
])

export const workspaceMembers = pgTable('workspace_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: workspaceRoleEnum('role').notNull().default('member'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('workspace_members_workspace_idx').on(t.workspaceId),
  index('workspace_members_user_idx').on(t.userId),
])
```

### 3. Projects Schema
**packages/db/src/schema/projects.ts**:
```typescript
import { pgTable, text, timestamp, uuid, index, pgEnum } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { users } from './users'

export const projectStatusEnum = pgEnum('project_status', ['active', 'archived', 'deleted'])

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  status: projectStatusEnum('status').notNull().default('active'),
  createdById: uuid('created_by_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('projects_workspace_idx').on(t.workspaceId),
  index('projects_status_idx').on(t.status),
  index('projects_workspace_status_idx').on(t.workspaceId, t.status),
])
```

### 4. Workflow Statuses Schema
**packages/db/src/schema/workflow-statuses.ts**:
```typescript
import { pgTable, text, timestamp, uuid, integer, boolean, index } from 'drizzle-orm/pg-core'
import { projects } from './projects'

export const workflowStatuses = pgTable('workflow_statuses', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6366f1'),
  order: integer('order').notNull(),
  isDefault: boolean('is_default').default(false),
  isFinal: boolean('is_final').default(false), // Marks as "done" status
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('workflow_statuses_project_idx').on(t.projectId),
  index('workflow_statuses_project_order_idx').on(t.projectId, t.order),
])
```

### 5. Tasks Schema
**packages/db/src/schema/tasks.ts**:
```typescript
import { pgTable, text, timestamp, uuid, integer, index, pgEnum } from 'drizzle-orm/pg-core'
import { projects } from './projects'
import { workflowStatuses } from './workflow-statuses'
import { users } from './users'

export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'urgent'])

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'), // Rich text HTML
  statusId: uuid('status_id').references(() => workflowStatuses.id, { onDelete: 'set null' }),
  priority: taskPriorityEnum('priority').notNull().default('medium'),
  assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  createdById: uuid('created_by_id').notNull().references(() => users.id),
  order: integer('order').notNull().default(0),
  dueDate: timestamp('due_date', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('tasks_project_idx').on(t.projectId),
  index('tasks_status_idx').on(t.statusId),
  index('tasks_assignee_idx').on(t.assigneeId),
  index('tasks_project_status_idx').on(t.projectId, t.statusId),
  index('tasks_due_date_idx').on(t.dueDate),
  index('tasks_project_order_idx').on(t.projectId, t.order),
])
```

### 6. Task Dependencies Schema
**packages/db/src/schema/task-dependencies.ts**:
```typescript
import { pgTable, timestamp, uuid, index, unique } from 'drizzle-orm/pg-core'
import { tasks } from './tasks'

export const taskDependencies = pgTable('task_dependencies', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  dependsOnId: uuid('depends_on_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('task_deps_task_idx').on(t.taskId),
  index('task_deps_depends_idx').on(t.dependsOnId),
  unique('task_deps_unique').on(t.taskId, t.dependsOnId),
])
```

### 7. Task Watchers Schema
**packages/db/src/schema/task-watchers.ts**:
```typescript
import { pgTable, timestamp, uuid, index, unique } from 'drizzle-orm/pg-core'
import { tasks } from './tasks'
import { users } from './users'

export const taskWatchers = pgTable('task_watchers', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('task_watchers_task_idx').on(t.taskId),
  index('task_watchers_user_idx').on(t.userId),
  unique('task_watchers_unique').on(t.taskId, t.userId),
])
```

### 8. Comments Schema
**packages/db/src/schema/comments.ts**:
```typescript
import { pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core'
import { tasks } from './tasks'
import { users } from './users'

export const comments = pgTable('comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  content: text('content').notNull(), // Rich text HTML with @mentions
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('comments_task_idx').on(t.taskId),
  index('comments_user_idx').on(t.userId),
  index('comments_task_created_idx').on(t.taskId, t.createdAt),
])
```

### 9. Attachments Schema
**packages/db/src/schema/attachments.ts**:
```typescript
import { pgTable, text, timestamp, uuid, integer, index } from 'drizzle-orm/pg-core'
import { tasks } from './tasks'
import { users } from './users'

export const attachments = pgTable('attachments', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  uploadedById: uuid('uploaded_by_id').notNull().references(() => users.id),
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: text('mime_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('attachments_task_idx').on(t.taskId),
])
```

### 10. Activity Logs Schema
**packages/db/src/schema/activity-logs.ts**:
```typescript
import { pgTable, text, timestamp, uuid, jsonb, index, pgEnum } from 'drizzle-orm/pg-core'
import { users } from './users'

export const entityTypeEnum = pgEnum('entity_type', [
  'workspace', 'project', 'task', 'comment'
])

export const actionTypeEnum = pgEnum('action_type', [
  'created', 'updated', 'deleted', 'assigned', 'commented', 'status_changed', 'moved'
])

export type ActivityChanges = Record<string, { old: unknown; new: unknown }>

export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull(),
  entityType: entityTypeEnum('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  action: actionTypeEnum('action').notNull(),
  changes: jsonb('changes').$type<ActivityChanges>(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('activity_logs_workspace_idx').on(t.workspaceId),
  index('activity_logs_entity_idx').on(t.entityType, t.entityId),
  index('activity_logs_user_idx').on(t.userId),
  index('activity_logs_created_idx').on(t.createdAt),
])
```

### 11. Relations
**packages/db/src/schema/relations.ts**:
```typescript
import { relations } from 'drizzle-orm'
import { users } from './users'
import { workspaces, workspaceMembers } from './workspaces'
import { projects } from './projects'
import { workflowStatuses } from './workflow-statuses'
import { tasks } from './tasks'
import { taskDependencies } from './task-dependencies'
import { taskWatchers } from './task-watchers'
import { comments } from './comments'
import { attachments } from './attachments'
import { activityLogs } from './activity-logs'

export const usersRelations = relations(users, ({ many }) => ({
  ownedWorkspaces: many(workspaces),
  workspaceMemberships: many(workspaceMembers),
  createdProjects: many(projects),
  assignedTasks: many(tasks, { relationName: 'assignedTasks' }),
  createdTasks: many(tasks, { relationName: 'createdTasks' }),
  comments: many(comments),
  activityLogs: many(activityLogs),
}))

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, { fields: [workspaces.ownerId], references: [users.id] }),
  members: many(workspaceMembers),
  projects: many(projects),
}))

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, { fields: [workspaceMembers.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [workspaceMembers.userId], references: [users.id] }),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [projects.workspaceId], references: [workspaces.id] }),
  createdBy: one(users, { fields: [projects.createdById], references: [users.id] }),
  tasks: many(tasks),
  workflowStatuses: many(workflowStatuses),
}))

export const workflowStatusesRelations = relations(workflowStatuses, ({ one, many }) => ({
  project: one(projects, { fields: [workflowStatuses.projectId], references: [projects.id] }),
  tasks: many(tasks),
}))

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  status: one(workflowStatuses, { fields: [tasks.statusId], references: [workflowStatuses.id] }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
    relationName: 'assignedTasks'
  }),
  createdBy: one(users, {
    fields: [tasks.createdById],
    references: [users.id],
    relationName: 'createdTasks'
  }),
  comments: many(comments),
  attachments: many(attachments),
  watchers: many(taskWatchers),
  dependencies: many(taskDependencies, { relationName: 'taskDependencies' }),
  dependents: many(taskDependencies, { relationName: 'taskDependents' }),
}))

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
  task: one(tasks, {
    fields: [taskDependencies.taskId],
    references: [tasks.id],
    relationName: 'taskDependencies'
  }),
  dependsOn: one(tasks, {
    fields: [taskDependencies.dependsOnId],
    references: [tasks.id],
    relationName: 'taskDependents'
  }),
}))

export const taskWatchersRelations = relations(taskWatchers, ({ one }) => ({
  task: one(tasks, { fields: [taskWatchers.taskId], references: [tasks.id] }),
  user: one(users, { fields: [taskWatchers.userId], references: [users.id] }),
}))

export const commentsRelations = relations(comments, ({ one }) => ({
  task: one(tasks, { fields: [comments.taskId], references: [tasks.id] }),
  user: one(users, { fields: [comments.userId], references: [users.id] }),
}))

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  task: one(tasks, { fields: [attachments.taskId], references: [tasks.id] }),
  uploadedBy: one(users, { fields: [attachments.uploadedById], references: [users.id] }),
}))

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, { fields: [activityLogs.userId], references: [users.id] }),
}))
```

### 12. Schema Index Export
**packages/db/src/schema/index.ts**:
```typescript
export * from './users'
export * from './workspaces'
export * from './projects'
export * from './workflow-statuses'
export * from './tasks'
export * from './task-dependencies'
export * from './task-watchers'
export * from './comments'
export * from './attachments'
export * from './activity-logs'
export * from './relations'
```

### 13. Database Client
**packages/db/src/index.ts**:
```typescript
import { drizzle } from 'drizzle-orm/bun-sql'
import { SQL } from 'bun'
import * as schema from './schema'

const client = new SQL(process.env.DATABASE_URL!)

export const db = drizzle({ client, schema })
export type Database = typeof db

export * from './schema'
```

### 14. Drizzle Config
**packages/db/drizzle.config.ts**:
```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

### 15. Push Schema to Database
```bash
cd packages/db
bun run db:push
```

## Todo List
- [ ] Create users schema with Clerk ID mapping
- [ ] Create workspaces + workspace_members schemas
- [ ] Create projects schema with status enum
- [ ] Create workflow_statuses for custom columns
- [ ] Create tasks schema with priority enum
- [ ] Create task_dependencies (many-to-many)
- [ ] Create task_watchers table
- [ ] Create comments schema
- [ ] Create attachments schema
- [ ] Create activity_logs audit trail
- [ ] Define all Drizzle relations
- [ ] Create drizzle.config.ts
- [ ] Export db client from package
- [ ] Run `drizzle-kit push` to create tables

## Success Criteria
- [x] All tables created in PostgreSQL
- [x] Foreign keys and cascades working
- [x] Indexes created for query patterns
- [x] Type-safe queries via `db.query`
- [x] Relations resolve correctly

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Schema changes break app | High | Use migrations in production |
| Missing indexes slow queries | Medium | Add indexes iteratively |
| Circular dependencies | Low | Careful relation design |

## Security Considerations
- No PII stored without encryption consideration
- Soft delete for audit compliance
- Activity logs for access tracking

## Next Steps
- Phase 03: Backend API Foundation
