import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { entityTypeEnum } from './activity-logs'
import { users } from './users'

export const notificationTypeEnum = pgEnum('notification_type', [
  'task_assigned',
  'task_status_changed',
  'task_comment_added',
  'task_mentioned',
  'task_due_soon',
  'task_dependency_completed',
  'watcher_added',
])

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    data: jsonb('data').default({}),
    entityType: entityTypeEnum('entity_type'),
    entityId: uuid('entity_id'),
    read: boolean('read').notNull().default(false),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('notifications_user_idx').on(t.userId),
    index('notifications_user_read_idx').on(t.userId, t.read),
    index('notifications_user_created_idx').on(t.userId, t.createdAt),
    index('notifications_entity_idx').on(t.entityType, t.entityId),
  ],
)
