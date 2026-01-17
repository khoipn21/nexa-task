import type { Database } from '@repo/db'
import {
  notificationPreferences,
  notifications,
  userProjectPreferences,
  users,
} from '@repo/db/schema'
import { and, desc, eq, sql } from 'drizzle-orm'
import { NotFoundError, ForbiddenError, ValidationError } from '../lib/errors'
import { publishNotification } from '../lib/notification-publisher'
import { addEmailJob, type EmailJobData } from '../lib/queue'
import { redis, isRedisConnected } from '../lib/redis'

// Redis cache TTL for view preferences
// 1 hour balances freshness vs DB load - preferences change infrequently
const VIEW_PREF_CACHE_TTL = 3600
const getViewPrefCacheKey = (userId: string, projectId: string) =>
  `view-pref:${userId}:${projectId}`

// Sanitize string to prevent XSS - escapes HTML entities
function sanitizeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Valid notification types (must match enum in schema)
export const NOTIFICATION_TYPES = [
  'task_assigned',
  'task_status_changed',
  'task_comment_added',
  'task_mentioned',
  'task_due_soon',
  'task_dependency_completed',
  'watcher_added',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

// Types for notification creation
export interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, unknown>
  entityType?: 'task' | 'project' | 'comment' | 'workspace'
  entityId?: string
}

// Email template data for queue jobs
export interface EmailTemplateData {
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
}

// Create notification and optionally queue email
export async function createNotification(
  db: Database,
  input: CreateNotificationInput,
) {
  // Sanitize user-provided content to prevent XSS
  const sanitizedTitle = sanitizeText(input.title)
  const sanitizedMessage = sanitizeText(input.message)

  const [notification] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: sanitizedTitle,
      message: sanitizedMessage,
      data: input.data ?? {},
      entityType: input.entityType,
      entityId: input.entityId,
    })
    .returning()

  // Publish to WebSocket for real-time delivery (non-blocking)
  if (notification) {
    try {
      await publishNotification(input.userId, {
        id: notification.id,
        type: notification.type,
        message: notification.message,
        entityType: notification.entityType,
        entityId: notification.entityId,
        createdAt: notification.createdAt,
        isRead: notification.read,
      })
    } catch (error) {
      // Log but don't fail - DB write succeeded, real-time is best-effort
      console.error('Failed to publish notification via WebSocket:', error)
    }
  }

  return notification
}

// Create notification with email (checks preferences and queues email)
export async function createNotificationWithEmail(
  db: Database,
  input: CreateNotificationInput,
  emailData: EmailTemplateData,
) {
  // Create in-app notification
  const notification = await createNotification(db, input)
  if (!notification) {
    throw new Error('Failed to create notification')
  }

  // Check user preferences for email
  const prefs = await getNotificationPreferences(db, input.userId)
  if (!prefs) {
    return { notification, emailQueued: false }
  }

  // Skip email if disabled or type not enabled
  if (!prefs.emailEnabled) {
    return { notification, emailQueued: false }
  }

  if (!prefs.enabledTypes.includes(input.type)) {
    return { notification, emailQueued: false }
  }

  // Get user email
  const user = await db.query.users.findFirst({
    where: eq(users.id, input.userId),
    columns: { email: true },
  })

  if (!user?.email) {
    return { notification, emailQueued: false }
  }

  // Queue email job
  const jobData: EmailJobData = {
    notificationId: notification.id,
    userId: input.userId,
    type: input.type,
    recipientEmail: user.email,
    subject: input.title,
    templateData: emailData,
  }

  await addEmailJob(jobData)

  return { notification, emailQueued: true }
}

// Get user notifications with pagination (optimized single query with counts)
export async function getUserNotifications(
  db: Database,
  userId: string,
  page = 1,
  limit = 20,
) {
  const offset = (page - 1) * limit

  // Single query to get all data at once
  const [notificationList, [counts]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({
        total: sql<number>`count(*)::int`,
        unread: sql<number>`count(*) filter (where read = false)::int`,
      })
      .from(notifications)
      .where(eq(notifications.userId, userId)),
  ])

  return {
    data: notificationList,
    meta: {
      page,
      limit,
      total: counts?.total ?? 0,
      unread: counts?.unread ?? 0,
    },
  }
}

// Get unread notification count only (dedicated function)
export async function getUnreadNotificationCount(db: Database, userId: string) {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))

  return result?.count ?? 0
}

// Mark single notification as read (atomic update with ownership check)
export async function markNotificationRead(
  db: Database,
  notificationId: string,
  userId: string,
) {
  // Atomic update with ownership check - no race condition
  const [updated] = await db
    .update(notifications)
    .set({ read: true, readAt: new Date() })
    .where(
      and(eq(notifications.id, notificationId), eq(notifications.userId, userId)),
    )
    .returning()

  if (!updated) {
    // Check if notification exists vs ownership issue
    const exists = await db.query.notifications.findFirst({
      where: eq(notifications.id, notificationId),
      columns: { id: true },
    })
    if (!exists) {
      throw new NotFoundError('Notification', notificationId)
    }
    throw new ForbiddenError('Cannot access this notification')
  }

  return updated
}

// Mark all user notifications as read
export async function markAllNotificationsRead(db: Database, userId: string) {
  await db
    .update(notifications)
    .set({ read: true, readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))

  return { success: true }
}

// Get notification preferences
export async function getNotificationPreferences(db: Database, userId: string) {
  let prefs = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, userId),
  })

  // Create default preferences if not exist
  if (!prefs) {
    const [created] = await db
      .insert(notificationPreferences)
      .values({ userId })
      .returning()
    prefs = created
  }

  return prefs
}

// Update notification preferences with validation
export async function updateNotificationPreferences(
  db: Database,
  userId: string,
  input: {
    emailEnabled?: boolean
    inappEnabled?: boolean
    enabledTypes?: string[]
  },
) {
  // Validate enabledTypes against allowed enum values to prevent injection
  if (input.enabledTypes) {
    const invalidTypes = input.enabledTypes.filter(
      (t) => !NOTIFICATION_TYPES.includes(t as NotificationType),
    )
    if (invalidTypes.length > 0) {
      throw new ValidationError({
        enabledTypes: `Invalid notification types: ${invalidTypes.join(', ')}`,
      })
    }
  }

  // Upsert pattern: insert if not exists, update if exists
  const existing = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, userId),
    columns: { id: true },
  })

  if (existing) {
    const [updated] = await db
      .update(notificationPreferences)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(notificationPreferences.userId, userId))
      .returning()
    return updated
  }

  const [created] = await db
    .insert(notificationPreferences)
    .values({
      userId,
      emailEnabled: input.emailEnabled ?? true,
      inappEnabled: input.inappEnabled ?? true,
      enabledTypes: input.enabledTypes ?? [
        'task_assigned',
        'task_status_changed',
        'task_comment_added',
        'task_mentioned',
        'task_due_soon',
      ],
    })
    .returning()

  return created
}

// Get project view preference (with Redis caching)
export async function getProjectViewPreference(
  db: Database,
  userId: string,
  projectId: string,
) {
  const cacheKey = getViewPrefCacheKey(userId, projectId)

  // Try Redis cache first
  if (isRedisConnected()) {
    try {
      const cached = await redis.get(cacheKey)
      if (cached) {
        return { viewMode: cached as 'kanban' | 'list' | 'calendar' }
      }
    } catch (error) {
      console.warn('[ViewPref] Redis read error, fallback to DB:', error)
    }
  }

  // Fetch from DB
  const pref = await db.query.userProjectPreferences.findFirst({
    where: and(
      eq(userProjectPreferences.userId, userId),
      eq(userProjectPreferences.projectId, projectId),
    ),
  })

  const viewMode = pref?.viewMode ?? 'kanban'

  // Cache in Redis
  if (isRedisConnected()) {
    try {
      await redis.setex(cacheKey, VIEW_PREF_CACHE_TTL, viewMode)
    } catch (error) {
      console.warn('[ViewPref] Redis write error:', error)
    }
  }

  return { viewMode }
}

// Set project view preference (with Redis caching)
export async function setProjectViewPreference(
  db: Database,
  userId: string,
  projectId: string,
  viewMode: 'kanban' | 'list' | 'calendar',
) {
  const existing = await db.query.userProjectPreferences.findFirst({
    where: and(
      eq(userProjectPreferences.userId, userId),
      eq(userProjectPreferences.projectId, projectId),
    ),
  })

  let result
  if (existing) {
    const [updated] = await db
      .update(userProjectPreferences)
      .set({ viewMode, updatedAt: new Date() })
      .where(eq(userProjectPreferences.id, existing.id))
      .returning()
    result = updated
  } else {
    const [created] = await db
      .insert(userProjectPreferences)
      .values({ userId, projectId, viewMode })
      .returning()
    result = created
  }

  // Update Redis cache
  const cacheKey = getViewPrefCacheKey(userId, projectId)
  if (isRedisConnected()) {
    try {
      await redis.setex(cacheKey, VIEW_PREF_CACHE_TTL, viewMode)
    } catch (error) {
      console.warn('[ViewPref] Redis cache update error:', error)
    }
  }

  return result
}
