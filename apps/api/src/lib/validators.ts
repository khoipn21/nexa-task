import { z } from 'zod'

// Common
export const uuidSchema = z.string().uuid()
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

// ID params
export const idParamSchema = z.object({
  id: uuidSchema,
})
