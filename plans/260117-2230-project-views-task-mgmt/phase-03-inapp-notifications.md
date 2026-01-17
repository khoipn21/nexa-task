# Phase 3: In-App Notifications

**Priority:** High | **Status:** ✅ Done | **Depends on:** Phase 1 | **Parallel with:** Phase 2

## Context Links

- [In-App Notifications Research](../reports/research-260117-2230-inapp-notifications.md)

## Overview

Real-time in-app notifications via Redis pub/sub + existing WebSocket.

## Key Insights

- Project already has WebSocket infrastructure
- Redis available for pub/sub
- Mantine Indicator component for bell badge
- Store notifications in PostgreSQL for history

## Requirements

### Functional
- Push notifications via WebSocket in real-time
- Display notification bell with unread count
- Notification dropdown with recent items
- Mark as read (single/all)
- Click notification to navigate to entity

### Non-Functional
- <100ms WebSocket latency
- Persist last 100 notifications per user
- Graceful degradation if Redis unavailable

## Architecture

```
Task Event → Notification Service → PostgreSQL (persist)
                                  → Redis pub/sub → WebSocket → React
```

## Related Code Files

### Create
- `apps/web/src/components/notifications/notification-bell.tsx`
- `apps/web/src/components/notifications/notification-item.tsx`
- `apps/web/src/components/notifications/notification-list.tsx`
- `apps/web/src/hooks/use-notifications.ts`
- `apps/api/src/lib/notification-publisher.ts`

### Modify
- `apps/api/src/lib/websocket.ts` - Add notification channel handling
- `apps/api/src/services/notification.ts` - Add Redis publish after DB insert
- `apps/web/src/components/layout/header.tsx` - Add notification bell

## Implementation Steps

1. Create `notification-publisher.ts` with Redis pub/sub for `notifications:{userId}`
2. Update notification service to publish after creating notification
3. Update WebSocket handler to subscribe to user's notification channel
4. Create `use-notifications.ts` hook for WebSocket message handling
5. Create `notification-bell.tsx` with Mantine Indicator + Popover
6. Create `notification-item.tsx` for individual notification display
7. Create `notification-list.tsx` for scrollable list
8. Add bell to header component
9. Implement click-to-navigate for each notification type

## Todo List

- [x] Create Redis notification publisher
- [x] Update notification service with pub/sub
- [x] Update WebSocket to handle notifications
- [x] Create useNotifications hook
- [x] Create NotificationBell component
- [x] Create NotificationItem component
- [x] Create NotificationList component
- [x] Add bell to header
- [x] Implement navigation on click
- [x] Fix type error `notification.isRead` → `notification.read`
- [x] Fix React hook deps (moved connect inside useEffect)
- [x] Implement Redis subscription cleanup
- [x] Add try-catch around WebSocket publish

## Success Criteria

- [x] Creating notification shows toast in real-time
- [x] Bell shows unread count badge
- [x] Clicking notification marks as read
- [x] Clicking notification navigates to task/project
- [x] Mark all as read clears badge

## Code Review

**Date:** 2026-01-18 03:00
**Reviewer:** code-reviewer
**Score:** 8.5/10
**Status:** ✅ Approved

**Fixes Applied:**
1. Fixed type error: `notification.isRead` → `notification.read`
2. Fixed React hook dependency loop (moved connect inside useEffect)
3. Implemented Redis subscription cleanup with `redisSub.off()`
4. Increased reconnect attempts to 10 (~17 min total)
5. Added try-catch around publishNotification call

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| WebSocket disconnect | Auto-reconnect with backoff, fetch on reconnect |
| Redis unavailable | Fallback to polling (60s interval) |
| Too many notifications | Paginate, limit to 100 recent |

## Security Considerations

- Verify user owns notification before marking read
- Don't expose other users' notifications via WebSocket
- Sanitize notification content for XSS

## Next Steps

Integrate with watcher notification triggers in Phase 6.
