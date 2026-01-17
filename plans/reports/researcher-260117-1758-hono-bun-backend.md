# Hono + Bun Backend Research Report

**Date:** 2026-01-17
**Focus:** Task Management API with WebSockets, File Uploads, Drizzle ORM
**Stack:** Hono v4 + Bun runtime + Drizzle ORM

---

## 1. Setup & Project Structure

### Initial Setup
```bash
bun create hono@latest nexa-task-api
cd nexa-task-api
bun install drizzle-orm @hono/zod-validator zod
```

### Recommended Structure
```
src/
├── index.ts              # Entry point with Bun.serve config
├── app.ts                # Main Hono app instance
├── routes/               # Route modules
│   ├── tasks.ts
│   ├── attachments.ts
│   └── ws.ts
├── middleware/           # Custom middleware
│   ├── drizzle.ts
│   ├── auth.ts
│   └── rate-limit.ts
├── db/
│   ├── schema.ts         # Drizzle schema
│   └── index.ts          # DB connection
└── lib/
    ├── error.ts
    └── validators.ts
```

### Entry Point (`src/index.ts`)
```typescript
import { app } from './app'
import { websocket } from 'hono/bun'

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
  websocket,
  maxRequestBodySize: 1024 * 1024 * 50, // 50MB for file uploads
  host: '127.0.0.1' // Explicit host for performance boost
}
```

---

## 2. Drizzle ORM Integration

### DB Setup (Bun + PostgreSQL)
```typescript
// src/db/index.ts
import { drizzle } from 'drizzle-orm/bun-sql'
import { SQL } from 'bun'

const client = new SQL(process.env.DATABASE_URL!)
export const db = drizzle({ client })
```

### Type-Safe Context Middleware
```typescript
// src/middleware/drizzle.ts
import { createMiddleware } from 'hono/factory'
import { db } from '../db'

declare module 'hono' {
  interface ContextVariableMap {
    db: typeof db
  }
}

export const drizzleMiddleware = createMiddleware(async (c, next) => {
  c.set('db', db)
  await next()
})
```

### Usage in Routes
```typescript
// src/routes/tasks.ts
import { Hono } from 'hono'
import { tasks } from '../db/schema'

const app = new Hono()

app.get('/', async (c) => {
  const db = c.var.db // Fully typed!
  const allTasks = await db.select().from(tasks)
  return c.json(allTasks)
})

export default app
```

---

## 3. Middleware Patterns

### Authentication Middleware
```typescript
// src/middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { bearerAuth } from 'hono/bearer-auth'

// Simple JWT validation (expand as needed)
export const authMiddleware = createMiddleware(async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')

  if (!token) {
    throw new HTTPException(401, { message: 'Unauthorized' })
  }

  // Verify JWT and attach user to context
  const user = await verifyToken(token) // Your JWT logic
  c.set('user', user)
  await next()
})
```

### Rate Limiting Pattern
```typescript
// src/middleware/rate-limit.ts
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

const rateLimitStore = new Map<string, { count: number; reset: number }>()

export const rateLimit = (limit = 100, window = 60000) => {
  return createMiddleware(async (c, next) => {
    const key = c.req.header('x-forwarded-for') || 'unknown'
    const now = Date.now()
    const record = rateLimitStore.get(key)

    if (!record || record.reset < now) {
      rateLimitStore.set(key, { count: 1, reset: now + window })
    } else if (record.count >= limit) {
      throw new HTTPException(429, { message: 'Rate limit exceeded' })
    } else {
      record.count++
    }

    await next()
  })
}
```

### Conditional Middleware Execution
```typescript
import { some } from 'hono/combine'

// Skip rate limiting if valid auth token
app.use('/api/*', some(
  authMiddleware,
  rateLimit({ limit: 100 })
))
```

---

## 4. Validation with Zod

### Schema Definition
```typescript
// src/lib/validators.ts
import { z } from 'zod'

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']),
  dueDate: z.string().datetime().optional()
})

export const updateTaskSchema = createTaskSchema.partial()
```

### Route with Validation
```typescript
import { zValidator } from '@hono/zod-validator'
import { createTaskSchema } from '../lib/validators'

app.post('/',
  zValidator('json', createTaskSchema, (result, c) => {
    if (!result.success) {
      return c.json({
        error: 'Validation failed',
        details: result.error.flatten()
      }, 400)
    }
  }),
  async (c) => {
    const data = c.req.valid('json') // Fully typed!
    const db = c.var.db

    const [task] = await db.insert(tasks).values(data).returning()
    return c.json(task, 201)
  }
)
```

---

## 5. Error Handling Patterns

### Global Error Handler
```typescript
// src/app.ts
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'

const app = new Hono()

app.onError((err, c) => {
  console.error(`[Error] ${err.message}`, err)

  if (err instanceof HTTPException) {
    return c.json({
      error: err.message,
      status: err.status
    }, err.status)
  }

  // Database errors, etc.
  return c.json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  }, 500)
})

app.notFound((c) => {
  return c.json({ error: 'Not Found', path: c.req.path }, 404)
})
```

---

## 6. WebSocket Support

### WebSocket Route Setup
```typescript
// src/routes/ws.ts
import { Hono } from 'hono'
import { upgradeWebSocket, websocket } from 'hono/bun'

const wsApp = new Hono()

const connections = new Set<WebSocket>()

wsApp.get('/tasks',
  upgradeWebSocket((c) => {
    return {
      onOpen(event, ws) {
        connections.add(ws.raw)
        console.log('Client connected')
      },
      onMessage(event, ws) {
        const data = JSON.parse(event.data)

        // Broadcast to all clients
        connections.forEach(client => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({
              type: 'task_update',
              payload: data
            }))
          }
        })
      },
      onClose(event, ws) {
        connections.delete(ws.raw)
        console.log('Client disconnected')
      }
    }
  })
)

export default wsApp
export { websocket }
```

### Main App Integration
```typescript
// src/app.ts
import wsRoutes from './routes/ws'

app.route('/ws', wsRoutes)

// Export websocket for Bun.serve
export { websocket } from './routes/ws'
```

---

## 7. File Upload Handling

### Single File Upload
```typescript
// src/routes/attachments.ts
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'

const app = new Hono()

app.post('/upload',
  bodyLimit({
    maxSize: 10 * 1024 * 1024, // 10MB
    onError: (c) => c.json({ error: 'File too large' }, 413)
  }),
  async (c) => {
    const file = await c.req.file('attachment')

    if (!file) {
      return c.json({ error: 'No file provided' }, 400)
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: 'Invalid file type' }, 400)
    }

    // Save file (example using Bun.write)
    const buffer = await file.arrayBuffer()
    const filename = `${Date.now()}-${file.name}`
    const filepath = `./uploads/${filename}`

    await Bun.write(filepath, buffer)

    return c.json({
      filename,
      size: file.size,
      type: file.type,
      url: `/uploads/${filename}`
    })
  }
)
```

### Multiple Files with parseBody
```typescript
app.post('/upload-multiple', async (c) => {
  const body = await c.req.parseBody()
  const files = body['attachments'] // If input has multiple attribute

  if (!Array.isArray(files)) {
    return c.json({ error: 'Expected multiple files' }, 400)
  }

  const results = await Promise.all(
    files.map(async (file) => {
      const buffer = await file.arrayBuffer()
      const filename = `${Date.now()}-${file.name}`
      await Bun.write(`./uploads/${filename}`, buffer)
      return { filename, size: file.size }
    })
  )

  return c.json({ files: results })
})
```

---

## 8. Complete App Assembly

```typescript
// src/app.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { drizzleMiddleware } from './middleware/drizzle'
import { authMiddleware } from './middleware/auth'
import { rateLimit } from './middleware/rate-limit'

import taskRoutes from './routes/tasks'
import attachmentRoutes from './routes/attachments'
import wsRoutes from './routes/ws'

const app = new Hono()

// Global middleware
app.use('*', logger())
app.use('*', cors())
app.use('*', drizzleMiddleware)

// Public routes
app.get('/health', (c) => c.json({ status: 'ok' }))

// Protected routes
app.use('/api/*', authMiddleware)
app.use('/api/*', rateLimit({ limit: 100 }))

app.route('/api/tasks', taskRoutes)
app.route('/api/attachments', attachmentRoutes)
app.route('/ws', wsRoutes)

// Error handling (as shown in section 5)

export { app }
export { websocket } from './routes/ws'
```

---

## Key Takeaways

1. **Setup**: Use `bun create hono@latest`, organize with `app.route()` for modularity
2. **Drizzle**: Create middleware to inject typed `db` into context via `ContextVariableMap`
3. **Middleware**: Use `createMiddleware` for custom logic, `some()`/`every()` for conditional execution
4. **Validation**: `@hono/zod-validator` with custom error handlers for type-safe requests
5. **Errors**: Global `onError` + `HTTPException` for structured error responses
6. **WebSocket**: Import `upgradeWebSocket` and `websocket` from `hono/bun`, manage connections manually
7. **Files**: Use `c.req.file()` or `c.req.parseBody()`, validate types/sizes with `bodyLimit` middleware
8. **Performance**: Set explicit `host`, use `TrieRouter` (default), configure `maxRequestBodySize` in Bun.serve

---

## Unresolved Questions
- Session/token storage strategy (Redis vs in-memory vs DB)
- WebSocket authentication mechanism (JWT in initial upgrade request?)
- File storage location for production (local vs S3/cloud storage)
- Database migration strategy with Drizzle Kit
