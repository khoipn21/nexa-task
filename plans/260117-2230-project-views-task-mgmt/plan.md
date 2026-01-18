# Project Views & Advanced Task Management

**Created:** 2026-01-17 22:30 | **Status:** ✅ Complete

## Overview

Complete 4 missing frontend features + add notification system (in-app + email) for watchers.

## Scope

- **Module B:** View preference persistence (Redis + localStorage)
- **Module C:** Watchers UI, dependency picker, file upload dropzone, workflow settings
- **Notifications:** In-app (PostgreSQL + Redis pub/sub + WebSocket) + Email (Resend + BullMQ)

## Phases

| # | Phase | Status | Parallel |
|---|-------|--------|----------|
| 1 | [Database & Backend Foundation](./phase-01-database-backend-foundation.md) | ✅ Done (2026-01-17) | No |
| 2 | [Email Infrastructure](./phase-02-email-infrastructure.md) | ✅ Done (2026-01-18) | Yes (2,3) |
| 3 | [In-App Notifications](./phase-03-inapp-notifications.md) | ✅ Done (2026-01-18) | Yes (2,3) |
| 4 | [View Preference Sync](./phase-04-view-preference-sync.md) | ✅ Done (2026-01-18) | Yes (4,5,6,7) |
| 5 | [Workflow Settings UI](./phase-05-workflow-settings-ui.md) | ✅ Done (2026-01-18) | Yes (4,5,6,7) |
| 6 | [Watchers UI](./phase-06-watchers-ui.md) | ✅ Done (2026-01-18) | Yes (4,5,6,7) |
| 7 | [Dependency Picker + File Upload](./phase-07-dependency-picker-file-upload.md) | ✅ Done (2026-01-18) | Yes (4,5,6,7) |
| 8 | [Integration & Testing](./phase-08-integration-testing.md) | ✅ Done (2026-01-18) | No |

## Dependencies

```
Phase 1 (DB/Backend) ──┬── Phase 2 (Email) ─────┐
                       ├── Phase 3 (In-app) ────┤
                       │                        ├── Phase 8 (Test)
                       ├── Phase 4 (View Pref) ─┤
                       ├── Phase 5 (Workflow) ──┤
                       ├── Phase 6 (Watchers) ──┤
                       └── Phase 7 (Dep+File) ──┘
```

## Reports

- [Scout Report](../reports/scout-260117-2230-project-views-task-mgmt.md)
- [Email Notifications Research](../reports/researcher-260117-2237-email-notifications.md)
- [In-App Notifications Research](../reports/research-260117-2230-inapp-notifications.md)
- [UI Components Research](../reports/researcher-260117-2237-ui-components.md)
- [Phase 4 Code Review](./reports/code-reviewer-260118-0315-phase-04-view-preference.md)
- [Phase 7 Code Review](./reports/code-reviewer-260118-0430-phase-07-dep-file.md) ⚠️ **CRITICAL Security Issues**

## Success Criteria

- [x] Database schemas created (notifications, notification-preferences, user-project-preferences)
- [x] Notification service with optimized queries
- [x] Backend routes (notifications, user-settings)
- [x] All Phase 1 unit tests passing (16/16)
- [x] Email infrastructure with Nodemailer + BullMQ
- [x] React Email templates (task-assigned, task-updated, comment-added, base-layout)
- [x] Email worker with rate limiting (100/min), retries (3x), circuit breaker
- [x] All Phase 2 unit tests passing (32/32 total)
- [x] View preference syncs across devices via Redis
- [x] Workflow statuses can be managed in project settings
- [x] Watchers can subscribe/unsubscribe from tasks
- [x] Watchers receive in-app notifications for task changes
- [x] Watchers receive email notifications (configurable)
- [x] Dependencies can be added via task picker modal
- [x] Files can be uploaded via drag-drop dropzone with S3 storage
- [x] Circular dependency detection (DFS for transitive cycles)
- [x] Server-side MIME validation + magic bytes check
- [x] All features have integration tests passing (56/56 tests)
