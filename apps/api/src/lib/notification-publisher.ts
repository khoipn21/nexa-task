import { redis, redisSub, isRedisConnected } from './redis'
import { wsManager } from './websocket'

// Notification channel pattern: notifications:{userId}
const getNotificationChannel = (userId: string) => `notifications:${userId}`

// Track active subscriptions for cleanup
const activeSubscriptions = new Map<string, (channel: string, message: string) => void>()

export interface NotificationPayload {
  id: string
  type: string
  message: string
  entityType?: 'task' | 'project' | 'comment' | 'workspace' | null
  entityId?: string | null
  createdAt: Date | string
  isRead: boolean
}

// Publish notification to user via Redis + WebSocket
export async function publishNotification(
  userId: string,
  notification: NotificationPayload,
) {
  const payload = {
    type: 'notification',
    data: {
      ...notification,
      createdAt:
        notification.createdAt instanceof Date
          ? notification.createdAt.toISOString()
          : notification.createdAt,
    },
  }

  // Try Redis pub/sub first (for multi-server deployment)
  if (isRedisConnected()) {
    try {
      await redis.publish(getNotificationChannel(userId), JSON.stringify(payload))
    } catch (error) {
      console.warn('Redis publish failed, falling back to direct WebSocket:', error)
      // Fallback to direct WebSocket
      sendToUserWebSocket(userId, payload)
    }
  } else {
    // Direct WebSocket if Redis unavailable
    sendToUserWebSocket(userId, payload)
  }
}

// Send directly to user's WebSocket connection
function sendToUserWebSocket(userId: string, payload: object) {
  // Use room-based broadcasting with user-specific room
  const userRoom = `user:${userId}`
  wsManager.broadcast(userRoom, payload)
}

// Subscribe to user's notification channel (called when user connects)
export async function subscribeToUserNotifications(
  userId: string,
  callback: (notification: NotificationPayload) => void,
): Promise<() => void> {
  if (!isRedisConnected()) {
    return () => {} // No-op unsubscribe if Redis unavailable
  }

  const channel = getNotificationChannel(userId)

  // Handler for incoming notifications
  const messageHandler = (receivedChannel: string, message: string) => {
    if (receivedChannel === channel) {
      try {
        const payload = JSON.parse(message)
        if (payload.type === 'notification') {
          callback(payload.data)
        }
      } catch (error) {
        console.error('Failed to parse notification message:', error)
      }
    }
  }

  // Store handler for cleanup
  activeSubscriptions.set(userId, messageHandler)

  // Subscribe
  redisSub.on('message', messageHandler)
  await redisSub.subscribe(channel)

  // Return unsubscribe function
  return async () => {
    const handler = activeSubscriptions.get(userId)
    if (handler) {
      redisSub.off('message', handler)
      activeSubscriptions.delete(userId)
      try {
        await redisSub.unsubscribe(channel)
      } catch {
        // Ignore unsubscribe errors
      }
    }
  }
}

// Bulk publish for batch notifications
export async function publishNotifications(
  notifications: Array<{ userId: string; notification: NotificationPayload }>,
) {
  const promises = notifications.map(({ userId, notification }) =>
    publishNotification(userId, notification),
  )
  await Promise.allSettled(promises)
}
