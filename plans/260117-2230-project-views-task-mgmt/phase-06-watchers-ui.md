# Phase 6: Watchers UI

**Priority:** High | **Status:** ✅ Complete | **Depends on:** Phases 1,2,3 | **Parallel with:** Phases 4,5,7

## Context Links

- [UI Components Research](../reports/researcher-260117-2237-ui-components.md)
- [Scout Report](../reports/scout-260117-2230-project-views-task-mgmt.md) - Backend CRUD exists
- [Code Review](../reports/code-reviewer-260118-0357-phase-06-watchers-ui.md) - 6.5/10, needs fixes

## Overview

UI for subscribing/unsubscribing from tasks + displaying watcher list.

## Key Insights

- Backend fully implemented (routes/tasks.ts:166-193)
- Need watch/unwatch button in task detail
- Avatar.Group for watcher display
- Trigger notifications when task changes (wire to Phases 2,3)

## Requirements

### Functional
- "Watch" button to subscribe current user
- "Watching" badge if already subscribed
- Avatar stack showing all watchers
- Click avatar stack to see full list
- Add/remove watchers (for assignee/PM)

### Non-Functional
- Optimistic UI updates
- Max 5 avatars in stack, "+N" for overflow

## Architecture

```
Task Detail Sidebar
├── Watch/Unwatch Button (current user)
├── Watchers Avatar Stack (clickable)
└── Watchers Popover
    ├── List of watchers
    └── Add watcher (MultiSelect) - PM only
```

## Related Code Files

### Create
- `apps/web/src/components/task-detail/task-watchers.tsx`
- `apps/web/src/hooks/use-task-watchers.ts`

### Modify
- `apps/web/src/components/task-detail/task-sidebar.tsx` - Add watchers section
- `apps/api/src/services/task.ts` - Trigger notifications on changes

## Implementation Steps

1. Create `use-task-watchers.ts` hook:
   - useQuery for watchers list
   - useMutation for add/remove watcher
   - Check if current user is watching
2. Create `task-watchers.tsx`:
   - Watch/Unwatch ActionIcon button
   - Avatar.Group with max 5
   - Popover with full list
   - MultiSelect for adding watchers (PM only)
3. Update `task-sidebar.tsx` to include TaskWatchers
4. Update task service to create notifications when:
   - Task assigned
   - Status changed
   - Comment added
   - Due date changed

## Todo List

- [x] Create useTaskWatchers hook
- [x] Create TaskWatchers component
- [x] Add watch/unwatch button
- [x] Add avatar stack display
- [x] Add watcher management popover
- [x] Update task-sidebar
- [x] Wire notification triggers in backend
- [ ] **CRITICAL:** Fix missing addedById in route (routes/tasks.ts:182)
- [ ] **CRITICAL:** Fix stale closure in useToggleWatch (race condition)
- [ ] **HIGH:** Add workspace membership validation
- [ ] **HIGH:** Add error handling UI for mutations
- [ ] **MEDIUM:** Sanitize notification messages (XSS prevention)
- [ ] **MEDIUM:** Implement optimistic updates
- [ ] Test notification delivery (blocked by critical fixes)

## Success Criteria

- [ ] Can watch/unwatch task with single click
- [ ] Avatar stack shows current watchers
- [ ] PM can add other users as watchers
- [ ] Watchers receive in-app notification on task change
- [ ] Watchers receive email notification (if enabled)

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Too many watchers | Paginate in popover, cap at 50 |
| Notification spam | Debounce rapid changes, batch updates |

## Security Considerations

- Any member can watch
- Only PM/assignee can add others as watchers
- Validate user belongs to workspace

## Next Steps

End-to-end test notification flow from task update to email delivery.
