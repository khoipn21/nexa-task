# Phase 8: Integration & Testing

**Priority:** High | **Status:** ⬜ Pending | **Depends on:** Phases 2-7

## Context Links

- All phase files in this plan directory

## Overview

End-to-end testing, bug fixes, and final integration.

## Key Insights

- All features implemented in Phases 1-7
- Need integration tests for notification flow
- Need E2E tests for critical paths
- Code review and simplification pass

## Requirements

### Functional
- All features work together correctly
- Notifications trigger correctly for watchers
- View preferences sync correctly
- No regressions in existing features

### Non-Functional
- Test coverage >80%
- E2E tests pass
- No TypeScript errors
- Biome lint passes

## Test Scenarios

### Notification Flow
1. User A watches task
2. User B updates task status
3. User A receives in-app notification
4. User A receives email (if enabled)

### View Preference
1. User selects calendar view
2. User refreshes page → still calendar
3. User logs in on different device → calendar synced

### Workflow Settings
1. PM adds new status column
2. Kanban board shows new column
3. Tasks can be dragged to new column

### Dependencies
1. Add task B as blocker for task A
2. Try to complete task A → warning shown
3. Complete task B → task A unblocked

### File Upload
1. Drag file to dropzone
2. Progress shown
3. File appears in list
4. Can delete file

## Related Code Files

### Create
- `apps/api/tests/integration/notifications.test.ts`
- `apps/web/tests/e2e/notifications.spec.ts`
- `apps/web/tests/e2e/workflow-settings.spec.ts`
- `apps/web/tests/e2e/file-upload.spec.ts`

## Implementation Steps

1. Write integration tests for notification service
2. Write E2E tests for notification bell + dropdown
3. Write E2E tests for workflow settings modal
4. Write E2E tests for file upload
5. Write E2E tests for dependency picker
6. Run full test suite, fix failures
7. Run `bun run typecheck` and fix errors
8. Run `bun run lint:fix` and resolve issues
9. Code review pass with code-reviewer agent
10. Simplification pass with code-simplifier agent

## Todo List

- [ ] Write notification integration tests
- [ ] Write notification E2E tests
- [ ] Write workflow settings E2E tests
- [ ] Write file upload E2E tests
- [ ] Write dependency picker E2E tests
- [ ] Fix all test failures
- [ ] Fix TypeScript errors
- [ ] Fix lint issues
- [ ] Code review
- [ ] Code simplification

## Success Criteria

- [ ] All tests pass
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] No console errors in browser
- [ ] Code review approves changes

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Flaky E2E tests | Retry logic, proper waits |
| Integration issues | Incremental testing during phases |

## Security Considerations

- Test permission boundaries
- Test unauthorized access attempts
- Verify no data leaks between users

## Next Steps

Merge to main, update documentation, deploy.
