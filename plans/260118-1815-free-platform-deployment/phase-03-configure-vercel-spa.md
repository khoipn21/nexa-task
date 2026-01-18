---
phase: 03
title: Configure Vercel SPA Deployment
status: completed
effort: 1h
completed: 2026-01-18
---

# Phase 03: Configure Vercel SPA Deployment

## Context Links
- [Plan Overview](./plan.md)
- [Web Dockerfile](../../docker/web.Dockerfile) - Reference for build process
- [Vite Config](../../apps/web/vite.config.ts)

## Overview

Deploy React SPA to Vercel Hobby tier:
- **Zero-config** for Vite projects
- **CDN-backed** static hosting
- **Preview deployments** per PR
- **Environment variables** for build-time config

## Key Insights

1. Vercel auto-detects Vite and builds correctly
2. SPA needs rewrite rules: all routes → index.html
3. Build-time env vars must be prefixed with `VITE_`
4. API URL must point to Koyeb endpoint

## Requirements

**Functional:**
- SPA accessible at `app.yourdomain.com` or Vercel subdomain
- All routes work (React Router)
- API calls reach Koyeb backend
- Clerk auth works in production

**Non-Functional:**
- Build time < 2 minutes
- Page load < 2 seconds
- CDN cache for static assets

## Architecture

```
[Browser] --> [Vercel Edge/CDN]
                    |
                    v
              [Static SPA]
                    |
                    v (API calls)
              [Koyeb API]
```

## Related Code Files

**Create:**
- `apps/web/vercel.json` - Vercel configuration

**Verify:**
- `apps/web/vite.config.ts` - Build config
- `apps/web/src/lib/api-client.ts` - API base URL

## Implementation Steps

### 1. Create vercel.json Configuration

Create `apps/web/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "cd ../.. && bun run build --filter=@repo/web",
  "outputDirectory": "dist",
  "installCommand": "cd ../.. && bun install --frozen-lockfile",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

### 2. Verify API Client Uses Env Var

Check `apps/web/src/lib/api-client.ts`:

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const apiClient = {
  baseURL: API_URL,
  // ...
};
```

### 3. Connect Vercel to GitHub

1. Go to https://vercel.com/new
2. Import GitHub repository
3. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `apps/web`
   - **Build Command:** Override with monorepo command
   - **Output Directory:** `dist`

### 4. Configure Environment Variables

In Vercel dashboard > Settings > Environment Variables:

```env
# API endpoint (Koyeb URL)
VITE_API_URL=https://nexa-task-api-xxx.koyeb.app

# WebSocket URL (same as API)
VITE_WS_URL=wss://nexa-task-api-xxx.koyeb.app

# Clerk publishable key (safe for client)
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxx
```

**Important:** Only `VITE_` prefixed vars are exposed to client!

### 5. Configure Build Settings

In Vercel dashboard > Settings > General:

- **Framework Preset:** Vite
- **Node.js Version:** 20.x
- **Build Command:** `cd ../.. && bun install && bun run build --filter=@repo/web`
- **Output Directory:** `dist`
- **Install Command:** (leave empty, handled in build)

### 6. Trigger First Deploy

1. Push to main branch, or
2. Click "Redeploy" in Vercel dashboard
3. Monitor build logs

### 7. Verify Deployment

```bash
# Check main page
curl -I https://your-app.vercel.app

# Check SPA routing (should return index.html)
curl -I https://your-app.vercel.app/projects/123

# Check static assets have cache headers
curl -I https://your-app.vercel.app/assets/index-xxx.js
```

### 8. Configure Custom Domain (Optional)

1. Vercel dashboard > Domains
2. Add domain: `app.yourdomain.com`
3. Configure DNS: CNAME → `cname.vercel-dns.com`
4. Wait for SSL certificate provisioning

## Todo List

- [ ] Create `apps/web/vercel.json`
- [ ] Verify API client uses VITE_API_URL
- [ ] Connect Vercel to GitHub repo
- [ ] Configure environment variables
- [ ] Configure build settings for monorepo
- [ ] Trigger first deployment
- [ ] Verify SPA routing works
- [ ] Verify API calls reach Koyeb
- [ ] Verify Clerk auth works
- [ ] Configure custom domain (optional)

## Success Criteria

- [ ] SPA loads without errors
- [ ] All routes return index.html (SPA routing)
- [ ] API calls succeed (check network tab)
- [ ] Clerk sign-in/sign-up works
- [ ] Static assets have long cache headers
- [ ] Build time < 2 minutes

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Monorepo build fails | No deploy | Use custom build command |
| CORS errors | API blocked | Configure Koyeb CORS |
| Missing env vars | Broken app | Check Vercel logs |
| Route 404s | Broken nav | Verify rewrite rules |

## Security Considerations

- Only `VITE_` vars exposed to client (no secrets)
- Clerk publishable key is safe for client-side
- API URL public but requires auth tokens
- Enable Vercel's security headers

## Next Steps

After completing this phase:
1. Test full user flow: login → create task → view board
2. Proceed to [Phase 04: Setup GitHub Actions CI/CD](./phase-04-setup-github-actions-cicd.md)
