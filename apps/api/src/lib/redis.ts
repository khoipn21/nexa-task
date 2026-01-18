import Redis from 'ioredis'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

// Main client for publishing
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

// Separate client for subscriptions (required by Redis)
export const redisSub = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

// Connection state tracking
let isConnected = false

export async function connectRedis() {
  try {
    await redis.connect()
    await redisSub.connect()
    isConnected = true
    console.log('Redis connected successfully')
  } catch (error) {
    console.warn(
      'Redis connection failed, running without real-time sync:',
      error,
    )
    isConnected = false
  }
}

export function isRedisConnected() {
  return isConnected
}

// Pub/sub channel helpers
export const CHANNELS = {
  taskUpdate: (projectId: string) => `task:${projectId}`,
  presence: (projectId: string) => `presence:${projectId}`,
}
