# Drizzle ORM + PostgreSQL Research Report
**Task Management System Schema Design**

## 1. Schema Design

### Core Tables

```typescript
import { pgTable, serial, text, timestamp, integer, jsonb, uuid, boolean, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('users_email_idx').on(t.email),
]);

// Workspaces
export const workspaces = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  settings: jsonb('settings').$type<WorkspaceSettings>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('workspaces_slug_idx').on(t.slug),
  index('workspaces_owner_idx').on(t.ownerId),
]);

// Projects
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('active'), // active, archived, deleted
  createdById: uuid('created_by_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('projects_workspace_idx').on(t.workspaceId),
  index('projects_status_idx').on(t.status),
  index('projects_workspace_status_idx').on(t.workspaceId, t.status),
]);

// Custom Workflow Statuses
export const workflowStatuses = pgTable('workflow_statuses', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').notNull(),
  order: integer('order').notNull(),
  isDefault: boolean('is_default').default(false),
}, (t) => [
  index('workflow_statuses_project_idx').on(t.projectId),
  index('workflow_statuses_project_order_idx').on(t.projectId, t.order),
]);

// Tasks
export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  statusId: uuid('status_id').references(() => workflowStatuses.id),
  priority: text('priority').notNull().default('medium'), // low, medium, high, urgent
  assigneeId: uuid('assignee_id').references(() => users.id),
  createdById: uuid('created_by_id').notNull().references(() => users.id),
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
]);

// Task Dependencies (self-referencing many-to-many)
export const taskDependencies = pgTable('task_dependencies', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  dependsOnId: uuid('depends_on_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('task_deps_task_idx').on(t.taskId),
  index('task_deps_depends_idx').on(t.dependsOnId),
  index('task_deps_composite_idx').on(t.taskId, t.dependsOnId),
]);

// Comments
export const comments = pgTable('comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('comments_task_idx').on(t.taskId),
  index('comments_task_created_idx').on(t.taskId, t.createdAt),
]);

// Attachments
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
]);

// Activity Logs (Audit Trail)
export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  entityType: text('entity_type').notNull(), // task, project, workspace
  entityId: uuid('entity_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  action: text('action').notNull(), // created, updated, deleted, assigned, etc.
  changes: jsonb('changes').$type<Record<string, { old: any; new: any }>>(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('activity_logs_entity_idx').on(t.entityType, t.entityId),
  index('activity_logs_user_idx').on(t.userId),
  index('activity_logs_created_idx').on(t.createdAt),
]);
```

## 2. Relationship Patterns

### One-to-Many Relations

```typescript
export const usersRelations = relations(users, ({ many }) => ({
  ownedWorkspaces: many(workspaces),
  createdProjects: many(projects),
  assignedTasks: many(tasks),
  comments: many(comments),
  activityLogs: many(activityLogs),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, { fields: [workspaces.ownerId], references: [users.id] }),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [projects.workspaceId], references: [workspaces.id] }),
  createdBy: one(users, { fields: [projects.createdById], references: [users.id] }),
  tasks: many(tasks),
  workflowStatuses: many(workflowStatuses),
}));
```

### Many-to-Many (Task Dependencies)

```typescript
export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  status: one(workflowStatuses, { fields: [tasks.statusId], references: [workflowStatuses.id] }),
  assignee: one(users, { fields: [tasks.assigneeId], references: [users.id] }),
  createdBy: one(users, { fields: [tasks.createdById], references: [users.id] }),
  comments: many(comments),
  attachments: many(attachments),
  dependencies: many(taskDependencies, { relationName: 'taskDependencies' }),
  dependents: many(taskDependencies, { relationName: 'taskDependents' }),
}));

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
}));
```

## 3. Indexing Strategy

**Single Column Indexes**: Foreign keys (projectId, userId, assigneeId) for fast joins
**Composite Indexes**: Common filter combinations (projectId + statusId, taskId + createdAt)
**Unique Indexes**: Business keys (email, workspace slug)
**Temporal Indexes**: Timestamp columns for audit queries (createdAt, dueDate)

**Performance Tips**:
- Index junction table FKs individually + composite for many-to-many
- Index frequently filtered columns (status, priority)
- Index sort columns (order, createdAt)

## 4. Migration Workflow

```bash
# Development: Direct schema push (no migration files)
npx drizzle-kit push

# Production: Generate + apply migrations
npx drizzle-kit generate   # Creates SQL migration files in drizzle/
npx drizzle-kit migrate    # Applies pending migrations
```

**Config** (`drizzle.config.ts`):
```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

## 5. Query Patterns

### Fetch tasks with relations
```typescript
const tasksWithDetails = await db.query.tasks.findMany({
  where: (tasks, { eq }) => eq(tasks.projectId, projectId),
  with: {
    assignee: true,
    status: true,
    comments: {
      with: { user: true },
      orderBy: (comments, { desc }) => [desc(comments.createdAt)],
    },
    attachments: true,
  },
});
```

### Filter with nested conditions
```typescript
const urgentTasks = await db.query.tasks.findMany({
  where: (tasks, { and, eq, isNull }) => and(
    eq(tasks.projectId, projectId),
    eq(tasks.priority, 'urgent'),
    isNull(tasks.completedAt)
  ),
  with: { assignee: true },
});
```

### Activity log query
```typescript
const recentActivity = await db.query.activityLogs.findMany({
  where: (logs, { and, eq, gte }) => and(
    eq(logs.entityType, 'task'),
    eq(logs.entityId, taskId),
    gte(logs.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  ),
  with: { user: true },
  orderBy: (logs, { desc }) => [desc(logs.createdAt)],
  limit: 50,
});
```

### Task dependencies (recursive)
```typescript
const taskWithDeps = await db.query.tasks.findFirst({
  where: (tasks, { eq }) => eq(tasks.id, taskId),
  with: {
    dependencies: {
      with: { dependsOn: true }
    }
  }
});
```

## Key Insights

1. **UUID vs Serial**: UUIDs prevent ID enumeration attacks, enable distributed systems
2. **JSONB for flexibility**: Use for settings/metadata without schema changes
3. **Cascade deletes**: onDelete: 'cascade' maintains referential integrity
4. **Soft deletes**: Status field ('active'/'deleted') for workspace/project archival
5. **Audit trail**: Activity logs with JSONB changes column for full history
6. **Relational queries**: `db.query` API cleaner than raw SQL joins
7. **Type safety**: Relations provide compile-time safety for includes

## Unresolved Questions

- Pagination strategy for large task lists (cursor vs offset)?
- Full-text search implementation (PostgreSQL tsvector or external service)?
- Real-time subscriptions (PostgreSQL LISTEN/NOTIFY or separate service)?
- File storage strategy for attachments (database vs S3/cloud storage)?
