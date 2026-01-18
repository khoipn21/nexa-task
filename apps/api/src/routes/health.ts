import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import type { Variables } from '../types/context'

const health = new Hono<{ Variables: Variables }>()

health.get('/', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.0.0',
  })
})

health.get('/ready', async (c) => {
  const db = c.var.db
  try {
    // Simple query to check DB connection
    await db.execute(sql`SELECT 1`)
    return c.json({ status: 'ready', database: 'connected' })
  } catch {
    return c.json({ status: 'not ready', database: 'disconnected' }, 503)
  }
})

export default health
