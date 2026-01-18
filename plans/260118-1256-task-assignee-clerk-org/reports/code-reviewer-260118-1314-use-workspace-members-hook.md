# Code Review: `useWorkspaceMembers` Hook

**File:** `apps/web/src/hooks/use-workspace.ts` (lines 45-83)
**Reviewer:** code-reviewer
**Date:** 2026-01-18

## Scope
- Reviewed: `useWorkspaceMembers` hook implementation
- Type definitions: `WorkspaceMember`, `MembershipResponse`
- Related: API client, backend service response structure

## Overall Assessment
Clean, type-safe implementation with proper React Query practices. No critical issues. Minor suggestions for improvement.

## ✅ Strengths
1. **Type Safety**: Strong typing with explicit generic `useQuery<WorkspaceMember[]>`
2. **Null Handling**: Correct `avatarUrl: m.user.avatarUrl ?? undefined` transformation
3. **Query Guard**: Proper `enabled: !!workspaceId` prevents invalid requests
4. **Caching**: Appropriate 5min staleTime for relatively static member data
5. **Clean Separation**: Types defined locally since not shared with other modules
6. **JSDoc**: Clear documentation of transformation purpose

## 🟡 Medium Priority Improvements

### 1. Error Boundary Consideration
Hook doesn't expose error handling. React Query returns `error` object but consumers may need guidance.

**Recommendation:** Add error handling example in JSDoc or expose typed error:
```typescript
// Current: implicit error handling via React Query
// Consider: Document expected error scenarios for consumers
```

### 2. Type Location
`MembershipResponse` defined locally but matches backend response. If reused elsewhere, move to `@repo/shared/types`.

**Current:** Local type definition (acceptable for single use)
**Future:** Consider shared types package if used in multiple places

### 3. Response Validation
No runtime validation of API response shape. Relies on type assertion.

**Risk:** Low - backend controlled, but could add runtime check for robustness
**Mitigation:** Backend returns consistent structure (verified in `workspace.service.ts:72-76`)

## 🟢 Low Priority Observations

### Caching Strategy
5-minute staleTime appropriate for member lists (infrequent changes). Consider:
- Invalidation on member add/remove mutations (not yet implemented)
- Background refetch on window focus (default React Query behavior)

### Query Key Structure
`['workspace-members', workspaceId]` follows React Query best practices:
- Hierarchical structure
- Unique per workspace
- Easy to invalidate

## Verified Behaviors
✅ TypeScript compilation passes (`bun run typecheck`)
✅ Backend returns expected structure: `{ id, userId, role, user: { id, name, avatarUrl } }`
✅ Transformation correctly extracts `user.id` as member `id`
✅ Null coalescing handles missing avatarUrl properly

## No Action Required
- Implementation meets requirements
- Type safety verified
- React Query patterns correct
- No security concerns

## Unresolved Questions
None
