import type { ServerWebSocket } from 'bun'

export type WSData = {
  userId: string
  workspaceId: string
  rooms: Set<string>
}

// Helper to get user's personal notification room
export function getUserNotificationRoom(userId: string): string {
  return `user:${userId}`
}

class WebSocketManager {
  private connections = new Map<string, Set<ServerWebSocket<WSData>>>()
  private userSockets = new Map<string, ServerWebSocket<WSData>>()

  addConnection(ws: ServerWebSocket<WSData>) {
    this.userSockets.set(ws.data.userId, ws)
    // Auto-join user's personal notification room
    const userRoom = getUserNotificationRoom(ws.data.userId)
    this.joinRoom(ws, userRoom)
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
    const roomSet = this.connections.get(room)
    if (roomSet) {
      roomSet.add(ws)
    }
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

  // Send directly to a specific user
  sendToUser(userId: string, message: object) {
    const ws = this.userSockets.get(userId)
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(message))
    }
  }

  getRoomUsers(room: string): string[] {
    const clients = this.connections.get(room)
    if (!clients) return []
    return [...clients].map((ws) => ws.data.userId)
  }

  getConnectionCount(): number {
    return this.userSockets.size
  }

  getRoomCount(): number {
    return this.connections.size
  }

  isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId)
  }
}

export const wsManager = new WebSocketManager()
