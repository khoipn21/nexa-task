# Phase 3: In-App Notifications

**Priority:** High | **Status:** ⬜ Pending | **Depends on:** Phase 1 | **Parallel with:** Phase 2

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

- [ ] Create Redis notification publisher
- [ ] Update notification service with pub/sub
- [ ] Update WebSocket to handle notifications
- [ ] Create useNotifications hook
- [ ] Create NotificationBell component
- [ ] Create NotificationItem component
- [ ] Create NotificationList component
- [ ] Add bell to header
- [ ] Implement navigation on click

## Success Criteria

- [ ] Creating notification shows toast in real-time
- [ ] Bell shows unread count badge
- [ ] Clicking notification marks as read
- [ ] Clicking notification navigates to task/project
- [ ] Mark all as read clears badge

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
