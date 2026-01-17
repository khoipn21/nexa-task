# Code Review: Phase 6 Watchers UI

**Review Date:** 2026-01-18
**Reviewer:** code-reviewer (acef990)
**Phase:** Phase 6 - Watchers UI
**Score:** 6.5/10

---

## Scope

**Files reviewed:**
- `apps/web/src/hooks/use-task-watchers.ts` (NEW, 92 lines)
- `apps/web/src/components/task-detail/task-watchers.tsx` (NEW, 194 lines)
- `apps/web/src/components/task-detail/task-sidebar.tsx` (MODIFIED, +8 lines)
- `apps/api/src/services/task.ts` (MODIFIED, ~100 lines notification logic)

**Lines analyzed:** ~500 LOC
**Review focus:** Phase 6 changes (watchers UI + notification triggers)
**Updated plans:** None yet

---

## Overall Assessment

Implementation meets functional requirements but has **critical security flaw** (missing addedById), performance issues (stale closures, missing optimistic updates), and several quality concerns. API notification logic solid. Frontend needs fixes before production.

---

## Critical Issues

### 1. **SECURITY: Missing Actor ID in Watcher Addition**
**File:** `apps/api/src/routes/tasks.ts:182`
**Severity:** HIGH (notification bypass)

```typescript
// CURRENT - Missing addedById
const result = await taskService.addTaskWatcher(db, taskId, userId)

// REQUIRED
const result = await taskService.addTaskWatcher(db, taskId, userId, c.var.userId)
```

**Impact:** Watcher-added notifications never sent because `addedById` undefined. Service expects it to notify user when PM adds them.

**Fix:** Pass authenticated user ID from middleware.

---

### 2. **RACE CONDITION: Stale Closure in Toggle**
**File:** `apps/web/src/hooks/use-task-watchers.ts:59-91`
**Severity:** HIGH (data corruption)

```typescript
// BROKEN - isWatching captured at hook call, not mutation time
export function useToggleWatch(taskId: string, currentUserId: string) {
  const { data: watchers = [] } = useTaskWatchers(taskId)
  const isWatching = watchers.some((w) => w.userId === currentUserId) // ❌ Stale

  const toggle = () => {
    if (isWatching) { // ❌ Uses stale value from closure
      removeWatcher.mutate()
    } else {
      addWatcher.mutate()
    }
  }
}
```

**Scenario:**
1. User clicks Watch (isWatching=false, adds watcher)
2. Before query refetch completes, user clicks again
3. `isWatching` still false → adds again instead of removing → duplicate watcher error

**Fix:** Read fresh data inside toggle function:
```typescript
const toggle = () => {
  const freshWatchers = queryClient.getQueryData<Watcher[]>(['task-watchers', taskId]) || []
  const currentlyWatching = freshWatchers.some(w => w.userId === currentUserId)
  // ...
}
```

---

### 3. **XSS RISK: Unsanitized User Input in Notification Messages**
**File:** `apps/api/src/services/task.ts:288-289, 344`
**Severity:** MEDIUM (notification spam/injection)

```typescript
// No HTML escaping
message: `Status changed from "${existing.status?.name}" to a new status`
message: `Due date updated for task "${existing.title}"`
```

**Impact:** If `existing.status.name` or `existing.title` contains `<script>` or malicious HTML, could render in notification UI (depends on frontend sanitization).

**Fix:** Use DOMPurify or escape HTML in notification service before storage. Frontend should also escape on render.

---

## High Priority Findings

### 4. **PERFORMANCE: Missing Optimistic Updates**
**File:** `apps/web/src/hooks/use-task-watchers.ts:30-49`

No optimistic UI updates. Every watch/unwatch shows loading spinner for ~200-500ms.

**Expected:** Instant UI feedback with rollback on error.

```typescript
// Add to mutations
onMutate: async (userId) => {
  await queryClient.cancelQueries(['task-watchers', taskId])
  const previous = queryClient.getQueryData(['task-watchers', taskId])

  queryClient.setQueryData(['task-watchers', taskId], (old) =>
    [...(old || []), { userId, /* mock watcher */ }]
  )

  return { previous }
},
onError: (err, vars, context) => {
  queryClient.setQueryData(['task-watchers', taskId], context.previous)
}
```

---

### 5. **ACCESS CONTROL: No Workspace Membership Validation**
**File:** `apps/api/src/routes/tasks.ts:174-184`

Route allows ANY userId in request body. No check if userId belongs to workspace.

```typescript
// CURRENT - Trusts client
const { userId } = c.req.valid('json')
await taskService.addTaskWatcher(db, taskId, userId)

// NEEDED
const member = await db.query.workspaceMembers.findFirst({
  where: and(
    eq(workspaceMembers.workspaceId, c.var.workspaceId),
    eq(workspaceMembers.userId, userId)
  )
})
if (!member) throw new ForbiddenError('User not in workspace')
```

**Impact:** Attacker can add users from other workspaces as watchers, leaking task updates.

---

### 6. **ERROR HANDLING: No Error Display to User**
**File:** `apps/web/src/components/task-detail/task-watchers.tsx:54-60`

Mutations fail silently. User never sees "User already watching" or "Permission denied" errors.

```typescript
const handleAddWatcher = (userId: string) => {
  addWatcher.mutate(userId) // ❌ No error handling
}
```

**Fix:** Add `onError` callback with toast notification:
```typescript
addWatcher.mutate(userId, {
  onError: (error) => {
    notifications.show({
      color: 'red',
      message: error.message
    })
  }
})
```

---

## Medium Priority Improvements

### 7. **CODE SMELL: Duplicate Hooks in useToggleWatch**
**File:** `apps/web/src/hooks/use-task-watchers.ts:64-76`

Creates separate `useMutation` instances when `useAddWatcher` and `useRemoveWatcher` hooks exist. Violates DRY.

```typescript
// CURRENT - Duplicates mutation logic
const addWatcher = useMutation({ ... })
const removeWatcher = useMutation({ ... })

// BETTER - Reuse existing hooks
const addWatcher = useAddWatcher(taskId)
const removeWatcher = useRemoveWatcher(taskId)
```

---

### 8. **UX: No Loading State for Avatar Stack**
**File:** `apps/web/src/components/task-detail/task-watchers.tsx:85-89`

Shows "Loading..." text but avatar skeleton would be better UX.

---

### 9. **PERFORMANCE: No Memoization in Component**
**File:** `apps/web/src/components/task-detail/task-watchers.tsx:47-52`

Recalculates `watcherIds`, `availableMembers`, `displayedWatchers` on every render.

```typescript
const watcherIds = useMemo(
  () => new Set(watchers.map((w) => w.userId)),
  [watchers]
)
const availableMembers = useMemo(
  () => members.filter((m) => !watcherIds.has(m.id)),
  [members, watcherIds]
)
```

---

### 10. **MISSING FEATURE: No Search for Available Members**
**File:** `apps/web/src/components/task-detail/task-watchers.tsx:166-178`

Only shows first 5 available members. If workspace has 100 users and needed user is #80, PM can't add them.

**Fix:** Add `<TextInput>` with filter or use `<Select>` component.

---

### 11. **TYPE SAFETY: Member Type Mismatch**
**File:** `apps/web/src/components/task-detail/task-watchers.tsx:20-25` vs `task-sidebar.tsx:21-25`

Different `Member` types defined. Should import from shared types.

```typescript
// task-watchers.tsx
type Member = {
  id: string
  name: string
  email?: string        // Optional
  avatarUrl?: string
}

// task-sidebar.tsx
type Member = {
  id: string
  name: string
  avatarUrl?: string    // No email field
}
```

---

### 12. **NOTIFICATION: Wrong Type for Due Date Change**
**File:** `apps/api/src/services/task.ts:342`

```typescript
type: 'task_status_changed', // ❌ Should be 'task_updated' or 'task_due_date_changed'
```

Misleading notification type. Frontend might route to wrong UI.

---

## Low Priority Suggestions

### 13. **CONSISTENCY: Hardcoded Max Display Count**
**File:** `apps/web/src/components/task-detail/task-watchers.tsx:51-52`

Magic number `5` used twice. Extract to constant:
```typescript
const MAX_DISPLAYED_WATCHERS = 5
```

---

### 14. **A11Y: Missing ARIA Labels**
**File:** `apps/web/src/components/task-detail/task-watchers.tsx:71-78`

```typescript
<ActionIcon
  aria-label={isWatching ? 'Stop watching this task' : 'Watch this task'}
  // ...
>
```

---

### 15. **CODE STYLE: Unnecessary Fragment**
**File:** `apps/web/src/components/task-detail/task-watchers.tsx:161`

```typescript
{canManageWatchers && availableMembers.length > 0 && (
  <>  {/* ❌ Unnecessary */}
    <Text>...</Text>
    <Stack>...</Stack>
  </>
)}

// Should be <div> or direct children
```

---

## Positive Observations

✅ **Excellent notification architecture**: `notifyTaskWatchers` helper well-designed with Promise.allSettled for fault tolerance
✅ **Proper activity logging**: All watcher changes logged for audit trail
✅ **Clean separation**: Hooks properly separated from components
✅ **Real-time events**: WebSocket integration for live updates
✅ **Circular dependency prevention**: Proper validation in dependencies
✅ **Conflict handling**: `onConflictDoNothing()` prevents duplicate watcher errors at DB level

---

## Recommended Actions

**Priority 1 (Before Merge):**
1. **Fix Critical #1:** Add `c.var.userId` as `addedById` in route handler (routes/tasks.ts:182)
2. **Fix Critical #2:** Resolve stale closure in `useToggleWatch` using fresh query data
3. **Fix High #5:** Add workspace membership validation in addWatcher route
4. **Fix High #6:** Add error handling UI for failed mutations

**Priority 2 (Before Production):**
5. **Fix Critical #3:** Sanitize notification messages to prevent XSS
6. **Fix High #4:** Implement optimistic updates for better UX
7. **Fix Medium #10:** Add search/select for available members list

**Priority 3 (Tech Debt):**
8. **Fix Medium #7:** Refactor `useToggleWatch` to reuse existing mutation hooks
9. **Fix Medium #11:** Create shared `Member` type in @repo/shared
10. **Fix Medium #12:** Use correct notification type for due date changes

---

## Metrics

- **Type Coverage:** ✅ Full (TypeScript strict mode)
- **Test Coverage:** ❌ No tests found for watcher features
- **Linting Issues:** ⚠️ Build timeout (web package), API compiled successfully
- **API Compiled:** ✅ Yes (1960ms)
- **Security Issues:** 2 critical (addedById, workspace validation), 1 medium (XSS)

---

## Plan Updates Required

**File:** `/mnt/k/Work/nexa-task/plans/260117-2230-project-views-task-mgmt/phase-06-watchers-ui.md`

```diff
## Todo List

- [x] Create useTaskWatchers hook
- [x] Create TaskWatchers component
- [x] Add watch/unwatch button
- [x] Add avatar stack display
- [x] Add watcher management popover
- [x] Update task-sidebar
- [x] Wire notification triggers in backend
- [ ] Test notification delivery  # ❌ BLOCKED by Critical #1
+ [ ] Fix stale closure in useToggleWatch
+ [ ] Add workspace membership validation
+ [ ] Add error handling UI
+ [ ] Write unit tests for watcher hooks
+ [ ] Write integration tests for notification flow
```

**Status:** Change from "Pending" to "⚠️ Needs Fixes"

---

## Unresolved Questions

1. **Notification delivery test:** Cannot verify email delivery without fixing Critical #1. Should emails send immediately or batch?
2. **Watcher limit:** Plan mentions "cap at 50" but no enforcement code. Intended for future?
3. **Debounce strategy:** Plan mentions debouncing rapid changes. Where should this be implemented (client vs server)?
4. **Member data source:** Where does `members` prop come from in TaskSidebar? No query hook visible.
5. **PM role check:** `canManageWatchers` prop passed from parent but no validation of PM role at API level. Client-only check?
