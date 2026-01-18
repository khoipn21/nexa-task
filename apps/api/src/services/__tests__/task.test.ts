import { beforeEach, describe, expect, it } from 'bun:test'
import '../../../tests/setup'
import {
  createTestProject,
  createTestUser,
  createTestWorkspace,
} from '../../../tests/helpers'
import { testDb } from '../../../tests/setup'
import * as taskService from '../task'

describe('Task Service', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>
  let workspace: Awaited<ReturnType<typeof createTestWorkspace>>
  let project: Awaited<ReturnType<typeof createTestProject>>['project']
  let statuses: Awaited<ReturnType<typeof createTestProject>>['statuses']

  beforeEach(async () => {
    user = await createTestUser()
    workspace = await createTestWorkspace(user.id)
    const result = await createTestProject(workspace.id, user.id)
    project = result.project
    statuses = result.statuses
  })

  describe('createTask', () => {
    it('creates a task with default status', async () => {
      const task = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        { title: 'Test Task' },
      )

      expect(task).toBeDefined()
      expect(task.title).toBe('Test Task')
      expect(task.statusId).toBe(statuses[0].id) // Default status (isDefault: true)
      expect(task.order).toBe(0)
    })

    it('creates a task with specified status', async () => {
      const task = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        { title: 'Test Task', statusId: statuses[1].id },
      )

      expect(task.statusId).toBe(statuses[1].id)
    })

    it('creates multiple tasks with incremented order', async () => {
      const task1 = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        { title: 'Task 1' },
      )
      const task2 = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        { title: 'Task 2' },
      )

      expect(task1.order).toBe(0)
      expect(task2.order).toBe(1)
    })

    it('creates a task with priority and description', async () => {
      const task = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        {
          title: 'High Priority Task',
          description: 'This is important',
          priority: 'high',
        },
      )

      expect(task.title).toBe('High Priority Task')
      expect(task.description).toBe('This is important')
      expect(task.priority).toBe('high')
    })
  })

  describe('getTaskById', () => {
    it('returns task with relations', async () => {
      const created = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        { title: 'Test Task' },
      )

      const task = await taskService.getTaskById(testDb, created.id)

      expect(task.id).toBe(created.id)
      expect(task.project).toBeDefined()
      expect(task.status).toBeDefined()
      expect(task.createdBy).toBeDefined()
    })

    it('throws NotFoundError for non-existent task', async () => {
      await expect(
        taskService.getTaskById(testDb, '00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow()
    })
  })

  describe('updateTask', () => {
    it('updates task title', async () => {
      const task = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        { title: 'Original Title' },
      )

      const updated = await taskService.updateTask(
        testDb,
        task.id,
        user.id,
        workspace.id,
        { title: 'Updated Title' },
      )

      expect(updated.title).toBe('Updated Title')
    })

    it('updates task priority', async () => {
      const task = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        { title: 'Test Task', priority: 'low' },
      )

      const updated = await taskService.updateTask(
        testDb,
        task.id,
        user.id,
        workspace.id,
        { priority: 'urgent' },
      )

      expect(updated.priority).toBe('urgent')
    })
  })

  describe('moveTask', () => {
    it('moves task to different status', async () => {
      const task = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        { title: 'Test Task' },
      )

      const moved = await taskService.moveTask(
        testDb,
        task.id,
        user.id,
        workspace.id,
        { statusId: statuses[2].id, order: 0 },
      )

      expect(moved.statusId).toBe(statuses[2].id)
      expect(moved.order).toBe(0)
    })

    it('updates task order within same status', async () => {
      const task = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        { title: 'Test Task' },
      )

      const moved = await taskService.moveTask(
        testDb,
        task.id,
        user.id,
        workspace.id,
        { statusId: statuses[0].id, order: 5 },
      )

      expect(moved.order).toBe(5)
    })
  })

  describe('deleteTask', () => {
    it('deletes a task', async () => {
      const task = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        { title: 'Test Task' },
      )

      await taskService.deleteTask(testDb, task.id, user.id, workspace.id)

      await expect(taskService.getTaskById(testDb, task.id)).rejects.toThrow(
        'Task',
      )
    })
  })

  describe('addTaskDependency', () => {
    it('adds a dependency between tasks', async () => {
      const task1 = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        { title: 'Task 1' },
      )
      const task2 = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        { title: 'Task 2' },
      )

      const dep = await taskService.addTaskDependency(
        testDb,
        task1.id,
        task2.id,
      )

      expect(dep).toBeDefined()
      expect(dep?.taskId).toBe(task1.id)
      expect(dep?.dependsOnId).toBe(task2.id)
    })

    it('prevents self-dependency', async () => {
      const task = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        { title: 'Test Task' },
      )

      await expect(
        taskService.addTaskDependency(testDb, task.id, task.id),
      ).rejects.toThrow()
    })

    it('prevents circular dependency', async () => {
      const task1 = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        { title: 'Task 1' },
      )
      const task2 = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        { title: 'Task 2' },
      )

      // Task 1 depends on Task 2
      await taskService.addTaskDependency(testDb, task1.id, task2.id)

      // Task 2 cannot depend on Task 1 (circular)
      await expect(
        taskService.addTaskDependency(testDb, task2.id, task1.id),
      ).rejects.toThrow()
    })
  })

  describe('removeTaskDependency', () => {
    it('removes a dependency', async () => {
      const task1 = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        { title: 'Task 1' },
      )
      const task2 = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        { title: 'Task 2' },
      )

      await taskService.addTaskDependency(testDb, task1.id, task2.id)
      await taskService.removeTaskDependency(testDb, task1.id, task2.id)

      const deps = await taskService.getTaskDependencies(testDb, task1.id)
      expect(deps.length).toBe(0)
    })
  })

  describe('addTaskWatcher', () => {
    it('adds a watcher to task', async () => {
      const task = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        { title: 'Test Task' },
      )

      const watcher = await taskService.addTaskWatcher(testDb, task.id, user.id)

      expect(watcher?.userId).toBe(user.id)
      expect(watcher?.taskId).toBe(task.id)
    })
  })

  describe('removeTaskWatcher', () => {
    it('removes a watcher from task', async () => {
      const task = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        { title: 'Test Task' },
      )

      await taskService.addTaskWatcher(testDb, task.id, user.id)
      await taskService.removeTaskWatcher(testDb, task.id, user.id)

      const watchers = await taskService.getTaskWatchers(testDb, task.id)
      expect(watchers.length).toBe(0)
    })
  })
})
