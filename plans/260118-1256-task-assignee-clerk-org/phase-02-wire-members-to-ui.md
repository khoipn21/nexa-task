---
phase: 2
title: "Wire Members to Task Detail UI"
status: completed
effort: 1h
completed: 2026-01-18
---

# Phase 2: Wire Members to Task Detail UI

## Context

- [project-detail.tsx](../../apps/web/src/routes/project-detail.tsx)
- [task-detail-panel.tsx](../../apps/web/src/components/task-detail/task-detail-panel.tsx)
- [task-sidebar.tsx](../../apps/web/src/components/task-detail/task-sidebar.tsx)

## Overview

Wire `useWorkspaceMembers` hook to provide real member data to the task assignee dropdown.

## workspaceId Availability

**CONFIRMED:** API already returns `workspaceId` in project response.

The `getProjectById` service uses `db.query.projects.findFirst()` which returns the full row including `workspaceId` field. Only the frontend type definition is missing it.

## Implementation Steps

### Step 1: Add workspaceId to Frontend Project Type

File: `apps/web/src/hooks/use-projects.ts`

```typescript
export type Project = {
  id: string
  name: string
  description?: string
  status: 'active' | 'archived'
  color?: string
  taskCount?: number
  completedTaskCount?: number
  workspaceId?: string  // ADD THIS
  workflowStatuses?: Array<{ id: string; name: string; color: string }>
}
```

### Step 2: Update project-detail.tsx

```typescript
import { useWorkspaceMembers } from '@/hooks/use-workspace'

export default function ProjectDetail() {
  const { id } = useParams()
  const { data: project, isLoading } = useProject(id)
  const { viewMode } = useViewPreference(id)

  // ADD: Fetch workspace members
  const { data: members = [] } = useWorkspaceMembers(project?.workspaceId)

  // ... rest unchanged ...

  return (
    // ... unchanged ...
    <TaskDetailPanel
      taskId={selectedTaskId}
      onClose={handleCloseTaskDetail}
      statuses={statuses}
      members={members}  // CHANGE: was members={[]}
      projectId={id}
    />
  )
}
```

## Todo

- [x] Add `workspaceId` to frontend `Project` type
- [x] Import `useWorkspaceMembers` in project-detail.tsx
- [x] Call hook with `project?.workspaceId`
- [x] Pass `members` data to `TaskDetailPanel`
- [x] Update task-detail.tsx to fetch members (use task.projectId → project.workspaceId)
- [x] Consolidate Member type duplication (4 files → 1 WorkspaceMember export)
- [ ] Test assignee dropdown shows members
- [ ] Test assigning user works
- [ ] Test clearing assignee works

## Testing Checklist

1. Open project detail page
2. Click on a task to open drawer
3. Click Assignee dropdown - should show workspace members
4. Select a member - task should update
5. Clear selection - task assigneeId should be null
6. Refresh page - assignee should persist

## Edge Cases

- Empty workspace (no other members) - dropdown shows only current user
- Network error fetching members - graceful fallback to empty
- Slow member load - dropdown disabled until loaded

## Success Criteria

- [ ] Assignee dropdown populated with real members
- [ ] Assignment persists after refresh
- [ ] No console errors
- [ ] Loading state handled gracefully
