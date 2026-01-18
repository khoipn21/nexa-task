import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { projects } from './projects'

export const workflowStatuses = pgTable(
  'workflow_statuses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull().default('#6366f1'),
    order: integer('order').notNull(),
    isDefault: boolean('is_default').default(false),
    isFinal: boolean('is_final').default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('workflow_statuses_project_idx').on(t.projectId),
    index('workflow_statuses_project_order_idx').on(t.projectId, t.order),
  ],
)
