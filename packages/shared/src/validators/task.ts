import { z } from 'zod'

export const taskFilterSchema = z.object({
  statusId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  search: z.string().optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
})

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(50000).optional(), // Rich text HTML
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  statusId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z
    .string()
    .datetime()
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
})

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(50000).optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  statusId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z
    .string()
    .datetime()
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
})

export const moveTaskSchema = z.object({
  statusId: z.string().uuid(),
  order: z.number().int().min(0),
})

export const addDependencySchema = z.object({
  dependsOnId: z.string().uuid(),
})

export const addWatcherSchema = z.object({
  userId: z.string().uuid(),
})

export const uploadAttachmentSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileUrl: z.string().url(),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1),
})

export type TaskFilterInput = z.infer<typeof taskFilterSchema>
export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
export type MoveTaskInput = z.infer<typeof moveTaskSchema>
