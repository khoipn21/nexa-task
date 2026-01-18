import { type Job, type Processor, Queue, Worker } from 'bullmq'
import type { NotificationType } from '../services/notification'

// Queue names as constants for type safety
export const QUEUE_NAMES = {
  email: 'email-notifications',
} as const

// Job priority levels (lower number = higher priority)
export const JOB_PRIORITY = {
  critical: 1, // Password reset, security alerts
  high: 2, // Mentions, direct assignments
  normal: 3, // Status changes, comments
  low: 4, // Bulk notifications, digests
} as const

// Email job data structure
export interface EmailJobData {
  notificationId: string
  userId: string
  type: NotificationType
  recipientEmail: string
  subject: string
  templateData: {
    taskTitle?: string
    projectName?: string
    actorName?: string
    taskUrl?: string
    dueDate?: string
    changeType?: 'status' | 'priority' | 'due_date' | 'description'
    oldValue?: string
    newValue?: string
    commentPreview?: string
    isMention?: boolean
    unsubscribeUrl?: string
  }
}

// Get rate limit config from env
function getRateLimitConfig() {
  return {
    max: Number(process.env.EMAIL_RATE_LIMIT_MAX) || 100,
    duration: Number(process.env.EMAIL_RATE_LIMIT_DURATION_MS) || 60000,
  }
}

// Get Redis connection config for BullMQ
function getRedisConfig() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
  const url = new URL(redisUrl)

  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: url.password || undefined,
    maxRetriesPerRequest: null, // Required for BullMQ
  }
}

// Singleton queue instance
let emailQueue: Queue<EmailJobData> | null = null

// Get or create email queue
export function getEmailQueue(): Queue<EmailJobData> {
  if (!emailQueue) {
    emailQueue = new Queue<EmailJobData>(QUEUE_NAMES.email, {
      connection: getRedisConfig(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000, // 1s, 2s, 4s backoff
        },
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 24 hours
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
        },
      },
    })
  }
  return emailQueue
}

// Add email job to queue with priority support
export async function addEmailJob(
  data: EmailJobData,
  options?: { delay?: number; priority?: keyof typeof JOB_PRIORITY },
) {
  const queue = getEmailQueue()

  // Determine priority based on notification type
  let priority: (typeof JOB_PRIORITY)[keyof typeof JOB_PRIORITY] =
    JOB_PRIORITY.normal
  if (options?.priority) {
    priority = JOB_PRIORITY[options.priority]
  } else if (data.type === 'task_mentioned') {
    priority = JOB_PRIORITY.high
  } else if (data.type === 'task_assigned') {
    priority = JOB_PRIORITY.high
  }

  // Use notificationId as job ID for idempotency (prevents duplicates)
  const job = await queue.add('send-email', data, {
    jobId: `email-${data.notificationId}`,
    delay: options?.delay,
    priority,
  })

  return job.id
}

// Create email worker with configurable rate limiting
export function createEmailWorker(
  processor: Processor<EmailJobData>,
): Worker<EmailJobData> {
  const rateLimit = getRateLimitConfig()

  const worker = new Worker<EmailJobData>(QUEUE_NAMES.email, processor, {
    connection: getRedisConfig(),
    concurrency: 5, // Process 5 emails in parallel
    limiter: {
      max: rateLimit.max,
      duration: rateLimit.duration,
    },
  })

  worker.on('completed', (job: Job<EmailJobData>) => {
    console.log(`[EmailWorker] Job ${job.id} completed`)
  })

  worker.on('failed', (job: Job<EmailJobData> | undefined, err: Error) => {
    console.error(`[EmailWorker] Job ${job?.id} failed:`, err.message)
  })

  return worker
}

// Close queue and workers (cleanup on shutdown)
export async function closeEmailQueue(): Promise<void> {
  if (emailQueue) {
    await emailQueue.close()
    emailQueue = null
  }
}
