---
phase: 01
title: Setup External Services
status: completed
effort: 1h
completed: 2026-01-18
---

# Phase 01: Setup External Services

## Context Links
- [Plan Overview](./plan.md)
- [PaaS Research](./research/researcher-01-paas-platforms.md)

## Overview

Setup external managed services for production:
- **Neon PostgreSQL** - Database with auto-suspend
- **Upstash Redis** - Serverless cache
- **Cloudflare R2** - Object storage (already configured)
- **Clerk** - Production auth instance

## Key Insights

1. Neon auto-suspends after 5min idle → saves 100 CU-hrs quota
2. Upstash 10k req/day → use for cache only, not sessions
3. R2 has no egress fees → ideal for file attachments
4. Clerk free tier: 10k MAU → sufficient for MVP

## Requirements

**Functional:**
- Production PostgreSQL with connection string
- Redis endpoint with TLS
- R2 bucket with public URL
- Clerk production keys

**Non-Functional:**
- All credentials stored securely (not in git)
- Connection pooling for Neon (if needed)

## Implementation Steps

### 1. Create Neon PostgreSQL Project

1. Sign up at https://neon.tech
2. Create new project: `nexa-task-prod`
3. Select region: `us-east-1` (closest to Koyeb)
4. Copy connection string with pooler:
   ```
   postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
5. Enable connection pooling (recommended for serverless)

### 2. Create Upstash Redis Instance

1. Sign up at https://console.upstash.com
2. Create new database: `nexa-task-prod`
3. Select region: `us-east-1`
4. Enable TLS
5. Copy connection URL:
   ```
   rediss://default:xxx@us1-xxx.upstash.io:6379
   ```

### 3. Verify Cloudflare R2 Setup

1. Login to Cloudflare dashboard
2. Navigate to R2 > Create bucket: `nexa-task-prod`
3. Generate R2 API token with read/write access
4. Note credentials:
   - Account ID
   - Access Key ID
   - Secret Access Key
5. Configure public access (optional custom domain)

### 4. Setup Clerk Production Instance

1. Go to Clerk dashboard
2. Create new application or use existing
3. Switch to Production mode
4. Configure:
   - Allowed origins: `https://app.yourdomain.com`
   - Redirect URLs: `https://app.yourdomain.com/sign-in`
5. Copy production keys:
   - `CLERK_PUBLISHABLE_KEY` (pk_live_...)
   - `CLERK_SECRET_KEY` (sk_live_...)

### 5. Document All Credentials

Create secure notes with:
- Neon connection string
- Upstash Redis URL
- R2 credentials (4 values)
- Clerk production keys (2 values)

## Todo List

- [x] Create Neon project and database
- [x] Create Upstash Redis instance
- [x] Verify R2 bucket and generate API token
- [ ] Configure Clerk production instance (using test keys for now)
- [x] Test Neon connection from local machine
- [x] Test Upstash connection from local machine
- [x] Document all credentials securely

## Success Criteria

- [ ] Neon connection works: `psql $DATABASE_URL -c "SELECT 1"`
- [ ] Upstash responds: `redis-cli -u $REDIS_URL PING`
- [ ] R2 accessible via S3-compatible API
- [ ] Clerk production keys validated

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Neon compute quota exceeded | API errors | Monitor usage, optimize queries |
| Upstash rate limit hit | Cache misses | Fall back to DB, reduce cache TTL |
| Region latency | Slow API | Choose same region for all services |

## Security Considerations

- Never commit credentials to git
- Use environment variables in all platforms
- Enable TLS for all connections
- Rotate credentials if exposed

## Next Steps

After completing this phase:
1. Add credentials to GitHub Secrets
2. Proceed to [Phase 02: Configure Koyeb API](./phase-02-configure-koyeb-api.md)
