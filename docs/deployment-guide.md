# Deployment Guide

**Project:** Nexa Task
**Last Updated:** 2026-01-17

---

## Overview

This guide covers deployment options for Nexa Task, from local development to production infrastructure.

---

## Prerequisites

### Required Tools
- **Bun:** 1.2.0 or later
- **Docker:** 20.10+ with Docker Compose
- **PostgreSQL:** 14+ (or Docker)
- **Redis:** 6+ (or Docker, optional)
- **Git:** For repository cloning

### Accounts Needed
- **Clerk:** Authentication provider ([clerk.com](https://clerk.com))
- **Cloudflare R2** or **AWS S3:** File storage
- **GitHub:** For CI/CD (optional)

---

## Local Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/nexa-task.git
cd nexa-task
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Setup Databases (Docker)

```bash
# Start PostgreSQL and Redis
bun run docker:dev

# Wait for containers to be healthy
docker ps
```

**Containers started:**
- PostgreSQL: `localhost:5433`
- Redis: `localhost:6380`

### 4. Configure Environment Variables

```bash
cp .env.example .env
```

**Edit `.env`:**

```env
# Database
DATABASE_URL=postgresql://nexatask:devpassword@localhost:5433/nexa_task

# Redis (optional for dev)
REDIS_URL=redis://localhost:6380

# Clerk (get from Clerk Dashboard)
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# File Storage (use Cloudflare R2 for dev)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=nexa-task-dev
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://your-bucket.r2.dev

# API
PORT=3001
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173

# Environment
NODE_ENV=development
```

### 5. Setup Database Schema

```bash
# Push schema to database
bun run db:push

# Or generate and run migrations
bun run db:generate
bun run db:migrate
```

### 6. Start Development Servers

```bash
# Start all apps in dev mode (Turbo)
bun run dev
```

**Services started:**
- API: `http://localhost:3001`
- Web: `http://localhost:5173`

### 7. Verify Setup

**API Health Check:**
```bash
curl http://localhost:3001/health
```

**Web App:**
Open browser to `http://localhost:5173`

---

## Clerk Authentication Setup

### 1. Create Clerk Application

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com)
2. Create new application
3. Select authentication methods (Email, Google, GitHub)
4. Copy publishable and secret keys to `.env`

### 2. Configure Allowed URLs

**Development:**
- Allowed origins: `http://localhost:5173`
- Allowed redirect URLs: `http://localhost:5173/*`

**Production:**
- Allowed origins: `https://yourdomain.com`
- Allowed redirect URLs: `https://yourdomain.com/*`

### 3. Setup Webhooks (Optional)

**Webhook URL:** `https://yourdomain.com/api/auth/webhooks`

**Events to subscribe:**
- `user.created`
- `user.updated`
- `organization.created`
- `organization.updated`

**Copy webhook secret to `.env`:**
```env
CLERK_WEBHOOK_SECRET=whsec_...
```

### 4. Enable Organizations

1. In Clerk Dashboard → Organizations
2. Enable organization feature
3. Configure organization settings

---

## File Storage Setup

### Option 1: Cloudflare R2 (Recommended)

**Create R2 Bucket:**
```bash
# Using wrangler CLI
wrangler r2 bucket create nexa-task-prod
```

**Generate API Tokens:**
1. Cloudflare Dashboard → R2 → Manage R2 API Tokens
2. Create API token with read/write permissions
3. Copy credentials to `.env`

**Configure CORS:**
```json
{
  "AllowedOrigins": ["https://yourdomain.com"],
  "AllowedMethods": ["GET", "PUT", "POST"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 3000
}
```

### Option 2: AWS S3

**Create S3 Bucket:**
```bash
aws s3 mb s3://nexa-task-prod --region us-east-1
```

**Configure Environment:**
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=nexa-task-prod
```

**Set Bucket Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicRead",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::nexa-task-prod/*"
    }
  ]
}
```

---

## Docker Deployment

### Build Images

```bash
# Build API image
docker build -f docker/api.Dockerfile -t nexa-task-api:latest .

# Build Web image
docker build -f docker/web.Dockerfile \
  --build-arg VITE_API_URL=https://api.yourdomain.com \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_live_... \
  --build-arg VITE_WS_URL=wss://api.yourdomain.com \
  -t nexa-task-web:latest .
```

### Run with Docker Compose

**Production Stack:**
```bash
# Create production env file
cp .env.production.example .env.production

# Edit .env.production with production credentials

# Start stack
docker compose -f docker/docker-compose.prod.yml up -d
```

**Services started:**
- PostgreSQL (internal)
- Redis (internal)
- API (port 3001)
- Web (port 80/443)

### Verify Deployment

```bash
# Check all services are healthy
docker compose -f docker/docker-compose.prod.yml ps

# Check logs
docker compose -f docker/docker-compose.prod.yml logs -f api
docker compose -f docker/docker-compose.prod.yml logs -f web
```

---

## Production Environment Setup

### Environment Variables

**Copy production template:**
```bash
cp .env.production.example .env.production
```

**Required Production Variables:**

```env
# Database (managed PostgreSQL)
DATABASE_URL=postgresql://user:password@db-host:5432/nexa_task?sslmode=require

# Redis (managed Redis)
REDIS_URL=rediss://user:password@redis-host:6379

# Clerk (production keys)
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...

# File Storage (production bucket)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=nexa-task-prod
R2_ENDPOINT=https://account.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://cdn.yourdomain.com

# API
PORT=3001
FRONTEND_URL=https://yourdomain.com
CORS_ORIGIN=https://yourdomain.com

# Security
NODE_ENV=production

# Docker (for CI/CD)
REGISTRY=ghcr.io
IMAGE_NAME=your-org/nexa-task
TAG=latest
```

---

## Database Management

### Migrations

**Generate Migration:**
```bash
# After schema changes in packages/db/src/schema/
bun run db:generate
```

**Review Migration:**
```bash
# Check generated SQL in packages/db/drizzle/
cat packages/db/drizzle/0001_migration.sql
```

**Run Migration:**
```bash
# In production
bun run db:migrate
```

### Backups

**PostgreSQL Backup (Manual):**
```bash
pg_dump -h localhost -p 5432 -U nexatask nexa_task > backup.sql
```

**Restore:**
```bash
psql -h localhost -p 5432 -U nexatask nexa_task < backup.sql
```

**Automated Backups (AWS RDS):**
- Enable automated backups (7-day retention)
- Enable point-in-time recovery
- Configure maintenance window

### Database Seeding (Optional)

```bash
# Create seed script in packages/db/seed.ts
bun run packages/db/seed.ts
```

**Example Seed:**
```typescript
import { db } from "./src/client";
import { users, workspaces } from "./src/schema";

const seed = async () => {
  // Create test user
  await db.insert(users).values({
    clerkId: "user_test123",
    email: "demo@example.com",
    name: "Demo User",
  });

  // Create test workspace
  await db.insert(workspaces).values({
    clerkOrgId: "org_test123",
    name: "Demo Workspace",
    slug: "demo",
    ownerId: "user-id",
  });
};

seed();
```

---

## CI/CD Pipeline

### GitHub Actions Setup

**Secrets Configuration:**

1. Go to GitHub repository → Settings → Secrets
2. Add secrets:
   - `CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `VITE_API_URL`
   - `VITE_CLERK_PUBLISHABLE_KEY`
   - `VITE_WS_URL`
   - `GHCR_TOKEN` (for container registry)

**Workflow Triggers:**
- **CI:** On push/PR to `main` branch
- **Deploy:** On push to `main` or release published

### Manual Deployment Trigger

```bash
# Trigger deploy workflow
gh workflow run deploy.yml
```

---

## Infrastructure as Code (IaC)

### Terraform Example (AWS)

**`main.tf`:**
```hcl
# RDS PostgreSQL
resource "aws_db_instance" "postgres" {
  identifier        = "nexa-task-db"
  engine            = "postgres"
  engine_version    = "14.7"
  instance_class    = "db.t3.micro"
  allocated_storage = 20
  storage_encrypted = true

  db_name  = "nexa_task"
  username = "nexatask"
  password = var.db_password

  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  skip_final_snapshot = false
  final_snapshot_identifier = "nexa-task-final"

  tags = {
    Environment = "production"
  }
}

# ElastiCache Redis
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "nexa-task-redis"
  engine              = "redis"
  node_type           = "cache.t3.micro"
  num_cache_nodes     = 1
  parameter_group_name = "default.redis7"
  port                = 6379

  tags = {
    Environment = "production"
  }
}

# ECS Fargate for API
resource "aws_ecs_task_definition" "api" {
  family                   = "nexa-task-api"
  requires_compatibilities = ["FARGATE"]
  network_mode            = "awsvpc"
  cpu                     = "512"
  memory                  = "1024"

  container_definitions = jsonencode([{
    name  = "api"
    image = "ghcr.io/your-org/nexa-task-api:latest"

    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "3001" }
    ]

    secrets = [
      { name = "DATABASE_URL", valueFrom = "arn:aws:secretsmanager:..." },
      { name = "CLERK_SECRET_KEY", valueFrom = "arn:aws:secretsmanager:..." }
    ]

    portMappings = [{ containerPort = 3001 }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/nexa-task-api"
        "awslogs-region"        = "us-east-1"
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}
```

---

## Monitoring & Logging

### Application Logs

**View Logs (Docker):**
```bash
# API logs
docker compose logs -f api

# Web logs
docker compose logs -f web
```

**Structured Logging:**
```typescript
// API uses pino logger
logger.info({ userId, taskId }, "Task created");
logger.error({ error, context }, "Failed to update task");
```

### Health Monitoring

**API Health Endpoint:**
```bash
curl https://api.yourdomain.com/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-17T12:00:00Z",
  "checks": {
    "database": "ok",
    "redis": "ok"
  }
}
```

### Uptime Monitoring

**Recommended Tools:**
- **Uptime Robot:** Free tier, 5-minute checks
- **Better Uptime:** Advanced features, status page
- **Cronitor:** Comprehensive monitoring

**Setup:**
1. Create HTTP check for `https://api.yourdomain.com/health`
2. Alert on 3 consecutive failures
3. Create status page for users

### Performance Monitoring (Future)

**APM Solutions:**
- **Sentry:** Error tracking, performance monitoring
- **Datadog:** Full observability stack
- **New Relic:** APM and infrastructure monitoring

---

## SSL/TLS Setup

### Option 1: Let's Encrypt (Free)

**Using Certbot:**
```bash
# Install certbot
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Auto-renewal (cron)
0 0 * * * certbot renew --quiet
```

**Nginx Configuration:**
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:3001;
    }
}
```

### Option 2: Cloudflare (Recommended)

**Setup:**
1. Add domain to Cloudflare
2. Enable "Full (strict)" SSL mode
3. Enable "Always Use HTTPS"
4. Enable HTTP/3 (QUIC)
5. Configure origin certificates for backend

---

## Scaling Guide

### Horizontal Scaling

**Requirements:**
- Redis for session/cache sharing
- Load balancer (Nginx, HAProxy, ALB)
- Shared PostgreSQL instance

**Scale API Servers:**
```bash
# Docker Swarm
docker service scale nexa-task-api=3

# Kubernetes
kubectl scale deployment nexa-task-api --replicas=3
```

**Database Read Replicas:**
1. Create PostgreSQL read replica
2. Route read queries to replica
3. Keep write queries on primary

### Vertical Scaling

**Increase Container Resources:**
```yaml
# docker-compose.prod.yml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
```

---

## Troubleshooting

### Common Issues

**Database Connection Errors:**
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Test connection
psql postgresql://user:pass@localhost:5432/nexa_task

# Check logs
docker logs nexa-task-postgres
```

**WebSocket Connection Failures:**
- Verify Redis is running
- Check CORS_ORIGIN includes client URL
- Ensure WebSocket route `/ws` is not blocked by firewall

**Clerk Authentication Errors:**
- Verify `CLERK_PUBLISHABLE_KEY` matches environment
- Check allowed origins in Clerk dashboard
- Ensure webhook secret is correct

**File Upload Failures:**
- Verify S3/R2 credentials
- Check bucket CORS configuration
- Ensure bucket public access for downloads

### Debug Mode

**Enable Verbose Logging:**
```env
# .env
LOG_LEVEL=debug
```

**API Debug Endpoint:**
```bash
curl https://api.yourdomain.com/api/debug/config
```

---

## Production Checklist

### Pre-deployment

- [ ] All tests passing (unit, integration, E2E)
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL/TLS certificates configured
- [ ] Clerk production keys set
- [ ] File storage bucket created
- [ ] CORS origins configured
- [ ] Webhooks tested
- [ ] Health checks passing
- [ ] Monitoring/alerting set up

### Post-deployment

- [ ] Verify API health endpoint
- [ ] Test user authentication flow
- [ ] Create test workspace/project/task
- [ ] Verify WebSocket real-time updates
- [ ] Test file upload/download
- [ ] Check error tracking (Sentry)
- [ ] Review logs for errors
- [ ] Confirm backups running
- [ ] Test disaster recovery procedure
- [ ] Update documentation

---

## Rollback Procedure

**Docker Deployment:**
```bash
# Rollback to previous image
docker compose -f docker/docker-compose.prod.yml pull
docker compose -f docker/docker-compose.prod.yml up -d --force-recreate
```

**Database Rollback:**
```bash
# Restore from backup
psql nexa_task < backup-2026-01-17.sql

# Or point-in-time recovery (AWS RDS)
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier nexa-task-db \
  --target-db-instance-identifier nexa-task-db-restored \
  --restore-time 2026-01-17T12:00:00Z
```

---

## Cost Estimation

### Small Team (10-50 users)

| Service | Provider | Cost/Month |
|---------|----------|------------|
| PostgreSQL (10GB) | AWS RDS | $15 |
| Redis (1GB) | Redis Cloud | $10 |
| API Server (1 instance) | Railway/Render | $20 |
| Web Hosting (Static) | Cloudflare Pages | Free |
| File Storage (10GB) | Cloudflare R2 | $1 |
| Clerk Auth | Clerk | $25 |
| Domain + SSL | Cloudflare | $10 |
| **Total** | | **~$81/month** |

### Medium Team (100-500 users)

| Service | Cost/Month |
|---------|------------|
| PostgreSQL (50GB) | $50 |
| Redis (5GB) | $30 |
| API Servers (3 instances) | $150 |
| File Storage (100GB) | $10 |
| Clerk Auth | $100 |
| Monitoring (Datadog) | $50 |
| **Total** | **~$390/month** |

---

## Support & Maintenance

### Regular Maintenance Tasks

**Weekly:**
- Review error logs
- Check database size/performance
- Monitor disk space
- Review user feedback

**Monthly:**
- Update dependencies (`bun update`)
- Review security advisories
- Database optimization (VACUUM, ANALYZE)
- Backup restoration test

**Quarterly:**
- Major version upgrades (after testing)
- Security audit
- Performance review
- Capacity planning

### Emergency Contacts

**Critical Issues:**
- Database outage: Contact DB provider support
- Clerk outage: Check status.clerk.com
- CDN issues: Cloudflare support

**On-call Rotation:**
- Use PagerDuty or Opsgenie for incident management
- Define SLA response times (15 min for P0, 1 hour for P1)
