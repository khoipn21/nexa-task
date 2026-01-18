# CI/CD Pipeline Options for Turborepo Monorepo Deployment

**Research Date:** 2026-01-18
**Context:** Free tier CI/CD platforms for Turborepo monorepo with Biome, TypeScript, Bun, Playwright, Docker

---

## Platform Comparison

### 1. GitHub Actions ⭐ RECOMMENDED

**Free Tier Limits:**
- Public repos: Unlimited minutes
- Private repos: 2,000 minutes/month
- 500MB cache storage per repo (free tier)
- Linux runners: 1x multiplier (most cost-effective)
- macOS runners: 10x multiplier
- Windows runners: 2x multiplier

**Pros:**
- Native integration with GitHub repos
- Excellent Turborepo support via `actions/cache`
- Built-in GitHub Container Registry (GHCR) - free, unlimited for public images
- Mature ecosystem, extensive action marketplace
- Matrix builds for parallel testing
- Native secrets management
- Preview deployments via environments

**Cons:**
- 2,000 min/month limit for private repos (33 hours)
- Cache storage limited to 500MB free tier

**Docker Registry Options:**
- GHCR (ghcr.io) - free for public, generous for private
- Docker Hub - free tier: 1 private repo, unlimited public
- Self-hosted registry on deployment platform

---

### 2. GitLab CI

**Free Tier Limits:**
- SaaS (GitLab.com): 400 CI/CD minutes/month per user
- Shared runners on Linux, Windows, macOS
- GitLab Container Registry included (10GB storage limit)

**Pros:**
- Built-in container registry (no external dependency)
- All-in-one platform (repo + CI/CD + registry)
- Good Docker/Kubernetes integration
- Can self-host GitLab Runner for unlimited minutes

**Cons:**
- Only 400 minutes/month (6.6 hours) on free tier
- Less mature caching compared to GitHub Actions
- Smaller ecosystem than GitHub

---

### 3. CircleCI

**Free Tier Limits:**
- 6,000 build minutes/month (100 hours)
- 1 concurrent job
- Docker support included
- Free Docker Hub integration

**Pros:**
- Generous free tier (6,000 min vs GitHub's 2,000)
- Good Docker layer caching
- Orbs marketplace for reusable configs
- SSH debugging support

**Cons:**
- Only 1 concurrent job (slower for matrix builds)
- Requires separate repo (GitHub/Bitbucket)
- No built-in container registry (need Docker Hub or external)
- Learning curve for CircleCI-specific config

---

### 4. Platform-Native CI/CD

**Vercel:**
- Zero-config for frontend projects
- Automatic preview deployments
- No build minute limits
- **Limitation:** Frontend-only (no backend/Docker support)

**Railway:**
- Auto-deploy on git push
- Preview environments per PR
- Built-in Docker support
- **Limitation:** Free trial ($5 credit), then paid only

**Render:**
- Auto-deploy from GitHub
- Preview environments for PRs
- Free tier for web services (750 hrs/month)
- **Limitation:** Limited to Render's build environment, no custom runners

**Fly.io:**
- Auto-deploy via `fly.toml`
- Free tier: 3 VMs with 256MB RAM
- Dockerfile-based deployments
- **Limitation:** Small free tier, mainly for production hosting

---

## Turborepo Caching Strategies

### Local Caching (Default)
```bash
# Turborepo caches to .turbo/ by default
# No setup needed
```

### GitHub Actions Cache Strategy
```yaml
- name: Cache Turborepo artifacts
  uses: actions/cache@v4
  with:
    path: .turbo
    key: ${{ runner.os }}-turbo-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-turbo-
```

### Vercel Remote Cache (Free for hobby projects)
```yaml
env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}
  TURBO_REMOTE_ONLY: true
```

### Bun Dependency Caching
```yaml
- uses: oven-sh/setup-bun@v1
  with:
    bun-version: latest
- run: bun install --frozen-lockfile
```

---

## Recommended Setup: GitHub Actions + GHCR

**Why:**
- Unlimited minutes for public repos (or 2,000/month for private)
- Free container registry (GHCR)
- Native Turborepo caching support
- Preview deployments via GitHub Environments
- Secrets via GitHub Secrets
- Deploy to any platform (Railway, Render, Fly.io)

**Workflow Structure:**
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:

jobs:
  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run lint
      - run: bun run typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - name: Cache Turborepo
        uses: actions/cache@v4
        with:
          path: .turbo
          key: ${{ runner.os }}-turbo-${{ github.sha }}
          restore-keys: ${{ runner.os }}-turbo-
      - run: bun install
      - run: bun run test

  build-push:
    needs: [lint-typecheck, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to platform
        run: |
          # Railway CLI, Fly.io CLI, or webhook trigger
```

---

## Secrets Management

**GitHub Actions:**
- Repository Secrets (encrypted)
- Environment Secrets (per environment)
- Organization Secrets (shared across repos)

**Best Practice:**
- Store `TURBO_TOKEN`, `DOCKER_REGISTRY_TOKEN`, deployment tokens as secrets
- Store non-sensitive config as repository variables
- Use environment protection rules for production

---

## Preview Deployments

**GitHub Actions + Railway/Render:**
```yaml
- name: Deploy preview
  if: github.event_name == 'pull_request'
  env:
    RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
  run: railway up --service ${{ github.event.pull_request.number }}
```

**Auto-deploy on merge:**
```yaml
on:
  push:
    branches: [main]
```

---

## Unresolved Questions

1. **Playwright E2E tests:** Need dedicated runner with browser deps? Consider using `playwright-github-action` or Docker container with browsers pre-installed.
2. **Build time estimate:** Unknown how long full pipeline takes (lint + typecheck + test + build + e2e). May need CircleCI if exceeds GitHub's 2,000 min/month for private repos.
3. **Monorepo selective deployment:** Which apps/services deploy on what triggers? Need deployment strategy per package.
