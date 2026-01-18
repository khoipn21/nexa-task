import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { projects } from './projects'
import { users } from './users'
import { workflowStatuses } from './workflow-statuses'

export const taskPriorityEnum = pgEnum('task_priority', [
  'low',
  'medium',
  'high',
  'urgent',
])

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    statusId: uuid('status_id').references(() => workflowStatuses.id, {
      onDelete: 'set null',
    }),
    priority: taskPriorityEnum('priority').notNull().default('medium'),
    assigneeId: uuid('assignee_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id),
    order: integer('order').notNull().default(0),
    dueDate: timestamp('due_date', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('tasks_project_idx').on(t.projectId),
    index('tasks_status_idx').on(t.statusId),
    index('tasks_assignee_idx').on(t.assigneeId),
    index('tasks_project_status_idx').on(t.projectId, t.statusId),
    index('tasks_due_date_idx').on(t.dueDate),
    index('tasks_project_order_idx').on(t.projectId, t.order),
  ],
)
