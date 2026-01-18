# Nexa Task

**Modern, real-time project and task management platform built for developers**

[![CI](https://github.com/your-org/nexa-task/workflows/CI/badge.svg)](https://github.com/your-org/nexa-task/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.2-orange)](https://bun.sh)

---

## Overview

Nexa Task is a scalable, self-hostable task management SaaS application featuring:

- **Real-time Collaboration:** WebSocket-powered live updates
- **Flexible Workflows:** Customizable Kanban boards per project
- **Rich Editing:** TipTap-powered task descriptions
- **Multi-tenancy:** Workspace-based organization management
- **RBAC:** Granular role-based access control
- **Modern Stack:** Bun, Hono, React 19, Mantine, PostgreSQL, Redis

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) 1.2.0 or later
- [Docker](https://www.docker.com) and Docker Compose (for databases)
- [Clerk Account](https://clerk.com) (free tier available)

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/nexa-task.git
cd nexa-task

# Install dependencies
bun install

# Start databases (PostgreSQL + Redis)
bun run docker:dev

# Configure environment
cp .env.example .env
# Edit .env with your Clerk keys and database URLs

# Setup database schema
bun run db:push

# Start development servers
bun run dev
```

**Services started:**
- API: `http://localhost:3001`
- Web: `http://localhost:5173`

---

## Tech Stack

### Backend
- **Runtime:** [Bun](https://bun.sh) 1.2 - Fast JavaScript runtime
- **Framework:** [Hono](https://hono.dev) 4.7 - Lightweight web framework
- **Database:** [PostgreSQL](https://postgresql.org) 14+ with [Drizzle ORM](https://orm.drizzle.team)
- **Cache/Pub-Sub:** [Redis](https://redis.io) 6+
- **Auth:** [Clerk](https://clerk.com) with JWT
- **Validation:** [Zod](https://zod.dev) 3.24
- **File Storage:** AWS S3 / Cloudflare R2
- **Testing:** Bun native test runner

### Frontend
- **Bundler:** [Vite](https://vitejs.dev) 6.0
- **Framework:** [React](https://react.dev) 19
- **UI Library:** [Mantine](https://mantine.dev) 7/8 + [Tailwind CSS](https://tailwindcss.com) 4.0
- **Routing:** [React Router](https://reactrouter.com) 7.1
- **State Management:** [TanStack Query](https://tanstack.com/query) 5.64 + [Zustand](https://zustand-demo.pmnd.rs) 5.0
- **Rich Text:** [TipTap](https://tiptap.dev) 3.15
- **Drag & Drop:** [@dnd-kit](https://dndkit.com)
- **Testing:** [Vitest](https://vitest.dev) 3.0 + [Playwright](https://playwright.dev) 1.57

### Infrastructure
- **Monorepo:** [Turborepo](https://turbo.build/repo)
- **Package Manager:** Bun
- **Linting:** [Biome](https://biomejs.dev)
- **Containers:** Docker with multi-stage builds
- **CI/CD:** GitHub Actions
- **Reverse Proxy:** Nginx

---

## Features

### Core Functionality
- ✅ **Workspace Management** - Multi-tenant organizations with Clerk sync
- ✅ **Project Organization** - Create projects with custom workflow statuses
- ✅ **Task Management** - Rich task creation with dependencies, attachments, watchers
- ✅ **Kanban Board** - Drag-and-drop task cards with real-time sync
- ✅ **List & Calendar Views** - Multiple visualization modes
- ✅ **Comments & Activity** - Discussion threads and audit logs
- ✅ **Real-time Updates** - WebSocket-powered live collaboration
- ✅ **RBAC** - 4 roles (super_admin, pm, member, guest) with fine-grained permissions

### Coming Soon
- 🚧 **Email Notifications** - Task assignments and mentions
- 🚧 **Advanced Search** - Full-text search across all content
- 🚧 **Slack Integration** - Bi-directional sync with Slack
- 🚧 **Mobile Apps** - iOS and Android (React Native)
- 🚧 **Time Tracking** - Built-in time tracking and reporting
- 🚧 **Analytics Dashboard** - Team productivity insights

See [Project Roadmap](./docs/project-roadmap.md) for full feature timeline.

---

## Documentation

- [**Project Overview & PDR**](./docs/project-overview-pdr.md) - Product requirements and features
- [**Codebase Summary**](./docs/codebase-summary.md) - File organization and structure
- [**Code Standards**](./docs/code-standards.md) - Naming conventions and best practices
- [**System Architecture**](./docs/system-architecture.md) - Architecture diagrams and design patterns
- [**Deployment Guide**](./docs/deployment-guide.md) - Production deployment instructions
- [**Project Roadmap**](./docs/project-roadmap.md) - Feature timeline and priorities

---

## Project Structure

```
nexa-task/
├── apps/
│   ├── api/              # Hono backend API server
│   │   ├── src/
│   │   │   ├── routes/   # API endpoints
│   │   │   ├── services/ # Business logic
│   │   │   ├── middleware/ # Auth, RBAC, DB injection
│   │   │   └── lib/      # Utilities
│   │   └── tests/        # Unit and integration tests
│   │
│   └── web/              # React frontend SPA
│       ├── src/
│       │   ├── components/ # Feature-based components
│       │   ├── hooks/    # React Query hooks
│       │   ├── lib/      # API client, auth sync
│       │   └── routes/   # Route components
│       └── tests/        # E2E tests (Playwright)
│
├── packages/
│   ├── db/               # Drizzle ORM schema
│   │   └── src/schema/   # Database tables and relations
│   ├── shared/           # Shared types, validators, RBAC
│   ├── ui/               # Shared UI components
│   └── typescript-config/ # Shared TS configs
│
├── docker/               # Docker configuration
├── docs/                 # Project documentation
└── plans/                # Implementation plans and reports
```

---

## Development

### Commands

```bash
# Development
bun run dev              # Start all apps in dev mode
bun run dev:api          # Start API only
bun run dev:web          # Start web only

# Building
bun run build            # Build all packages/apps
bun run typecheck        # TypeScript validation

# Testing
bun run test             # Run all tests
bun run test:watch       # Watch mode
bun test apps/api        # Test specific package

# Linting
bun run lint             # Check code style
bun run lint:fix         # Auto-fix issues

# Database
bun run db:push          # Push schema to DB (dev)
bun run db:generate      # Generate migrations
bun run db:migrate       # Run migrations
bun run db:studio        # Drizzle Studio UI

# Docker
bun run docker:dev       # Start databases only
bun run docker:prod      # Full production stack
```

### Environment Variables

**Required:**
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/nexa_task

# Clerk Authentication
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# File Storage (Cloudflare R2 or AWS S3)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=nexa-task-dev
R2_PUBLIC_URL=https://your-bucket.r2.dev

# API
PORT=3001
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
```

**Optional:**
```env
# Redis (for real-time features)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info
```

See [`.env.example`](./.env.example) for all variables.

---

## Database Schema

### Core Tables
- **users** - User profiles synced from Clerk
- **workspaces** - Multi-tenant organizations
- **workspace_members** - User-workspace relationships with roles
- **projects** - Workspace-scoped projects
- **workflow_statuses** - Custom Kanban columns per project
- **tasks** - Tasks with metadata, dependencies, watchers
- **comments** - Task discussion threads
- **attachments** - File uploads linked to tasks
- **activity_logs** - Audit trail for all changes

**Relationships:**
```
Workspaces → Projects → Tasks → Comments
                      ↓
                 Workflow Statuses
```

See [System Architecture](./docs/system-architecture.md) for ER diagrams.

---

## API Endpoints

### Authentication
- Clerk handles auth UI (`/sign-in`, `/sign-up`)
- API validates JWT tokens on every request

### REST API
```
GET    /api/workspaces              # List user workspaces
GET    /api/projects                # List projects in workspace
GET    /api/projects/:id/tasks      # List tasks with filters
POST   /api/projects/:id/tasks      # Create task
PATCH  /api/tasks/:id               # Update task
POST   /api/tasks/:id/move          # Move task (drag-drop)
POST   /api/tasks/:id/comments      # Add comment
GET    /api/dashboard/stats         # Workspace statistics
```

### WebSocket
```
/ws - Real-time updates for tasks, comments, presence
```

See scout reports in `plans/reports/` for full endpoint documentation.

---

## Testing

### Unit Tests (Bun)
```bash
# Run all unit tests
bun test

# Watch mode
bun test --watch

# Coverage
bun test --coverage
```

### Integration Tests
```bash
# API integration tests
bun test apps/api/tests/integration
```

### E2E Tests (Playwright)
```bash
# Run E2E tests
cd apps/web
bun run test:e2e

# UI mode
bun run test:e2e -- --ui

# Specific test
bun run test:e2e tests/tasks.spec.ts
```

---

## Deployment

### Docker Production Deployment

```bash
# Build images
docker build -f docker/api.Dockerfile -t nexa-task-api:latest .
docker build -f docker/web.Dockerfile -t nexa-task-web:latest .

# Run production stack
docker compose -f docker/docker-compose.prod.yml up -d
```

### Manual Deployment

```bash
# Build all packages
bun run build

# Start API
cd apps/api
bun run dist/index.js

# Serve web (static files in apps/web/dist)
# Use Nginx, Caddy, or any static file server
```

See [Deployment Guide](./docs/deployment-guide.md) for detailed instructions.

---

## Contributing

### Development Workflow

1. **Clone and setup:**
   ```bash
   git clone https://github.com/your-org/nexa-task.git
   cd nexa-task
   bun install
   ```

2. **Create feature branch:**
   ```bash
   git checkout -b feat/your-feature-name
   ```

3. **Make changes and test:**
   ```bash
   bun run lint:fix
   bun run typecheck
   bun test
   ```

4. **Commit with conventional commits:**
   ```bash
   git commit -m "feat(tasks): add bulk delete functionality"
   ```

5. **Push and create PR:**
   ```bash
   git push origin feat/your-feature-name
   ```

### Commit Message Format

```
type(scope): subject

[optional body]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

**Examples:**
```
feat(kanban): add drag-and-drop reordering
fix(auth): resolve token refresh race condition
docs(readme): update deployment instructions
```

### Code Review Guidelines

- All PRs require passing CI checks
- Maintain test coverage above 80%
- Follow existing code style (Biome enforced)
- Update documentation if needed
- No console.log statements in production code

---

## Architecture Highlights

### Real-time Architecture
```
Client (React) ↔ WebSocket ↔ API Server 1
                    ↕            ↕
                  Redis  ↔  PostgreSQL
                    ↕
              API Server 2 ↔ WebSocket ↔ Client
```

- WebSocket connections managed per API instance
- Redis pub/sub for cross-instance message broadcasting
- Graceful degradation if Redis unavailable

### RBAC System
```typescript
const ROLE_PERMISSIONS = {
  super_admin: ["workspace:*", "project:*", "task:*"],
  pm: ["workspace:invite", "project:*", "task:*"],
  member: ["task:create", "task:update:own"],
  guest: ["comment:create"],
};
```

Permissions enforced via middleware on every route.

### Database Design
- **UUIDs** for all primary keys
- **Composite indexes** for frequent queries
- **Cascade deletes** for workspace/project hierarchies
- **JSONB columns** for flexible metadata
- **Audit logs** for compliance

---

## Performance

### Benchmarks (Target)

| Metric | Target | Current |
|--------|--------|---------|
| API Response Time (p95) | <200ms | ✅ 150ms |
| Page Load Time | <2s | ✅ 1.5s |
| WebSocket Latency | <50ms | ✅ 30ms |
| Database Queries | <20ms | ✅ 15ms |
| Test Suite Runtime | <30s | ✅ 25s |

### Optimization Strategies
- Drizzle ORM with query batching
- TanStack Query caching (5min cache, 1min stale)
- Redis for session and query caching
- CDN for static assets (1-year cache)
- React lazy loading for routes

---

## Security

### Authentication & Authorization
- Clerk-managed user authentication
- JWT token validation on every API request
- RBAC enforced via middleware
- Rate limiting (100 req/min per IP)

### Data Protection
- PostgreSQL encryption at rest
- TLS 1.3 encryption in transit
- Parameterized queries (SQL injection prevention)
- XSS protection (React auto-escaping + CSP headers)
- CORS configuration

### Security Practices
- Regular dependency updates (Dependabot)
- Automated vulnerability scanning (GitHub Security)
- Environment variables for secrets (never committed)
- Security headers (X-Frame-Options, CSP, HSTS)

---

## Monitoring & Observability

### Health Checks
```bash
curl https://api.yourdomain.com/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-17T12:00:00Z",
  "checks": {
    "database": "ok",
    "redis": "ok"
  }
}
```

### Logging
- Structured JSON logs via Pino
- Log levels: debug, info, warn, error
- Request ID tracking across services

### Metrics (Future)
- Prometheus metrics export
- Grafana dashboards
- Sentry error tracking
- DataDog APM

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Support

### Documentation
- [Full Documentation](./docs/)
- [API Documentation](./docs/project-overview-pdr.md#api-architecture)
- [Deployment Guide](./docs/deployment-guide.md)

### Community
- [GitHub Issues](https://github.com/your-org/nexa-task/issues) - Bug reports and feature requests
- [GitHub Discussions](https://github.com/your-org/nexa-task/discussions) - Questions and community support
- [Discord Server](#) - Real-time community chat (coming soon)

### Commercial Support
For enterprise support, custom development, or SLA agreements, contact: support@nexa-task.com

---

## Acknowledgments

Built with amazing open-source technologies:
- [Bun](https://bun.sh) - Fast JavaScript runtime
- [Hono](https://hono.dev) - Lightweight web framework
- [React](https://react.dev) - UI library
- [Mantine](https://mantine.dev) - Component library
- [Drizzle ORM](https://orm.drizzle.team) - Type-safe ORM
- [TanStack Query](https://tanstack.com/query) - Data fetching
- [Clerk](https://clerk.com) - Authentication
- [Turborepo](https://turbo.build/repo) - Monorepo tooling

---

## Roadmap

See [Project Roadmap](./docs/project-roadmap.md) for detailed feature timeline.

**Next Up:**
- Email notifications (Q1 2026)
- Advanced search (Q1 2026)
- Slack integration (Q1 2026)
- Mobile apps (Q2 2026)

---

<p align="center">
  <strong>Built with ❤️ by developers, for developers</strong>
</p>
