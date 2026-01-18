import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import { dbMiddleware } from './middleware/db'
import { errorHandler, notFoundHandler } from './middleware/error'
import { rateLimit } from './middleware/rate-limit'
import routes from './routes'
import type { Variables } from './types/context'

const app = new Hono<{ Variables: Variables }>()

// Global middleware
app.use('*', requestId())
app.use('*', logger())
app.use('*', secureHeaders())
app.use(
  '*',
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:5173',
      'http://localhost:3000',
    ],
    credentials: true,
  }),
)
app.use('*', dbMiddleware)

// Rate limit public endpoints
app.use('/api/*', rateLimit({ limit: 100, windowMs: 60_000 }))

// Mount routes
app.route('/', routes)

// Error handlers
app.onError(errorHandler)
app.notFound(notFoundHandler)

export { app }
