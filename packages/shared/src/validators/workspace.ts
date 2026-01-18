import { z } from 'zod'

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  clerkOrgId: z.string().min(1),
})

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  settings: z
    .object({
      defaultProjectView: z.enum(['kanban', 'list', 'calendar']).optional(),
      allowGuestInvites: z.boolean().optional(),
    })
    .optional(),
})

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['super_admin', 'pm', 'member', 'guest']).default('member'),
})

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>
