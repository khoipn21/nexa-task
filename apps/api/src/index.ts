import { app } from './app'
import { connectRedis } from './lib/redis'
import wsRoutes, { websocket } from './routes/ws'
import { initRealtimeSubscriptions } from './services/realtime'

const port = process.env.PORT || 3001

// Mount WebSocket routes
app.route('/ws', wsRoutes)

// Initialize real-time layer
async function init() {
  await connectRedis()
  initRealtimeSubscriptions()
  console.log(`Starting API server on port ${port}...`)
}

init().catch(console.error)

export default {
  port,
  fetch: app.fetch,
  websocket,
  maxRequestBodySize: 50 * 1024 * 1024, // 50MB for file uploads
}
