# Clerk Organization Membership API Research

**Date:** 2026-01-18
**Researcher:** researcher-260118-1256
**Focus:** Clerk organization membership fetching for task assignee dropdown

---

## Backend SDK - Organization Members

### Primary API: `getOrganizationMembershipList`

Two usage patterns:

**1. By Organization ID** (recommended for task assignment):
```typescript
const memberships = await clerkClient.organizations.getOrganizationMembershipList({
  organizationId: 'org_xxx',
  limit: 100,        // default 10, max 500
  offset: 0,         // pagination
});
```

**Optional filters:**
- `nameQuery` (string) - filter by member name
- `lastActiveAtBefore` (number, ms) - filter by session activity
- `lastActiveAtAfter` (number, ms) - filter by session activity

**2. By User ID** (for user's org memberships):
```typescript
const memberships = await clerkClient.organizations.getOrganizationMembershipList({
  userId: 'user_xxx',
  limit: 100,
  offset: 0,
});
```

**Endpoints:**
- `GET /organizations/{organization_id}/memberships`
- `GET /users/{user_id}/organization_memberships`

---

## Response Structure

**Type:** `PaginatedResourceResponse`

```typescript
{
  data: OrganizationMembership[],
  totalCount: number
}
```

**OrganizationMembership object:**
```typescript
{
  id: string,
  organizationId: string,
  role: 'org:admin' | 'org:member' | string,  // custom roles possible
  publicUserData: {
    userId: string,
    firstName: string | null,
    lastName: string | null,
    imageUrl: string,
    identifier: string,  // email or phone
  },
  createdAt: number,
  updatedAt: number,
  // Methods:
  update(),   // change role
  destroy(),  // remove member
}
```

---

## Frontend - React Hooks

### `useOrganization` Hook

**Critical:** Membership data NOT populated by default (optimization).

**Explicit request required:**
```typescript
import { useOrganization } from '@clerk/nextjs';

const { isLoaded, organization, memberships } = useOrganization({
  memberships: true,  // REQUIRED to fetch members
});
```

**With pagination/filtering:**
```typescript
const { memberships } = useOrganization({
  memberships: {
    pageSize: 50,
    initialPage: 1,
    keepPreviousData: true,  // smoother UX during pagination
    role: 'org:member',      // filter by role
    query: 'john',           // search by name
  },
});
```

**Returns:** `PaginatedResources` object
```typescript
{
  data: OrganizationMembership[],
  totalCount: number,
  fetchNext: () => Promise<void>,
  fetchPrevious: () => Promise<void>,
  fetchPage: (page: number) => Promise<void>,
}
```

**Usage example:**
```typescript
memberships?.data.map((member) => (
  <option key={member.id} value={member.publicUserData.userId}>
    {member.publicUserData.firstName} {member.publicUserData.lastName}
  </option>
))
```

---

## Rate Limits & Best Practices

### Pagination
- Default limit: 10
- Max limit: 500 per request
- Use pagination for orgs with many members

### Performance
- Frontend: Only request memberships when needed (pass `memberships: true`)
- Backend: Cache membership lists if frequently accessed
- Use `nameQuery` for server-side filtering (more efficient than client-side)

### Best Practices
1. **Task assignment dropdown**: Fetch on component mount, cache in state
2. **Large orgs**: Implement search with `nameQuery` filter
3. **Role filtering**: Use `role` param if only certain roles can be assigned
4. **Error handling**: Check `isLoaded` before accessing data
5. **Loading states**: Show skeleton while `!isLoaded`

---

## Implementation Approach for Task Assignee

**Recommended pattern:**

1. **Backend endpoint** (optional, for search/filtering):
   ```typescript
   GET /api/workspaces/:workspaceId/members?search=john&limit=20
   ```
   - Fetch from Clerk via `getOrganizationMembershipList`
   - Apply filters server-side
   - Return simplified member list

2. **Frontend dropdown**:
   - Use `useOrganization({ memberships: { pageSize: 100 } })`
   - Extract `publicUserData` for display
   - Store `userId` as task assignee value
   - Implement autocomplete for large member lists

3. **Data format for UI**:
   ```typescript
   interface AssigneeOption {
     userId: string;
     name: string;
     imageUrl: string;
     email: string;
   }
   ```

---

## Unresolved Questions

1. **Rate limit specifics** - Clerk docs don't specify exact rate limits for organization API
2. **Webhook notifications** - Need to verify if org membership changes trigger webhooks for cache invalidation
3. **Custom role support** - Confirm if custom org roles beyond `org:admin`/`org:member` work with filtering

---

**Sources:**
- Clerk Backend SDK docs (Jan 2026)
- Clerk React hooks docs (Jan 2026)
- Context7 Clerk documentation
