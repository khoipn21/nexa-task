# Phase 4: View Preference Sync

**Priority:** Medium | **Status:** ⬜ Pending | **Depends on:** Phase 1 | **Parallel with:** Phases 5-7

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
- `apps/web/src/lib/api.ts` - Add preference endpoints

## Implementation Steps

1. Create `use-view-preference.ts` hook:
   - Read from localStorage on mount
   - Fetch from API in background
   - Debounced save to both storage layers
2. Add API functions in `lib/api.ts`:
   - `getViewPreference(projectId)`
   - `setViewPreference(projectId, mode)`
3. Update `view-switcher.tsx`:
   - Use hook instead of local state
   - Pass projectId prop

## Todo List

- [ ] Create useViewPreference hook
- [ ] Add localStorage read/write
- [ ] Add API integration with debounce
- [ ] Update view-switcher component
- [ ] Test cross-device sync

## Success Criteria

- [ ] Switching view persists after refresh
- [ ] View syncs to another device within 5s
- [ ] Works offline with localStorage
- [ ] No flicker on page load

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Race condition | Debounce + optimistic updates |
| Stale cache | Short TTL (1hr), refetch on focus |

## Security Considerations

- Validate viewMode enum on backend
- User can only access own preferences

## Next Steps

Integrate with project page component.
