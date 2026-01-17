# Phase 1: Database & Backend Foundation

**Priority:** High | **Status:** ✅ Done (2026-01-17) | **Blocking:** All other phases

## Context Links

- [Scout Report](../reports/scout-260117-2230-project-views-task-mgmt.md)
- [In-App Notifications Research](../reports/research-260117-2230-inapp-notifications.md)
- [Email Research](../reports/researcher-260117-2237-email-notifications.md)

## Overview

Add database tables and API endpoints for notifications + user preferences.

## Key Insights

- Existing task watchers table ready for use
- Need notifications table for in-app history
- Need notification_preferences table for user settings
- Need user_settings table for view preferences

## Requirements

### Functional
- Store in-app notifications with read status
- Store user notification preferences (which events enabled)
- Store user view preferences (kanban/list/calendar per project)

### Non-Functional
- JSONB for flexible notification payloads
- Composite indexes for fast unread queries

## Architecture

```
notifications (new)
├── id, user_id, type, title, message
├── data (JSONB), entity_type, entity_id
├── read, read_at, created_at

notification_preferences (new)
├── id, user_id
├── email_enabled, inapp_enabled
├── enabled_types TEXT[]

user_project_preferences (new)
├── id, user_id, project_id
├── view_mode (kanban/list/calendar)
├── UNIQUE(user_id, project_id)
```

## Related Code Files

### Create
- `packages/db/src/schema/notifications.ts`
- `packages/db/src/schema/notification-preferences.ts`
- `packages/db/src/schema/user-project-preferences.ts`
- `apps/api/src/routes/notifications.ts`
- `apps/api/src/routes/user-settings.ts`
- `apps/api/src/services/notification.ts`

### Modify
- `packages/db/src/schema/relations.ts` - Add new relations
- `packages/db/src/schema/index.ts` - Export new schemas
- `apps/api/src/index.ts` - Mount new routes

## Implementation Steps

1. Create `notifications.ts` schema with fields: id, userId, type (enum), title, message, data (jsonb), entityType, entityId, read, readAt, createdAt
2. Create `notification-preferences.ts` with: id, userId, emailEnabled, inappEnabled, enabledTypes (array)
3. Create `user-project-preferences.ts` with: id, userId, projectId, viewMode (enum)
4. Update `relations.ts` to add user → notifications, user → preferences relations
5. Export all schemas from `index.ts`
6. Create `notification.ts` service with: create, list, markRead, markAllRead, getPreferences, updatePreferences
7. Create `notifications.ts` route: GET /, PATCH /:id/read, POST /mark-all-read, GET /preferences, PATCH /preferences
8. Create `user-settings.ts` route: GET /projects/:id/preference, PATCH /projects/:id/preference
9. Mount routes in `index.ts`
10. Run `bun run db:push` to apply schema changes

## Todo List

- [x] Create notifications schema
- [x] Create notification-preferences schema
- [x] Create user-project-preferences schema
- [x] Update relations.ts
- [x] Export schemas from index.ts
- [x] Create notification service
- [x] Create notifications route
- [x] Create user-settings route
- [x] Mount routes
- [x] Push DB schema

## Success Criteria

- [x] `bun run db:push` succeeds without errors
- [x] `GET /api/notifications` returns empty array for new user
- [x] `PATCH /api/notifications/:id/read` marks notification as read
- [x] `GET /api/user-settings/projects/:id/preference` returns view mode

## Completion Summary

**Completed:** 2026-01-17

### Deliverables
- ✅ 3 new DB schemas: `notifications`, `notification-preferences`, `user-project-preferences`
- ✅ Notification service with optimized queries (unread count, pagination)
- ✅ Notifications route: list, unread-count, mark-read, preferences
- ✅ User-settings route: project view preference CRUD
- ✅ All unit tests passing (16/16)

### Files Created
- `packages/db/src/schema/notifications.ts`
- `packages/db/src/schema/notification-preferences.ts`
- `packages/db/src/schema/user-project-preferences.ts`
- `apps/api/src/routes/notifications.ts`
- `apps/api/src/routes/user-settings.ts`
- `apps/api/src/services/notification.ts`

### Files Modified
- `packages/db/src/schema/relations.ts` - Added new relations
- `packages/db/src/schema/index.ts` - Exported new schemas
- `apps/api/src/index.ts` - Mounted new routes

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Schema migration conflicts | Use db:push for dev, proper migrations for prod |
| Missing indexes | Add composite indexes for user_id + read queries |

## Security Considerations

- All endpoints require auth middleware
- Users can only access their own notifications
- Validate notification IDs belong to requesting user

## Next Steps

After completion, phases 2-7 can proceed in parallel.
