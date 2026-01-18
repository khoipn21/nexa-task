# Debugging Report: Email and Notification Issues

**Date:** 2026-01-18
**Reporter:** Debugger Agent
**Status:** Root causes identified, fixes required

---

## Executive Summary

### Issue 1: Email Not Sent When Task Assigned
**Status:** ✅ Root cause identified
**Severity:** Critical - Core functionality broken
**Root Cause:** Email worker never started in production/dev environments

### Issue 2: Notification Always Shows Offline
**Status:** ✅ Root cause identified
**Severity:** High - Degraded user experience
**Root Cause:** WebSocket URL misconfiguration for non-localhost deployments

---

## Issue 1: Email Not Sent When Task Assigned

### Root Cause Analysis

The email notification infrastructure is fully implemented but **the email worker is never started**. The codebase has all necessary components:

1. ✅ Email queue setup (`apps/api/src/lib/queue.ts`)
2. ✅ Email worker processor (`apps/api/src/workers/email-worker.ts`)
3. ✅ Email templates (React Email components in `@repo/shared`)
4. ✅ Job enqueueing in `createNotificationWithEmail()` (line 158 in `notification.ts`)
5. ❌ **Worker startup missing from main entry point**

### Evidence

**File:** `apps/api/src/index.ts`
```typescript
import { app } from './app'
import { connectRedis } from './lib/redis'
import wsRoutes, { websocket } from './routes/ws'
import { initRealtimeSubscriptions } from './services/realtime'

const port = process.env.PORT || 3001

// Mount WebSocket routes
app.route('/ws', wsRoutes)

// Initialize real-time layer
async function init() {
  await connectRedis()
  initRealtimeSubscriptions()
  console.log(`Starting API server on port ${port}...`)
}

init().catch(console.error)
```

**Missing:** No call to `startEmailWorker()` anywhere in the initialization chain.

**Worker Implementation:** The worker is designed to run as a standalone process OR be imported and started:
```typescript
// apps/api/src/workers/email-worker.ts:142
export function startEmailWorker() {
  const worker = createEmailWorker(processEmailJob)
  console.log('[EmailWorker] Started and listening for jobs')
  // ...
}

// For running as standalone worker process
if (import.meta.main) {
  startEmailWorker()
}
```

**Package.json Scripts:** No script exists to start the worker separately:
```json
"scripts": {
  "dev": "bun run --watch src/index.ts",
  "build": "bun build src/index.ts --outdir dist --target bun",
  "start": "bun run dist/index.js",
  "test": "bun test",
  // ... NO worker:dev or worker:start script
}
```

### Task Assignment Flow (Verified Working)

The assignment flow correctly enqueues email jobs:

**File:** `apps/api/src/services/task.ts:318-346`
```typescript
// Notify new assignee
if (data.assigneeId && data.assigneeId !== userId) {
  // Get assigner name for email
  const assigner = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { name: true },
  })
  const taskUrl = `${process.env.FRONTEND_URL || ''}/tasks/${taskId}`

  await createNotificationWithEmail(
    db,
    {
      userId: data.assigneeId,
      type: 'task_assigned',
      title: `You were assigned to: ${existing.title}`,
      message: `You have been assigned to task "${existing.title}"`,
      entityType: 'task',
      entityId: taskId,
      data: { taskId },
    },
    {
      taskTitle: existing.title,
      projectName: existing.project?.name,
      actorName: assigner?.name || 'Someone', // Fixed in commit 10c5651
      taskUrl,
      dueDate: existing.dueDate?.toISOString().split('T')[0],
    },
  )
}
```

**Recent fix (commit 10c5651):** Added missing `actorName`, `taskUrl`, and `dueDate` fields - this was CORRECTLY fixed but emails still won't send because worker isn't running.

### Email Queue Behavior

**File:** `apps/api/src/services/notification.ts:148-159`
```typescript
// Queue email job
const jobData: EmailJobData = {
  notificationId: notification.id,
  userId: input.userId,
  type: input.type,
  recipientEmail: user.email,
  subject: input.title,
  templateData: emailData,
}

await addEmailJob(jobData)

return { notification, emailQueued: true }
```

Jobs are successfully added to BullMQ/Redis queue but **no worker is consuming them**.

### SMTP Configuration Requirements

Required env vars (from `.env.example`):
- `SMTP_HOST` (default: smtp.gmail.com)
- `SMTP_PORT` (default: 587)
- `SMTP_USER` ⚠️ Required
- `SMTP_PASS` ⚠️ Required
- `SMTP_FROM` ⚠️ Required
- `EMAIL_RATE_LIMIT_MAX` (default: 100)
- `EMAIL_RATE_LIMIT_DURATION_MS` (default: 60000)

If SMTP credentials are missing, worker will fail on job processing (not on startup).

---

## Issue 2: Notification Always Shows Offline

### Root Cause Analysis

The WebSocket connection URL is hardcoded to assume same-host deployment, causing connection failures in different deployment scenarios.

### Evidence

**File:** `apps/web/src/hooks/use-notifications.ts:86-88`
```typescript
const wsUrl =
  import.meta.env.VITE_WS_URL ||
  `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/connect`
```

**Problem:** The fallback URL assumes API is on same host as frontend. In dev:
- Frontend: `http://localhost:5173`
- API: `http://localhost:3001`
- Fallback WS URL: `ws://localhost:5173/ws/connect` ❌ (Wrong port!)

**Current .env configuration:**
```bash
# apps/web/.env
VITE_WS_URL=ws://localhost:3001/ws
```

**Actual endpoint:** `ws://localhost:3001/ws/connect` (note the `/connect` path)

**URL Mismatch:**
- Configured: `ws://localhost:3001/ws` ❌
- Expected: `ws://localhost:3001/ws/connect` ✅

### WebSocket Connection Logic

**Connection Status Display:**
```tsx
// apps/web/src/components/notifications/notification-bell.tsx:68-72
{!isConnected && (
  <Text size="xs" c="dimmed">
    (offline)
  </Text>
)}
```

The `isConnected` state is managed by `useRealtimeNotifications()`:

```typescript
// apps/web/src/hooks/use-notifications.ts:75-156
const [isConnected, setIsConnected] = useState(false)

ws.onopen = () => {
  setIsConnected(true)
  reconnectAttempts.current = 0
  console.log('[WS] Connected')
}

ws.onclose = (event) => {
  setIsConnected(false)
  wsRef.current = null
  console.log('[WS] Disconnected:', event.code, event.reason)
  // ... reconnection logic
}
```

### Backend WebSocket Setup (Verified Working)

**File:** `apps/api/src/routes/ws.ts:12-28`
```typescript
wsRoutes.get(
  '/connect',
  upgradeWebSocket((c) => {
    const auth = getAuth(c)

    return {
      onOpen(_event, ws) {
        const rawWs = ws.raw as ServerWebSocket<WSData> | undefined
        if (rawWs) {
          rawWs.data = {
            userId: auth?.userId || 'anonymous',
            workspaceId: auth?.orgId || '',
            rooms: new Set(),
          }
          wsManager.addConnection(rawWs)
          ws.send(JSON.stringify({ type: 'connected' }))
        }
      },
      // ...
    }
  }),
)
```

Backend is correctly listening on `/ws/connect` and auto-joins user notification room.

### Connection Flow Issues

**Expected flow:**
1. Frontend connects to `ws://localhost:3001/ws/connect`
2. Backend upgrades connection and sends `{ type: 'connected' }`
3. Backend auto-joins user to `user:{userId}` room
4. Frontend sets `isConnected = true`
5. Notification bell shows "online" (no offline text)

**Actual behavior:**
- Frontend attempts connection to wrong URL
- Connection fails immediately
- `isConnected` remains `false`
- UI always shows "(offline)"

---

## Recommended Fixes

### Fix 1: Start Email Worker

**Option A: Embedded Worker (Single Process)**
Add to `apps/api/src/index.ts`:
```typescript
import { app } from './app'
import { connectRedis } from './lib/redis'
import wsRoutes, { websocket } from './routes/ws'
import { initRealtimeSubscriptions } from './services/realtime'
import { startEmailWorker } from './workers/email-worker' // ADD

const port = process.env.PORT || 3001

app.route('/ws', wsRoutes)

async function init() {
  await connectRedis()
  initRealtimeSubscriptions()

  // Start email worker (embedded mode)
  startEmailWorker() // ADD

  console.log(`Starting API server on port ${port}...`)
}

init().catch(console.error)
```

**Pros:** Simple, single process, good for development/small deployments
**Cons:** Email jobs blocked if API server crashes; scales with API not with email volume

**Option B: Separate Worker Process (Production Recommended)**
1. Add script to `apps/api/package.json`:
```json
"scripts": {
  "worker:dev": "bun run --watch src/workers/email-worker.ts",
  "worker:start": "bun run src/workers/email-worker.ts"
}
```

2. Update `turbo.json` for parallel dev:
```json
{
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true,
      "dependsOn": ["^build"]
    },
    "dev:worker": {  // ADD
      "cache": false,
      "persistent": true
    }
  }
}
```

3. Start both processes:
```bash
# Terminal 1: API server
bun run --filter=@repo/api dev

# Terminal 2: Email worker
bun run --filter=@repo/api worker:dev
```

**Pros:** Worker scales independently, fault isolation, production-ready
**Cons:** Two processes to manage, more complex deployment

**Recommendation:** Use Option A for immediate fix, migrate to Option B for production.

### Fix 2: Correct WebSocket URL

**File:** `apps/web/.env`
```bash
# BEFORE
VITE_WS_URL=ws://localhost:3001/ws

# AFTER
VITE_WS_URL=ws://localhost:3001/ws/connect
```

**Alternative fix (make it more robust):**

Update `apps/web/src/hooks/use-notifications.ts`:
```typescript
const wsUrl =
  import.meta.env.VITE_WS_URL ||
  (() => {
    // Use API URL from env if available, otherwise assume same host
    const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
    const wsProtocol = apiUrl.startsWith('https') ? 'wss:' : 'ws:'
    const host = new URL(apiUrl).host
    return `${wsProtocol}//${host}/ws/connect`
  })()
```

Add to `apps/web/.env`:
```bash
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001/ws/connect
```

**Recommendation:** Fix immediate issue with corrected URL, then refactor for better env var handling.

---

## Testing Verification Steps

### Test Email Sending

1. **Start worker:**
```bash
cd apps/api
bun run src/workers/email-worker.ts
```

Expected console output:
```
[EmailWorker] Started and listening for jobs
```

2. **Assign task to user:**
- Open frontend, navigate to project
- Create or edit task
- Assign to another user
- Check API logs for job enqueue:
```
[EmailWorker] Processing job email-{notification-id} for user@example.com
[EmailWorker] Email sent successfully: <message-id>
```

3. **Verify email received:**
- Check recipient's inbox
- Verify email contains: task title, project name, assigner name, task URL, due date (if set)

4. **Check BullMQ queue (if jobs stuck):**
```bash
# In Redis CLI
redis-cli
> KEYS *email-notifications*
> LRANGE bull:email-notifications:wait 0 -1
> LRANGE bull:email-notifications:failed 0 -1
```

### Test WebSocket Connection

1. **Fix .env URL:**
```bash
echo "VITE_WS_URL=ws://localhost:3001/ws/connect" > apps/web/.env
```

2. **Restart frontend dev server:**
```bash
cd apps/web
bun run dev
```

3. **Open browser console:**
Expected logs:
```
[WS] Connected
```

4. **Check notification bell:**
- Should NOT show "(offline)" text
- Unread count should be visible

5. **Test real-time delivery:**
- Open two browser tabs with different users
- In tab 1: Assign task to user in tab 2
- Tab 2 should receive notification immediately (no page refresh)
- Notification bell badge should update

6. **Test reconnection:**
- Stop API server
- Frontend should show "(offline)"
- Restart API server
- Frontend should auto-reconnect within 1-60s (exponential backoff)
- "(offline)" text should disappear

---

## Environment Configuration Checklist

### Backend (.env in root)
```bash
✅ DATABASE_URL=postgresql://user:password@localhost:5432/nexa_task
✅ REDIS_URL=redis://localhost:6379
✅ PORT=3001
✅ FRONTEND_URL=http://localhost:5173

⚠️ SMTP_HOST=smtp.gmail.com
⚠️ SMTP_PORT=587
⚠️ SMTP_USER=your_email@gmail.com
⚠️ SMTP_PASS=your_app_password  # Gmail App Password, not account password
⚠️ SMTP_FROM=NexaTask <your_email@gmail.com>
```

### Frontend (apps/web/.env)
```bash
✅ VITE_API_URL=http://localhost:3001
❌ VITE_WS_URL=ws://localhost:3001/ws  # WRONG
✅ VITE_WS_URL=ws://localhost:3001/ws/connect  # CORRECT
```

---

## Logging Additions for Future Debugging

### Email Queue Monitoring

Add to `apps/api/src/services/notification.ts:158`:
```typescript
await addEmailJob(jobData)

console.log('[Email] Job queued:', {
  notificationId: notification.id,
  userId: input.userId,
  type: input.type,
  recipientEmail: user.email,
  jobId: `email-${notification.id}`
})

return { notification, emailQueued: true }
```

### WebSocket Connection Tracking

Add to `apps/api/src/routes/ws.ts:27`:
```typescript
wsManager.addConnection(rawWs)
ws.send(JSON.stringify({ type: 'connected' }))

console.log('[WS] Client connected:', {
  userId: rawWs.data.userId,
  totalConnections: wsManager.getConnectionCount()
})
```

Add to `apps/api/src/routes/ws.ts:70`:
```typescript
wsManager.removeConnection(rawWs)

console.log('[WS] Client disconnected:', {
  userId: rawWs.data.userId,
  totalConnections: wsManager.getConnectionCount()
})
```

### Email Worker Health Check

Add endpoint to `apps/api/src/routes/index.ts`:
```typescript
import { getEmailQueue } from '../lib/queue'

app.get('/health/email-queue', async (c) => {
  const queue = getEmailQueue()
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ])

  return c.json({
    status: 'ok',
    queue: {
      waiting,
      active,
      completed,
      failed,
    },
    timestamp: new Date().toISOString(),
  })
})
```

---

## Security Considerations

### Email
- ✅ SMTP credentials in env vars (not committed)
- ✅ Email validation (RFC 5322 compliant)
- ✅ XSS sanitization for email content
- ✅ Email injection prevention (newline detection)
- ✅ Circuit breaker for SMTP failures (5 failures → 1min cooldown)
- ✅ Rate limiting (100 emails/min default)
- ⚠️ No SPF/DKIM verification in code (handled by SMTP provider)

### WebSocket
- ✅ Clerk auth integration (userId from JWT)
- ✅ Auto-join user rooms (prevents unauthorized access)
- ✅ Room-based isolation (users only receive their notifications)
- ⚠️ Anonymous users allowed (`userId: 'anonymous'`) - acceptable for public features
- ⚠️ No rate limiting on WS messages - consider adding if abuse occurs

---

## Performance Impact

### Email System
- **Current:** Jobs queued in Redis, never processed → Redis memory grows unbounded
- **After fix:** Jobs processed asynchronously, removed after 24h (completed) or 7d (failed)
- **Throughput:** 100 emails/min by default (configurable via `EMAIL_RATE_LIMIT_MAX`)
- **Retry strategy:** 3 attempts with exponential backoff (1s, 2s, 4s)

### WebSocket
- **Current:** Connections fail immediately → no resource usage
- **After fix:** Persistent connections → ~1KB memory per connection
- **Scalability:** Single-server OK for <10k concurrent users; for larger scale, use Redis pub/sub (already implemented)

---

## Related Code Files

### Email System
- `apps/api/src/lib/email.ts` - Nodemailer transport, validation, circuit breaker
- `apps/api/src/lib/queue.ts` - BullMQ queue setup, job types
- `apps/api/src/workers/email-worker.ts` - Job processor, template rendering
- `apps/api/src/services/notification.ts` - Notification creation, email queueing
- `apps/api/src/services/task.ts` - Task assignment flow (lines 318-346)
- `packages/shared/src/emails/` - React Email templates

### WebSocket System
- `apps/api/src/lib/websocket.ts` - WebSocket manager, room management
- `apps/api/src/routes/ws.ts` - WebSocket routes, connection handling
- `apps/api/src/lib/notification-publisher.ts` - Publish notifications to Redis/WS
- `apps/web/src/hooks/use-notifications.ts` - Frontend WS connection, reconnection
- `apps/web/src/components/notifications/notification-bell.tsx` - UI display

---

## Unresolved Questions

1. **SMTP Credentials:** Are valid Gmail App Password credentials configured in production `.env`?
2. **Redis Connection:** Is Redis running and accessible? Email queue requires Redis.
3. **Worker Deployment:** Should email worker run embedded (single process) or separate (scalable)?
4. **Notification Preferences:** Are users' email notification preferences enabled by default? (Default: yes, per `notification.ts:318-324`)
5. **Failed Jobs:** Are there existing failed email jobs in Redis that need manual inspection?
6. **WebSocket Auth:** Should anonymous WS connections be allowed, or require Clerk auth? (Currently allows anonymous)
7. **Production URLs:** What are the production FRONTEND_URL and WS URL values?

---

## Summary

Both issues have clear root causes and straightforward fixes:

1. **Email not sent:** Worker never started → Add `startEmailWorker()` to `index.ts` or start separate worker process
2. **Always offline:** Wrong WS URL → Change `VITE_WS_URL=ws://localhost:3001/ws/connect` in `apps/web/.env`

Implementation complexity: **Low** (both are configuration/startup issues, not code bugs)
Estimated fix time: **15-30 minutes**
Testing time: **10-15 minutes**

All underlying infrastructure (queue, templates, WS manager, notification flow) is correctly implemented. Recent commit 10c5651 correctly fixed missing email template data. Only missing piece is worker initialization and correct WS URL configuration.
