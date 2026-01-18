# Phase 03: Backend API Foundation

## Context Links
- [Hono + Bun Research](../reports/researcher-260117-1758-hono-bun-backend.md)
- [Phase 02: Database Schema](./phase-02-database-schema.md)

## Overview
- **Priority**: P1 (Critical Path)
- **Status**: pending
- **Effort**: 8h

Establish Hono backend structure with middleware, error handling, validation, and Drizzle integration.

## Key Insights
- `createMiddleware` for typed context injection
- Zod validator for request validation
- Global error handler for consistent responses
- Modular routes via `app.route()`

## Requirements

### Functional
- RESTful API structure
- Request validation with Zod
- Consistent error responses
- Health check endpoint
- Drizzle DB context injection

### Non-Functional
- Response time < 100ms for simple queries
- Structured logging
- Rate limiting on public endpoints

## Architecture

```
apps/api/src/
├── index.ts              # Bun.serve entry
├── app.ts                # Hono app assembly
├── routes/
│   ├── index.ts          # Route aggregation
│   ├── health.ts
│   ├── auth.ts
│   ├── workspaces.ts
│   ├── projects.ts
│   ├── tasks.ts
│   └── ws.ts             # WebSocket routes
├── middleware/
│   ├── db.ts             # Drizzle context
│   ├── auth.ts           # Clerk auth
│   ├── rbac.ts           # Permission checks
│   ├── rate-limit.ts
│   └── error.ts
├── lib/
│   ├── errors.ts         # Custom error classes
│   ├── validators.ts     # Zod schemas
│   └── response.ts       # Response helpers
└── types/
    └── context.ts        # Hono context types
```

## Related Code Files

### Create
- `/apps/api/src/app.ts`
- `/apps/api/src/middleware/db.ts`
- `/apps/api/src/middleware/error.ts`
- `/apps/api/src/middleware/rate-limit.ts`
- `/apps/api/src/lib/errors.ts`
- `/apps/api/src/lib/response.ts`
- `/apps/api/src/lib/validators.ts`
- `/apps/api/src/types/context.ts`
- `/apps/api/src/routes/index.ts`
- `/apps/api/src/routes/health.ts`

### Modify
- `/apps/api/src/index.ts`
- `/apps/api/package.json` (add dependencies)

## Implementation Steps

### 1. Context Types
**apps/api/src/types/context.ts**:
```typescript
import type { Database } from '@repo/db'

export type Variables = {
  db: Database
  user: {
    id: string
    clerkId: string
    email: string
    role: 'super_admin' | 'pm' | 'member' | 'guest'
    orgId: string | null
  } | null
  requestId: string
}
```

### 2. Custom Errors
**apps/api/src/lib/errors.ts**:
```typescript
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id ${id} not found` : `${resource} not found`,
      404,
      'NOT_FOUND'
    )
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED')
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN')
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super('Validation failed', 400, 'VALIDATION_ERROR', details)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT')
  }
}
```

### 3. Response Helpers
**apps/api/src/lib/response.ts**:
```typescript
import type { Context } from 'hono'

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

export function success<T>(c: Context, data: T, meta?: ApiResponse<T>['meta'], status = 200) {
  const response: ApiResponse<T> = { success: true, data }
  if (meta) response.meta = meta
  return c.json(response, status as any)
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
  { page, limit, total }: { page: number; limit: number; total: number }
) {
  return success(c, data, { page, limit, total })
}
```

### 4. Validators
**apps/api/src/lib/validators.ts**:
```typescript
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

// Workspace
export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
})

export const updateWorkspaceSchema = createWorkspaceSchema.partial()

// Project
export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
})

export const updateProjectSchema = createProjectSchema.partial().extend({
  status: z.enum(['active', 'archived', 'deleted']).optional(),
})

// Task
export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  statusId: uuidSchema.optional(),
  assigneeId: uuidSchema.optional(),
  dueDate: z.string().datetime().optional(),
})

export const updateTaskSchema = createTaskSchema.partial()

export const moveTaskSchema = z.object({
  statusId: uuidSchema,
  order: z.number().int().min(0),
})

// Comment
export const createCommentSchema = z.object({
  content: z.string().min(1).max(10000),
})

export const updateCommentSchema = createCommentSchema
```

### 5. Database Middleware
**apps/api/src/middleware/db.ts**:
```typescript
import { createMiddleware } from 'hono/factory'
import { db } from '@repo/db'
import type { Variables } from '../types/context'

export const dbMiddleware = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  c.set('db', db)
  await next()
})
```

### 6. Error Middleware
**apps/api/src/middleware/error.ts**:
```typescript
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
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
    return c.json(response, err.statusCode as any)
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
      message: process.env.NODE_ENV === 'production'
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
```

### 7. Rate Limiting Middleware
**apps/api/src/middleware/rate-limit.ts**:
```typescript
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import type { Variables } from '../types/context'

type RateLimitRecord = { count: number; reset: number }
const store = new Map<string, RateLimitRecord>()

export const rateLimit = (options: { limit?: number; windowMs?: number } = {}) => {
  const { limit = 100, windowMs = 60_000 } = options

  return createMiddleware<{ Variables: Variables }>(async (c, next) => {
    const key = c.req.header('x-forwarded-for') ||
                c.req.header('x-real-ip') ||
                'unknown'
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
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of store) {
    if (record.reset < now) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000)
```

### 8. Health Route
**apps/api/src/routes/health.ts**:
```typescript
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
    await db.execute('SELECT 1')
    return c.json({ status: 'ready', database: 'connected' })
  } catch {
    return c.json({ status: 'not ready', database: 'disconnected' }, 503)
  }
})

export default health
```

### 9. Route Aggregation
**apps/api/src/routes/index.ts**:
```typescript
import { Hono } from 'hono'
import type { Variables } from '../types/context'
import health from './health'

const routes = new Hono<{ Variables: Variables }>()

// Public routes
routes.route('/health', health)

// API routes (auth required) - added in Phase 04

export default routes
```

### 10. Main App Assembly
**apps/api/src/app.ts**:
```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import type { Variables } from './types/context'
import { dbMiddleware } from './middleware/db'
import { rateLimit } from './middleware/rate-limit'
import { errorHandler, notFoundHandler } from './middleware/error'
import routes from './routes'

const app = new Hono<{ Variables: Variables }>()

// Global middleware
app.use('*', requestId())
app.use('*', logger())
app.use('*', secureHeaders())
app.use('*', cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
}))
app.use('*', dbMiddleware)

// Rate limit public endpoints
app.use('/api/*', rateLimit({ limit: 100, windowMs: 60_000 }))

// Mount routes
app.route('/', routes)

// Error handlers
app.onError(errorHandler)
app.notFound(notFoundHandler)

export { app }
```

### 11. Entry Point
**apps/api/src/index.ts**:
```typescript
import { app } from './app'

const port = process.env.PORT || 3001

console.log(`Starting API server on port ${port}...`)

export default {
  port,
  fetch: app.fetch,
  maxRequestBodySize: 50 * 1024 * 1024, // 50MB for file uploads
}
```

### 12. Update package.json
Add to **apps/api/package.json** dependencies:
```json
{
  "dependencies": {
    "@hono/zod-validator": "^0.4.0",
    "@repo/db": "workspace:*",
    "@repo/shared": "workspace:*",
    "hono": "^4.7.0",
    "zod": "^3.24.0"
  }
}
```

## Todo List
- [ ] Create types/context.ts with Variables type
- [ ] Create lib/errors.ts with custom error classes
- [ ] Create lib/response.ts with helpers
- [ ] Create lib/validators.ts with Zod schemas
- [ ] Create middleware/db.ts for Drizzle injection
- [ ] Create middleware/error.ts for error handling
- [ ] Create middleware/rate-limit.ts
- [ ] Create routes/health.ts
- [ ] Create routes/index.ts aggregator
- [ ] Create app.ts with middleware chain
- [ ] Update index.ts entry point
- [ ] Test health endpoint returns 200

## Success Criteria
- [x] `GET /health` returns `{ status: "healthy" }`
- [x] `GET /health/ready` checks database connection
- [x] Unknown routes return structured 404
- [x] Errors return structured JSON responses
- [x] Rate limiting headers present
- [x] CORS configured correctly

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Middleware order issues | Medium | Document order clearly |
| Memory leak in rate limiter | Low | Periodic cleanup implemented |
| CORS misconfiguration | Medium | Environment-based config |

## Security Considerations
- Secure headers enabled
- Rate limiting on all API routes
- CORS restricted to allowed origins
- Request IDs for tracing

## Next Steps
- Phase 04: Authentication + RBAC (Clerk integration)
