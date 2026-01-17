# Code Review: Phase 3 In-App Notifications

**Reviewer:** code-reviewer-a04fde9
**Date:** 2026-01-18 02:44
**Plan:** /mnt/k/Work/nexa-task/plans/260117-2230-project-views-task-mgmt
**Score:** 6.5/10

## Scope

**Files reviewed:**
- apps/api/src/lib/notification-publisher.ts (NEW)
- apps/api/src/lib/websocket.ts (UPDATED)
- apps/api/src/services/notification.ts (UPDATED)
- apps/web/src/hooks/use-notifications.ts (NEW)
- apps/web/src/components/notifications/notification-bell.tsx (NEW)
- apps/web/src/components/notifications/notification-item.tsx (NEW)
- apps/web/src/components/notifications/notification-list.tsx (NEW)
- apps/web/src/components/layouts/app-shell.tsx (UPDATED)

**LOC analyzed:** ~750 lines
**Review focus:** Security, Performance, Architecture, React best practices
**Updated plans:** /mnt/k/Work/nexa-task/plans/260117-2230-project-views-task-mgmt/phase-03-inapp-notifications.md

## Overall Assessment

Implementation provides functional in-app notifications but has **1 CRITICAL type error blocking build** and several high-priority security/performance issues. Architecture generally YAGNI/KISS compliant but missing key error handling and auth validation.

**BUILD STATUS:** ❌ **BLOCKED - Type error prevents compilation**

## Critical Issues

### 1. Type Error - Build Blocking ⛔
**File:** `apps/api/src/services/notification.ts:78`
**Severity:** CRITICAL
**Impact:** Build fails, deployment blocked

```typescript
// ❌ WRONG - notification.isRead doesn't exist
await publishNotification(input.userId, {
  id: notification.id,
  type: notification.type,
  message: notification.message,
  entityType: notification.entityType,
  entityId: notification.entityId,
  createdAt: notification.createdAt,
  isRead: notification.isRead,  // ❌ Property 'isRead' doesn't exist
})

// ✅ FIX - Use notification.read
isRead: notification.read,  // Field is 'read' in schema, not 'isRead'
```

**Root cause:** Schema defines `read: boolean`, but service uses `isRead`. Inconsistent naming.

**Fix required before deployment.**

---

## High Priority Findings

### 2. Missing Auth Validation in WebSocket
**Files:** `apps/api/src/lib/websocket.ts`, `notification-publisher.ts`
**Severity:** HIGH (Security)
**Impact:** Potential unauthorized access to user notifications

**Issue:** No validation that `userId` in WebSocket connection is authenticated.

```typescript
// ❌ MISSING - No auth check
addConnection(ws: ServerWebSocket<WSData>) {
  this.userSockets.set(ws.data.userId, ws)  // Trusts userId without validation
  const userRoom = getUserNotificationRoom(ws.data.userId)
  this.joinRoom(ws, userRoom)
}
```

**Required:**
- Validate JWT/session token before accepting connection
- Verify `ws.data.userId` matches authenticated user
- Reject connections with invalid/expired tokens
- Add authentication middleware in WebSocket upgrade handler

### 3. Race Condition in Hook Dependencies
**File:** `apps/web/src/hooks/use-notifications.ts:142`
**Severity:** HIGH (Performance/Memory)
**Impact:** Infinite reconnect loops, memory leaks

```typescript
// ❌ WRONG - connect/disconnect recreated every render
useEffect(() => {
  connect()
  return () => disconnect()
}, [connect, disconnect])  // These change every render!
```

**Fix:**
```typescript
// ✅ Remove from deps, wrap in useRef or memo
useEffect(() => {
  connect()
  return () => disconnect()
}, [])  // Empty deps - connect/disconnect stable via useCallback
```

### 4. Missing Cleanup in Notification Publisher
**File:** `apps/api/src/lib/notification-publisher.ts:56-85`
**Severity:** HIGH (Memory Leak)
**Impact:** Redis subscriptions not cleaned up

```typescript
// ❌ WRONG - subscription never unsubscribed
export function subscribeToUserNotifications(
  userId: string,
  callback: (notification: NotificationPayload) => void,
) {
  // ...setup subscription...
  return () => {
    // ❌ NO-OP - doesn't actually unsubscribe!
  }
}
```

**Required:**
- Call `redisSub.unsubscribe(channel)` in cleanup
- Track active subscriptions in Map
- Clean up on user disconnect
- Prevent subscription leaks

### 5. XSS Vulnerability in Notification Message
**Files:** `notification-item.tsx:121`, `notification-bell.tsx`
**Severity:** HIGH (Security)
**Impact:** Malicious notification content could execute scripts

```typescript
// ⚠️ POTENTIAL XSS - notification.message from DB unsanitized
<Text size="sm" lineClamp={2}>
  {notification.message}  // If DB compromised, could contain <script>
</Text>
```

**Mitigation:**
- React escapes by default (safe currently)
- **BUT**: Ensure server-side validation prevents HTML in message
- Add CSP headers to prevent inline scripts
- Never use `dangerouslySetInnerHTML` for notifications
- Validate input in `createNotification()` to strip HTML tags

**Current status:** Low risk (React auto-escapes), but add validation for defense-in-depth.

### 6. Unhandled WebSocket Error States
**File:** `apps/web/src/hooks/use-notifications.ts:121-126`
**Severity:** MEDIUM-HIGH (UX)
**Impact:** Silent failures, no error feedback to user

```typescript
ws.onerror = () => {
  ws.close()  // ❌ No error logging, no user notification
}

// ❌ Empty catch blocks swallow errors
try {
  const message = JSON.parse(event.data)
} catch {
  // Ignore parse errors  // ❌ Should log for debugging
}
```

**Fix:**
- Log errors to monitoring service (Sentry, etc.)
- Show connection status indicator to user
- Toast notification on repeated failures
- Expose error state in hook return value

---

## Medium Priority Improvements

### 7. Inefficient Unread Count Hook
**File:** `apps/web/src/hooks/use-notifications.ts:42-45`
**Severity:** MEDIUM (Performance)

```typescript
// ⚠️ INEFFICIENT - fetches full notifications just for count
export function useUnreadCount() {
  const { data } = useNotifications({ limit: 1 })
  return data?.unreadCount ?? 0
}
```

**Better:**
```typescript
// ✅ Dedicated endpoint GET /notifications/unread/count
export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get('/notifications/unread/count'),
  })
}
```

### 8. Missing Loading/Error States
**File:** `notification-bell.tsx:21-27`
**Severity:** MEDIUM (UX)

- No error state displayed if fetch fails
- `isLoading` prop exists but not shown in UI
- User sees stale data on error

**Add:**
```tsx
{error && <Text c="red">Failed to load</Text>}
```

### 9. No Notification Retention Limit
**File:** `notification.ts:138-173`
**Severity:** MEDIUM (Performance)

- Plan specifies "last 100 notifications per user"
- **NOT IMPLEMENTED** - notifications accumulate forever
- Query performance degrades over time

**Required:**
- Add cleanup job to delete old notifications
- Or implement rolling window query
- Add `createdAt` index for performance

### 10. WebSocket Reconnect Limits Too Strict
**File:** `use-notifications.ts:79`
**Severity:** MEDIUM (UX)

```typescript
const maxReconnectAttempts = 5  // ⚠️ Gives up after ~63 seconds
```

**Recommendation:**
- Increase to 10-15 attempts (user may have brief network issues)
- Or remove limit, add manual reconnect button
- Current backoff: 1s, 2s, 4s, 8s, 16s (stops at 31s total)

---

## Low Priority Suggestions

### 11. Import Ordering (Linter)
**Files:** `notification-publisher.ts`, `notification.ts`
**Severity:** LOW (Style)

```typescript
// Fix with:
bun run biome check --write apps/api/src/lib/notification-publisher.ts
bun run biome check --write apps/api/src/services/notification.ts
```

### 12. Magic Numbers
**File:** `notification-bell.tsx:22, 86, 95`

```typescript
limit: 10,          // Extract to const NOTIFICATIONS_PREVIEW_LIMIT
width={360}         // Extract to const POPOVER_WIDTH
mah={400}           // Extract to const MAX_NOTIFICATION_HEIGHT
```

### 13. Type Assertion Casting
**File:** `notification-item.tsx:64, 70`

```typescript
// ⚠️ Unsafe casts - assumes data exists
const projectId = (notification.data?.projectId as string) || ''
```

**Better:**
```typescript
const projectId = typeof notification.data?.projectId === 'string'
  ? notification.data.projectId
  : ''
```

### 14. Accessibility
**Files:** Notification components

- ✅ GOOD: `aria-label` on bell icon
- ⚠️ MISSING: `role="alert"` for new notifications
- ⚠️ MISSING: Keyboard navigation in list
- ⚠️ MISSING: Focus management when opening popover

---

## Positive Observations

1. ✅ **Clean architecture** - separation of concerns (publisher, service, hooks, components)
2. ✅ **Graceful Redis fallback** - direct WebSocket if Redis unavailable
3. ✅ **Atomic DB operations** - `markNotificationRead` uses ownership check in WHERE clause
4. ✅ **React Query integration** - proper cache invalidation on mutations
5. ✅ **Exponential backoff** - reconnect strategy prevents server hammering
6. ✅ **Room-based isolation** - users auto-join personal room, prevents cross-user leaks
7. ✅ **No XSS vectors** - React auto-escapes, no `dangerouslySetInnerHTML`
8. ✅ **Type safety** - strong TypeScript usage (except one critical error)
9. ✅ **YAGNI compliant** - no overengineering, simple solutions
10. ✅ **DRY principles** - reusable hooks, components

---

## Recommended Actions

### Immediate (Before Merge)
1. **Fix type error** - Change `notification.isRead` → `notification.read` (Line 78)
2. **Add WebSocket auth** - Validate JWT before accepting connections
3. **Fix hook deps** - Remove `connect`/`disconnect` from useEffect deps
4. **Implement Redis cleanup** - Unsubscribe in returned function
5. **Run biome format** - Fix import ordering

### Pre-Production
6. Add error logging to WebSocket handlers
7. Implement `/notifications/unread/count` endpoint
8. Add notification retention cleanup (100 per user limit)
9. Increase reconnect attempts to 10-15
10. Add error/loading UI states

### Nice-to-Have
11. Add keyboard navigation
12. Extract magic numbers to constants
13. Improve type guards for `notification.data`
14. Add `role="alert"` for a11y

---

## Metrics

- **Type Coverage:** ~95% (excellent)
- **Test Coverage:** ❌ 0% (no tests for new notification code)
- **Linting Issues:**
  - 2 import order warnings (low severity)
  - 1 format warning (low severity)
  - **1 type error (critical)**

---

## Security Checklist

- ⚠️ **Auth/Authorization:** Missing WebSocket auth validation
- ✅ **SQL Injection:** Protected (Drizzle ORM parameterized queries)
- ✅ **XSS:** Low risk (React auto-escape, no innerHTML)
- ⚠️ **User Isolation:** Relies on WebSocket data.userId trust (needs auth)
- ✅ **Input Validation:** `updateNotificationPreferences` validates types
- ✅ **Error Messages:** No sensitive data leaked
- ⚠️ **Logging:** Missing error logs (should add for monitoring)
- ✅ **Rate Limiting:** Not implemented (consider for WebSocket)

---

## Updated Plan Status

**File:** `/mnt/k/Work/nexa-task/plans/260117-2230-project-views-task-mgmt/phase-03-inapp-notifications.md`

**Todo Progress:** 8/9 complete (89%)
- [x] Create Redis notification publisher
- [x] Update notification service with pub/sub
- [x] Update WebSocket to handle notifications
- [x] Create useNotifications hook
- [x] Create NotificationBell component
- [x] Create NotificationItem component
- [x] Create NotificationList component
- [x] Add bell to header
- [x] Implement navigation on click

**Success Criteria:** 0/5 verified (blocked by build error)
- [ ] Creating notification shows toast in real-time (NOT TESTED)
- [ ] Bell shows unread count badge (NOT TESTED)
- [ ] Clicking notification marks as read (NOT TESTED)
- [ ] Clicking notification navigates to task/project (NOT TESTED)
- [ ] Mark all as read clears badge (NOT TESTED)

**Status:** ⚠️ **Implementation Complete but BLOCKED by type error**

---

## Unresolved Questions

1. **WebSocket Auth:** How is JWT validated on WebSocket upgrade? Need auth middleware.
2. **Redis Pub/Sub:** Where is `redisSub` client created? Missing from `redis.ts`.
3. **Notification Cleanup:** When to delete old notifications? Cron job? TTL?
4. **Error Monitoring:** Which service for production error tracking? (Sentry, DataDog?)
5. **Rate Limiting:** Should WebSocket connections be rate-limited per user?
6. **Testing Strategy:** Why are notification tests not written? Need integration tests.
7. **Database Migration:** Was schema updated for `notifications` table? Need migration file.

---

**Next Step:** Fix type error, add auth validation, then run full test suite.
