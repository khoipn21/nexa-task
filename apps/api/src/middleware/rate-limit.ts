import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import type { Variables } from '../types/context'

type RateLimitRecord = { count: number; reset: number }
const store = new Map<string, RateLimitRecord>()

export const rateLimit = (
  options: { limit?: number; windowMs?: number } = {},
) => {
  const { limit = 100, windowMs = 60_000 } = options

  return createMiddleware<{ Variables: Variables }>(async (c, next) => {
    const key =
      c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    const now = Date.now()
    const record = store.get(key)

    if (!record || record.reset < now) {
      store.set(key, { count: 1, reset: now + windowMs })
    } else if (record.count >= limit) {
      c.header('X-RateLimit-Limit', String(limit))
      c.header('X-RateLimit-Remaining', '0')
      c.header('X-RateLimit-Reset', String(Math.ceil(record.reset / 1000)))
      throw new HTTPException(429, { message: 'Rate limit exceeded' })
    } else {
      record.count++
    }

    c.header('X-RateLimit-Limit', String(limit))
    c.header('X-RateLimit-Remaining', String(limit - (record?.count || 1)))

    await next()
  })
}

// Cleanup stale entries every 5 minutes
setInterval(
  () => {
    const now = Date.now()
    for (const [key, record] of store) {
      if (record.reset < now) {
        store.delete(key)
      }
    }
  },
  5 * 60 * 1000,
)
