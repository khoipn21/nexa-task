import { index, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { tasks } from './tasks'

export const taskDependencies = pgTable(
  'task_dependencies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    dependsOnId: uuid('depends_on_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('task_deps_task_idx').on(t.taskId),
    index('task_deps_depends_idx').on(t.dependsOnId),
    unique('task_deps_unique').on(t.taskId, t.dependsOnId),
  ],
)
