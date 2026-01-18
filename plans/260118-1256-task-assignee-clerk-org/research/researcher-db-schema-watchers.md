# Database Schema & Watchers UI Research Report

**Generated:** 2026-01-18 12:56
**Focus:** Task assignee schema + existing watchers UI pattern

---

## Database Schema Analysis

### Tasks Table (`packages/db/src/schema/tasks.ts`)

**Assignee Field:**
```typescript
assigneeId: uuid('assignee_id').references(() => users.id, {
  onDelete: 'set null',
})
```

- Field: `assigneeId` (UUID, nullable)
- FK → `users.id` with CASCADE on user deletion (sets NULL)
- Indexed via `tasks_assignee_idx`
- No restrictions on assignee source (workspace vs org)

**Other Task Fields:**
- `projectId` (required, FK to projects)
- `createdById` (required, FK to users)
- `statusId` (nullable, FK to workflow_statuses)
- `priority` (enum: low/medium/high/urgent)
- Standard timestamps

---

### Users Table (`packages/db/src/schema/users.ts`)

**Schema:**
```typescript
{
  id: uuid (PK)
  clerkId: text (unique, not null)
  email: text (unique, not null)
  name: text (not null)
  avatarUrl: text (nullable)
  createdAt, updatedAt: timestamp
}
```

**Indexes:**
- `users_clerk_id_idx` → fast Clerk user lookup
- `users_email_idx` → email search

**Key Points:**
- Single users table (no org/workspace separation at DB level)
- Clerk integration via `clerkId` field
- No workspace membership tracking in users table

---

## Existing Watchers UI Pattern

### Component: `TaskWatchers` (`apps/web/src/components/task-detail/task-watchers.tsx`)

**Props Interface:**
```typescript
{
  taskId: string
  currentUserId: string
  members: Member[]              // Passed from parent
  canManageWatchers?: boolean    // Permission flag
}

type Member = {
  id: string
  name: string
  email?: string
  avatarUrl?: string
}
```

**UI Structure:**
1. **Self-toggle button** (IconBell/IconBellOff) - user watches/unwatches
2. **Avatar stack** - shows current watchers (max 5 + overflow count)
3. **Popover dropdown:**
   - Lists all watchers with avatars
   - Remove button (X icon) for each watcher (if `canManageWatchers=true`)
   - "Add watcher" section showing available members (max 5 preview)

**Member Filtering Logic:**
```typescript
const watcherIds = new Set(watchers.map((w) => w.userId))
const availableMembers = members.filter((m) => !watcherIds.has(m.id))
```

**Permission Model:**
- Self-watch: always allowed
- Manage others: requires `canManageWatchers=true`

---

### Hook: `use-task-watchers.ts`

**API Endpoints:**
- GET `/tasks/:taskId/watchers` → fetch all watchers
- POST `/tasks/:taskId/watchers` + `{ userId }` → add watcher
- DELETE `/tasks/:taskId/watchers/:userId` → remove watcher

**Watcher Type:**
```typescript
type Watcher = {
  id: string
  userId: string
  taskId: string
  user: {
    id: string
    name: string
    email: string
    avatarUrl?: string
  }
  createdAt: string
}
```

**Key Features:**
- Optimistic updates with rollback on error
- Query invalidation on mutations
- Dedicated `useToggleWatch()` hook for self-management
- Mantine notifications on errors

---

## Reusable Pattern for Assignee Picker

**Direct Applicability:**

1. **Member Popover Pattern:**
   - Replace watchers list with single assignee slot
   - Keep avatar + name + email display
   - Replace "Add watcher" section with "Assign to" member list

2. **Member Data Source:**
   - Parent component fetches Clerk org members
   - Filters by workspace membership (if needed)
   - Passes as `members: Member[]` prop

3. **API Integration:**
   - PATCH `/tasks/:taskId` + `{ assigneeId: userId | null }`
   - Optimistic update pattern from watchers hook
   - Query key: `['task', taskId]` or `['tasks']`

4. **UI Simplifications:**
   - Single assignee (not array) - simpler state
   - No self-toggle button - direct selection only
   - "Unassign" action for clearing assignee

---

## Implementation Delta

**What Differs from Watchers:**

| Aspect | Watchers | Assignee |
|--------|----------|----------|
| Cardinality | Many-to-many | One-to-one |
| DB table | `task_watchers` (junction) | `tasks.assigneeId` (FK) |
| API endpoints | 3 (GET/POST/DELETE) | 1 (PATCH task) |
| Self-management | Yes (toggle watch) | No (PM assigns) |
| Clear action | Remove specific user | Set assigneeId = null |

**Reuse Opportunities:**
- Member list UI component (90% identical)
- Avatar display + popover layout
- Optimistic update pattern
- Error handling + notifications
- Permission gating via prop

---

## Clerk Org Integration Gap

**Current State:**
- Users table has `clerkId` but no org/workspace FK
- No `workspace_members` or `org_members` junction table found
- Members prop passed to TaskWatchers - **source unknown**

**Missing Pieces:**
1. Clerk org → workspace mapping (which Clerk org = which workspace?)
2. Workspace members query (fetch users by workspace ID)
3. Role/permission mapping (PM vs member in Clerk org)

**Assumption:**
- Parent component (TaskDetailPanel?) fetches members via Clerk SDK
- Filters by current workspace context
- Passes to watchers/assignee components

---

## Unresolved Questions

1. **Where is `members` prop populated?** (TaskDetailPanel? Project context?)
2. **Clerk org → workspace mapping?** (1:1? many:1? stored where?)
3. **Workspace membership table?** (needed for multi-workspace support)
4. **Permission source?** (`canManageWatchers` computed from Clerk roles or DB?)
5. **Assignee change triggers?** (activity log? notifications? realtime broadcast?)
