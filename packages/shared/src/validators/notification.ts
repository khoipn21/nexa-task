import { z } from 'zod'

export const notificationFilterSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export const updateNotificationPreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  inappEnabled: z.boolean().optional(),
  enabledTypes: z
    .array(
      z.enum([
        'task_assigned',
        'task_status_changed',
        'task_comment_added',
        'task_mentioned',
        'task_due_soon',
        'task_dependency_completed',
        'watcher_added',
      ]),
    )
    .optional(),
})

export const viewModeSchema = z.object({
  viewMode: z.enum(['kanban', 'list', 'calendar']),
})

export type NotificationFilterInput = z.infer<typeof notificationFilterSchema>
export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>
export type ViewModeInput = z.infer<typeof viewModeSchema>
