# Phase 2: Email Infrastructure

**Priority:** High | **Status:** ⬜ Pending | **Depends on:** Phase 1 | **Parallel with:** Phase 3

## Context Links

- [Email Notifications Research](../reports/researcher-260117-2237-email-notifications.md)

## Overview

Set up Resend + BullMQ for async email delivery to task watchers.

## Key Insights

- Resend has native Bun support, simple API
- BullMQ handles retries, rate limiting, scheduling
- React Email for type-safe templates
- Need queue worker as separate process (or same process in dev)

## Requirements

### Functional
- Send emails for: task_assigned, status_changed, comment_added, mentioned, due_soon
- Respect user notification preferences
- Queue emails for async delivery
- Retry failed sends (3 attempts)

### Non-Functional
- Rate limit: 100 emails/min
- Idempotency keys prevent duplicates
- Worker handles batch processing

## Architecture

```
Task Event → Notification Service
                    ↓
            Check Preferences
                    ↓
            Add to BullMQ Queue
                    ↓
            Worker Processes
                    ↓
            Resend API → Email Delivered
```

## Related Code Files

### Create
- `packages/shared/src/email-templates/task-assigned.tsx`
- `packages/shared/src/email-templates/task-updated.tsx`
- `packages/shared/src/email-templates/comment-added.tsx`
- `apps/api/src/lib/email.ts` - Resend client
- `apps/api/src/lib/queue.ts` - BullMQ setup
- `apps/api/src/workers/email-worker.ts`

### Modify
- `apps/api/package.json` - Add resend, bullmq, @react-email/components
- `apps/api/src/services/notification.ts` - Add email queueing

## Implementation Steps

1. Install deps: `cd apps/api && bun add resend bullmq @react-email/components`
2. Create email templates in packages/shared (React Email components)
3. Create `lib/email.ts` with Resend client initialization
4. Create `lib/queue.ts` with BullMQ queue setup (emailQueue)
5. Create `workers/email-worker.ts` with rate-limited processor
6. Update notification service to queue emails when preferences allow
7. Add RESEND_API_KEY to .env.example
8. Create startup script to spawn worker

## Todo List

- [ ] Install email dependencies
- [ ] Create React Email templates (3 types)
- [ ] Create Resend client wrapper
- [ ] Create BullMQ queue configuration
- [ ] Create email worker with rate limiting
- [ ] Integrate with notification service
- [ ] Update .env.example
- [ ] Test email delivery

## Success Criteria

- [ ] Email template renders correctly (preview)
- [ ] Queue accepts jobs without error
- [ ] Worker processes and sends test email
- [ ] Rate limiting prevents spam (100/min cap)
- [ ] Failed sends retry 3 times

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Resend API key exposure | Env var only, never commit |
| Email bounce handling | Use Resend webhooks (future) |
| Worker crash | Supervisor process, health checks |

## Security Considerations

- API key in env vars only
- Sanitize user content in emails
- Validate recipient emails
- Unsubscribe link in all emails

## Next Steps

Test email delivery end-to-end with watcher notification trigger.
