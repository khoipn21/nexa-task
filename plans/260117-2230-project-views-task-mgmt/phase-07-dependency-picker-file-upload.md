# Phase 7: Dependency Picker + File Upload

**Priority:** Medium | **Status:** ⬜ Pending | **Depends on:** Phase 1 | **Parallel with:** Phases 4,5,6

## Context Links

- [UI Components Research](../reports/researcher-260117-2237-ui-components.md)
- [Scout Report](../reports/scout-260117-2230-project-views-task-mgmt.md)

## Overview

Two missing UI components: task dependency picker + file upload dropzone.

## Key Insights

### Dependencies
- Backend exists (routes/tasks.ts:131-164)
- Current UI shows blockers but can't add new ones
- Need searchable task picker modal

### File Attachments
- Backend exists (routes/tasks.ts:195-240)
- Current UI shows files but can't upload
- Need Mantine Dropzone component

## Requirements

### Functional - Dependencies
- "Add Blocker" button opens modal
- Search/filter tasks in same project
- Select task to create dependency
- Prevent circular dependencies (backend validates)

### Functional - File Upload
- Drag-drop area in task detail
- Progress indicator during upload
- Support multiple files
- Preview after upload

### Non-Functional
- Max 10MB per file
- Accepted types: images, PDFs, docs, zips

## Architecture

```
Task Detail
├── Dependencies Section
│   ├── Blocked By list (existing)
│   └── Add Blocker button → TaskPickerModal
│
└── Attachments Section
    ├── File list (existing)
    └── Dropzone component
```

## Related Code Files

### Create
- `apps/web/src/components/task-detail/task-picker-modal.tsx`
- `apps/web/src/components/task-detail/file-dropzone.tsx`

### Modify
- `apps/web/src/components/task-detail/task-dependencies.tsx` - Add picker trigger
- `apps/web/src/components/task-detail/task-attachments.tsx` - Add dropzone

## Implementation Steps

### Dependencies
1. Create `task-picker-modal.tsx`:
   - Modal with search input
   - List of tasks (exclude current, exclude already-blocking)
   - Click to select → API call → close
2. Update `task-dependencies.tsx`:
   - Add "Add Blocker" button
   - Open modal on click
   - Refresh list after add

### File Upload
3. Create `file-dropzone.tsx`:
   - Mantine Dropzone component
   - onDrop → upload to API
   - Progress state
   - Error handling (size, type)
4. Update `task-attachments.tsx`:
   - Add FileDropzone above list
   - Refresh list after upload

## Todo List

- [ ] Create TaskPickerModal component
- [ ] Add search/filter for tasks
- [ ] Wire up add dependency API
- [ ] Update task-dependencies with add button
- [ ] Create FileDropzone component
- [ ] Wire up file upload API
- [ ] Add progress indicator
- [ ] Update task-attachments with dropzone

## Success Criteria

- [ ] Can search and select blocking task
- [ ] Circular dependency rejected with error
- [ ] Dependency appears immediately after add
- [ ] Can drag files to upload
- [ ] Progress shown during upload
- [ ] File appears in list after upload
- [ ] Large files (>10MB) rejected with error

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Large file upload timeout | Increase timeout, chunked upload (future) |
| Task picker slow with many tasks | Debounced search, pagination |

## Security Considerations

- Validate file types on backend
- Scan for malware (future)
- Check storage quota (future)

## Next Steps

Integration testing with real files and dependency chains.
