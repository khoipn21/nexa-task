# Nexa Task - Tech Stack

## Overview
Internal task management platform for development and product teams.

## Stack Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| Runtime | Bun | Fast JS/TS runtime |
| Backend | Hono | Lightweight web framework |
| Frontend | React (Vite) | SPA framework |
| UI Library | Mantine v7 | Component library |
| Styling | Tailwind CSS v4 | Utility-first CSS |
| Animation | GSAP | UI animations |
| Database | PostgreSQL | Relational data store |
| ORM | Drizzle | Type-safe SQL |
| Cache | Redis | Session/cache store |
| Auth | Clerk | Authentication + RBAC |
| State | TanStack Query | Server state management |
| Routing | React Router v7 | Client-side routing |
| Monorepo | Turborepo | Build orchestration |
| Container | Docker | Deployment |

## Architecture

```
nexa-task/
├── apps/
│   ├── web/          # React frontend
│   └── api/          # Hono backend
├── packages/
│   ├── db/           # Drizzle schema + migrations
│   ├── shared/       # Shared types + utils
│   └── ui/           # Shared UI components
├── docker/
└── turbo.json
```

## Key Decisions

### Why Bun + Hono?
- Single runtime for frontend build + backend
- Hono's edge-ready design, fast routing
- Native WebSocket support for real-time

### Why Drizzle over Prisma?
- Better Bun compatibility
- SQL-first approach, lighter bundle
- Type-safe without code generation overhead

### Why Clerk for Auth?
- Built-in RBAC, organizations
- SSO support (Google, Azure AD)
- Invitation system included
- React + backend SDKs

### Why Mantine + Tailwind?
- Mantine: Rich components (DataGrid, RichText, DatePicker)
- Tailwind v4: Custom styling, animations
- Compatible via CSS layers

## Real-Time Strategy
- Hono WebSocket for task updates
- Redis pub/sub for multi-instance sync
- Optimistic UI updates with TanStack Query
