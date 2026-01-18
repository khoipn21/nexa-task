import { describe, expect, it, mock } from 'bun:test'
import type { Database } from '@repo/db'
import { ForbiddenError, NotFoundError } from '../../src/lib/errors'
import {
  createNotification,
  getNotificationPreferences,
  getProjectViewPreference,
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  setProjectViewPreference,
  updateNotificationPreferences,
} from '../../src/services/notification'

// Mock database responses
const mockNotification = {
  id: 'notif-1',
  userId: 'user-1',
  type: 'task_assigned' as const,
  title: 'Task Assigned',
  message: 'You have been assigned to a task',
  data: { taskId: 'task-1' },
  entityType: 'task' as const,
  entityId: 'task-1',
  read: false,
  readAt: null,
  createdAt: new Date('2026-01-17T10:00:00Z'),
}

const mockPreferences = {
  id: 'pref-1',
  userId: 'user-1',
  emailEnabled: true,
  inappEnabled: true,
  enabledTypes: ['task_assigned', 'task_comment_added'],
  createdAt: new Date('2026-01-17T10:00:00Z'),
  updatedAt: new Date('2026-01-17T10:00:00Z'),
}

const mockProjectPreference = {
  id: 'proj-pref-1',
  userId: 'user-1',
  projectId: 'project-1',
  viewMode: 'kanban' as const,
  createdAt: new Date('2026-01-17T10:00:00Z'),
  updatedAt: new Date('2026-01-17T10:00:00Z'),
}

describe('Notification Service', () => {
  describe('createNotification', () => {
    it('creates notification with all fields', async () => {
      const mockDb = {
        insert: mock(() => ({
          values: mock(() => ({
            returning: mock(() => Promise.resolve([mockNotification])),
          })),
        })),
      } as unknown as Database

      const result = await createNotification(mockDb, {
        userId: 'user-1',
        type: 'task_assigned',
        title: 'Task Assigned',
        message: 'You have been assigned to a task',
        data: { taskId: 'task-1' },
        entityType: 'task',
        entityId: 'task-1',
      })

      expect(result).toEqual(mockNotification)
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('creates notification with minimal fields', async () => {
      const minimalNotif = {
        ...mockNotification,
        data: {},
        entityType: null,
        entityId: null,
      }

      const mockDb = {
        insert: mock(() => ({
          values: mock(() => ({
            returning: mock(() => Promise.resolve([minimalNotif])),
          })),
        })),
      } as unknown as Database

      const result = await createNotification(mockDb, {
        userId: 'user-1',
        type: 'task_assigned',
        title: 'Task Assigned',
        message: 'You have been assigned to a task',
      })

      expect(result.data).toEqual({})
      expect(result.entityType).toBeNull()
      expect(result.entityId).toBeNull()
    })
  })

  describe('getUserNotifications', () => {
    it('returns paginated notifications with metadata', async () => {
      // Create mock that handles Promise.all pattern
      // First select: notification list query
      // Second select: counts query (total + unread in one)
      const mockSelectChain = {
        from: mock(() => ({
          where: mock(() => ({
            orderBy: mock(() => ({
              limit: mock(() => ({
                offset: mock(() => Promise.resolve([mockNotification])),
              })),
            })),
          })),
        })),
      }

      const mockCountChain = {
        from: mock(() => ({
          where: mock(() => Promise.resolve([{ total: 10, unread: 3 }])),
        })),
      }

      let selectCallCount = 0
      const mockDb = {
        select: mock(() => {
          selectCallCount++
          // First call is notification list, second is counts
          if (selectCallCount === 1) {
            return mockSelectChain
          }
          return mockCountChain
        }),
      } as unknown as Database

      const result = await getUserNotifications(mockDb, 'user-1', 1, 20)

      expect(result.data).toEqual([mockNotification])
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 10,
        unread: 3,
      })
    })

    it('handles pagination correctly', async () => {
      let capturedOffset = 0

      const mockSelectChain = {
        from: mock(() => ({
          where: mock(() => ({
            orderBy: mock(() => ({
              limit: mock(() => ({
                offset: mock((offset: number) => {
                  capturedOffset = offset
                  return Promise.resolve([mockNotification])
                }),
              })),
            })),
          })),
        })),
      }

      const mockCountChain = {
        from: mock(() => ({
          where: mock(() => Promise.resolve([{ total: 50, unread: 10 }])),
        })),
      }

      let selectCallCount = 0
      const mockDb = {
        select: mock(() => {
          selectCallCount++
          if (selectCallCount === 1) {
            return mockSelectChain
          }
          return mockCountChain
        }),
      } as unknown as Database

      await getUserNotifications(mockDb, 'user-1', 3, 20)

      expect(capturedOffset).toBe(40) // (page 3 - 1) * 20
    })
  })

  describe('markNotificationRead', () => {
    it('marks notification as read', async () => {
      const readNotif = { ...mockNotification, read: true, readAt: new Date() }

      // Atomic update pattern: update first, check after
      const mockDb = {
        update: mock(() => ({
          set: mock(() => ({
            where: mock(() => ({
              returning: mock(() => Promise.resolve([readNotif])),
            })),
          })),
        })),
      } as unknown as Database

      const result = await markNotificationRead(mockDb, 'notif-1', 'user-1')

      expect(result.read).toBe(true)
      expect(result.readAt).toBeDefined()
    })

    it('throws NotFoundError if notification does not exist', async () => {
      // Atomic pattern: update returns empty, then query to check existence
      const mockDb = {
        update: mock(() => ({
          set: mock(() => ({
            where: mock(() => ({
              returning: mock(() => Promise.resolve([])),
            })),
          })),
        })),
        query: {
          notifications: {
            findFirst: mock(() => Promise.resolve(undefined)),
          },
        },
      } as unknown as Database

      await expect(
        markNotificationRead(mockDb, 'nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundError)
    })

    it('throws ForbiddenError if user does not own notification', async () => {
      // Atomic pattern: update returns empty (wrong user), query finds it exists
      const mockDb = {
        update: mock(() => ({
          set: mock(() => ({
            where: mock(() => ({
              returning: mock(() => Promise.resolve([])),
            })),
          })),
        })),
        query: {
          notifications: {
            findFirst: mock(() =>
              Promise.resolve({ ...mockNotification, userId: 'other-user' }),
            ),
          },
        },
      } as unknown as Database

      await expect(
        markNotificationRead(mockDb, 'notif-1', 'user-1'),
      ).rejects.toThrow(ForbiddenError)
    })
  })

  describe('markAllNotificationsRead', () => {
    it('marks all unread notifications as read', async () => {
      const mockDb = {
        update: mock(() => ({
          set: mock(() => ({
            where: mock(() => Promise.resolve()),
          })),
        })),
      } as unknown as Database

      const result = await markAllNotificationsRead(mockDb, 'user-1')

      expect(result.success).toBe(true)
      expect(mockDb.update).toHaveBeenCalled()
    })
  })

  describe('getNotificationPreferences', () => {
    it('returns existing preferences', async () => {
      const mockDb = {
        query: {
          notificationPreferences: {
            findFirst: mock(() => Promise.resolve(mockPreferences)),
          },
        },
      } as unknown as Database

      const result = await getNotificationPreferences(mockDb, 'user-1')

      expect(result).toEqual(mockPreferences)
    })

    it('creates default preferences if none exist', async () => {
      const defaultPrefs = { ...mockPreferences, enabledTypes: [] }

      const mockDb = {
        query: {
          notificationPreferences: {
            findFirst: mock(() => Promise.resolve(undefined)),
          },
        },
        insert: mock(() => ({
          values: mock(() => ({
            returning: mock(() => Promise.resolve([defaultPrefs])),
          })),
        })),
      } as unknown as Database

      const result = await getNotificationPreferences(mockDb, 'user-1')

      expect(result).toEqual(defaultPrefs)
      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  describe('updateNotificationPreferences', () => {
    it('updates preferences', async () => {
      const updatedPrefs = {
        ...mockPreferences,
        emailEnabled: false,
      }

      const mockDb = {
        query: {
          notificationPreferences: {
            findFirst: mock(() => Promise.resolve(mockPreferences)),
          },
        },
        update: mock(() => ({
          set: mock(() => ({
            where: mock(() => ({
              returning: mock(() => Promise.resolve([updatedPrefs])),
            })),
          })),
        })),
      } as unknown as Database

      const result = await updateNotificationPreferences(mockDb, 'user-1', {
        emailEnabled: false,
      })

      expect(result.emailEnabled).toBe(false)
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('creates preferences if they do not exist', async () => {
      // Upsert pattern: if no existing record, insert new one (not update)
      const mockDb = {
        query: {
          notificationPreferences: {
            findFirst: mock(() => Promise.resolve(undefined)),
          },
        },
        insert: mock(() => ({
          values: mock(() => ({
            returning: mock(() => Promise.resolve([mockPreferences])),
          })),
        })),
      } as unknown as Database

      const result = await updateNotificationPreferences(mockDb, 'user-1', {
        emailEnabled: true,
      })

      expect(result).toEqual(mockPreferences)
      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  describe('getProjectViewPreference', () => {
    it('returns existing preference', async () => {
      const mockDb = {
        query: {
          userProjectPreferences: {
            findFirst: mock(() => Promise.resolve(mockProjectPreference)),
          },
        },
      } as unknown as Database

      const result = await getProjectViewPreference(
        mockDb,
        'user-1',
        'project-1',
      )

      expect(result.viewMode).toBe(mockProjectPreference.viewMode)
    })

    it('returns default kanban view if no preference exists', async () => {
      const mockDb = {
        query: {
          userProjectPreferences: {
            findFirst: mock(() => Promise.resolve(undefined)),
          },
        },
      } as unknown as Database

      const result = await getProjectViewPreference(
        mockDb,
        'user-1',
        'project-1',
      )

      expect(result.viewMode).toBe('kanban')
    })
  })

  describe('setProjectViewPreference', () => {
    it('updates existing preference', async () => {
      const updatedPref = {
        ...mockProjectPreference,
        viewMode: 'list' as const,
      }

      const mockDb = {
        query: {
          userProjectPreferences: {
            findFirst: mock(() => Promise.resolve(mockProjectPreference)),
          },
        },
        update: mock(() => ({
          set: mock(() => ({
            where: mock(() => ({
              returning: mock(() => Promise.resolve([updatedPref])),
            })),
          })),
        })),
      } as unknown as Database

      const result = await setProjectViewPreference(
        mockDb,
        'user-1',
        'project-1',
        'list',
      )

      expect(result.viewMode).toBe('list')
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('creates new preference if none exists', async () => {
      const newPref = {
        ...mockProjectPreference,
        viewMode: 'calendar' as const,
      }

      const mockDb = {
        query: {
          userProjectPreferences: {
            findFirst: mock(() => Promise.resolve(undefined)),
          },
        },
        insert: mock(() => ({
          values: mock(() => ({
            returning: mock(() => Promise.resolve([newPref])),
          })),
        })),
      } as unknown as Database

      const result = await setProjectViewPreference(
        mockDb,
        'user-1',
        'project-1',
        'calendar',
      )

      expect(result.viewMode).toBe('calendar')
      expect(mockDb.insert).toHaveBeenCalled()
    })
  })
})
