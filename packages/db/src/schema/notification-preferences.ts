import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  emailEnabled: boolean('email_enabled').notNull().default(true),
  inappEnabled: boolean('inapp_enabled').notNull().default(true),
  enabledTypes: text('enabled_types')
    .array()
    .notNull()
    .default([
      'task_assigned',
      'task_status_changed',
      'task_comment_added',
      'task_mentioned',
      'task_due_soon',
    ]),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})
