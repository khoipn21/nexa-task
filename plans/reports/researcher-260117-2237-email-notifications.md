# Email Notification Implementation Research

**Date:** 2026-01-17
**Context:** Bun/Hono backend email notifications for task management
**Report:** /mnt/k/Work/nexa-task/plans/reports/researcher-260117-2237-email-notifications.md

---

## 1. Email Provider Comparison

### Resend (Recommended)
**Strengths:**
- Native React Email template support
- High source reputation (83.4 benchmark)
- 1026+ code snippets, excellent docs
- Built-in idempotency for safe retries
- Simple error handling (`{ data, error }` pattern)
- 2026 trend: Popular for Hono/edge runtimes

**Pricing:** Developer-friendly free tier

```typescript
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'tasks@nexa.com',
  to: user.email,
  subject: 'Task Assigned: Fix Auth Bug',
  react: TaskAssignedEmail({ task, assignee }),
});
```

### SendGrid
**Strengths:**
- Enterprise-grade (716 code snippets)
- Advanced analytics/tracking
- Dynamic templates with merge vars
- Batch sending for multiple recipients

**Weaknesses:**
- More complex API surface
- Heavier SDK (~5x larger)
- Overkill for small-medium projects

**Verdict:** Use Resend unless enterprise features needed.

---

## 2. Queue Strategy: BullMQ + Redis

### Why Queue?
- Prevent API timeouts on bulk notifications (100+ watchers)
- Retry failed sends with exponential backoff
- Rate limit compliance (stay under provider caps)
- Async processing = faster HTTP responses

### BullMQ Implementation

```typescript
// queue/email-queue.ts
import { Queue, Worker } from 'bullmq';

const emailQueue = new Queue('emails', {
  connection: { host: 'localhost', port: 6379 },
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 }, // 2s, 4s, 8s, 16s, 32s
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

// Worker with rate limiting
const emailWorker = new Worker(
  'emails',
  async (job) => {
    const { template, to, data } = job.data;
    await resend.emails.send({
      from: 'tasks@nexa.com',
      to,
      react: templates[template](data),
    });
  },
  {
    connection: { host: 'localhost', port: 6379 },
    concurrency: 3, // Process 3 emails concurrently
    limiter: {
      max: 100, // Max 100 emails
      duration: 60000, // per minute (Resend limit: 1000/min)
    },
  }
);
```

### Usage in Hono Route

```typescript
// routes/tasks.ts
app.post('/tasks/:id/assign', async (c) => {
  const task = await assignTask(c.req.param('id'), userId);

  // Queue email instead of blocking
  await emailQueue.add('task-assigned', {
    template: 'taskAssigned',
    to: task.assignee.email,
    data: { task, assignee: task.assignee },
  });

  return c.json({ success: true, task });
});
```

---

## 3. React Email Templates

### Structure

```
emails/
├── task-assigned.tsx
├── task-status-changed.tsx
├── task-comment.tsx
├── task-mentioned.tsx
└── components/
    ├── task-card.tsx
    └── button.tsx
```

### Example: Task Assigned

```tsx
// emails/task-assigned.tsx
import { Html, Body, Container, Heading, Text, Button, Section } from '@react-email/components';

interface TaskAssignedProps {
  task: { id: string; title: string; priority: string };
  assignee: { name: string };
  assigner: { name: string };
}

export const TaskAssignedEmail = ({ task, assignee, assigner }: TaskAssignedProps) => (
  <Html>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New Task Assigned</Heading>
        <Text style={text}>
          Hi {assignee.name}, {assigner.name} assigned you a task:
        </Text>

        <Section style={taskCard}>
          <Text style={taskTitle}>{task.title}</Text>
          <Text style={taskMeta}>Priority: {task.priority}</Text>
        </Section>

        <Button href={`https://app.nexa.com/tasks/${task.id}`} style={button}>
          View Task
        </Button>
      </Container>
    </Body>
  </Html>
);

const main = { backgroundColor: '#f6f9fc', fontFamily: 'sans-serif' };
const container = { margin: 'auto', padding: '40px 20px' };
const h1 = { fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' };
const text = { fontSize: '16px', lineHeight: '24px', color: '#404040' };
const taskCard = { backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #e0e0e0' };
const taskTitle = { fontSize: '18px', fontWeight: '600', marginBottom: '8px' };
const taskMeta = { fontSize: '14px', color: '#666' };
const button = { backgroundColor: '#5469d4', color: '#fff', padding: '12px 24px', borderRadius: '4px', textDecoration: 'none' };
```

---

## 4. Rate Limiting Strategy

### Provider Limits
- **Resend:** 1000 emails/min (free tier: 100/day)
- **SendGrid:** 100 emails/sec (adjustable)

### Multi-Layer Protection

```typescript
// 1. BullMQ Worker Limiter (see Section 2)
limiter: { max: 100, duration: 60000 }

// 2. Batch Watchers for Same Event
async function notifyWatchers(taskId: string, event: string) {
  const watchers = await getWatchers(taskId);

  if (watchers.length > 50) {
    // Batch into groups of 50
    const batches = chunk(watchers, 50);
    for (const batch of batches) {
      await emailQueue.addBulk(
        batch.map(w => ({
          name: event,
          data: { to: w.email, ... },
          opts: { delay: 5000 } // Delay between batches
        }))
      );
    }
  } else {
    // Send immediately
    await emailQueue.addBulk(...);
  }
}

// 3. Idempotency Keys (prevent duplicate sends)
import { randomUUID } from 'crypto';

await resend.emails.send(emailData, {
  idempotencyKey: randomUUID(), // Resend deduplicates retries
});
```

---

## 5. Notification Types

### Implementation Map

| Event | Template | Trigger | Priority |
|-------|----------|---------|----------|
| **Task Assigned** | `task-assigned.tsx` | `POST /tasks/:id/assign` | High |
| **Status Changed** | `task-status-changed.tsx` | `PATCH /tasks/:id/status` | Medium |
| **Comment Added** | `task-comment.tsx` | `POST /tasks/:id/comments` | Low |
| **User Mentioned** | `task-mentioned.tsx` | Comment parser detects `@username` | High |
| **Due Date Soon** | `task-due-reminder.tsx` | Cron job (daily) | Medium |

### Mention Detection

```typescript
// utils/mention-parser.ts
export function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g;
  return [...text.matchAll(mentionRegex)].map(m => m[1]);
}

// In comment route
app.post('/tasks/:id/comments', async (c) => {
  const { text } = await c.req.json();
  const mentions = extractMentions(text);

  // Queue mention notifications
  for (const username of mentions) {
    const user = await getUserByUsername(username);
    await emailQueue.add('task-mentioned', {
      to: user.email,
      data: { task, comment: text, mentioner: c.get('user') },
    });
  }

  return c.json({ success: true });
});
```

---

## Unresolved Questions

1. **User Preferences:** Should we add "Email Notification Settings" (e.g., digest mode, mute notifications)?
2. **Email Deliverability:** Need SPF/DKIM/DMARC DNS setup - who owns domain configuration?
3. **Redis Hosting:** Local Redis vs managed (Upstash, Redis Cloud) for production?
4. **Webhook Logging:** Should we track open/click rates via Resend webhooks?
