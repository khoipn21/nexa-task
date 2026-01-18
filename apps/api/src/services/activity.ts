import type { Database } from '@repo/db'
import { activityLogs } from '@repo/db/schema'

type EntityType = 'workspace' | 'project' | 'task' | 'comment'
type ActionType =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'assigned'
  | 'commented'
  | 'status_changed'
  | 'moved'

type ActivityChanges = Record<string, { old: unknown; new: unknown }>

export async function logActivity(
  db: Database,
  params: {
    workspaceId: string
    entityType: EntityType
    entityId: string
    userId: string
    action: ActionType
    changes?: ActivityChanges
    metadata?: Record<string, unknown>
  },
) {
  const [log] = await db
    .insert(activityLogs)
    .values({
      workspaceId: params.workspaceId,
      entityType: params.entityType,
      entityId: params.entityId,
      userId: params.userId,
      action: params.action,
      changes: params.changes,
      metadata: params.metadata,
    })
    .returning()

  return log
}

export function computeChanges<T extends Record<string, unknown>>(
  original: T,
  updated: Partial<T>,
  fields: (keyof T)[],
): ActivityChanges | undefined {
  const changes: ActivityChanges = {}
  let hasChanges = false

  for (const field of fields) {
    if (field in updated && updated[field] !== original[field]) {
      changes[field as string] = {
        old: original[field],
        new: updated[field],
      }
      hasChanges = true
    }
  }

  return hasChanges ? changes : undefined
}
