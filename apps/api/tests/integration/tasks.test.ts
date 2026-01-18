import { beforeEach, describe, expect, it } from 'bun:test'
import '../setup'
import * as taskService from '../../src/services/task'
import {
  addWorkspaceMember,
  createTestProject,
  createTestUser,
  createTestWorkspace,
} from '../helpers'
import { testDb } from '../setup'

describe('Task Integration Tests', () => {
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

  describe('Full task lifecycle', () => {
    it('creates, updates, moves, and deletes a task', async () => {
      // Create
      const task = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        { title: 'Lifecycle Test Task', priority: 'medium' },
      )
      expect(task.title).toBe('Lifecycle Test Task')
      expect(task.statusId).toBe(statuses[0].id)

      // Update
      const updated = await taskService.updateTask(
        testDb,
        task.id,
        user.id,
        workspace.id,
        { title: 'Updated Lifecycle Task', priority: 'high' },
      )
      expect(updated.title).toBe('Updated Lifecycle Task')
      expect(updated.priority).toBe('high')

      // Move to In Progress
      const moved = await taskService.moveTask(
        testDb,
        task.id,
        user.id,
        workspace.id,
        { statusId: statuses[1].id, order: 0 },
      )
      expect(moved.statusId).toBe(statuses[1].id)

      // Move to Done
      const completed = await taskService.moveTask(
        testDb,
        task.id,
        user.id,
        workspace.id,
        { statusId: statuses[2].id, order: 0 },
      )
      expect(completed.statusId).toBe(statuses[2].id)

      // Delete
      await taskService.deleteTask(testDb, task.id, user.id, workspace.id)
      await expect(taskService.getTaskById(testDb, task.id)).rejects.toThrow()
    })
  })

  describe('Task dependencies workflow', () => {
    it('manages blocking and blocked tasks', async () => {
      // Create three tasks
      const task1 = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        { title: 'Foundation Work' },
      )
      const task2 = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        { title: 'Build on Foundation' },
      )
      const task3 = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        { title: 'Final Polish' },
      )

      // Task 2 depends on Task 1
      await taskService.addTaskDependency(testDb, task2.id, task1.id)

      // Task 3 depends on Task 2
      await taskService.addTaskDependency(testDb, task3.id, task2.id)

      // Verify dependencies
      const task2Deps = await taskService.getTaskDependencies(testDb, task2.id)
      expect(task2Deps.length).toBe(1)
      expect(task2Deps[0].dependsOnId).toBe(task1.id)

      const task3Deps = await taskService.getTaskDependencies(testDb, task3.id)
      expect(task3Deps.length).toBe(1)
      expect(task3Deps[0].dependsOnId).toBe(task2.id)
    })
  })

  describe('Task watchers workflow', () => {
    it('manages multiple watchers on a task', async () => {
      const user2 = await createTestUser()
      // Add user2 as a workspace member (required for watcher validation)
      await addWorkspaceMember(workspace.id, user2.id)

      const task = await taskService.createTask(
        testDb,
        project.id,
        user.id,
        workspace.id,
        { title: 'Watched Task' },
      )

      // Add watchers
      await taskService.addTaskWatcher(testDb, task.id, user.id)
      await taskService.addTaskWatcher(testDb, task.id, user2.id)

      // Verify watchers
      const watchers = await taskService.getTaskWatchers(testDb, task.id)
      expect(watchers.length).toBe(2)

      // Remove one watcher
      await taskService.removeTaskWatcher(testDb, task.id, user.id)
      const remainingWatchers = await taskService.getTaskWatchers(
        testDb,
        task.id,
      )
      expect(remainingWatchers.length).toBe(1)
      expect(remainingWatchers[0].userId).toBe(user2.id)
    })
  })

  describe('Task filtering', () => {
    it('filters tasks by status', async () => {
      // Create tasks in different statuses
      await taskService.createTask(testDb, project.id, user.id, workspace.id, {
        title: 'Todo Task',
      })
      await taskService.createTask(testDb, project.id, user.id, workspace.id, {
        title: 'In Progress Task',
        statusId: statuses[1].id,
      })

      // Filter by status
      const result = await taskService.getTasksByProject(testDb, project.id, {
        page: 1,
        limit: 10,
        statusId: statuses[0].id,
      })

      expect(result.data.length).toBe(1)
      expect(result.data[0].title).toBe('Todo Task')
    })

    it('filters tasks by priority', async () => {
      const uniqueTitle = `High Priority ${Date.now()}`
      await taskService.createTask(testDb, project.id, user.id, workspace.id, {
        title: 'Low Priority Task',
        priority: 'low',
      })
      await taskService.createTask(testDb, project.id, user.id, workspace.id, {
        title: uniqueTitle,
        priority: 'high',
      })

      const result = await taskService.getTasksByProject(testDb, project.id, {
        page: 1,
        limit: 10,
        priority: 'high',
      })

      expect(result.data.length).toBeGreaterThanOrEqual(1)
      expect(result.data.some((t) => t.title === uniqueTitle)).toBe(true)
    })

    it('searches tasks by title', async () => {
      const uniqueTitle = `Fix authentication bug ${Date.now()}`
      await taskService.createTask(testDb, project.id, user.id, workspace.id, {
        title: uniqueTitle,
      })
      await taskService.createTask(testDb, project.id, user.id, workspace.id, {
        title: 'Add new feature',
      })

      const result = await taskService.getTasksByProject(testDb, project.id, {
        page: 1,
        limit: 10,
        search: 'bug',
      })

      expect(result.data.length).toBeGreaterThanOrEqual(1)
      expect(result.data.some((t) => t.title === uniqueTitle)).toBe(true)
    })
  })

  describe('Pagination', () => {
    it('paginates task results', async () => {
      // Create 15 tasks
      for (let i = 1; i <= 15; i++) {
        await taskService.createTask(
          testDb,
          project.id,
          user.id,
          workspace.id,
          { title: `Task ${i}` },
        )
      }

      // First page
      const page1 = await taskService.getTasksByProject(testDb, project.id, {
        page: 1,
        limit: 10,
      })
      expect(page1.data.length).toBe(10)
      expect(page1.meta.total).toBe(15)
      expect(page1.meta.page).toBe(1)

      // Second page
      const page2 = await taskService.getTasksByProject(testDb, project.id, {
        page: 2,
        limit: 10,
      })
      expect(page2.data.length).toBe(5)
      expect(page2.meta.page).toBe(2)
    })
  })
})
