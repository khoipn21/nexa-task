import { Hono } from 'hono'
import { authMiddleware, clerkAuth } from '../middleware/auth'
import type { Variables } from '../types/context'
import auth from './auth'
import comments from './comments'
import dashboard from './dashboard'
import health from './health'
import invitations from './invitations'
import notifications from './notifications'
import projects from './projects'
import tasks, { attachmentsRouter, projectTasks } from './tasks'
import userSettings from './user-settings'
import workspaces from './workspaces'

const routes = new Hono<{ Variables: Variables }>()

// Public routes
routes.route('/health', health)

// Auth middleware for all /api routes
routes.use('/api/*', clerkAuth)
routes.use('/api/*', authMiddleware)

// API routes
routes.route('/api/auth', auth)
routes.route('/api/workspaces', workspaces)
routes.route('/api/projects', projects)
routes.route('/api/projects', projectTasks) // For /projects/:id/tasks
routes.route('/api', dashboard) // For /dashboard/stats, /activity, /tasks/recent (before tasks router)
routes.route('/api/tasks', tasks) // For /tasks/:id
routes.route('/api/attachments', attachmentsRouter) // For /attachments/:id
routes.route('/api', comments) // For /tasks/:id/comments and /comments/:id
routes.route('/api/notifications', notifications) // For /notifications/*
routes.route('/api/invitations', invitations) // For /invitations/*
routes.route('/api/user-settings', userSettings) // For /user-settings/*

export default routes
