export * from './auth'

// User roles for RBAC
export type UserRole = 'super_admin' | 'project_manager' | 'member' | 'guest'

// Task priority levels
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low'

// Task status (customizable per project)
export type TaskStatus =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'in_review'
  | 'done'

// API response wrapper
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

// Pagination
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// User
export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  role: UserRole
  createdAt: Date
}

// Workspace
export interface Workspace {
  id: string
  name: string
  slug: string
  ownerId: string
  createdAt: Date
}

// Project
export interface Project {
  id: string
  workspaceId: string
  name: string
  description?: string
  status: 'active' | 'archived'
  createdAt: Date
}

// Task
export interface Task {
  id: string
  projectId: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  assigneeId?: string
  creatorId: string
  dueDate?: Date
  createdAt: Date
  updatedAt: Date
}

// Comment
export interface Comment {
  id: string
  taskId: string
  authorId: string
  content: string
  createdAt: Date
}
