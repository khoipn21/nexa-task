---
phase: 04
title: Setup GitHub Actions CI/CD
status: pending
effort: 2h
---

# Phase 04: Setup GitHub Actions CI/CD

## Context Links
- [Plan Overview](./plan.md)
- [Existing CI Workflow](../../.github/workflows/ci.yml)
- [CI/CD Research](./research/researcher-02-cicd-options.md)

## Overview

Extend existing CI workflow to include:
- **Lint + Typecheck + Test** (existing)
- **Docker build + push to GHCR**
- **Deploy triggers for Koyeb and Vercel**
- **Turborepo caching** for faster builds

## Key Insights

1. Existing CI has lint, typecheck, test, build, e2e jobs
2. GHCR is free for public repos, generous for private
3. Docker layer caching via `docker/build-push-action`
4. Koyeb can auto-deploy on GHCR image update
5. Vercel auto-deploys on push (no GHA needed)

## Requirements

**Functional:**
- All CI checks pass before deploy
- Docker image pushed to GHCR on main branch
- API deploys to Koyeb after image push
- SPA deploys to Vercel (handled by Vercel)

**Non-Functional:**
- Pipeline < 10 minutes total
- Parallel jobs where possible
- Cache dependencies between runs

## Architecture

```
[Push to main]
      |
      v
[Lint] [Typecheck] [Test] [Build]  (parallel)
      |
      v (all pass)
[E2E Tests]
      |
      v (pass)
[Docker Build + Push to GHCR]
      |
      v
[Koyeb Redeploy]   [Vercel Auto-deploy]
```

## Related Code Files

**Modify:**
- `.github/workflows/ci.yml` - Add deploy stages

**Create:**
- None (extend existing workflow)

## Implementation Steps

### 1. Add GitHub Secrets

In GitHub repo > Settings > Secrets and variables > Actions:

**Repository Secrets:**
```
KOYEB_TOKEN         # Koyeb API token
```

**Note:** GITHUB_TOKEN is auto-provided for GHCR access.

### 2. Update CI Workflow

Replace `.github/workflows/ci.yml` with enhanced version:

```yaml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  API_IMAGE: ghcr.io/${{ github.repository }}/api

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun lint

  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run typecheck

  test:
    name: Test
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: nexa_task_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - name: Cache Turborepo
        uses: actions/cache@v4
        with:
          path: .turbo
          key: ${{ runner.os }}-turbo-${{ github.sha }}
          restore-keys: ${{ runner.os }}-turbo-
      - run: bun install --frozen-lockfile
      - run: bun run db:push
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/nexa_task_test
      - run: bun test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/nexa_task_test
          TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/nexa_task_test
          REDIS_URL: redis://localhost:6379

  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - name: Cache Turborepo
        uses: actions/cache@v4
        with:
          path: .turbo
          key: ${{ runner.os }}-turbo-${{ github.sha }}
          restore-keys: ${{ runner.os }}-turbo-
      - run: bun install --frozen-lockfile
      - run: bun run build

  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [lint, typecheck, build]
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: cd apps/web && bunx playwright install --with-deps chromium
      - run: cd apps/web && bun run test:e2e
        env:
          CI: true
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: apps/web/playwright-report/
          retention-days: 30

  docker-build-push:
    name: Docker Build & Push
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test, build]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.API_IMAGE }}
          tags: |
            type=sha,prefix=
            type=raw,value=latest

      - name: Build and push API image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: docker/api.Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-koyeb:
    name: Deploy to Koyeb
    runs-on: ubuntu-latest
    needs: [docker-build-push]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - name: Install Koyeb CLI
        run: curl -fsSL https://raw.githubusercontent.com/koyeb/koyeb-cli/master/install.sh | bash

      - name: Redeploy API service
        run: ~/.koyeb/bin/koyeb service redeploy nexa-task-api
        env:
          KOYEB_TOKEN: ${{ secrets.KOYEB_TOKEN }}

      - name: Wait for deployment
        run: sleep 30

      - name: Health check
        run: |
          for i in {1..10}; do
            if curl -sf https://nexa-task-api-xxx.koyeb.app/health; then
              echo "Health check passed"
              exit 0
            fi
            echo "Attempt $i failed, retrying..."
            sleep 10
          done
          echo "Health check failed after 10 attempts"
          exit 1
```

### 3. Generate Koyeb API Token

1. Go to https://app.koyeb.com/settings/api
2. Generate new token with full access
3. Add to GitHub Secrets as `KOYEB_TOKEN`

### 4. Update Koyeb Service Name

Replace `nexa-task-api-xxx.koyeb.app` with actual Koyeb URL in:
- Health check step
- Any hardcoded references

### 5. Test Workflow

1. Push to a test branch
2. Create PR to main
3. Verify all jobs pass
4. Merge PR
5. Verify deploy jobs trigger

## Todo List

- [ ] Add KOYEB_TOKEN to GitHub Secrets
- [ ] Update CI workflow with deploy stages
- [ ] Add Turborepo caching to test/build jobs
- [ ] Configure Docker build with GHCR push
- [ ] Add Koyeb redeploy step
- [ ] Add health check verification
- [ ] Update Koyeb URL in workflow
- [ ] Test full pipeline on PR
- [ ] Test deploy on merge to main
- [ ] Verify Koyeb receives new image

## Success Criteria

- [ ] All CI jobs complete in < 10 minutes
- [ ] Docker image pushed to GHCR on main
- [ ] Koyeb redeploys automatically
- [ ] Health check passes post-deploy
- [ ] Vercel deploys via its own webhook

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| CI minutes exceeded | Blocked deploys | Optimize caching, parallelize |
| Docker build fails | No deploy | Test locally first |
| Koyeb token expired | Deploy fails | Set reminder to rotate |
| Health check timeout | False failure | Increase timeout, retries |

## Security Considerations

- KOYEB_TOKEN stored as encrypted secret
- GITHUB_TOKEN auto-scoped to repo
- No secrets logged in workflow
- Use `permissions` to limit token scope

## Next Steps

After completing this phase:
1. Monitor first few deployments
2. Proceed to [Phase 05: Production Environment](./phase-05-production-environment.md)
