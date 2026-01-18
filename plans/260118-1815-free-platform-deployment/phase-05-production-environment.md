---
phase: 05
title: Production Environment Configuration
status: pending
effort: 0.5h
---

# Phase 05: Production Environment Configuration

## Context Links
- [Plan Overview](./plan.md)
- [Existing .env.example](../../.env.example)

## Overview

Document and configure all production environment variables:
- Create `.env.production.example`
- Document secrets for each platform
- Setup monitoring/alerting basics

## Key Insights

1. Environment vars split across 3 platforms: Koyeb, Vercel, GitHub Actions
2. Sensitive vars never in git
3. Build-time vs runtime vars differ
4. Health endpoints for monitoring

## Requirements

**Functional:**
- All required vars documented
- Example values for reference
- Platform-specific groupings

**Non-Functional:**
- No secrets in version control
- Clear documentation for onboarding

## Related Code Files

**Create:**
- `.env.production.example` - Production env template
- `docs/deployment-secrets.md` - Secrets documentation

## Implementation Steps

### 1. Create Production Environment Template

Create `.env.production.example`:

```env
# ===========================================
# PRODUCTION ENVIRONMENT VARIABLES
# ===========================================
# This file documents all required production environment variables.
# DO NOT commit actual values to git!
# Configure these in your deployment platform (Koyeb, Vercel).

# -------------------------------------------
# DATABASE (Neon PostgreSQL)
# -------------------------------------------
# Format: postgresql://user:password@host/database?sslmode=require
DATABASE_URL=postgresql://neondb_owner:xxx@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require

# -------------------------------------------
# REDIS (Upstash)
# -------------------------------------------
# Format: rediss://default:password@host:port
# Note: Use 'rediss://' (with double s) for TLS
REDIS_URL=rediss://default:xxx@us1-xxx.upstash.io:6379

# -------------------------------------------
# AUTHENTICATION (Clerk)
# -------------------------------------------
# API Server (secret)
CLERK_SECRET_KEY=sk_live_xxx

# Both API and Web (publishable)
CLERK_PUBLISHABLE_KEY=pk_live_xxx

# -------------------------------------------
# FILE STORAGE (Cloudflare R2)
# -------------------------------------------
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=nexa-task-prod
R2_ENDPOINT=https://your_account_id.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://pub-xxx.r2.dev

# -------------------------------------------
# EMAIL (SMTP)
# -------------------------------------------
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=NexaTask <noreply@yourdomain.com>
SMTP_POOL_SIZE=5

EMAIL_RATE_LIMIT_MAX=100
EMAIL_RATE_LIMIT_DURATION_MS=300000

# -------------------------------------------
# APPLICATION
# -------------------------------------------
NODE_ENV=production
PORT=3001

# Your production domain
FRONTEND_URL=https://app.yourdomain.com

# -------------------------------------------
# VITE (Build-time only - Vercel)
# -------------------------------------------
# These are embedded at build time
VITE_API_URL=https://nexa-task-api-xxx.koyeb.app
VITE_WS_URL=wss://nexa-task-api-xxx.koyeb.app
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxx
```

### 2. Document Platform-Specific Secrets

**Koyeb (API Runtime):**
| Variable | Source | Type |
|----------|--------|------|
| DATABASE_URL | Neon | Secret |
| REDIS_URL | Upstash | Secret |
| CLERK_SECRET_KEY | Clerk | Secret |
| CLERK_PUBLISHABLE_KEY | Clerk | Env |
| R2_* (5 vars) | Cloudflare | Secret |
| SMTP_* (7 vars) | Gmail | Secret |
| NODE_ENV | Static | Env |
| PORT | Static | Env |
| FRONTEND_URL | Config | Env |

**Vercel (SPA Build-time):**
| Variable | Source | Type |
|----------|--------|------|
| VITE_API_URL | Koyeb URL | Env |
| VITE_WS_URL | Koyeb URL | Env |
| VITE_CLERK_PUBLISHABLE_KEY | Clerk | Env |

**GitHub Actions (CI/CD):**
| Variable | Source | Type |
|----------|--------|------|
| KOYEB_TOKEN | Koyeb | Secret |
| GITHUB_TOKEN | Auto | Auto |

### 3. Setup Basic Monitoring

**Health Check URLs:**
- API: `https://nexa-task-api-xxx.koyeb.app/health`
- Web: `https://app.yourdomain.com` (check for 200)

**Free Monitoring Options:**
- **UptimeRobot** (free): 50 monitors, 5-min intervals
- **Freshping** (free): 50 monitors, 1-min intervals
- **GitHub Actions** (cron): Add scheduled health check workflow

**Optional: Health Check Workflow:**

```yaml
# .github/workflows/health-check.yml
name: Health Check

on:
  schedule:
    - cron: '*/30 * * * *'  # Every 30 minutes

jobs:
  health:
    runs-on: ubuntu-latest
    steps:
      - name: Check API health
        run: |
          response=$(curl -sf https://nexa-task-api-xxx.koyeb.app/health)
          echo "$response"
          if [[ $(echo "$response" | jq -r '.status') != "healthy" ]]; then
            exit 1
          fi

      - name: Check Web availability
        run: curl -sf https://app.yourdomain.com > /dev/null
```

### 4. Update Deployment Documentation

Update `docs/deployment-guide.md` with:
- Free tier platform setup instructions
- Environment variable configuration
- Troubleshooting common issues

## Todo List

- [ ] Create `.env.production.example`
- [ ] Add to `.gitignore` if needed
- [ ] Document secrets per platform
- [ ] Setup UptimeRobot or similar
- [ ] Create health check workflow (optional)
- [ ] Update deployment documentation
- [ ] Verify all services running

## Success Criteria

- [ ] `.env.production.example` covers all required vars
- [ ] Documentation clear for new developers
- [ ] Health monitoring active
- [ ] All production services accessible

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missing env var | Service crash | Test locally with prod config |
| Secret rotation needed | Downtime | Document rotation procedure |
| Service goes down | User impact | Monitoring + alerts |

## Security Considerations

- Never commit actual secrets
- Use platform-native secret managers
- Rotate credentials on breach
- Limit access to production vars

## Next Steps

After completing this phase:
1. Run full end-to-end test in production
2. Monitor for 24-48 hours
3. Share production URLs with team
4. Plan for scaling when free tier limits hit
