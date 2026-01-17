# Phase 5: Workflow Settings UI

**Priority:** Medium | **Status:** ⬜ Pending | **Depends on:** Phase 1 | **Parallel with:** Phases 4,6,7

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

### Create
- `apps/web/src/components/project-settings/workflow-settings-modal.tsx`
- `apps/web/src/components/project-settings/sortable-status-item.tsx`
- `apps/web/src/components/project-settings/add-status-form.tsx`

### Modify
- `apps/web/src/routes/project.tsx` or settings panel - Add modal trigger

## Implementation Steps

1. Create `sortable-status-item.tsx`:
   - useSortable hook for drag handle
   - Inline edit for name/color
   - Delete button with confirmation
   - Checkbox for isDefault/isFinal
2. Create `add-status-form.tsx`:
   - TextInput for name
   - ColorInput for color
   - Submit creates via API
3. Create `workflow-settings-modal.tsx`:
   - DndContext + SortableContext wrapper
   - List of SortableStatusItem
   - handleDragEnd calls reorder API
   - Add form at bottom
4. Add trigger button to project header/settings
5. Wire up TanStack Query mutations

## Todo List

- [ ] Create SortableStatusItem component
- [ ] Create AddStatusForm component
- [ ] Create WorkflowSettingsModal component
- [ ] Add drag-drop with @dnd-kit
- [ ] Wire up create/update/delete/reorder API calls
- [ ] Add confirmation for delete
- [ ] Add modal trigger to project page

## Success Criteria

- [ ] Can add new status with custom color
- [ ] Can edit status name and color
- [ ] Can delete status (confirms if has tasks)
- [ ] Can drag to reorder
- [ ] Changes reflect immediately in kanban board

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Delete status with tasks | Show warning, reassign tasks option |
| Reorder fails | Rollback optimistic update, show error |

## Security Considerations

- Only PM/super_admin can access settings
- Validate color format on backend

## Next Steps

Test with kanban board to ensure columns update correctly.
