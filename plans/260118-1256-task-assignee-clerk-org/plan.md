---
title: "Task Assignee Functionality with Clerk Organizations"
description: "Wire workspace members to task assignee dropdown using existing API/UI"
status: completed
priority: P1
effort: 2h
branch: master
tags: [task, assignee, clerk, workspace-members]
created: 2026-01-18
completed: 2026-01-18
---

# Task Assignee Functionality with Clerk Organizations

## Summary

Enable task assignment by connecting existing workspace members API to the task detail UI.

**Key Finding:** 90% of infrastructure already exists. Only need to:
1. Add `useWorkspaceMembers` hook (frontend)
2. Pass real members to `TaskDetailPanel` (instead of `members={[]}`)

## Current State

| Component | Status | Notes |
|-----------|--------|-------|
| DB Schema (`tasks.assigneeId`) | Done | UUID FK to users, indexed |
| Task Update API (`PATCH /tasks/:id`) | Done | Accepts `assigneeId` |
| Workspace Members API (`GET /workspaces/:id/members`) | Done | Returns `{ user: { id, name, avatarUrl } }` |
| Task Sidebar UI (Assignee Select) | Done | Lines 82-97 in `task-sidebar.tsx` |
| Frontend Members Hook | **Missing** | Need `useWorkspaceMembers()` |
| Data Wiring | **Missing** | `project-detail.tsx` passes `members={[]}` |

## Implementation Phases

### [Phase 1: Frontend Members Hook](./phase-01-workspace-members-hook.md) ✅
- Create `useWorkspaceMembers(workspaceId)` hook
- Transform API response to `Member[]` format
- ~30min effort

### [Phase 2: Wire Members to Task Detail](./phase-02-wire-members-to-ui.md) ✅
- Update `project-detail.tsx` to fetch members
- Pass to `TaskDetailPanel`
- Test assignee selection
- ~1h effort

## Architecture

```
Frontend Flow:
useWorkspaceMembers(workspaceId)
    → GET /workspaces/:id/members
    → Transform: { user: {...} }[] → { id, name, avatarUrl }[]
    → TaskDetailPanel → TaskDetailContent → TaskSidebar
        → Select onChange → useUpdateTask → PATCH /tasks/:id { assigneeId }
```

## Files to Modify

| File | Action |
|------|--------|
| `apps/web/src/hooks/use-workspace.ts` | Add `useWorkspaceMembers` hook |
| `apps/web/src/routes/project-detail.tsx` | Fetch members, pass to panel |
| `apps/web/src/routes/task-detail.tsx` | Fetch members, pass to content |
| `apps/web/src/hooks/use-projects.ts` | Add `workspaceId` to Project type |

## Validation Summary

**Validated:** 2026-01-18
**Questions asked:** 3

### Confirmed Decisions
- **Scope:** Wire members to BOTH project drawer and /tasks/:id page
- **workspaceId:** API confirmed to return it (verified in project.ts:65-83)
- **Cache duration:** 5 minutes staleTime for member data

### Verified Assumptions
- `getProjectById` returns full project object including `workspaceId` ✓

## Success Criteria

- [ ] Assignee dropdown shows workspace members
- [ ] Selecting assignee updates task
- [ ] Clearing assignee sets to null
- [ ] Members load without errors

## Risks

- **Stale member data** - Consider query invalidation on focus

## Notes

- `workspaceId` is already returned by GET /projects/:id (confirmed in service)
