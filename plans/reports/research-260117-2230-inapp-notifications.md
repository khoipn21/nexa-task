# In-App Notification System Research

**Date:** 2026-01-17
**Researcher:** ac053b3
**Stack:** React + Hono WebSocket + PostgreSQL + Redis

## Executive Summary

In-app notification system requires: PostgreSQL storage, Redis pub/sub for broadcasting, Hono WebSocket endpoints, React hooks for real-time updates, Mantine UI components for bell icon/badge.

---

## 1. Notification Storage (PostgreSQL)

### Schema Design

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'task_assigned', 'comment', 'mention', etc.
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}', -- event-specific metadata
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_user_unread (user_id, read, created_at DESC),
  INDEX idx_user_created (user_id, created_at DESC)
);

CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled_types TEXT[] DEFAULT ARRAY['task_assigned', 'comment', 'mention'],
  muted_until TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Key Design Decisions

- **UUID primary keys** for distributed scalability
- **JSONB data field** for flexible event payloads
- **Composite indexes** on (user_id, read, created_at) for fast unread queries
- **Preference table** for per-user notification settings

---

## 2. Real-Time Delivery (Redis + Hono WebSocket)

### Redis Pub/Sub Pattern

```typescript
// Publisher (when creating notification)
import { createClient } from 'redis';

const redis = createClient();

async function publishNotification(userId: string, notification: Notification) {
  await redis.publish(
    `notifications:${userId}`,
    JSON.stringify(notification)
  );
}
```

### Hono WebSocket Endpoint

```typescript
import { Hono } from 'hono';
import { upgradeWebSocket } from 'hono/bun'; // or /cloudflare-workers, /deno
import { createClient } from 'redis';

const app = new Hono();

app.get(
  '/ws/notifications',
  upgradeWebSocket((c) => {
    const userId = c.req.query('userId'); // or from auth token
    const redis = createClient();

    return {
      async onOpen(_event, ws) {
        await redis.connect();
        await redis.subscribe(`notifications:${userId}`, (message) => {
          ws.send(message); // Forward notification to client
        });
      },

      onMessage(event, ws) {
        const msg = JSON.parse(event.data);
        if (msg.type === 'mark_read') {
          // Handle mark as read request
        }
      },

      async onClose() {
        await redis.unsubscribe(`notifications:${userId}`);
        await redis.quit();
      },
    };
  })
);

export default { fetch: app.fetch, websocket };
```

### Architecture Flow

1. User action triggers notification creation → Insert to PostgreSQL
2. Backend publishes to Redis channel: `notifications:{userId}`
3. WebSocket connection subscribed to user's channel receives message
4. WebSocket forwards to connected React client
5. React updates UI immediately

---

## 3. Bell Icon UI (Mantine)

### Notification Bell Component

```tsx
import { ActionIcon, Indicator, Popover, ScrollArea, Text, Badge, Group, Stack } from '@mantine/core';
import { IconBell } from '@tabler/icons-react';
import { useState } from 'react';

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [opened, setOpened] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <Popover opened={opened} onChange={setOpened} width={360} position="bottom-end">
      <Popover.Target>
        <Indicator
          label={unreadCount}
          disabled={unreadCount === 0}
          size={16}
          color="red"
        >
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={() => setOpened(!opened)}
          >
            <IconBell size={20} />
          </ActionIcon>
        </Indicator>
      </Popover.Target>

      <Popover.Dropdown p={0}>
        <Group justify="space-between" p="sm" style={{ borderBottom: '1px solid #e9ecef' }}>
          <Text fw={600}>Notifications</Text>
          {unreadCount > 0 && <Badge size="sm">{unreadCount} new</Badge>}
        </Group>

        <ScrollArea h={400}>
          <Stack gap={0}>
            {notifications.map(notif => (
              <NotificationItem key={notif.id} notification={notif} />
            ))}
          </Stack>
        </ScrollArea>
      </Popover.Dropdown>
    </Popover>
  );
}
```

### Toast Notifications (Mantine)

```tsx
import { notifications } from '@mantine/notifications';
import { IconCheck } from '@tabler/icons-react';

// Show toast when notification arrives
function showNotificationToast(notif: Notification) {
  notifications.show({
    title: notif.title,
    message: notif.message,
    color: 'blue',
    icon: <IconCheck size={16} />,
    autoClose: 5000,
  });
}
```

---

## 4. WebSocket Hook (React)

### Custom Hook Pattern

```tsx
import { useEffect, useRef, useState } from 'react';

interface UseNotificationsOptions {
  userId: string;
  onNotification: (notification: Notification) => void;
}

function useNotifications({ userId, onNotification }: UseNotificationsOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:3000/ws/notifications?userId=${userId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      onNotification(notification);
    };

    ws.onclose = () => {
      setConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [userId, onNotification]);

  const markAsRead = (notificationId: string) => {
    wsRef.current?.send(JSON.stringify({
      type: 'mark_read',
      notificationId,
    }));
  };

  return { connected, markAsRead };
}
```

### Integration in Component

```tsx
function App() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { userId } = useAuth();

  const handleNotification = (notif: Notification) => {
    setNotifications(prev => [notif, ...prev]);
    showNotificationToast(notif);
  };

  const { markAsRead } = useNotifications({
    userId,
    onNotification: handleNotification,
  });

  return <NotificationBell notifications={notifications} onMarkRead={markAsRead} />;
}
```

---

## 5. Notification Preferences

### Settings UI

```tsx
import { Checkbox, Stack } from '@mantine/core';

const NOTIFICATION_TYPES = [
  { value: 'task_assigned', label: 'Task assignments' },
  { value: 'comment', label: 'Comments on my tasks' },
  { value: 'mention', label: 'Mentions (@username)' },
  { value: 'status_change', label: 'Task status changes' },
];

function NotificationSettings() {
  const [enabledTypes, setEnabledTypes] = useState<string[]>([]);

  return (
    <Stack>
      {NOTIFICATION_TYPES.map(type => (
        <Checkbox
          key={type.value}
          label={type.label}
          checked={enabledTypes.includes(type.value)}
          onChange={(e) => {
            setEnabledTypes(prev =>
              e.currentTarget.checked
                ? [...prev, type.value]
                : prev.filter(t => t !== type.value)
            );
          }}
        />
      ))}
    </Stack>
  );
}
```

### Backend Filtering

```typescript
async function createNotification(userId: string, type: string, data: NotificationData) {
  // Check user preferences
  const prefs = await db.query(
    'SELECT enabled_types FROM notification_preferences WHERE user_id = $1',
    [userId]
  );

  if (!prefs.rows[0]?.enabled_types.includes(type)) {
    return; // User has disabled this notification type
  }

  // Create notification
  const notif = await db.query(
    'INSERT INTO notifications (user_id, type, title, message, data) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [userId, type, data.title, data.message, JSON.stringify(data.meta)]
  );

  // Publish to Redis
  await publishNotification(userId, notif.rows[0]);
}
```

---

## 6. Mark as Read

### Individual Read

```typescript
// API endpoint
app.patch('/api/notifications/:id/read', async (c) => {
  const { id } = c.req.param();
  const userId = c.get('userId'); // from auth middleware

  await db.query(
    'UPDATE notifications SET read = true, read_at = NOW() WHERE id = $1 AND user_id = $2',
    [id, userId]
  );

  return c.json({ success: true });
});
```

### Bulk Read

```typescript
// Mark all as read
app.post('/api/notifications/read-all', async (c) => {
  const userId = c.get('userId');

  await db.query(
    'UPDATE notifications SET read = true, read_at = NOW() WHERE user_id = $1 AND read = false',
    [userId]
  );

  return c.json({ success: true });
});
```

---

## Implementation Checklist

- [ ] Create PostgreSQL migrations for notifications + preferences tables
- [ ] Setup Redis client in Hono backend
- [ ] Implement WebSocket endpoint with Redis pub/sub subscription
- [ ] Build `useNotifications` React hook
- [ ] Create NotificationBell component with Mantine Indicator/Popover
- [ ] Add notification preferences UI
- [ ] Implement mark as read endpoints (individual + bulk)
- [ ] Setup Mantine Notifications provider for toast messages
- [ ] Add notification creation logic in relevant business operations
- [ ] Test real-time delivery across multiple tabs/devices

---

## Unresolved Questions

1. **Persistence**: How long to retain read notifications? (Suggest: 30 days, then archive/delete)
2. **Rate limiting**: Prevent notification spam for high-frequency events?
3. **Offline handling**: Queue notifications if WebSocket disconnected? (Use polling fallback?)
4. **Push notifications**: Extend to browser push API for background notifications?
