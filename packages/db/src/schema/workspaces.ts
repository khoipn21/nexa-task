import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './users'

export const workspaceRoleEnum = pgEnum('workspace_role', [
  'super_admin',
  'pm',
  'member',
  'guest',
])

export type WorkspaceSettings = {
  defaultProjectView?: 'kanban' | 'list' | 'calendar'
  allowGuestInvites?: boolean
}

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clerkOrgId: text('clerk_org_id').notNull().unique(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    settings: jsonb('settings').$type<WorkspaceSettings>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('workspaces_clerk_org_idx').on(t.clerkOrgId),
    index('workspaces_slug_idx').on(t.slug),
    index('workspaces_owner_idx').on(t.ownerId),
  ],
)

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: workspaceRoleEnum('role').notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('workspace_members_workspace_idx').on(t.workspaceId),
    index('workspace_members_user_idx').on(t.userId),
  ],
)
