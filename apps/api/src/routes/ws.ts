import { getAuth } from '@hono/clerk-auth'
import type { ServerWebSocket } from 'bun'
import { Hono } from 'hono'
import { createBunWebSocket } from 'hono/bun'
import { type WSData, wsManager } from '../lib/websocket'
import type { Variables } from '../types/context'

const { upgradeWebSocket, websocket } = createBunWebSocket<WSData>()

const wsRoutes = new Hono<{ Variables: Variables }>()

wsRoutes.get(
  '/connect',
  upgradeWebSocket((c) => {
    const auth = getAuth(c)

    return {
      onOpen(_event, ws) {
        const rawWs = ws.raw as ServerWebSocket<WSData> | undefined
        if (rawWs) {
          rawWs.data = {
            userId: auth?.userId || 'anonymous',
            workspaceId: auth?.orgId || '',
            rooms: new Set(),
          }
          wsManager.addConnection(rawWs)
          ws.send(JSON.stringify({ type: 'connected' }))
        }
      },

      onMessage(event, ws) {
        const rawWs = ws.raw as ServerWebSocket<WSData> | undefined
        if (!rawWs) return

        try {
          const msg = JSON.parse(event.data as string) as {
            type: string
            room?: string
          }

          switch (msg.type) {
            case 'subscribe':
              if (msg.room) {
                wsManager.joinRoom(rawWs, msg.room)
                ws.send(JSON.stringify({ type: 'subscribed', room: msg.room }))
              }
              break

            case 'unsubscribe':
              if (msg.room) {
                wsManager.leaveRoom(rawWs, msg.room)
                ws.send(
                  JSON.stringify({ type: 'unsubscribed', room: msg.room }),
                )
              }
              break

            case 'ping':
              ws.send(JSON.stringify({ type: 'pong' }))
              break
          }
        } catch (err) {
          console.error('WebSocket message error:', err)
        }
      },

      onClose(_event, ws) {
        const rawWs = ws.raw as ServerWebSocket<WSData> | undefined
        if (rawWs) {
          wsManager.removeConnection(rawWs)
        }
      },
    }
  }),
)

export { websocket, wsRoutes as default }
