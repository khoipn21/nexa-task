import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './users'

export const entityTypeEnum = pgEnum('entity_type', [
  'workspace',
  'project',
  'task',
  'comment',
])

export const actionTypeEnum = pgEnum('action_type', [
  'created',
  'updated',
  'deleted',
  'assigned',
  'commented',
  'status_changed',
  'moved',
])

export type ActivityChanges = Record<string, { old: unknown; new: unknown }>

export const activityLogs = pgTable(
  'activity_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').notNull(),
    entityType: entityTypeEnum('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    action: actionTypeEnum('action').notNull(),
    changes: jsonb('changes').$type<ActivityChanges>(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('activity_logs_workspace_idx').on(t.workspaceId),
    index('activity_logs_entity_idx').on(t.entityType, t.entityId),
    index('activity_logs_user_idx').on(t.userId),
    index('activity_logs_created_idx').on(t.createdAt),
  ],
)
