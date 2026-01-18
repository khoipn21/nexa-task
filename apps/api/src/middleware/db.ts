import { db } from '@repo/db'
import { createMiddleware } from 'hono/factory'
import type { Variables } from '../types/context'

export const dbMiddleware = createMiddleware<{ Variables: Variables }>(
  async (c, next) => {
    c.set('db', db)
    await next()
  },
)
