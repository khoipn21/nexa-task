import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

export type ApiResponse<T> = {
  success: true
  data: T
  meta?: {
    page?: number
    limit?: number
    total?: number
  }
}

export type ApiError = {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export function success<T>(
  c: Context,
  data: T,
  meta?: ApiResponse<T>['meta'],
  status: ContentfulStatusCode = 200,
) {
  const response: ApiResponse<T> = { success: true, data }
  if (meta) response.meta = meta
  return c.json(response, status)
}

export function created<T>(c: Context, data: T) {
  return success(c, data, undefined, 201)
}

export function noContent(c: Context) {
  return c.body(null, 204)
}

export function paginated<T>(
  c: Context,
  data: T[],
  { page, limit, total }: { page: number; limit: number; total: number },
) {
  return success(c, data, { page, limit, total })
}
