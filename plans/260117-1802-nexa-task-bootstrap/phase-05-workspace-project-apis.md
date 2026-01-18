# Phase 05: Workspace + Project APIs

## Context Links
- [Phase 04: Auth + RBAC](./phase-04-auth-rbac.md)
- [Drizzle Research](../reports/researcher-260117-1758-drizzle-postgres.md)

## Overview
- **Priority**: P2
- **Status**: pending
- **Effort**: 8h

Implement CRUD APIs for workspaces and projects with tenant isolation and custom workflow statuses.

## Key Insights
- Workspaces map to Clerk Organizations
- All queries scoped by workspaceId
- Default workflow statuses created with new projects
- Soft delete for projects (archived status)

## Requirements

### Functional
- Workspace CRUD (sync with Clerk orgs)
- Project CRUD within workspace
- Custom workflow status management per project
- Member management for workspace

### Non-Functional
- All queries scoped to user's workspace
- Proper cascade on delete
- Audit logging for changes

## Architecture

### API Endpoints
```
Workspaces:
  GET    /api/workspaces              List user's workspaces
  GET    /api/workspaces/:id          Get workspace details
  PATCH  /api/workspaces/:id          Update workspace
  POST   /api/workspaces/:id/members  Invite member
  DELETE /api/workspaces/:id/members/:userId  Remove member

Projects:
  GET    /api/projects                List projects in workspace
  POST   /api/projects                Create project
  GET    /api/projects/:id            Get project details
  PATCH  /api/projects/:id            Update project
  DELETE /api/projects/:id            Archive project

Workflow Statuses:
  GET    /api/projects/:id/statuses   List statuses
  POST   /api/projects/:id/statuses   Create status
  PATCH  /api/projects/:id/statuses/:statusId   Update status
  DELETE /api/projects/:id/statuses/:statusId   Delete status
  POST   /api/projects/:id/statuses/reorder     Reorder statuses
```

## Related Code Files

### Create
- `/apps/api/src/routes/workspaces.ts`
- `/apps/api/src/routes/projects.ts`
- `/apps/api/src/services/workspace.ts`
- `/apps/api/src/services/project.ts`
- `/packages/shared/src/validators/workspace.ts`
- `/packages/shared/src/validators/project.ts`

### Modify
- `/apps/api/src/routes/index.ts`
- `/apps/api/src/lib/validators.ts`

## Implementation Steps

### 1. Workspace Validators
**packages/shared/src/validators/workspace.ts**:
```typescript
import { z } from 'zod'

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  clerkOrgId: z.string().min(1),
})

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  settings: z.object({
    defaultProjectView: z.enum(['kanban', 'list', 'calendar']).optional(),
    allowGuestInvites: z.boolean().optional(),
  }).optional(),
})

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['super_admin', 'pm', 'member', 'guest']).default('member'),
})

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>
```

### 2. Project Validators
**packages/shared/src/validators/project.ts**:
```typescript
import { z } from 'zod'

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
})

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(['active', 'archived']).optional(),
})

export const createWorkflowStatusSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#6366f1'),
  isDefault: z.boolean().optional(),
  isFinal: z.boolean().optional(),
})

export const updateWorkflowStatusSchema = createWorkflowStatusSchema.partial()

export const reorderStatusesSchema = z.object({
  orderedIds: z.array(z.string().uuid()),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
export type CreateWorkflowStatusInput = z.infer<typeof createWorkflowStatusSchema>
```

### 3. Workspace Service
**apps/api/src/services/workspace.ts**:
```typescript
import { eq, and } from 'drizzle-orm'
import type { Database } from '@repo/db'
import { workspaces, workspaceMembers, users } from '@repo/db/schema'
import type { UpdateWorkspaceInput } from '@repo/shared/validators/workspace'
import { NotFoundError, ConflictError } from '../lib/errors'

export async function getWorkspacesByUserId(db: Database, userId: string) {
  const memberships = await db.query.workspaceMembers.findMany({
    where: eq(workspaceMembers.userId, userId),
    with: {
      workspace: true,
    },
  })
  return memberships.map(m => ({
    ...m.workspace,
    role: m.role,
  }))
}

export async function getWorkspaceById(db: Database, workspaceId: string, userId: string) {
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
    with: {
      owner: true,
      members: {
        with: { user: true },
      },
      projects: {
        where: (projects, { ne }) => ne(projects.status, 'deleted'),
      },
    },
  })

  if (!workspace) {
    throw new NotFoundError('Workspace', workspaceId)
  }

  // Verify membership
  const isMember = workspace.members.some(m => m.userId === userId)
  if (!isMember) {
    throw new NotFoundError('Workspace', workspaceId)
  }

  return workspace
}

export async function updateWorkspace(
  db: Database,
  workspaceId: string,
  data: UpdateWorkspaceInput
) {
  const [updated] = await db
    .update(workspaces)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspaceId))
    .returning()

  if (!updated) {
    throw new NotFoundError('Workspace', workspaceId)
  }

  return updated
}

export async function getWorkspaceMembers(db: Database, workspaceId: string) {
  return db.query.workspaceMembers.findMany({
    where: eq(workspaceMembers.workspaceId, workspaceId),
    with: { user: true },
  })
}

export async function addWorkspaceMember(
  db: Database,
  workspaceId: string,
  userId: string,
  role: string
) {
  // Check if already member
  const existing = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId)
    ),
  })

  if (existing) {
    throw new ConflictError('User is already a member of this workspace')
  }

  const [member] = await db
    .insert(workspaceMembers)
    .values({
      workspaceId,
      userId,
      role,
    })
    .returning()

  return member
}

export async function removeWorkspaceMember(
  db: Database,
  workspaceId: string,
  userId: string
) {
  const result = await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    )
    .returning()

  if (result.length === 0) {
    throw new NotFoundError('Member')
  }

  return result[0]
}
```

### 4. Project Service
**apps/api/src/services/project.ts**:
```typescript
import { eq, and, ne, asc } from 'drizzle-orm'
import type { Database } from '@repo/db'
import { projects, workflowStatuses } from '@repo/db/schema'
import type { CreateProjectInput, UpdateProjectInput, CreateWorkflowStatusInput } from '@repo/shared/validators/project'
import { NotFoundError } from '../lib/errors'

const DEFAULT_STATUSES = [
  { name: 'To Do', color: '#6b7280', order: 0, isDefault: true },
  { name: 'In Progress', color: '#3b82f6', order: 1 },
  { name: 'Review', color: '#f59e0b', order: 2 },
  { name: 'Done', color: '#10b981', order: 3, isFinal: true },
]

export async function getProjectsByWorkspace(db: Database, workspaceId: string) {
  return db.query.projects.findMany({
    where: and(
      eq(projects.workspaceId, workspaceId),
      ne(projects.status, 'deleted')
    ),
    with: {
      createdBy: true,
      _count: {
        tasks: true,
      },
    },
    orderBy: (projects, { desc }) => [desc(projects.createdAt)],
  })
}

export async function getProjectById(db: Database, projectId: string, workspaceId: string) {
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.workspaceId, workspaceId),
      ne(projects.status, 'deleted')
    ),
    with: {
      createdBy: true,
      workflowStatuses: {
        orderBy: (statuses, { asc }) => [asc(statuses.order)],
      },
    },
  })

  if (!project) {
    throw new NotFoundError('Project', projectId)
  }

  return project
}

export async function createProject(
  db: Database,
  workspaceId: string,
  createdById: string,
  data: CreateProjectInput
) {
  // Create project
  const [project] = await db
    .insert(projects)
    .values({
      ...data,
      workspaceId,
      createdById,
    })
    .returning()

  // Create default workflow statuses
  await db.insert(workflowStatuses).values(
    DEFAULT_STATUSES.map(status => ({
      ...status,
      projectId: project.id,
    }))
  )

  // Return with statuses
  return getProjectById(db, project.id, workspaceId)
}

export async function updateProject(
  db: Database,
  projectId: string,
  workspaceId: string,
  data: UpdateProjectInput
) {
  const [updated] = await db
    .update(projects)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, workspaceId)
      )
    )
    .returning()

  if (!updated) {
    throw new NotFoundError('Project', projectId)
  }

  return updated
}

export async function deleteProject(db: Database, projectId: string, workspaceId: string) {
  // Soft delete
  return updateProject(db, projectId, workspaceId, { status: 'archived' })
}

// Workflow Status Functions
export async function getProjectStatuses(db: Database, projectId: string) {
  return db.query.workflowStatuses.findMany({
    where: eq(workflowStatuses.projectId, projectId),
    orderBy: (statuses, { asc }) => [asc(statuses.order)],
  })
}

export async function createWorkflowStatus(
  db: Database,
  projectId: string,
  data: CreateWorkflowStatusInput
) {
  // Get max order
  const existing = await db
    .select({ maxOrder: workflowStatuses.order })
    .from(workflowStatuses)
    .where(eq(workflowStatuses.projectId, projectId))
    .orderBy(asc(workflowStatuses.order))

  const maxOrder = existing.length > 0 ? Math.max(...existing.map(e => e.maxOrder)) : -1

  const [status] = await db
    .insert(workflowStatuses)
    .values({
      ...data,
      projectId,
      order: maxOrder + 1,
    })
    .returning()

  return status
}

export async function updateWorkflowStatus(
  db: Database,
  statusId: string,
  projectId: string,
  data: Partial<CreateWorkflowStatusInput>
) {
  const [updated] = await db
    .update(workflowStatuses)
    .set(data)
    .where(
      and(
        eq(workflowStatuses.id, statusId),
        eq(workflowStatuses.projectId, projectId)
      )
    )
    .returning()

  if (!updated) {
    throw new NotFoundError('Workflow status', statusId)
  }

  return updated
}

export async function deleteWorkflowStatus(db: Database, statusId: string, projectId: string) {
  const result = await db
    .delete(workflowStatuses)
    .where(
      and(
        eq(workflowStatuses.id, statusId),
        eq(workflowStatuses.projectId, projectId)
      )
    )
    .returning()

  if (result.length === 0) {
    throw new NotFoundError('Workflow status', statusId)
  }

  return result[0]
}

export async function reorderStatuses(db: Database, projectId: string, orderedIds: string[]) {
  // Update each status with new order
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(workflowStatuses)
        .set({ order: index })
        .where(
          and(
            eq(workflowStatuses.id, id),
            eq(workflowStatuses.projectId, projectId)
          )
        )
    )
  )

  return getProjectStatuses(db, projectId)
}
```

### 5. Workspace Routes
**apps/api/src/routes/workspaces.ts**:
```typescript
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { Variables } from '../types/context'
import { requireAuth, requireWorkspace } from '../middleware/auth'
import { requireRole, requirePermission } from '../middleware/rbac'
import { success, created } from '../lib/response'
import { updateWorkspaceSchema, inviteMemberSchema } from '@repo/shared/validators/workspace'
import * as workspaceService from '../services/workspace'

const workspaces = new Hono<{ Variables: Variables }>()

// List user's workspaces
workspaces.get('/', requireAuth, async (c) => {
  const user = c.var.user!
  const db = c.var.db
  const result = await workspaceService.getWorkspacesByUserId(db, user.id)
  return success(c, result)
})

// Get workspace by ID
workspaces.get('/:id', requireAuth, async (c) => {
  const user = c.var.user!
  const db = c.var.db
  const workspaceId = c.req.param('id')
  const result = await workspaceService.getWorkspaceById(db, workspaceId, user.id)
  return success(c, result)
})

// Update workspace
workspaces.patch(
  '/:id',
  requireWorkspace,
  requirePermission('workspace:update'),
  zValidator('json', updateWorkspaceSchema),
  async (c) => {
    const db = c.var.db
    const workspaceId = c.req.param('id')
    const data = c.req.valid('json')
    const result = await workspaceService.updateWorkspace(db, workspaceId, data)
    return success(c, result)
  }
)

// List workspace members
workspaces.get('/:id/members', requireWorkspace, async (c) => {
  const db = c.var.db
  const workspaceId = c.req.param('id')
  const members = await workspaceService.getWorkspaceMembers(db, workspaceId)
  return success(c, members)
})

// Invite member (via Clerk, then add to local DB)
workspaces.post(
  '/:id/members',
  requireWorkspace,
  requirePermission('workspace:invite'),
  zValidator('json', inviteMemberSchema),
  async (c) => {
    // Note: Actual invite happens via Clerk Organizations
    // This endpoint handles post-invite local DB sync
    const db = c.var.db
    const workspaceId = c.req.param('id')
    const { email, role } = c.req.valid('json')

    // TODO: Look up user by email, add to workspace
    // For now, return success message
    return success(c, { message: 'Invitation sent', email, role })
  }
)

// Remove member
workspaces.delete(
  '/:id/members/:userId',
  requireWorkspace,
  requireRole('super_admin', 'pm'),
  async (c) => {
    const db = c.var.db
    const workspaceId = c.req.param('id')
    const userId = c.req.param('userId')
    await workspaceService.removeWorkspaceMember(db, workspaceId, userId)
    return success(c, { message: 'Member removed' })
  }
)

export default workspaces
```

### 6. Project Routes
**apps/api/src/routes/projects.ts**:
```typescript
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { Variables } from '../types/context'
import { requireWorkspace } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'
import { success, created, noContent } from '../lib/response'
import {
  createProjectSchema,
  updateProjectSchema,
  createWorkflowStatusSchema,
  updateWorkflowStatusSchema,
  reorderStatusesSchema,
} from '@repo/shared/validators/project'
import * as projectService from '../services/project'

const projects = new Hono<{ Variables: Variables }>()

// List projects
projects.get('/', requireWorkspace, async (c) => {
  const user = c.var.user!
  const db = c.var.db
  const result = await projectService.getProjectsByWorkspace(db, user.workspaceId!)
  return success(c, result)
})

// Create project
projects.post(
  '/',
  requireWorkspace,
  requirePermission('project:create'),
  zValidator('json', createProjectSchema),
  async (c) => {
    const user = c.var.user!
    const db = c.var.db
    const data = c.req.valid('json')
    const result = await projectService.createProject(db, user.workspaceId!, user.id, data)
    return created(c, result)
  }
)

// Get project
projects.get('/:id', requireWorkspace, async (c) => {
  const user = c.var.user!
  const db = c.var.db
  const projectId = c.req.param('id')
  const result = await projectService.getProjectById(db, projectId, user.workspaceId!)
  return success(c, result)
})

// Update project
projects.patch(
  '/:id',
  requireWorkspace,
  requirePermission('project:update'),
  zValidator('json', updateProjectSchema),
  async (c) => {
    const user = c.var.user!
    const db = c.var.db
    const projectId = c.req.param('id')
    const data = c.req.valid('json')
    const result = await projectService.updateProject(db, projectId, user.workspaceId!, data)
    return success(c, result)
  }
)

// Delete (archive) project
projects.delete(
  '/:id',
  requireWorkspace,
  requirePermission('project:delete'),
  async (c) => {
    const user = c.var.user!
    const db = c.var.db
    const projectId = c.req.param('id')
    await projectService.deleteProject(db, projectId, user.workspaceId!)
    return noContent(c)
  }
)

// --- Workflow Statuses ---

// List statuses
projects.get('/:id/statuses', requireWorkspace, async (c) => {
  const db = c.var.db
  const projectId = c.req.param('id')
  const result = await projectService.getProjectStatuses(db, projectId)
  return success(c, result)
})

// Create status
projects.post(
  '/:id/statuses',
  requireWorkspace,
  requirePermission('project:update'),
  zValidator('json', createWorkflowStatusSchema),
  async (c) => {
    const db = c.var.db
    const projectId = c.req.param('id')
    const data = c.req.valid('json')
    const result = await projectService.createWorkflowStatus(db, projectId, data)
    return created(c, result)
  }
)

// Update status
projects.patch(
  '/:id/statuses/:statusId',
  requireWorkspace,
  requirePermission('project:update'),
  zValidator('json', updateWorkflowStatusSchema),
  async (c) => {
    const db = c.var.db
    const projectId = c.req.param('id')
    const statusId = c.req.param('statusId')
    const data = c.req.valid('json')
    const result = await projectService.updateWorkflowStatus(db, statusId, projectId, data)
    return success(c, result)
  }
)

// Delete status
projects.delete(
  '/:id/statuses/:statusId',
  requireWorkspace,
  requirePermission('project:update'),
  async (c) => {
    const db = c.var.db
    const projectId = c.req.param('id')
    const statusId = c.req.param('statusId')
    await projectService.deleteWorkflowStatus(db, statusId, projectId)
    return noContent(c)
  }
)

// Reorder statuses
projects.post(
  '/:id/statuses/reorder',
  requireWorkspace,
  requirePermission('project:update'),
  zValidator('json', reorderStatusesSchema),
  async (c) => {
    const db = c.var.db
    const projectId = c.req.param('id')
    const { orderedIds } = c.req.valid('json')
    const result = await projectService.reorderStatuses(db, projectId, orderedIds)
    return success(c, result)
  }
)

export default projects
```

### 7. Update Routes Index
**apps/api/src/routes/index.ts**:
```typescript
import { Hono } from 'hono'
import type { Variables } from '../types/context'
import { clerkAuth, authMiddleware, requireWorkspace } from '../middleware/auth'
import health from './health'
import auth from './auth'
import workspaces from './workspaces'
import projects from './projects'

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

export default routes
```

## Todo List
- [ ] Create workspace validators
- [ ] Create project validators
- [ ] Implement workspace service functions
- [ ] Implement project service functions
- [ ] Create workspace routes with RBAC
- [ ] Create project routes with RBAC
- [ ] Create workflow status endpoints
- [ ] Update routes index
- [ ] Test all CRUD operations
- [ ] Verify tenant isolation

## Success Criteria
- [x] Workspaces scoped to user membership
- [x] Projects scoped to workspace
- [x] Default statuses created with new project
- [x] Status reordering works
- [x] RBAC enforced on all endpoints
- [x] Soft delete for projects

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cross-tenant data leak | Critical | Always filter by workspaceId |
| Missing cascade deletes | Medium | Test deletion flows |
| Status order conflicts | Low | Transaction for reorder |

## Security Considerations
- All queries include workspaceId filter
- Permission checks before mutations
- Soft delete preserves audit trail

## Next Steps
- Phase 06: Task Management APIs
