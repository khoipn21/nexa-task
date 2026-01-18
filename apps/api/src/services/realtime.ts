import { CHANNELS, isRedisConnected, redis, redisSub } from '../lib/redis'
import { wsManager } from '../lib/websocket'

type TaskEventType =
  | 'task:created'
  | 'task:updated'
  | 'task:moved'
  | 'task:deleted'

export type TaskEvent = {
  type: TaskEventType
  projectId: string
  data: unknown
  userId: string
}

// Emit a task event to all subscribers
export async function emitTaskEvent(event: TaskEvent) {
  const room = `project:${event.projectId}`

  // Always broadcast locally
  wsManager.broadcast(room, event, event.userId)

  // Also publish to Redis for multi-instance sync
  if (isRedisConnected()) {
    try {
      const channel = CHANNELS.taskUpdate(event.projectId)
      await redis.publish(channel, JSON.stringify(event))
    } catch (error) {
      console.error('Failed to publish to Redis:', error)
    }
  }
}

// Subscribe to Redis and broadcast to WebSocket clients
export function initRealtimeSubscriptions() {
  if (!isRedisConnected()) {
    console.log('Redis not connected, running in single-instance mode')
    return
  }

  redisSub.psubscribe('task:*', 'presence:*').catch((err) => {
    console.error('Failed to subscribe to Redis channels:', err)
  })

  redisSub.on('pmessage', (_pattern, _channel, message) => {
    try {
      const event = JSON.parse(message) as TaskEvent
      const room = `project:${event.projectId}`
      // Broadcast to local WebSocket clients, excluding the original sender
      wsManager.broadcast(room, event, event.userId)
    } catch (err) {
      console.error('Failed to process Redis message:', err)
    }
  })

  console.log('Real-time subscriptions initialized')
}
