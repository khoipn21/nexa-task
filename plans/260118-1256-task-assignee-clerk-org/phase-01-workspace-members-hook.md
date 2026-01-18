---
phase: 1
title: "Frontend Workspace Members Hook"
status: completed
effort: 30min
completed: 2026-01-18
---

# Phase 1: Frontend Workspace Members Hook

## Context

- [Existing hook file](../../apps/web/src/hooks/use-workspace.ts)
- [API endpoint](../../apps/api/src/routes/workspaces.ts#L50-55)
- [Service implementation](../../apps/api/src/services/workspace.ts#L72-77)

## Overview

Create `useWorkspaceMembers` hook to fetch workspace members for the assignee dropdown.

## API Response Format

Current `GET /workspaces/:id/members` returns:
```typescript
{
  id: string
  workspaceId: string
  userId: string
  role: 'super_admin' | 'pm' | 'member' | 'guest'
  user: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
}[]
```

## Target Member Format

UI components expect:
```typescript
type Member = {
  id: string      // user.id (NOT membership.id)
  name: string
  avatarUrl?: string
}
```

## Implementation

### File: `apps/web/src/hooks/use-workspace.ts`

Add to existing file:

```typescript
export type WorkspaceMember = {
  id: string
  name: string
  avatarUrl?: string
}

type MembershipResponse = {
  id: string
  userId: string
  role: string
  user: {
    id: string
    name: string
    avatarUrl: string | null
  }
}

export function useWorkspaceMembers(workspaceId?: string) {
  return useQuery<WorkspaceMember[]>({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => {
      const memberships: MembershipResponse[] = await api.get(
        `/workspaces/${workspaceId}/members`
      )
      return memberships.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl ?? undefined,
      }))
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5min cache
  })
}
```

## Todo

- [x] Add `WorkspaceMember` type export
- [x] Add `MembershipResponse` type (internal)
- [x] Implement `useWorkspaceMembers` hook
- [x] Transform response to UI-expected format
- [x] Set 5min staleTime for caching

## Success Criteria

- Hook returns `{ data: WorkspaceMember[], isLoading, isError }`
- Data format matches `Member` type in task-sidebar
- Query disabled when no workspaceId
