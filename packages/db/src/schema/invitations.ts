import { relations } from 'drizzle-orm'
import {
  index,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { users } from './users'
import { workspaceRoleEnum, workspaces } from './workspaces'

export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'expired',
  'cancelled',
])

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    inviterId: uuid('inviter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    inviteeEmail: varchar('invitee_email', { length: 255 }).notNull(),
    invitationToken: varchar('invitation_token', { length: 255 })
      .notNull()
      .unique(),
    status: invitationStatusEnum('status').default('pending').notNull(),
    role: workspaceRoleEnum('role').notNull().default('member'),
    clerkInvitationId: varchar('clerk_invitation_id', { length: 255 }),
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    inviteeId: uuid('invitee_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
  },
  (table) => {
    return {
      unqInviteeEmailWorkspace: unique('unq_invitee_email_workspace').on(
        table.inviteeEmail,
        table.workspaceId,
      ),
      clerkInvitationIdIdx: index('invitations_clerk_invitation_id_idx').on(
        table.clerkInvitationId,
      ),
    }
  },
)

export const invitationsRelations = relations(invitations, ({ one }) => ({
  inviter: one(users, {
    fields: [invitations.inviterId],
    references: [users.id],
    relationName: 'inviter',
  }),
  invitee: one(users, {
    fields: [invitations.inviteeId],
    references: [users.id],
    relationName: 'invitee',
  }),
  workspace: one(workspaces, {
    fields: [invitations.workspaceId],
    references: [workspaces.id],
  }),
}))
