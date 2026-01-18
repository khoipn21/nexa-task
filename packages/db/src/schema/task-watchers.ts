import { index, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { tasks } from './tasks'
import { users } from './users'

export const taskWatchers = pgTable(
  'task_watchers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('task_watchers_task_idx').on(t.taskId),
    index('task_watchers_user_idx').on(t.userId),
    unique('task_watchers_unique').on(t.taskId, t.userId),
  ],
)
