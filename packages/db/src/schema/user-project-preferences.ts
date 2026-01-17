import {
  index,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { projects } from './projects'
import { users } from './users'

export const viewModeEnum = pgEnum('view_mode', ['kanban', 'list', 'calendar'])

export const userProjectPreferences = pgTable(
  'user_project_preferences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    viewMode: viewModeEnum('view_mode').notNull().default('kanban'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique('user_project_preferences_unique').on(t.userId, t.projectId),
    index('user_project_preferences_user_idx').on(t.userId),
    index('user_project_preferences_project_idx').on(t.projectId),
  ],
)
