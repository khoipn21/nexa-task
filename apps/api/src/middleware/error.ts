import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { AppError } from '../lib/errors'
import type { ApiError } from '../lib/response'

export function errorHandler(err: Error, c: Context) {
  console.error(`[Error] ${err.message}`, {
    stack: err.stack,
    requestId: c.get('requestId'),
  })

  if (err instanceof AppError) {
    const response: ApiError = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    }
    return c.json(response, err.statusCode as ContentfulStatusCode)
  }

  if (err instanceof HTTPException) {
    const response: ApiError = {
      success: false,
      error: {
        code: 'HTTP_ERROR',
        message: err.message,
      },
    }
    return c.json(response, err.status)
  }

  // Unknown error
  const response: ApiError = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : err.message,
    },
  }
  return c.json(response, 500)
}

export function notFoundHandler(c: Context) {
  const response: ApiError = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${c.req.method} ${c.req.path} not found`,
    },
  }
  return c.json(response, 404)
}
