import { z } from 'zod'

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
})

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(['active', 'archived', 'deleted']).optional(),
})

export const createWorkflowStatusSchema = z.object({
  name: z.string().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default('#6366f1'),
  isDefault: z.boolean().optional(),
  isFinal: z.boolean().optional(),
})

export const updateWorkflowStatusSchema = createWorkflowStatusSchema.partial()

export const reorderStatusesSchema = z.object({
  orderedIds: z.array(z.string().uuid()),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
export type CreateWorkflowStatusInput = z.infer<
  typeof createWorkflowStatusSchema
>
