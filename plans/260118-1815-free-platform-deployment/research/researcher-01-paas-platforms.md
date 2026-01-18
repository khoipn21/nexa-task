# Free PaaS Platforms Research Report

**Date:** 2026-01-18
**Context:** Turborepo monorepo deployment (Hono/Bun API + Vite/React SPA)
**External deps:** PostgreSQL, Redis, Clerk auth, S3/R2

## Comparison Table

| Platform | CPU | RAM | Storage | Bandwidth | PostgreSQL | Redis | Cost/Month |
|----------|-----|-----|---------|-----------|------------|-------|------------|
| **Railway** | 1 vCPU | 0.5 GB | 0.5 GB vol + 1 GB ephemeral | Not specified | Not free | Not free | $1 credit (~hours) |
| **Render** | 0.1 CPU | 512 MB | Not specified | 100 GB | 256 MB (30-day limit) | 25 MB (no persist) | $0 (sleeps) |
| **Fly.io** | shared-1x | 256 MB × 3 VMs | 3 GB vol total | 100 GB NA/EU | ~$2/mo (unmanaged) | Pay separately | $5 one-time credit |
| **Vercel + Neon** | 4h CPU/mo | 360 GB-hrs | 1 GB blob | 100 GB edge + 10 GB origin | Via Neon: 0.5 GB | External only | $0 (Vercel) + $0 (Neon) |
| **Koyeb** | 0.1 vCPU | 512 MB | 2 GB disk | 100 GB | 50 hrs/mo | Not included | $0 (no sleep) |

## Detailed Analysis

### 1. Railway.app

**Free Tier:**
- $1/month credit (~0.5-1 hour runtime with 0.5 GB RAM + 1 vCPU)
- 0.5 GB RAM, 1 vCPU, 0.5 GB volume, 1 GB ephemeral per service
- Image retention: 24 hours after deployment removal
- No auto-sleep mentioned

**PostgreSQL/Redis:**
- Not included in free tier
- Would consume $1 credit extremely fast (~1-2 hours total)

**Bun Support:**
- Not explicitly documented, likely works via Docker

**Pros:**
- Simple deployment model
- Good developer experience

**Cons:**
- $1 credit = ~1 hour runtime (API + DB would drain instantly)
- No free database options
- Effectively unusable for 24/7 services
- Image retention only 24 hours

**Production Viability:** ❌ Not viable (credit depletes in hours)

---

### 2. Render.com

**Free Tier:**
- 0.1 CPU, 512 MB RAM web services
- 100 GB bandwidth/month
- Auto-sleeps when inactive (timing not specified)
- Static sites: unlimited

**PostgreSQL/Redis:**
- PostgreSQL: 0.1 CPU, 256 MB, 100 connections, **30-day expiration**
- Redis (Key Value): 25 MB, 50 connections, **no persistence**

**Bun Support:**
- Supports Docker deployments (Bun via container)

**Pros:**
- Static sites free (perfect for Vite/React SPA)
- Managed PostgreSQL included (30 days)
- Decent bandwidth (100 GB)
- No credit card required

**Cons:**
- Database expires after 30 days (must recreate/migrate)
- Redis not persistent on free tier
- Auto-sleep on web services (cold starts)
- Very low CPU (0.1 = ~3 minutes per 30 minutes max)

**Cold Starts:** Likely 10-30 seconds (not documented)

**Production Viability:** ⚠️ Testing/staging only (DB expires, auto-sleep)

---

### 3. Fly.io

**Free Tier (Legacy):**
- Up to 3 shared-cpu-1x 256 MB VMs (if on old Hobby plan)
- 3 GB persistent volume total
- 100 GB bandwidth (NA/EU)
- **New users:** $5 one-time credit, no free allowances

**PostgreSQL:**
- Unmanaged Fly Postgres: ~$2/month (single node dev cluster)
- Managed Postgres: Paid only

**Bun Support:**
- Supports Docker/OCI images (Bun compatible)

**Pros:**
- Stopped machines charged only for storage ($0.15/GB/month)
- Global edge network
- Good for microservices

**Cons:**
- Legacy free tier deprecated (unavailable for new users)
- $5 credit runs out fast (~2-3 months at minimum usage)
- Requires credit card
- No truly free option anymore

**Production Viability:** ❌ Not free (credit card required, no free tier)

---

### 4. Vercel + Neon PostgreSQL

**Vercel Hobby Tier:**
- 1M edge requests/month
- 100 GB edge transfer + 10 GB origin transfer
- 4 hours active CPU/month (serverless functions)
- 360 GB-hrs provisioned memory
- 1M function invocations
- Static hosting: unlimited (perfect for React SPA)

**Neon Free Tier:**
- 0.5 GB storage per project
- 100 CU-hours/month compute (2 CU = 8 GB RAM max)
- Auto-suspend after 5 minutes inactive
- 10 branches per project
- 100 projects max

**Redis:**
- Not included, must use external (Upstash free tier: 10k requests/day)

**Bun Support:**
- Vercel: No (Node.js serverless only)
- Neon: N/A (PostgreSQL only)
- **Need separate hosting for Bun API**

**Pros:**
- Best for React SPA (Vercel CDN + zero config)
- Neon auto-suspend saves compute hours
- 100 projects (multi-tenancy friendly)
- Both free tiers are permanent

**Cons:**
- Vercel doesn't support Bun runtime (API needs separate hosting)
- Redis requires external service
- Compute hours can drain with high traffic (100 CU-hrs = 50 hours at 2 CU)

**Production Viability:** ⚠️ Split deployment required (Vercel for SPA, separate API hosting)

---

### 5. Koyeb

**Free Tier:**
- 0.1 vCPU, 512 MB RAM (1 web service)
- 2 GB disk storage
- 100 GB bandwidth/month
- **No auto-sleep** (always-on)
- PostgreSQL: 50 hours/month usage

**Redis:**
- Not included in free tier

**Docker/Bun:**
- Supports Docker deployment (Bun via container)
- Native buildpacks available

**Pros:**
- No auto-sleep (always-on at free tier)
- Managed PostgreSQL included (50 hrs/month)
- Docker support (Bun compatible)
- No credit card required
- 1-second billing granularity

**Cons:**
- Single web service only (can't run API + separate worker)
- PostgreSQL: 50 hours/month = ~1.7 hours/day average
- No Redis on free tier
- Limited regions (Frankfurt, Washington DC)
- 1-day log retention

**Production Viability:** ⚠️ Limited (single service, 50 DB hours/month = 1.7h/day)

---

## Recommendations

### For This Monorepo (Hono/Bun API + React SPA)

**Best Option: Vercel (SPA) + Koyeb (API) + Neon (PostgreSQL) + Upstash (Redis)**

| Component | Platform | Cost | Reasoning |
|-----------|----------|------|-----------|
| **React SPA** | Vercel Hobby | $0 | Perfect for static sites, unlimited bandwidth |
| **Bun API** | Koyeb Free | $0 | Always-on, Docker support, 512 MB RAM |
| **PostgreSQL** | Neon Free | $0 | 0.5 GB storage, auto-suspend, 100 CU-hrs/mo |
| **Redis** | Upstash Free | $0 | 10k requests/day, serverless |

**Why split deployment:**
- Vercel doesn't support Bun runtime (Node.js only)
- Koyeb always-on = no cold starts for API
- Neon auto-suspend = efficient compute usage
- External Redis (Upstash) decouples caching from compute

**Limitations:**
- Koyeb: 50 DB hours/month (if using Koyeb's managed Postgres instead of Neon)
- Neon: 100 CU-hours/month (monitor usage)
- Upstash: 10k requests/day (cache hits only)

---

**Alternative: Render.com (All-in-One)**

If you prefer single-platform deployment:

| Component | Render Service | Cost | Notes |
|-----------|---------------|------|-------|
| **React SPA** | Static Site | $0 | Unlimited |
| **Bun API** | Web Service (Docker) | $0 | Auto-sleeps, 0.1 CPU, 512 MB |
| **PostgreSQL** | Managed Postgres | $0 | **30-day limit**, 256 MB |
| **Redis** | External (Upstash) | $0 | Render free tier = no persistence |

**Pros:**
- Single platform (simpler management)
- Free static + web service + DB

**Cons:**
- **Database expires after 30 days** (must recreate)
- API auto-sleeps (cold starts 10-30s)
- Redis not persistent on Render free tier

---

## Production Readiness Summary

| Platform | 24/7 Uptime | DB Persistence | Cold Starts | Suitable For |
|----------|-------------|----------------|-------------|--------------|
| Railway | ❌ (~1hr/mo) | N/A | N/A | Not viable |
| Render | ⚠️ (sleeps) | ⚠️ (30-day limit) | 10-30s | Testing/staging |
| Fly.io | ❌ (no free tier) | ✅ | Minimal | Paid users only |
| Vercel + Neon | ✅ (Vercel only) | ✅ | N/A (static) | SPAs + serverless |
| Koyeb | ✅ (single service) | ⚠️ (50hrs/mo) | None | Low-traffic APIs |

**Winner for your stack:** Vercel (SPA) + Koyeb (API) + Neon (DB) + Upstash (Redis)

---

## Unresolved Questions

1. **Clerk auth costs** - Does Clerk free tier support production traffic volume?
2. **S3/R2 storage** - Cloudflare R2 has free tier (10 GB storage, no egress fees)?
3. **Email service** - If task assignment emails needed, what's the free tier strategy?
4. **Monitoring** - Free observability for multi-platform deployment (Sentry, Axiom)?
5. **Upstash Redis limits** - 10k requests/day sufficient for session + cache?

**Next steps:** Validate Clerk + R2 + Upstash quotas against expected traffic.
