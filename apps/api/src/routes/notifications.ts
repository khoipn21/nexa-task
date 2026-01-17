import { zValidator } from '@hono/zod-validator'
import {
  notificationFilterSchema,
  updateNotificationPreferencesSchema,
} from '@repo/shared'
import { Hono } from 'hono'
import { getAuthUser } from '../lib/errors'
import { noContent, paginated, success } from '../lib/response'
import { requireWorkspace } from '../middleware/auth'
import * as notificationService from '../services/notification'
import type { Variables } from '../types/context'

const notificationsRouter = new Hono<{ Variables: Variables }>()

// List notifications
notificationsRouter.get(
  '/',
  requireWorkspace,
  zValidator('query', notificationFilterSchema),
  async (c) => {
    const user = getAuthUser(c.var)
    const db = c.var.db
    const { page, limit } = c.req.valid('query')
    const result = await notificationService.getUserNotifications(
      db,
      user.id,
      page,
      limit,
    )
    return paginated(c, result.data, {
      page: result.meta.page,
      limit: result.meta.limit,
      total: result.meta.total,
    })
  },
)

// Get unread count
notificationsRouter.get('/unread-count', requireWorkspace, async (c) => {
  const user = getAuthUser(c.var)
  const db = c.var.db
  const unread = await notificationService.getUnreadNotificationCount(db, user.id)
  return success(c, { unread })
})

// Mark single notification as read
notificationsRouter.patch('/:id/read', requireWorkspace, async (c) => {
  const user = getAuthUser(c.var)
  const db = c.var.db
  const notificationId = c.req.param('id')
  const result = await notificationService.markNotificationRead(
    db,
    notificationId,
    user.id,
  )
  return success(c, result)
})

// Mark all notifications as read
notificationsRouter.post('/mark-all-read', requireWorkspace, async (c) => {
  const user = getAuthUser(c.var)
  const db = c.var.db
  await notificationService.markAllNotificationsRead(db, user.id)
  return noContent(c)
})

// Get notification preferences
notificationsRouter.get('/preferences', requireWorkspace, async (c) => {
  const user = getAuthUser(c.var)
  const db = c.var.db
  const result = await notificationService.getNotificationPreferences(db, user.id)
  return success(c, result)
})

// Update notification preferences
notificationsRouter.patch(
  '/preferences',
  requireWorkspace,
  zValidator('json', updateNotificationPreferencesSchema),
  async (c) => {
    const user = getAuthUser(c.var)
    const db = c.var.db
    const data = c.req.valid('json')
    const result = await notificationService.updateNotificationPreferences(
      db,
      user.id,
      data,
    )
    return success(c, result)
  },
)

export default notificationsRouter
