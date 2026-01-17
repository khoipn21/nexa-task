# Code Review: Phase 2 Email Infrastructure

**Score: 6.5/10**

---

## Scope

**Files reviewed:**
- `/mnt/k/Work/nexa-task/apps/api/src/lib/email.ts` (112 lines)
- `/mnt/k/Work/nexa-task/apps/api/src/lib/queue.ts` (114 lines)
- `/mnt/k/Work/nexa-task/apps/api/src/workers/email-worker.ts` (130 lines)
- `/mnt/k/Work/nexa-task/apps/api/src/services/notification.ts` (334 lines, +69 new)
- `/mnt/k/Work/nexa-task/packages/shared/src/email-templates/*.tsx` (4 files)
- `/mnt/k/Work/nexa-task/.env.example` (31 lines)

**LOC analyzed:** ~900 lines

**Review focus:** Recent changes to notification service + new email infrastructure (security, performance, architecture, YAGNI/KISS/DRY)

---

## Overall Assessment

Implementation shows solid architecture patterns (singleton transporter, job idempotency, rate limiting) but contains **CRITICAL type errors blocking compilation**. Email templates lack XSS protection, unsubscribe URL is hardcoded placeholder, no input sanitization for email addresses, missing transporter pool management. Performance patterns good (exponential backoff, job cleanup), but no circuit breaker for SMTP failures.

---

## CRITICAL Issues

### 1. **Build Failure - JSX Configuration Missing**
**File:** `packages/shared/tsconfig.json` vs `apps/api`

**Issue:** API package importing React Email templates but lacks JSX compiler option:
```
error TS6142: Module './base-layout' was resolved to
'base-layout.tsx', but '--jsx' is not set.
```

**Impact:** Code won't compile, blocks deployment

**Fix:** Add to `apps/api/tsconfig.json`:
```json
{
  "compilerOptions": {
    "jsx": "react-jsx"
  }
}
```

---

### 2. **XSS Vulnerability in Email Templates**
**Files:** All `*.tsx` templates

**Issue:** User-provided data (taskTitle, assignerName, commentPreview, etc.) directly inserted into HTML without sanitization:
```tsx
// task-assigned.tsx line 25-26
<strong>{assignerName}</strong> assigned you to{' '}
<strong>"{taskTitle}"</strong>
```

**Attack vector:**
- User sets name to `<script>alert('xss')</script>`
- Email HTML contains executable script
- Recipient's email client may execute (depends on client)

**Impact:** Cross-site scripting in emails, potential phishing attacks

**Fix:** Use React Email's text sanitization or escape HTML:
```tsx
import { Text } from '@react-email/components'
// React Email auto-escapes text content
<Text>{assignerName}</Text>
```

---

### 3. **Email Injection - No Address Validation**
**File:** `apps/api/src/lib/email.ts` line 73

**Issue:** Email addresses accepted without validation:
```ts
to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
```

**Attack vector:**
- User input: `victim@example.com\nBcc: attacker@evil.com`
- Nodemailer may parse as additional headers

**Impact:** Email injection, spam relay, header injection

**Fix:** Validate emails with regex before use:
```ts
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
if (Array.isArray(options.to)) {
  if (!options.to.every(e => emailRegex.test(e))) {
    throw new Error('Invalid email address')
  }
}
```

---

### 4. **Hardcoded Unsubscribe URL - Non-functional**
**File:** `packages/shared/src/email-templates/base-layout.tsx` line 34

**Issue:** Template placeholder never replaced:
```tsx
<Link href="{{unsubscribe_url}}" style={unsubscribeLink}>
```

**Impact:** Users can't unsubscribe (CAN-SPAM compliance failure), broken link in emails

**Fix:** Pass `unsubscribeUrl` as prop and generate in worker:
```tsx
// base-layout.tsx
interface BaseLayoutProps {
  unsubscribeUrl: string
}
// worker
const unsubscribeUrl = `${process.env.FRONTEND_URL}/settings/notifications?token=${notificationId}`
```

---

### 5. **SMTP Credentials Exposure Risk**
**File:** `apps/api/src/lib/email.ts` line 32

**Issue:** Default from address construction uses SMTP_USER directly:
```ts
from: from || `NexaTask <${user}@gmail.com>`,
```

**Impact:** Leaks SMTP username in email headers if SMTP_FROM not set

**Fix:** Require SMTP_FROM explicitly:
```ts
if (!from) {
  throw new Error('SMTP_FROM required')
}
```

---

## High Priority Findings

### 6. **No Connection Pool - Memory Leak Risk**
**File:** `apps/api/src/lib/email.ts` line 37-54

**Issue:** Singleton transporter never pools connections, single connection reused forever. No max connection limit.

**Impact:**
- Single connection bottleneck under high load
- Connection may timeout/close, not auto-recovered
- No parallel SMTP connections

**Fix:** Configure pooling:
```ts
transporter = nodemailer.createTransport({
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  ...config
})
```

---

### 7. **No Circuit Breaker for SMTP Failures**
**File:** `apps/api/src/workers/email-worker.ts` line 89-106

**Issue:** Worker retries failed emails 3x exponentially but doesn't pause when SMTP server down. If SMTP unreachable, burns through retry attempts immediately.

**Impact:** Wasted Redis queue processing, delayed email delivery

**Recommendation:** Add circuit breaker pattern (skip retries if SMTP down for X minutes)

---

### 8. **Missing Rate Limit Config Validation**
**File:** `apps/api/src/lib/queue.ts` line 90-93

**Issue:** Hardcoded 100 emails/min limit without env override:
```ts
limiter: {
  max: 100,
  duration: 60000,
}
```

**Impact:** Can't adjust for different SMTP providers (Gmail: 500/day, SendGrid: unlimited)

**Fix:** Make configurable:
```ts
limiter: {
  max: Number(process.env.EMAIL_RATE_LIMIT) || 100,
  duration: 60000,
}
```

---

### 9. **Insecure SMTP Port Default**
**File:** `apps/api/src/lib/email.ts` line 28

**Issue:** Default port 587 (STARTTLS) but `secure: false` default may downgrade to plaintext:
```ts
secure: process.env.SMTP_SECURE === 'true',
```

**Impact:** SMTP credentials transmitted in plaintext if SMTP_SECURE not set

**Fix:** Force secure for 465, STARTTLS for 587:
```ts
const port = Number(process.env.SMTP_PORT) || 587
const secure = port === 465
```

---

### 10. **Missing Job Priority**
**File:** `apps/api/src/lib/queue.ts` line 71-81

**Issue:** All emails same priority. Critical notifications (task_mentioned, task_assigned) treated same as low-priority (watcher_added).

**Impact:** Important emails delayed behind bulk notifications

**Recommendation:** Add priority levels:
```ts
await queue.add('send-email', data, {
  priority: data.type === 'task_mentioned' ? 1 : 5
})
```

---

## Medium Priority Improvements

### 11. **No Email Delivery Tracking**
**Issue:** Worker logs success but doesn't update notification record with delivery status

**Recommendation:** Update `notifications.emailSentAt` timestamp after successful send for audit trail

---

### 12. **Missing SMTP Connection Health Check**
**Issue:** `verifyEmailConnection()` exists but never called on app startup

**Recommendation:** Call in API startup to fail fast if SMTP misconfigured

---

### 13. **Redis URL Parsing - No Error Handling**
**File:** `apps/api/src/lib/queue.ts` line 32-33

**Issue:**
```ts
const url = new URL(redisUrl) // Throws if invalid
```

**Fix:** Wrap in try-catch or validate URL format first

---

### 14. **Job Cleanup Too Aggressive**
**File:** `apps/api/src/lib/queue.ts` line 57-63

**Issue:** Completed jobs deleted after 24h, failed after 7d

**Concern:** Short retention for debugging production issues

**Recommendation:** Increase to 30d completed, 90d failed or export to logging service

---

### 15. **Missing Template Error Handling**
**File:** `apps/api/src/workers/email-worker.ts` line 83-86

**Issue:** Unknown notification type throws error:
```ts
default:
  throw new Error(`Unknown notification type: ${type}`)
```

**Impact:** Fails job permanently (no retry), breaks queue processing

**Fix:** Log error and mark job completed (bad data) or route to dead-letter queue

---

## Low Priority Suggestions

### 16. **Duplicate getEmailConfig() Call**
**File:** `apps/api/src/lib/email.ts` line 68

**Violation:** DRY principle
```ts
const config = getEmailConfig() // Called again
const transport = getEmailTransporter() // Already called in constructor
```

**Fix:** Reuse config from transporter singleton

---

### 17. **Console Logging - Not Production Ready**
**Issue:** All files use `console.log/error` instead of structured logger

**Recommendation:** Use structured logging (Pino, Winston) for production observability

---

### 18. **Missing Text Fallback in Templates**
**File:** `apps/api/src/workers/email-worker.ts` line 98-102

**Issue:** Only sends HTML, no plaintext alternative:
```ts
await sendEmail({
  to: recipientEmail,
  subject,
  html, // text: undefined
})
```

**Impact:** Some email clients block HTML-only emails

**Recommendation:** Generate text version from React Email:
```ts
import { render } from '@react-email/components'
const text = await render(template, { plainText: true })
```

---

### 19. **Over-Engineering: Worker Separate File**
**Observation:** `email-worker.ts` only 130 lines, could merge into `queue.ts` (YAGNI)

**Counter:** Separation allows independent worker process deployment (good for scaling)

**Verdict:** Current design acceptable

---

## Positive Observations

✅ **Job Idempotency:** Using `notificationId` as job ID prevents duplicate emails (line queue.ts:75)

✅ **Exponential Backoff:** 1s → 2s → 4s retry delays (queue.ts:54-55)

✅ **Singleton Pattern:** Reuses transporter connection (email.ts:38-40)

✅ **Type Safety:** Strong typing for EmailJobData, NotificationType

✅ **Graceful Shutdown:** SIGTERM handler closes worker cleanly (email-worker.ts:118-121)

✅ **Preference Checks:** Respects user email preferences before queuing (notification.ts:84-96)

---

## Recommended Actions

**URGENT (block deployment):**
1. Fix JSX compilation error in `apps/api/tsconfig.json`
2. Add email address validation (regex check)
3. Sanitize template variables for XSS
4. Implement functional unsubscribe URL
5. Require SMTP_FROM env var

**High Priority (next sprint):**
6. Enable Nodemailer connection pooling
7. Add circuit breaker for SMTP failures
8. Make rate limits configurable
9. Force secure=true for port 465
10. Add job priority levels

**Medium Priority (tech debt):**
11. Track email delivery status in DB
12. Call SMTP health check on startup
13. Add Redis URL validation
14. Increase job retention times
15. Handle unknown notification types gracefully

**Low Priority (nice-to-have):**
16. Remove duplicate config calls
17. Replace console with structured logger
18. Generate plaintext email fallbacks

---

## Architecture Score Breakdown

- **Security:** 4/10 (critical: XSS, email injection, credential leak risk)
- **Performance:** 7/10 (good retry/rate limiting, missing pooling/circuit breaker)
- **Architecture:** 8/10 (clean separation, singleton pattern, typed)
- **YAGNI/KISS/DRY:** 7/10 (simple design, minor duplication)

**Overall:** 6.5/10

---

## Unresolved Questions

1. What's the expected email volume (emails/day)? Determines if pooling needed urgently
2. Which SMTP provider production (Gmail has 500/day limit, may need SendGrid)
3. Should failed emails retry indefinitely or route to dead-letter queue?
4. Do we need email delivery webhooks (bounce/complaint tracking)?
5. Should templates support multiple languages (i18n)?
