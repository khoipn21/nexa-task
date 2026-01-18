---
title: "Free Platform Deployment + CI/CD"
description: "Deploy Nexa Task to free-tier platforms: Vercel (SPA), Koyeb (API), Neon (PostgreSQL), Upstash (Redis)"
status: pending
priority: P1
effort: 6h
branch: master
tags: [deployment, ci-cd, vercel, koyeb, neon, upstash, github-actions]
created: 2026-01-18
---

# Free Platform Deployment + CI/CD

## Overview

Split deployment strategy for zero-cost production hosting:
- **React SPA:** Vercel Hobby (unlimited static, CDN)
- **Bun API:** Koyeb Free (always-on, Docker-based)
- **PostgreSQL:** Neon Free (0.5GB, auto-suspend)
- **Redis:** Upstash Free (10k req/day)
- **File Storage:** Cloudflare R2 (10GB free)
- **CI/CD:** GitHub Actions + GHCR

## Architecture

```
[Vercel CDN] --> [React SPA]
                      |
                      v
[Koyeb API] <--> [Neon PostgreSQL]
     |                |
     +----> [Upstash Redis]
     |
     +--> [Cloudflare R2]
```

## Phases

| Phase | Status | Effort | Description |
|-------|--------|--------|-------------|
| [Phase 01](./phase-01-setup-external-services.md) | ✅ done | 1h | Setup Neon, Upstash, R2, Clerk prod |
| [Phase 02](./phase-02-configure-koyeb-api.md) | ✅ done | 1.5h | Configure Koyeb for API deployment |
| [Phase 03](./phase-03-configure-vercel-spa.md) | ✅ done | 1h | Configure Vercel for SPA deployment |
| [Phase 04](./phase-04-setup-github-actions-cicd.md) | pending | 2h | Full CI/CD pipeline with GHCR |
| [Phase 05](./phase-05-production-environment.md) | pending | 0.5h | Production env config + docs |

## Key Dependencies

- GitHub repository access
- Clerk account (free tier)
- Cloudflare account (R2 access)
- External service accounts (Neon, Upstash, Koyeb, Vercel)

## Reports

- [PaaS Platforms Research](./research/researcher-01-paas-platforms.md)
- [CI/CD Options Research](./research/researcher-02-cicd-options.md)

## Success Criteria

- [ ] API accessible at `api.yourdomain.com` with <500ms cold start
- [ ] SPA accessible at `app.yourdomain.com` with CDN caching
- [ ] CI/CD triggers deploy on push to main
- [ ] Health checks passing on all services
- [ ] All env vars documented and secured

## Limitations (Free Tier)

| Service | Limit | Mitigation |
|---------|-------|------------|
| Neon | 100 CU-hrs/mo, 0.5GB | Auto-suspend saves compute |
| Upstash | 10k req/day | Cache only, not sessions |
| Koyeb | 0.1 vCPU, 512MB | Sufficient for low traffic |
| Vercel | 100GB bandwidth | CDN + static assets |

---

## Validation Summary

**Validated:** 2026-01-18
**Questions asked:** 6

### Confirmed Decisions

| Decision | User Choice |
|----------|-------------|
| Custom domain | Use platform defaults (defer custom domain) |
| Region | US East (Washington DC) - Koyeb limits options |
| Email | Already configured in .env (use existing SMTP) |
| E2E tests | Include in CI (Playwright) |
| GitHub repo | Public (unlimited CI minutes, public GHCR) |
| Monitoring | Setup UptimeRobot for uptime alerts |

### Action Items

- [x] Region: Confirm US East for Koyeb, Neon, Upstash
- [x] Email: Use existing SMTP credentials from .env
- [x] CI: Include Playwright E2E tests
- [ ] Post-deploy: Setup UptimeRobot for monitoring
- [ ] Post-deploy: Consider custom domain when ready
