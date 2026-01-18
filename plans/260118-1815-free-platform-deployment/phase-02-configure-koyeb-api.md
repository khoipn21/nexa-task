---
phase: 02
title: Configure Koyeb API Deployment
status: completed
effort: 1.5h
completed: 2026-01-18
---

# Phase 02: Configure Koyeb API Deployment

## Context Links
- [Plan Overview](./plan.md)
- [Existing Dockerfile](../../docker/api.Dockerfile)
- [CI/CD Research](./research/researcher-02-cicd-options.md)

## Overview

Configure Koyeb for deploying the Bun/Hono API via Docker. Koyeb provides:
- **Always-on** (no cold starts)
- **Docker deployment** via GHCR
- **512MB RAM, 0.1 vCPU** on free tier
- **Auto-deploy** on image push (optional)

## Key Insights

1. Koyeb pulls Docker images from GHCR (public or with token)
2. Health check endpoint required for deployment verification
3. Environment variables set via Koyeb dashboard or CLI
4. Single web service on free tier (sufficient for API + worker)

## Requirements

**Functional:**
- API accessible at `api.nexa-task.koyeb.app` (or custom domain)
- Health endpoint returns 200 OK
- WebSocket connections work
- All env vars configured

**Non-Functional:**
- Container size < 500MB (faster deploys)
- Startup time < 30s
- Memory usage < 450MB (leave headroom)

## Architecture

```
[GHCR] --> [Koyeb] --> [Running Container]
                            |
                            +--> [Neon PostgreSQL]
                            +--> [Upstash Redis]
                            +--> [Cloudflare R2]
```

## Related Code Files

**Modify:**
- `docker/api.Dockerfile` - Minor optimizations if needed

**Create:**
- `.koyeb.yaml` - Koyeb service configuration (optional, can use dashboard)

## Implementation Steps

### 1. Verify Dockerfile Works Locally

```bash
# Build image
docker build -f docker/api.Dockerfile -t nexa-task-api:test .

# Run with test env
docker run -p 3001:3001 \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="rediss://..." \
  nexa-task-api:test

# Test health endpoint
curl http://localhost:3001/health
```

### 2. Create Koyeb Account and Service

1. Sign up at https://app.koyeb.com
2. Go to Services > Create Service
3. Select "Docker" deployment method
4. Configure:
   - **Image:** `ghcr.io/{owner}/nexa-task-api:latest`
   - **Region:** Washington DC (closest to Neon us-east-1)
   - **Instance:** Free tier (0.1 vCPU, 512MB)
   - **Port:** 3001
   - **Health check path:** `/health`

### 3. Configure Environment Variables in Koyeb

Add these environment variables in Koyeb dashboard:

```env
# Database (Neon)
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require

# Redis (Upstash)
REDIS_URL=rediss://default:xxx@us1-xxx.upstash.io:6379

# Clerk Auth
CLERK_SECRET_KEY=sk_live_xxx
CLERK_PUBLISHABLE_KEY=pk_live_xxx

# Cloudflare R2
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=nexa-task-prod
R2_PUBLIC_URL=https://xxx.r2.dev

# App Config
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://app.yourdomain.com

# SMTP (if email enabled)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=xxx
SMTP_PASS=xxx
SMTP_FROM=noreply@nexa-task.com
```

### 4. Configure GHCR Access (if private repo)

If using private images:
1. Generate GitHub PAT with `read:packages` scope
2. In Koyeb: Settings > Secrets > Add GHCR credentials
3. Reference in service config

### 5. Setup Auto-Deploy (Optional)

Option A: Koyeb webhook
1. Get Koyeb deploy webhook URL
2. Add to GitHub Actions workflow

Option B: Koyeb CLI in CI
```yaml
- name: Deploy to Koyeb
  run: |
    koyeb service redeploy nexa-task-api
  env:
    KOYEB_TOKEN: ${{ secrets.KOYEB_TOKEN }}
```

### 6. Test Deployment

```bash
# Check health
curl https://nexa-task-api-xxx.koyeb.app/health

# Check API response
curl https://nexa-task-api-xxx.koyeb.app/api/health
```

## Todo List

- [ ] Verify Dockerfile builds and runs locally
- [ ] Create Koyeb account
- [ ] Create web service with Docker deployment
- [ ] Configure all environment variables
- [ ] Setup GHCR access (if private)
- [ ] Deploy initial image manually
- [ ] Verify health check passes
- [ ] Test API endpoints work
- [ ] Configure auto-deploy webhook

## Success Criteria

- [ ] Health endpoint returns 200: `curl $KOYEB_URL/health`
- [ ] Database queries work: check logs for connection success
- [ ] Redis connects: verify cache operations
- [ ] No memory warnings in Koyeb dashboard
- [ ] Response time < 500ms for simple endpoints

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Memory exceeded | Container restart | Monitor usage, optimize queries |
| Cold start after idle | N/A | Koyeb free tier is always-on |
| GHCR rate limit | Failed deploys | Use PAT with higher limits |
| Neon connection drops | API errors | Connection retry logic |

## Security Considerations

- Store KOYEB_TOKEN in GitHub Secrets
- Use Secrets, not plain env vars, for sensitive values
- Enable HTTPS only (Koyeb provides TLS)
- Restrict CORS to frontend domain only

## Next Steps

After completing this phase:
1. Note the Koyeb API URL for Vercel config
2. Proceed to [Phase 03: Configure Vercel SPA](./phase-03-configure-vercel-spa.md)
