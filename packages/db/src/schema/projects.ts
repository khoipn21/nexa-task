import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './users'
import { workspaces } from './workspaces'

export const projectStatusEnum = pgEnum('project_status', [
  'active',
  'archived',
  'deleted',
])

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    color: text('color').default('blue'),
    status: projectStatusEnum('status').notNull().default('active'),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('projects_workspace_idx').on(t.workspaceId),
    index('projects_status_idx').on(t.status),
    index('projects_workspace_status_idx').on(t.workspaceId, t.status),
  ],
)
