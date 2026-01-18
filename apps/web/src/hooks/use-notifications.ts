import { api } from '@/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

export type Notification = {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  entityType?: 'task' | 'project' | 'comment' | 'workspace' | null
  entityId?: string | null
  data?: Record<string, unknown>
  createdAt: string
}

export type NotificationsResponse = {
  items: Notification[]
  total: number
  unreadCount: number
  page: number
  limit: number
  hasMore: boolean
}

// Hook for fetching notifications
export function useNotifications(options?: { page?: number; limit?: number }) {
  const page = options?.page ?? 1
  const limit = options?.limit ?? 20

  return useQuery<NotificationsResponse>({
    queryKey: ['notifications', page, limit],
    queryFn: () =>
      api.get('/notifications', {
        page: String(page),
        limit: String(limit),
      }),
  })
}

// Hook for unread count only (lightweight)
export function useUnreadCount() {
  const { data } = useNotifications({ limit: 1 })
  return data?.unreadCount ?? 0
}

// Hook for marking notification as read
export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (notificationId: string) =>
      api.patch(`/notifications/${notificationId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

// Hook for marking all notifications as read
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

// WebSocket-based real-time notifications
export function useRealtimeNotifications() {
  const queryClient = useQueryClient()
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 10 // Increased from 5 to allow ~17 min of retries
  const isCleaningUp = useRef(false)

  useEffect(() => {
    const connect = () => {
      if (isCleaningUp.current) return

      const wsUrl =
        import.meta.env.VITE_WS_URL ||
        `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/connect`

      try {
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          setIsConnected(true)
          reconnectAttempts.current = 0
          console.log('[WS] Connected')
        }

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            if (message.type === 'notification') {
              queryClient.invalidateQueries({ queryKey: ['notifications'] })
            }
          } catch (err) {
            console.warn('[WS] Message parse error:', err)
          }
        }

        ws.onclose = (event) => {
          setIsConnected(false)
          wsRef.current = null
          console.log('[WS] Disconnected:', event.code, event.reason)

          // Attempt reconnect with exponential backoff
          if (
            !isCleaningUp.current &&
            reconnectAttempts.current < maxReconnectAttempts
          ) {
            const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 60000)
            console.log(
              `[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`,
            )
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttempts.current++
              connect()
            }, delay)
          }
        }

        ws.onerror = (err) => {
          console.warn('[WS] Error:', err)
          ws.close()
        }
      } catch (err) {
        console.warn('[WS] Connection failed:', err)
      }
    }

    connect()

    return () => {
      isCleaningUp.current = true
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [queryClient])

  return { isConnected }
}

// Combined hook for notifications with real-time updates
export function useNotificationsWithRealtime(options?: {
  page?: number
  limit?: number
}) {
  const notifications = useNotifications(options)
  const { isConnected } = useRealtimeNotifications()

  return {
    ...notifications,
    isConnected,
  }
}
