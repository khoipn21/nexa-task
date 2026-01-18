import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { tasks } from './tasks'
import { users } from './users'

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('comments_task_idx').on(t.taskId),
    index('comments_user_idx').on(t.userId),
    index('comments_task_created_idx').on(t.taskId, t.createdAt),
  ],
)
