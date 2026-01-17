# Phase 5: Workflow Settings UI

**Priority:** Medium | **Status:** ✅ Done | **Depends on:** Phase 1 | **Parallel with:** Phases 4,6,7

## Context Links

- [UI Components Research](../reports/researcher-260117-2237-ui-components.md)
- [Scout Report](../reports/scout-260117-2230-project-views-task-mgmt.md) - Backend CRUD exists

## Overview

Modal UI for PMs to add/edit/delete/reorder workflow status columns.

## Key Insights

- Backend CRUD fully implemented (routes/projects.ts:96-177)
- Need sortable list with @dnd-kit
- Mantine ColorInput for color picker
- Flags: isDefault (initial status), isFinal (completion status)

## Requirements

### Functional
- Open modal from project settings
- Add new status with name + color
- Edit existing status name/color
- Delete status (with confirmation if tasks exist)
- Drag-to-reorder statuses
- Mark default/final flags

### Non-Functional
- Optimistic updates for reorder
- Confirm before deleting status with tasks

## Architecture

```
Project Settings → "Manage Statuses" button → Modal
                                               ↓
                            Sortable status list (DndContext)
                                               ↓
                            Add/Edit inline form → API calls
```

## Related Code Files

### Created
- `apps/web/src/hooks/use-workflow-statuses.ts` - React Query hooks for CRUD + reorder
- `apps/web/src/components/project-settings/workflow-settings-modal.tsx` - Main modal with DndContext
- `apps/web/src/components/project-settings/sortable-status-item.tsx` - Draggable status item with inline edit
- `apps/web/src/components/project-settings/add-status-form.tsx` - New status form

### Modified
- `apps/web/src/routes/project-detail.tsx` - Added settings icon trigger

## Implementation Steps

1. Create `use-workflow-statuses.ts` hook:
   - useWorkflowStatuses for fetching
   - useCreateStatus, useUpdateStatus, useDeleteStatus
   - useReorderStatuses with optimistic updates
2. Create `sortable-status-item.tsx`:
   - useSortable hook for drag handle
   - Inline edit for name/color
   - Delete button with window.confirm
   - Checkbox for isDefault/isFinal
3. Create `add-status-form.tsx`:
   - TextInput for name
   - ColorInput for color
   - Submit creates via API
4. Create `workflow-settings-modal.tsx`:
   - DndContext + SortableContext wrapper
   - List of SortableStatusItem
   - handleDragEnd calls reorder API
   - Add form at bottom
5. Add trigger button to project header/settings
6. Wire up TanStack Query mutations

## Todo List

- [x] Create useWorkflowStatuses hooks
- [x] Create SortableStatusItem component
- [x] Create AddStatusForm component
- [x] Create WorkflowSettingsModal component
- [x] Add drag-drop with @dnd-kit
- [x] Wire up create/update/delete/reorder API calls
- [x] Add confirmation for delete
- [x] Add modal trigger to project page

## Success Criteria

- [x] Can add new status with custom color
- [x] Can edit status name and color
- [x] Can delete status (confirms if has tasks)
- [x] Can drag to reorder
- [x] Changes reflect immediately in kanban board

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Delete status with tasks | Show warning via window.confirm |
| Reorder fails | Rollback optimistic update, show error |

## Security Considerations

- Only PM/super_admin can access settings (requirePermission middleware)
- Validate color format on backend (Zod regex)

## Next Steps

Integrate with Phase 6 (Watchers UI) for watcher notifications on status changes.
