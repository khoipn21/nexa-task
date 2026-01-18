# Free Platform Setup Guide

**Date:** 2026-01-18
**Estimated Time:** 15-20 minutes

---

## Step 1: Create Neon PostgreSQL Database

### Sign Up
1. Go to https://neon.tech
2. Click "Sign Up" → Use GitHub for faster signup
3. Verify email if required

### Create Project
1. Click **"New Project"**
2. **Project name:** `nexa-task-prod`
3. **Region:** Select **US East (N. Virginia)** ← Important for latency
4. **Postgres version:** Latest (16)
5. Click **"Create Project"**

### Get Connection String
1. After creation, you'll see the connection details
2. Click **"Pooled connection"** tab (important for serverless)
3. Copy the connection string:
   ```
   postgresql://neondb_owner:xxxxxxxx@ep-cool-name-123456.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
4. **Save this as:** `DATABASE_URL`

### Recommended Settings
- Go to **Settings → Compute**
- Ensure **Auto-suspend:** Enabled (saves compute hours)
- **Suspend after:** 5 minutes of inactivity

---

## Step 2: Create Upstash Redis

### Sign Up
1. Go to https://console.upstash.com
2. Click "Sign Up" → Use GitHub
3. Complete signup

### Create Database
1. Click **"Create Database"**
2. **Name:** `nexa-task-prod`
3. **Type:** Regional
4. **Region:** Select **US-East-1** ← Match Neon region
5. **TLS:** Enabled (default)
6. Click **"Create"**

### Get Connection URL
1. After creation, go to **"Details"** tab
2. Find **"REST URL"** and **"Redis URL"**
3. Copy the **Redis URL** (starts with `rediss://`):
   ```
   rediss://default:xxxxxxxx@us1-cool-redis-12345.upstash.io:6379
   ```
4. **Save this as:** `REDIS_URL`

---

## Step 3: Create Koyeb Account

### Sign Up
1. Go to https://app.koyeb.com
2. Click "Sign Up" → Use GitHub
3. Complete signup (no credit card required)

### Get API Token (for CI/CD)
1. Click your **avatar** (top-right) → **"Account settings"**
2. Go to **"API"** section
3. Click **"Create API Token"**
4. **Name:** `github-actions`
5. **Scope:** Full access
6. Click **"Create"**
7. **Copy the token immediately** (shown only once!)
8. **Save this as:** `KOYEB_TOKEN`

### Note Service Creation
- We'll create the actual service during Phase 02
- For now, just have the account ready

---

## Step 4: Create Vercel Account

### Sign Up
1. Go to https://vercel.com
2. Click **"Sign Up"** → **"Continue with GitHub"**
3. Authorize Vercel to access your GitHub

### Import Repository (Do Later)
- Skip importing for now
- We'll connect the repo during Phase 03

### Verify Hobby Plan
1. Go to **Settings → Billing**
2. Confirm you're on **"Hobby"** (free) plan
3. No credit card required

---

## Step 5: Verify Cloudflare R2

You mentioned R2 is already configured. Verify you have:

### Required Credentials
Check your `.env` file for:
```env
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=nexa-task-prod
R2_ENDPOINT=https://xxxxx.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

### If Missing, Create Token
1. Go to https://dash.cloudflare.com → **R2**
2. Click **"Manage R2 API Tokens"**
3. Create token with **Object Read & Write** permissions
4. Copy credentials

---

## Step 6: Clerk Production Keys

### Switch to Production
1. Go to https://dashboard.clerk.com
2. Select your application
3. Click **"Production"** in the environment switcher

### Get Production Keys
1. Go to **"API Keys"** section
2. Copy:
   - **Publishable key:** `pk_live_xxxxxxxx`
   - **Secret key:** `sk_live_xxxxxxxx`

### Configure Allowed Origins
1. Go to **Settings → Paths**
2. Add allowed origins (use platform URLs for now):
   - `https://nexa-task-xxx.vercel.app`
3. Update after deployment with actual URLs

---

## Step 7: Create UptimeRobot Account

### Sign Up
1. Go to https://uptimerobot.com
2. Click **"Register for FREE"**
3. Verify email

### Create Monitors (After Deployment)
- We'll add monitors after services are live
- Free tier: 50 monitors, 5-minute intervals

---

## Credentials Summary

After completing steps 1-6, you should have:

| Variable | Source | Example Format |
|----------|--------|----------------|
| `DATABASE_URL` | Neon | `postgresql://...@ep-xxx.neon.tech/neondb` |
| `REDIS_URL` | Upstash | `rediss://default:xxx@us1-xxx.upstash.io:6379` |
| `KOYEB_TOKEN` | Koyeb | `koyeb_xxxxxxxxxxxxx` |
| `CLERK_SECRET_KEY` | Clerk | `sk_live_xxxxxxxxxxxxx` |
| `CLERK_PUBLISHABLE_KEY` | Clerk | `pk_live_xxxxxxxxxxxxx` |
| `R2_*` (6 vars) | Cloudflare | Already in `.env` |
| `SMTP_*` (7 vars) | Gmail | Already in `.env` |

---

## Quick Verification

After creating accounts, verify locally:

```bash
# Test Neon connection
psql "postgresql://...your-neon-url..." -c "SELECT 1"

# Test Upstash connection (if redis-cli installed)
redis-cli -u "rediss://...your-upstash-url..." PING
```

---

## Next Steps

Once all accounts are ready:
1. Run `/code` to start implementation
2. Phase 01 will configure these services
3. Phases 02-05 will deploy and setup CI/CD

---

## Troubleshooting

### Neon: "Connection refused"
- Check region matches (us-east-1)
- Use pooled connection string
- Ensure `?sslmode=require` is in URL

### Upstash: "Auth failed"
- Use `rediss://` (double s) for TLS
- Password is in the URL after `default:`

### Koyeb: Token invalid
- Tokens are shown only once - regenerate if lost
- Ensure "Full access" scope

### Clerk: Keys don't work
- Ensure using Production keys, not Development
- Check allowed origins include your domain
