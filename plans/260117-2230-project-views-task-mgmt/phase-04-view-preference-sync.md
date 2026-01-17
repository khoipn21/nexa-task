# Phase 4: View Preference Sync

**Priority:** Medium | **Status:** ✅ Done | **Depends on:** Phase 1 | **Parallel with:** Phases 5-7

## Context Links

- [Scout Report](../reports/scout-260117-2230-project-views-task-mgmt.md)

## Overview

Sync view preference (kanban/list/calendar) via Redis + localStorage for cross-device persistence.

## Key Insights

- user_project_preferences table created in Phase 1
- localStorage for immediate response
- Redis for cross-device sync via API
- Fallback: localStorage if API fails

## Requirements

### Functional
- Remember last view mode per project
- Sync across devices via API/Redis
- Fall back to localStorage if offline

### Non-Functional
- <50ms local read, <200ms remote sync
- Debounce saves (500ms)

## Architecture

```
View Change → localStorage (immediate)
           → Debounced API call → PostgreSQL + Redis cache

Page Load → localStorage first → API fetch → Update if different
```

## Related Code Files

### Create
- `apps/web/src/hooks/use-view-preference.ts`

### Modify
- `apps/web/src/components/project-views/view-switcher.tsx`
- `apps/web/src/routes/project-detail.tsx`
- `apps/api/src/services/notification.ts` (Redis caching)

## Implementation Steps

1. Create `use-view-preference.ts` hook:
   - Read from localStorage on mount
   - Fetch from API in background
   - Debounced save to both storage layers
2. Update `view-switcher.tsx`:
   - Use hook instead of URL params
   - Pass projectId prop
3. Update `project-detail.tsx`:
   - Use hook for view mode state
4. Add Redis caching to backend:
   - 1hr TTL for view preferences
   - Fallback to DB if Redis unavailable

## Todo List

- [x] Create useViewPreference hook
- [x] Add localStorage read/write
- [x] Add API integration with debounce
- [x] Update view-switcher component
- [x] Update project-detail page
- [x] Fix dependency array (stable callbacks via refs)
- [x] Add Redis caching to backend
- [x] Add race condition protection
- [x] Add flush pending on unmount
- [x] Add Redis error logging

## Success Criteria

- [x] Switching view persists after refresh
- [x] View syncs to another device via Redis (1hr cache TTL)
- [x] Works offline with localStorage
- [x] No flicker on page load
- [x] 32/32 unit tests passing

## Code Review

**Date:** 2026-01-18 03:25
**Score:** 9/10
**Status:** ✅ Approved

**Fixes Applied:**
1. Stable callbacks via refs (saveMutationRef)
2. Race condition protection (projectIdRef + reset on switch)
3. Flush pending save on unmount
4. Redis caching with 1hr TTL
5. Redis error logging

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Race condition | Refs + project switch detection |
| Stale cache | 1hr TTL, refetch on focus |
| Redis failure | Fallback to DB, error logging |

## Security Considerations

- Validate viewMode enum on backend (Zod schema)
- User can only access own preferences (requireWorkspace middleware)

## Next Steps

Integrate with Phase 6 (Watchers UI) for notification preferences.
