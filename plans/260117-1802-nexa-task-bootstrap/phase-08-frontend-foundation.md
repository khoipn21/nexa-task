# Phase 08: Frontend Foundation

## Context Links
- [React + Mantine Research](../reports/researcher-260117-1758-react-mantine-tailwind.md)
- [Phase 07: Real-time Layer](./phase-07-realtime-layer.md)

## Overview
- **Priority**: P2
- **Status**: pending
- **Effort**: 8h

Setup React frontend with Clerk auth, TanStack Query, routing, and shared UI foundation.

## Key Insights
- Clerk Provider wraps app for auth
- TanStack Query for server state
- React Router v7 for routing
- Mantine + Tailwind via CSS layers
- API client with auth headers

## Requirements

### Functional
- Authentication flow (sign in/up/out)
- Protected routes
- Organization switching
- Global loading/error states
- Toast notifications

### Non-Functional
- Bundle size < 200KB (gzipped)
- First paint < 1.5s
- Type-safe API client

## Architecture

```
apps/web/src/
├── main.tsx                  # Entry point
├── App.tsx                   # Root component
├── routes/                   # Route definitions
│   ├── index.tsx             # Route config
│   ├── _auth.tsx             # Auth layout
│   ├── _app.tsx              # App layout (authenticated)
│   ├── sign-in.tsx
│   ├── sign-up.tsx
│   ├── dashboard.tsx
│   └── ...
├── components/
│   ├── ui/                   # Base components
│   ├── layouts/              # Layout components
│   └── common/               # Shared components
├── hooks/
│   ├── use-auth.ts
│   ├── use-api.ts
│   └── use-websocket.ts
├── lib/
│   ├── api.ts                # API client
│   ├── query-client.ts
│   └── utils.ts
├── stores/                   # Zustand stores (if needed)
└── styles/
    └── index.css
```

## Related Code Files

### Create
- `/apps/web/src/App.tsx`
- `/apps/web/src/lib/api.ts`
- `/apps/web/src/lib/query-client.ts`
- `/apps/web/src/hooks/use-auth.ts`
- `/apps/web/src/routes/index.tsx`
- `/apps/web/src/routes/_auth.tsx`
- `/apps/web/src/routes/_app.tsx`
- `/apps/web/src/routes/sign-in.tsx`
- `/apps/web/src/routes/dashboard.tsx`
- `/apps/web/src/components/layouts/app-shell.tsx`
- `/apps/web/src/components/layouts/sidebar.tsx`

### Modify
- `/apps/web/src/main.tsx`
- `/apps/web/package.json`

## Implementation Steps

### 1. Install Dependencies
```bash
cd apps/web
bun add @clerk/clerk-react @tanstack/react-query react-router zustand
bun add -D @tanstack/react-query-devtools
```

### 2. API Client
**apps/web/src/lib/api.ts**:
```typescript
const API_BASE = import.meta.env.VITE_API_URL || '/api'

type FetchOptions = RequestInit & {
  params?: Record<string, string>
}

class ApiClient {
  private token: string | null = null

  setToken(token: string | null) {
    this.token = token
  }

  async fetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { params, ...init } = options
    let url = `${API_BASE}${endpoint}`

    if (params) {
      const searchParams = new URLSearchParams(params)
      url += `?${searchParams.toString()}`
    }

    const headers = new Headers(init.headers)
    headers.set('Content-Type', 'application/json')

    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`)
    }

    const response = await fetch(url, { ...init, headers })
    const data = await response.json()

    if (!response.ok) {
      throw new ApiError(data.error?.message || 'Request failed', response.status, data.error)
    }

    return data.data
  }

  get<T>(endpoint: string, params?: Record<string, string>) {
    return this.fetch<T>(endpoint, { method: 'GET', params })
  }

  post<T>(endpoint: string, body?: unknown) {
    return this.fetch<T>(endpoint, { method: 'POST', body: JSON.stringify(body) })
  }

  patch<T>(endpoint: string, body?: unknown) {
    return this.fetch<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) })
  }

  delete<T>(endpoint: string) {
    return this.fetch<T>(endpoint, { method: 'DELETE' })
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const api = new ApiClient()
```

### 3. Query Client
**apps/web/src/lib/query-client.ts**:
```typescript
import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status === 401) return false
        return failureCount < 3
      },
    },
    mutations: {
      onError: (error) => {
        console.error('Mutation error:', error)
      },
    },
  },
})
```

### 4. Auth Hook
**apps/web/src/hooks/use-auth.ts**:
```typescript
import { useAuth as useClerkAuth, useUser, useOrganization } from '@clerk/clerk-react'
import { useEffect } from 'react'
import { api } from '@/lib/api'

export function useAuth() {
  const { isLoaded, isSignedIn, getToken, signOut } = useClerkAuth()
  const { user } = useUser()
  const { organization } = useOrganization()

  // Sync token to API client
  useEffect(() => {
    if (isSignedIn) {
      getToken().then(token => api.setToken(token))
    } else {
      api.setToken(null)
    }
  }, [isSignedIn, getToken])

  return {
    isLoaded,
    isSignedIn,
    user,
    organization,
    signOut,
    getToken,
  }
}
```

### 5. App Shell Layout
**apps/web/src/components/layouts/app-shell.tsx**:
```tsx
import { AppShell, Burger, Group, NavLink, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Link, Outlet, useLocation } from 'react-router'
import { OrganizationSwitcher, UserButton } from '@clerk/clerk-react'

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: 'home' },
  { label: 'Projects', path: '/projects', icon: 'folder' },
  { label: 'Settings', path: '/settings', icon: 'settings' },
]

export function AppShellLayout() {
  const [opened, { toggle }] = useDisclosure()
  const location = useLocation()

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text fw={700} size="lg">Nexa Task</Text>
          </Group>
          <Group>
            <OrganizationSwitcher />
            <UserButton afterSignOutUrl="/sign-in" />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            component={Link}
            to={item.path}
            label={item.label}
            active={location.pathname.startsWith(item.path)}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
```

### 6. Route Configuration
**apps/web/src/routes/index.tsx**:
```tsx
import { createBrowserRouter, Navigate } from 'react-router'
import { SignIn, SignUp, SignedIn, SignedOut } from '@clerk/clerk-react'
import { AppShellLayout } from '@/components/layouts/app-shell'
import Dashboard from './dashboard'
import Projects from './projects'
import ProjectDetail from './project-detail'

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut><Navigate to="/sign-in" replace /></SignedOut>
    </>
  )
}

export const router = createBrowserRouter([
  // Auth routes
  {
    path: '/sign-in/*',
    element: <SignIn routing="path" path="/sign-in" />,
  },
  {
    path: '/sign-up/*',
    element: <SignUp routing="path" path="/sign-up" />,
  },

  // App routes (protected)
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShellLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'projects', element: <Projects /> },
      { path: 'projects/:id', element: <ProjectDetail /> },
    ],
  },
])
```

### 7. Main Entry
**apps/web/src/main.tsx**:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { ClerkProvider } from '@clerk/clerk-react'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { router } from './routes'
import { queryClient } from './lib/query-client'
import '@mantine/core/styles.layer.css'
import '@mantine/notifications/styles.css'
import './styles/index.css'

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={CLERK_KEY}>
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <Notifications />
          <RouterProvider router={router} />
        </MantineProvider>
        <ReactQueryDevtools />
      </QueryClientProvider>
    </ClerkProvider>
  </StrictMode>
)
```

### 8. Environment Variables
**apps/web/.env.example**:
```bash
VITE_API_URL=http://localhost:3001/api
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
VITE_WS_URL=ws://localhost:3001/ws
```

## Todo List
- [ ] Install Clerk, TanStack Query, React Router
- [ ] Create API client with auth token sync
- [ ] Create query client with error handling
- [ ] Create useAuth hook
- [ ] Create AppShell layout with sidebar
- [ ] Configure routes with protection
- [ ] Setup main entry with providers
- [ ] Create environment variables
- [ ] Test auth flow end-to-end

## Success Criteria
- [x] Sign in/up flows work
- [x] Protected routes redirect unauthenticated
- [x] Org switcher changes context
- [x] API calls include auth token
- [x] Layout renders correctly

## Next Steps
- Phase 09: Dashboard + Workspace UI
