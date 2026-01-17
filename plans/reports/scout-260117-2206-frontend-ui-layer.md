# Scout Report: Frontend & UI Layer

**Date:** 2026-01-17  
**Scope:** `/mnt/k/Work/nexa-task/apps/web/` (70 files) + `/mnt/k/Work/nexa-task/packages/ui/` (4 files)

---

## 1. Directory Structure

### `/apps/web/src/`
```
src/
├── components/          # Feature components (~1227 lines total)
│   ├── comments/       # Activity timeline, comment editor, items, section
│   ├── dashboard/      # Stats cards, activity feed, recent tasks
│   ├── layouts/        # App shell with header/navbar
│   ├── project-views/  # Kanban, list, calendar views
│   │   ├── kanban/     # Board, column, task card, inline add
│   │   ├── list/       # Task table
│   │   └── calendar/   # Calendar view
│   ├── projects/       # Project card, list, create modal
│   └── task-detail/    # Panel, editor, sidebar, attachments, dependencies
├── hooks/              # React Query hooks
│   ├── use-auth.ts
│   ├── use-comments.ts
│   ├── use-debounce.ts
│   ├── use-projects.ts
│   ├── use-tasks.ts
│   └── use-workspace.ts
├── lib/                # Utilities
│   ├── api.ts          # API client
│   ├── auth-sync.tsx   # Clerk token sync
│   └── query-client.ts # TanStack Query setup
├── routes/             # Route components
│   ├── index.tsx       # Router config
│   ├── dashboard.tsx
│   ├── project-detail.tsx
│   ├── projects.tsx
│   └── settings.tsx
├── styles/             # Empty directory
├── main.tsx            # App entry point
└── index.css           # CSS layer imports
```

### `/packages/ui/src/`
```
src/
├── button.tsx          # Mantine Button wrapper
└── index.ts            # Export barrel (1 export)
```

---

## 2. Technology Stack

### Core Framework
- **Bundler:** Vite 6.0
- **Framework:** React 19.0 (not Next.js)
- **Routing:** React Router 7.1 (createBrowserRouter)
- **Language:** TypeScript 5.7

### UI & Styling
- **Component Library:** Mantine 7.16 (core) + 8.3.12 (dates, form, notifications)
- **CSS Framework:** Tailwind CSS 4.0 with Vite plugin
- **Icons:** Tabler Icons React 3.36
- **CSS Architecture:** CSS Layers (theme → base → mantine → components → utilities)
- **Font:** Inter (system fallback)

### State & Data
- **Data Fetching:** TanStack React Query 5.64
- **State Management:** Zustand 5.0.10
- **Auth:** Clerk React 5.20
- **Form Management:** Mantine Form 8.3.12

### Rich Features
- **Drag & Drop:** @dnd-kit (core, sortable, utilities)
- **Rich Text:** TipTap 3.15 (react, starter-kit, extensions for links, placeholders, tasks)
- **Animations:** GSAP 3.12
- **Date Handling:** date-fns 4.1

### Testing
- **Unit Tests:** Vitest 3.0
- **E2E Tests:** Playwright 1.57

### Dev Server
- **Port:** 5173
- **API Proxy:** `/api` → `http://localhost:3001`

---

## 3. Architecture Patterns

### Component Structure
- **Feature-based organization** (comments, dashboard, projects, task-detail)
- **View pattern separation** (kanban, list, calendar)
- **Component size:** ~1227 lines across 23 components (~53 lines/component avg)

### Routing Approach
- **Protected routes** via `ProtectedRoute` wrapper (Clerk `SignedIn`/`SignedOut`)
- **Nested routes** under `AppShellLayout`
- **Route structure:**
  - `/sign-in/*` → Clerk SignIn (public)
  - `/sign-up/*` → Clerk SignUp (public)
  - `/` → Protected layout
    - `/dashboard`
    - `/projects`
    - `/projects/:id`
    - `/settings`
- **Default redirect:** `/` → `/dashboard`

### Data Fetching Patterns
- **Custom hooks** wrapping TanStack Query (use-tasks, use-projects, etc.)
- **Optimistic updates** (e.g., `useMoveTask` with `onMutate`, `onError` rollback)
- **Query invalidation** for cache synchronization
- **API client singleton** (`api.ts`) with bearer token auth

### Layout System
- **Mantine AppShell** with header + collapsible navbar
- **Responsive breakpoint:** `sm` (mobile navbar collapses)
- **Header height:** 60px, Navbar width: 250px
- **Navbar items:** Dashboard, Projects, Settings

### Authentication Flow
1. Clerk handles auth UI (`/sign-in`, `/sign-up`)
2. `AuthSync` component syncs Clerk token → API client
3. Token passed via `Authorization: Bearer` header
4. Protected routes check `isSignedIn` state

---

## 4. Key Files Analysis

### `/apps/web/package.json`
**Dependencies highlights:**
- Clerk, Mantine, TanStack Query, React Router, Zustand, TipTap, dnd-kit, GSAP, Tabler Icons
- Workspace packages: `@repo/shared`, `@repo/ui`

**Scripts:**
- `dev`: Vite dev server
- `build`: TypeScript build → Vite build
- `test`: Vitest unit tests
- `test:e2e`: Playwright e2e tests

### `/apps/web/vite.config.ts`
- React plugin + Tailwind Vite plugin
- Path alias: `@` → `./src`
- Dev server port 5173
- API proxy to localhost:3001

### `/apps/web/src/main.tsx`
**Provider hierarchy:**
```tsx
<ClerkProvider>
  <AuthSync>
    <QueryClientProvider>
      <MantineProvider theme={customTheme}>
        <Notifications />
        <RouterProvider />
```

**Theme:** Primary color blue, font Inter

### `/apps/web/src/lib/api.ts`
- Singleton `ApiClient` class
- Token management via `setToken()`
- RESTful methods: `get`, `post`, `patch`, `delete`
- Query params support
- Error handling: `ApiError` with status code
- Response structure: `{ data: T }`

### `/apps/web/src/index.css`
**CSS Layers (order matters):**
1. `theme` - Tailwind theme
2. `base` - Tailwind preflight
3. `mantine` - Mantine styles
4. `components` - Custom components
5. `utilities` - Tailwind utilities

### `/packages/ui/package.json`
- Simple wrapper library
- Peer deps: React 19
- Direct deps: Mantine core + hooks
- Export entry: `./src/index.ts`

---

## 5. Pages/Routes Discovery

### Public Routes
- `/sign-in/*` - Clerk authentication (centered layout)
- `/sign-up/*` - Clerk registration (centered layout)

### Protected Routes (AppShell layout)
- `/` - Redirects to `/dashboard`
- `/dashboard` - Overview with stats, activity feed, recent tasks
- `/projects` - Project list view
- `/projects/:id` - Project detail with kanban/list/calendar views
- `/settings` - User settings

### Navigation Structure
**Header:**
- Logo: "Nexa Task"
- Organization switcher (Clerk)
- User button (Clerk)
- Burger menu (mobile)

**Navbar:**
- Dashboard
- Projects
- Settings

---

## 6. UI Components

### Shared Components (`@repo/ui`)
**Current state:** Minimal (7 lines total)
- `Button.tsx` - Thin wrapper around `MantineButton`
- `index.ts` - Single export

**Purpose:** Shared UI primitives for monorepo (currently underutilized)

### Application Components (`apps/web`)

#### Comments (`src/components/comments/`)
- `activity-timeline.tsx` - Activity feed timeline
- `comment-editor.tsx` - TipTap-based comment input
- `comment-item.tsx` - Individual comment display
- `comments-section.tsx` - Full comment thread UI

#### Dashboard (`src/components/dashboard/`)
- `stats-cards.tsx` - Responsive grid of stat cards (Mantine SimpleGrid)
- `activity-feed.tsx` - Recent activity list
- `recent-tasks.tsx` - Quick task overview

#### Layouts (`src/components/layouts/`)
- `app-shell.tsx` - Main app layout with header/navbar (Mantine AppShell)

#### Project Views (`src/components/project-views/`)
- `view-switcher.tsx` - Toggle between kanban/list/calendar
- **Kanban:**
  - `kanban-board.tsx` - DndContext with drag handlers, status grouping
  - `kanban-column.tsx` - Droppable column
  - `task-card.tsx` - Draggable task card
  - `add-task-inline.tsx` - Inline task creation
- **List:**
  - `task-table.tsx` - Tabular task view
- **Calendar:**
  - `calendar-view.tsx` - Calendar-based task view (Mantine dates)

#### Projects (`src/components/projects/`)
- `project-list.tsx` - Grid/list of projects
- `project-card.tsx` - Individual project card
- `create-project-modal.tsx` - Project creation modal (Mantine Modal + Form)

#### Task Detail (`src/components/task-detail/`)
- `task-detail-panel.tsx` - Main task detail container
- `task-editor.tsx` - TipTap rich text editor
- `task-sidebar.tsx` - Metadata sidebar (assignee, dates, priority)
- `task-attachments.tsx` - File attachments UI
- `task-dependencies.tsx` - Task relationships

### Design System Approach
**Hybrid pattern:**
- **Mantine components** for structural UI (Paper, Group, Grid, AppShell, Modal, etc.)
- **Tailwind utilities** for spacing, flex, responsive classes
- **CSS Layers** prevent style conflicts
- **No custom design system** - leverages Mantine's theming

### Component Patterns
1. **Container/Presentational** - Hooks in containers, pure display components
2. **Custom hooks** - Encapsulate React Query logic (use-tasks, use-projects)
3. **Composition** - Small focused components composed together
4. **TypeScript** - Strict typing with interfaces for props
5. **Optimistic UI** - Mutations with rollback for drag-drop

---

## Summary

**Web App:**
- Vite + React 19 SPA with React Router 7
- Mantine UI library + Tailwind CSS (hybrid approach)
- Clerk authentication with token sync
- TanStack Query for server state
- Feature-rich: drag-drop (dnd-kit), rich text (TipTap), animations (GSAP)
- ~1227 lines of components across 23 files (~53 lines avg)
- 5 main routes (sign-in, sign-up, dashboard, projects, settings)

**UI Package:**
- Minimal shared library (7 lines)
- Currently 1 component (Button wrapper)
- Ready for expansion with more shared primitives

**Key Architectural Decisions:**
- React Router over Next.js (SPA, not SSR)
- Mantine over shadcn/ui (integrated component library)
- CSS Layers for style isolation
- Custom hooks pattern for data fetching
- Optimistic updates for UX
