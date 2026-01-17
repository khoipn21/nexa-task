# Turborepo + Bun Monorepo Setup Research

**Date:** 2026-01-17
**Focus:** Turborepo + Bun workspace with Hono backend + React frontend

## Folder Structure

```
nexa-task/
├── apps/
│   ├── web/                    # React frontend
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── api/                    # Hono backend
│       ├── src/
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── shared/                 # Shared types, utils
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── db/                     # Drizzle schema
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── ui/                     # Shared React components
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── typescript-config/      # Shared TS configs
│       ├── base.json
│       ├── react.json
│       └── package.json
├── package.json
├── bun.lockb
├── turbo.json
└── .dockerignore
```

## Root Configuration

### package.json
```json
{
  "name": "nexa-task",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "packageManager": "bun@1.2.0",
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test"
  },
  "devDependencies": {
    "turbo": "latest"
  }
}
```

### turbo.json
```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "build/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    }
  }
}
```

## Shared TypeScript Config

### packages/typescript-config/base.json
```json
{
  "compilerOptions": {
    "esModuleInterop": true,
    "skipLibCheck": true,
    "target": "ES2022",
    "allowJs": true,
    "resolveJsonModule": true,
    "moduleDetection": "force",
    "isolatedModules": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

### packages/typescript-config/react.json
```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

### packages/typescript-config/package.json
```json
{
  "name": "@repo/typescript-config",
  "version": "0.0.0",
  "private": true,
  "files": ["base.json", "react.json"]
}
```

## App Configurations

### apps/api/package.json
```json
{
  "name": "@repo/api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target bun",
    "start": "bun run dist/index.js"
  },
  "dependencies": {
    "hono": "latest",
    "@repo/db": "workspace:*",
    "@repo/shared": "workspace:*"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "typescript": "latest"
  }
}
```

### apps/api/src/index.ts
```typescript
import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => c.json({ message: 'Hello from Hono!' }))

export default {
  port: process.env.PORT || 3001,
  fetch: app.fetch,
}
```

### apps/web/package.json
```json
{
  "name": "@repo/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "latest",
    "react-dom": "latest",
    "@repo/ui": "workspace:*",
    "@repo/shared": "workspace:*"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@vitejs/plugin-react": "latest",
    "typescript": "latest",
    "vite": "latest"
  }
}
```

## Development Workflow

### Start concurrent dev servers
```bash
bun install
bun dev  # Runs both web & api in parallel
```

Turborepo automatically:
- Parallelizes tasks across packages
- Caches build outputs
- Respects task dependencies via `dependsOn`
- Uses `persistent: true` for dev servers (doesn't wait for completion)

## Docker Multi-Stage Build

### apps/api/Dockerfile
```dockerfile
# Stage 1: Base
FROM oven/bun:1 AS base
WORKDIR /app

# Stage 2: Pruner (isolate app dependencies)
FROM base AS pruner
RUN bun add -g turbo
COPY . .
RUN turbo prune @repo/api --docker

# Stage 3: Installer (production deps only)
FROM base AS installer
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lockb ./bun.lockb
RUN bun install --frozen-lockfile --production

# Stage 4: Builder
FROM base AS builder
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
RUN turbo build --filter=@repo/api

# Stage 5: Runner (minimal production image)
FROM oven/bun:1-alpine AS runner
WORKDIR /app
COPY --from=installer /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
CMD ["bun", "run", "dist/index.js"]
```

### .dockerignore
```
node_modules
.turbo
dist
build
.next
coverage
.git
.env
*.log
```

### Build command
```bash
docker build -t nexa-api:latest -f apps/api/Dockerfile .
```

## Key Features

**Turborepo Benefits:**
- `^build` dependency syntax ensures packages build dependencies first
- Incremental builds via caching (`outputs` config)
- Parallel execution for independent tasks
- `turbo prune` for Docker optimization

**Bun Advantages:**
- Native TypeScript/JSX support (no transpilation needed)
- Fast package installation
- Built-in watch mode (`--watch`)
- Workspace protocol support (`workspace:*`)

**Docker Optimization:**
- 5-stage build reduces final image size
- `turbo prune` includes only required dependencies
- Layer caching for faster rebuilds
- Alpine base for minimal footprint

## Unresolved Questions

1. Remote caching setup for CI/CD (requires Vercel account or self-hosted)
2. Environment variable handling strategy across apps
3. Database migration workflow in Docker containers
4. Frontend deployment target (static/SSR/SSG)
