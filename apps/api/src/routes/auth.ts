import { Hono } from 'hono'
import { Webhook } from 'svix'
import { getAuthUser } from '../lib/errors'
import { success } from '../lib/response'
import { requireAuth } from '../middleware/auth'
import { syncUser } from '../services/user-sync'
import type { Variables } from '../types/context'

// Clerk webhook event type
interface ClerkWebhookEvent {
  type: string
  data: {
    id: string
    email_addresses?: Array<{ email_address: string }>
    first_name?: string | null
    last_name?: string | null
    image_url?: string | null
    [key: string]: unknown
  }
}

const auth = new Hono<{ Variables: Variables }>()

// Get current user
auth.get('/me', requireAuth, (c) => {
  const user = getAuthUser(c.var)
  return success(c, {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    workspaceId: user.workspaceId,
  })
})

// Clerk webhook for user events
auth.post('/webhook/clerk', async (c) => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('CLERK_WEBHOOK_SECRET not configured')
    return c.json({ error: 'Webhook not configured' }, 500)
  }

  const svixId = c.req.header('svix-id')
  const svixTimestamp = c.req.header('svix-timestamp')
  const svixSignature = c.req.header('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return c.json({ error: 'Missing headers' }, 400)
  }

  const body = await c.req.text()

  try {
    const wh = new Webhook(webhookSecret)
    const evt = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent

    const db = c.var.db

    switch (evt.type) {
      case 'user.created':
      case 'user.updated':
        // Transform Clerk webhook snake_case to camelCase for syncUser
        await syncUser(db, {
          id: evt.data.id,
          emailAddresses: (evt.data.email_addresses || []).map((e) => ({
            emailAddress: e.email_address,
          })),
          firstName: evt.data.first_name ?? null,
          lastName: evt.data.last_name ?? null,
          imageUrl: evt.data.image_url ?? null,
        })
        break
      // Handle other events as needed
    }

    return c.json({ received: true })
  } catch (err) {
    console.error('Webhook verification failed:', err)
    return c.json({ error: 'Invalid signature' }, 400)
  }
})

export default auth
