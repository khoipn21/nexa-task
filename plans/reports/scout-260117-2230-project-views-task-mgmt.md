# Scout Report: Project Views & Advanced Task Management

**Date:** 2026-01-17 | **Scope:** Module B (Views) + Module C (Task Mgmt)

## Feature Status Matrix

| Feature | Backend | DB | Frontend | % |
|---------|:-------:|:--:|:--------:|:-:|
| Kanban Board | ✅ | ✅ | ✅ | 100 |
| List View | ✅ | ✅ | ✅ | 100 |
| Calendar View | ✅ | ✅ | ✅ | 100 |
| View Switcher | N/A | N/A | ✅ | 100 |
| Workflow Custom | ✅ | ✅ | ⚠️ | 90 |
| Rich Text (TipTap) | ✅ | ✅ | ✅ | 100 |
| Assignees | ✅ | ✅ | ✅ | 100 |
| Watchers | ✅ | ✅ | ❌ | 70 |
| Dependencies | ✅ | ✅ | ⚠️ | 80 |
| File Attachments | ✅ | ✅ | ❌ | 70 |

## Key Files

### Backend (apps/api)
- `src/routes/projects.ts` - Status CRUD (lines 96-177)
- `src/routes/tasks.ts` - Dependencies (131-164), Watchers (166-193), Attachments (195-240)
- `src/services/task.ts` - All business logic (351-489)
- `src/services/project.ts` - Default statuses (lines 11-16, 125-227)

### Frontend (apps/web)
- `src/components/project-views/kanban/` - Full kanban impl with @dnd-kit
- `src/components/project-views/list/task-table.tsx` - Table view
- `src/components/project-views/calendar/calendar-view.tsx` - Calendar grid
- `src/components/project-views/view-switcher.tsx` - Segmented control
- `src/components/task-detail/task-editor.tsx` - TipTap rich text
- `src/components/task-detail/task-sidebar.tsx` - Assignee selector
- `src/components/task-detail/task-dependencies.tsx` - View/remove only
- `src/components/task-detail/task-attachments.tsx` - View/delete only

### Database (packages/db)
- `src/schema/workflow-statuses.ts` - Custom columns per project
- `src/schema/task-dependencies.ts` - M2M blocking relations
- `src/schema/task-watchers.ts` - M2M subscribers
- `src/schema/attachments.ts` - File metadata

## Gaps to Implement

1. **Workflow Settings UI** - Modal to add/edit/reorder/delete statuses in project settings
2. **Watchers UI** - Watch/unwatch button + watchers list in task detail
3. **Dependency Add UI** - Task picker to add "blocked by" relations
4. **File Upload UI** - Dropzone component with drag-drop support

## Unresolved Questions

1. Should view preference persist in localStorage or user settings (backend)?
2. Watcher notifications: email, in-app, or websocket push?
3. UX for blocked tasks: visual indicator only or actually prevent actions?
