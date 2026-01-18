# Phase 01: Monorepo + Dev Environment Setup

## Context Links
- [Turborepo Research](../reports/researcher-260117-1758-turborepo-setup.md)
- [Tech Stack](../../docs/tech-stack.md)

## Overview
- **Priority**: P1 (Critical Path)
- **Status**: pending
- **Effort**: 4h

Initialize Turborepo monorepo with Bun, configure shared TypeScript, ESLint, and Prettier.

## Key Insights
- Bun 1.2+ natively supports workspaces
- Turborepo `pipeline` config enables parallel builds
- Shared tsconfig packages reduce duplication
- `workspace:*` protocol for internal dependencies

## Requirements

### Functional
- Single `bun dev` starts all services
- Shared packages importable across apps
- TypeScript strict mode enabled

### Non-Functional
- Build time < 10s for incremental changes
- Clear separation: apps/, packages/
- Consistent code style across monorepo

## Architecture

```
nexa-task/
├── apps/
│   ├── web/          # React + Vite
│   └── api/          # Hono backend
├── packages/
│   ├── db/           # Drizzle schema
│   ├── shared/       # Types, utils, validators
│   ├── ui/           # Shared React components
│   └── typescript-config/
├── package.json
├── turbo.json
├── biome.json
└── .env.example
```

## Related Code Files

### Create
- `/package.json` - Root workspace config
- `/turbo.json` - Turborepo pipeline
- `/biome.json` - Linter/formatter config
- `/packages/typescript-config/base.json`
- `/packages/typescript-config/react.json`
- `/packages/typescript-config/package.json`
- `/packages/shared/package.json`
- `/packages/shared/src/index.ts`
- `/packages/db/package.json`
- `/packages/db/src/index.ts`
- `/packages/ui/package.json`
- `/packages/ui/src/index.ts`
- `/apps/api/package.json`
- `/apps/api/src/index.ts`
- `/apps/api/tsconfig.json`
- `/apps/web/package.json`
- `/apps/web/vite.config.ts`
- `/apps/web/tsconfig.json`
- `/apps/web/index.html`
- `/apps/web/src/main.tsx`
- `/.env.example`

## Implementation Steps

### 1. Initialize Root Workspace
```bash
cd /mnt/k/Work/nexa-task
bun init -y
```

### 2. Create package.json
```json
{
  "name": "nexa-task",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "packageManager": "bun@1.2.0",
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "test": "turbo run test",
    "db:push": "turbo run db:push --filter=@repo/db",
    "db:generate": "turbo run db:generate --filter=@repo/db"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "turbo": "^2.3.0",
    "typescript": "^5.7.0"
  }
}
```

### 3. Create turbo.json
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**"]
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
    },
    "db:push": {
      "cache": false
    },
    "db:generate": {
      "cache": false
    }
  }
}
```

### 4. Create biome.json
```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded"
    }
  }
}
```

### 5. Create TypeScript Config Package
```bash
mkdir -p packages/typescript-config
```

**packages/typescript-config/package.json**:
```json
{
  "name": "@repo/typescript-config",
  "version": "0.0.0",
  "private": true,
  "files": ["base.json", "react.json"]
}
```

**packages/typescript-config/base.json**:
```json
{
  "compilerOptions": {
    "esModuleInterop": true,
    "skipLibCheck": true,
    "target": "ES2022",
    "lib": ["ES2022"],
    "allowJs": true,
    "resolveJsonModule": true,
    "moduleDetection": "force",
    "isolatedModules": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true
  }
}
```

**packages/typescript-config/react.json**:
```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

### 6. Create Shared Package
```bash
mkdir -p packages/shared/src
```

**packages/shared/package.json**:
```json
{
  "name": "@repo/shared",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types/index.ts",
    "./validators": "./src/validators/index.ts"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "typescript": "^5.7.0"
  }
}
```

**packages/shared/src/index.ts**:
```typescript
export * from './types'
export * from './validators'
```

### 7. Create DB Package (Drizzle)
```bash
mkdir -p packages/db/src/schema
```

**packages/db/package.json**:
```json
{
  "name": "@repo/db",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts"
  },
  "scripts": {
    "db:push": "drizzle-kit push",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "drizzle-orm": "^0.38.0"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "drizzle-kit": "^0.30.0",
    "typescript": "^5.7.0"
  }
}
```

### 8. Create UI Package
```bash
mkdir -p packages/ui/src
```

**packages/ui/package.json**:
```json
{
  "name": "@repo/ui",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0"
  }
}
```

### 9. Create API App
```bash
mkdir -p apps/api/src
```

**apps/api/package.json**:
```json
{
  "name": "@repo/api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target bun",
    "start": "bun run dist/index.js",
    "test": "bun test"
  },
  "dependencies": {
    "@hono/zod-validator": "^0.4.0",
    "@repo/db": "workspace:*",
    "@repo/shared": "workspace:*",
    "hono": "^4.7.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/bun": "latest",
    "typescript": "^5.7.0"
  }
}
```

**apps/api/tsconfig.json**:
```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "types": ["bun"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**apps/api/src/index.ts**:
```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

const app = new Hono()

app.use('*', logger())
app.use('*', cors())

app.get('/', (c) => c.json({ status: 'ok', service: 'nexa-task-api' }))
app.get('/health', (c) => c.json({ status: 'healthy' }))

export default {
  port: process.env.PORT || 3001,
  fetch: app.fetch,
}
```

### 10. Create Web App
```bash
mkdir -p apps/web/src
```

**apps/web/package.json**:
```json
{
  "name": "@repo/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest"
  },
  "dependencies": {
    "@mantine/core": "^7.16.0",
    "@mantine/hooks": "^7.16.0",
    "@repo/shared": "workspace:*",
    "@repo/ui": "workspace:*",
    "@tanstack/react-query": "^5.64.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.1.0"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@tailwindcss/postcss": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "postcss": "^8.5.0",
    "postcss-preset-mantine": "^1.17.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

**apps/web/tsconfig.json**:
```json
{
  "extends": "@repo/typescript-config/react.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**apps/web/vite.config.ts**:
```typescript
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
```

**apps/web/postcss.config.cjs**:
```javascript
module.exports = {
  plugins: {
    'postcss-preset-mantine': {},
    '@tailwindcss/postcss': {},
  },
}
```

**apps/web/index.html**:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Nexa Task</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**apps/web/src/main.tsx**:
```tsx
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@mantine/core/styles.layer.css'
import './index.css'

const queryClient = new QueryClient()

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold p-4">Nexa Task</h1>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <App />
      </MantineProvider>
    </QueryClientProvider>
  </StrictMode>
)
```

**apps/web/src/index.css**:
```css
@layer theme, base, mantine, components, utilities;

@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/preflight.css" layer(base);
@import "@mantine/core/styles.layer.css" layer(mantine);
@import "tailwindcss/utilities.css" layer(utilities);
```

### 11. Create .env.example
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/nexa_task

# Clerk Auth
CLERK_SECRET_KEY=sk_test_xxxxx
CLERK_PUBLISHABLE_KEY=pk_test_xxxxx

# Redis
REDIS_URL=redis://localhost:6379

# API
PORT=3001
NODE_ENV=development
```

### 12. Install Dependencies
```bash
bun install
```

### 13. Verify Setup
```bash
bun dev
# Should start both web (3000) and api (3001)
```

## Todo List
- [ ] Initialize root package.json with workspaces
- [ ] Create turbo.json pipeline config
- [ ] Setup biome.json for linting/formatting
- [ ] Create typescript-config package
- [ ] Create shared package with exports
- [ ] Create db package skeleton
- [ ] Create ui package skeleton
- [ ] Create api app with Hono
- [ ] Create web app with Vite + React
- [ ] Configure Mantine + Tailwind CSS layers
- [ ] Create .env.example
- [ ] Run `bun install` and verify dev servers

## Success Criteria
- [x] `bun dev` starts both apps concurrently
- [x] `bun build` completes without errors
- [x] `bun lint` passes
- [x] Internal packages resolve correctly
- [x] Mantine + Tailwind styles work together
- [x] API health endpoint returns 200

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bun/Turborepo compatibility | Medium | Pin Bun version, test early |
| Tailwind/Mantine conflicts | Low | CSS layers configured |
| Package resolution issues | Medium | Use `workspace:*` protocol |

## Security Considerations
- `.env` files in .gitignore
- No secrets in committed code
- CORS configured for dev only

## Next Steps
- Phase 02: Database Schema (Drizzle + PostgreSQL)
