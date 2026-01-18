# Phase 7: Dependency Picker + File Upload

**Priority:** Medium | **Status:** ✅ Done (2026-01-18) | **Depends on:** Phase 1 | **Parallel with:** Phases 4,5,6

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

- [x] Create TaskPickerModal component
- [x] Add search/filter for tasks
- [x] Wire up add dependency API
- [x] Update task-dependencies with add button
- [x] Create FileDropzone component
- [x] Wire up file upload API (multipart with S3)
- [x] Add progress indicator with status colors
- [x] Update task-attachments with dropzone

## Security Fixes Applied

- [x] **Critical #1**: Replace blob URLs with real S3 file upload
- [x] **Critical #2**: Server-side MIME validation + magic bytes check
- [x] **Warning**: Transitive circular dependency detection (DFS algorithm)
- [x] Upload progress with success/error status
- [x] Recovery summary for batch upload failures

## Success Criteria

- [x] Can search and select blocking task
- [x] Circular dependency rejected with error (including transitive cycles)
- [x] Dependency appears immediately after add
- [x] Can drag files to upload
- [x] Progress shown during upload
- [x] File appears in list after upload
- [x] Large files (>10MB) rejected with error
- [x] Invalid MIME types rejected by server

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
