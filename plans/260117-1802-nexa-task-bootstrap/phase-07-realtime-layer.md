# Phase 07: Real-time Layer

## Context Links
- [Hono + Bun Research](../reports/researcher-260117-1758-hono-bun-backend.md)
- [Phase 06: Task APIs](./phase-06-task-apis.md)

## Overview
- **Priority**: P2
- **Status**: pending
- **Effort**: 6h

Implement WebSocket layer for real-time task updates with Redis pub/sub for multi-instance sync.

## Key Insights
- Hono's `upgradeWebSocket` for Bun native WebSocket
- Redis pub/sub for horizontal scaling
- Room-based subscriptions (workspace, project)
- JWT auth on WebSocket upgrade

## Requirements

### Functional
- Real-time task updates (create, update, move, delete)
- Room subscriptions per project
- Presence indicators (who's viewing)
- Connection management (heartbeat, reconnect)

### Non-Functional
- Message latency < 50ms
- Support 1000+ concurrent connections
- Graceful degradation if Redis unavailable

## Architecture

### WebSocket Events
```
Client -> Server:
  subscribe: { room: "project:{id}" }
  unsubscribe: { room: "project:{id}" }
  presence: { action: "join" | "leave", room: string }

Server -> Client:
  task:created: { task: Task }
  task:updated: { task: Task, changes: object }
  task:moved: { taskId, fromStatus, toStatus, order }
  task:deleted: { taskId }
  presence:update: { room, users: User[] }
```

## Related Code Files

### Create
- `/apps/api/src/routes/ws.ts`
- `/apps/api/src/lib/websocket.ts`
- `/apps/api/src/lib/redis.ts`
- `/apps/api/src/services/realtime.ts`

### Modify
- `/apps/api/src/index.ts` (export websocket)
- `/apps/api/src/services/task.ts` (emit events)
- `/apps/api/package.json` (add ioredis)

## Implementation Steps

### 1. Redis Client
**apps/api/src/lib/redis.ts**:
```typescript
import Redis from 'ioredis'

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
export const redisSub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

// Pub/sub channels
export const CHANNELS = {
  taskUpdate: (projectId: string) => `task:${projectId}`,
  presence: (projectId: string) => `presence:${projectId}`,
}
```

### 2. WebSocket Manager
**apps/api/src/lib/websocket.ts**:
```typescript
import type { ServerWebSocket } from 'bun'

type WSData = {
  userId: string
  workspaceId: string
  rooms: Set<string>
}

class WebSocketManager {
  private connections = new Map<string, Set<ServerWebSocket<WSData>>>()
  private userSockets = new Map<string, ServerWebSocket<WSData>>()

  addConnection(ws: ServerWebSocket<WSData>) {
    this.userSockets.set(ws.data.userId, ws)
  }

  removeConnection(ws: ServerWebSocket<WSData>) {
    this.userSockets.delete(ws.data.userId)
    for (const room of ws.data.rooms) {
      this.leaveRoom(ws, room)
    }
  }

  joinRoom(ws: ServerWebSocket<WSData>, room: string) {
    ws.data.rooms.add(room)
    if (!this.connections.has(room)) {
      this.connections.set(room, new Set())
    }
    this.connections.get(room)!.add(ws)
  }

  leaveRoom(ws: ServerWebSocket<WSData>, room: string) {
    ws.data.rooms.delete(room)
    this.connections.get(room)?.delete(ws)
  }

  broadcast(room: string, message: object, excludeUserId?: string) {
    const clients = this.connections.get(room)
    if (!clients) return

    const payload = JSON.stringify(message)
    for (const ws of clients) {
      if (excludeUserId && ws.data.userId === excludeUserId) continue
      if (ws.readyState === 1) {
        ws.send(payload)
      }
    }
  }

  getRoomUsers(room: string): string[] {
    const clients = this.connections.get(room)
    if (!clients) return []
    return [...clients].map(ws => ws.data.userId)
  }
}

export const wsManager = new WebSocketManager()
```

### 3. Realtime Service
**apps/api/src/services/realtime.ts**:
```typescript
import { redis, redisSub, CHANNELS } from '../lib/redis'
import { wsManager } from '../lib/websocket'

type TaskEvent = {
  type: 'task:created' | 'task:updated' | 'task:moved' | 'task:deleted'
  projectId: string
  data: any
  userId: string
}

export async function emitTaskEvent(event: TaskEvent) {
  const channel = CHANNELS.taskUpdate(event.projectId)
  await redis.publish(channel, JSON.stringify(event))
}

// Subscribe to Redis and broadcast to WebSocket clients
export function initRealtimeSubscriptions() {
  redisSub.psubscribe('task:*', 'presence:*')

  redisSub.on('pmessage', (pattern, channel, message) => {
    try {
      const event = JSON.parse(message) as TaskEvent
      const room = `project:${event.projectId}`
      wsManager.broadcast(room, event, event.userId)
    } catch (err) {
      console.error('Failed to process Redis message:', err)
    }
  })
}
```

### 4. WebSocket Routes
**apps/api/src/routes/ws.ts**:
```typescript
import { Hono } from 'hono'
import { upgradeWebSocket } from 'hono/bun'
import { getAuth } from '@hono/clerk-auth'
import { wsManager } from '../lib/websocket'
import type { Variables } from '../types/context'

const ws = new Hono<{ Variables: Variables }>()

ws.get(
  '/connect',
  upgradeWebSocket((c) => {
    const auth = getAuth(c)

    return {
      onOpen(event, wsContext) {
        const ws = wsContext.raw
        ws.data = {
          userId: auth?.userId || 'anonymous',
          workspaceId: auth?.orgId || '',
          rooms: new Set(),
        }
        wsManager.addConnection(ws)
        ws.send(JSON.stringify({ type: 'connected' }))
      },

      onMessage(event, wsContext) {
        const ws = wsContext.raw
        try {
          const msg = JSON.parse(event.data as string)

          switch (msg.type) {
            case 'subscribe':
              wsManager.joinRoom(ws, msg.room)
              ws.send(JSON.stringify({ type: 'subscribed', room: msg.room }))
              break

            case 'unsubscribe':
              wsManager.leaveRoom(ws, msg.room)
              ws.send(JSON.stringify({ type: 'unsubscribed', room: msg.room }))
              break

            case 'ping':
              ws.send(JSON.stringify({ type: 'pong' }))
              break
          }
        } catch (err) {
          console.error('WebSocket message error:', err)
        }
      },

      onClose(event, wsContext) {
        wsManager.removeConnection(wsContext.raw)
      },
    }
  })
)

export default ws
```

### 5. Update Task Service
Add to task mutations in `services/task.ts`:
```typescript
import { emitTaskEvent } from './realtime'

// After createTask:
await emitTaskEvent({
  type: 'task:created',
  projectId,
  data: result,
  userId: createdById,
})

// After updateTask/moveTask/deleteTask similarly...
```

### 6. Update Entry Point
**apps/api/src/index.ts**:
```typescript
import { app } from './app'
import { websocket } from 'hono/bun'
import { initRealtimeSubscriptions } from './services/realtime'

initRealtimeSubscriptions()

export default {
  port: process.env.PORT || 3001,
  fetch: app.fetch,
  websocket,
  maxRequestBodySize: 50 * 1024 * 1024,
}
```

## Todo List
- [ ] Setup Redis client with pub/sub
- [ ] Create WebSocket manager class
- [ ] Create realtime service for event emission
- [ ] Create WebSocket routes with auth
- [ ] Integrate events into task mutations
- [ ] Test real-time updates across clients
- [ ] Add heartbeat/reconnection logic

## Success Criteria
- [x] WebSocket connects with auth
- [x] Room subscriptions work
- [x] Task events broadcast to subscribers
- [x] Multi-instance sync via Redis

## Next Steps
- Phase 08: Frontend Foundation
