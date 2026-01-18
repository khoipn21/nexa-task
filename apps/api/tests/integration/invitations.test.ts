import { db } from '@nexa/db'
import { users, workspaces, invitations } from '@nexa/db/schema'
import { app } from '../../src/app'
import { generateAuthHeaders, seedDb } from '../helpers'
import { DrizzleSQLiteAsyncAdapter } from '@lucia-auth/adapter-drizzle'
import { D1Database } from '@cloudflare/workers-types'
import { subDays } from 'date-fns'
import { eq } from 'drizzle-orm'

// Mock the D1Database and Drizzle adapter for testing
// This assumes your tests run in an environment where D1 is available or can be mocked
// For actual integration tests, you might connect to a test database directly.
const mockDb = db as any // This will need to be configured to use a test database
const adapter = new DrizzleSQLiteAsyncAdapter(mockDb, users, null as any) // `null as any` for sessions table

describe('Invitation API', () => {
  let user: typeof users.$inferSelect
  let workspace: typeof workspaces.$inferSelect
  let authHeaders: Record<string, string>

  beforeEach(async () => {
    // Clear and re-seed the database for each test
    await seedDb(mockDb)

    // Create a test user and workspace
    const [createdUser] = await mockDb
      .insert(users)
      .values({
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hashed_password',
      })
      .returning()
    user = createdUser

    const [createdWorkspace] = await mockDb
      .insert(workspaces)
      .values({
        name: 'Test Workspace',
        ownerId: user.id,
      })
      .returning()
    workspace = createdWorkspace

    authHeaders = generateAuthHeaders(user.id) // Helper to generate auth headers
  })

  afterEach(async () => {
    // Clean up database after each test
    await mockDb.delete(users)
    await mockDb.delete(workspaces)
    await mockDb.delete(invitations)
  })

  it('should send an invitation successfully', async () => {
    const inviteeEmail = 'invitee@example.com'
    const res = await app.request('/api/invitations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        inviteeEmail,
        workspaceId: workspace.id,
      }),
    })

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBeDefined()
    expect(json.inviteeEmail).toBe(inviteeEmail)
    expect(json.status).toBe('pending')
    expect(json.inviterId).toBe(user.id)
    expect(json.workspaceId).toBe(workspace.id)

    // Verify invitation exists in the database
    const dbInvitation = await mockDb.query.invitations.findFirst({
      where: eq(invitations.id, json.id),
    })
    expect(dbInvitation).toBeDefined()
    expect(dbInvitation?.inviteeEmail).toBe(inviteeEmail)
  })

  it('should not send an invitation with invalid email', async () => {
    const res = await app.request('/api/invitations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        inviteeEmail: 'invalid-email',
        workspaceId: workspace.id,
      }),
    })

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('should accept an invitation successfully', async () => {
    // First, send an invitation
    const inviteeEmail = 'newuser@example.com'
    const inviterAuthHeaders = generateAuthHeaders(user.id)
    const sendRes = await app.request('/api/invitations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...inviterAuthHeaders,
      },
      body: JSON.stringify({
        inviteeEmail,
        workspaceId: workspace.id,
      }),
    })
    const { invitationToken } = await sendRes.json()

    // Create a new user who will accept the invitation
    const [inviteeUser] = await mockDb
      .insert(users)
      .values({
        email: inviteeEmail,
        username: 'newuser',
        passwordHash: 'newhashed_password',
      })
      .returning()
    const inviteeAuthHeaders = generateAuthHeaders(inviteeUser.id)

    const res = await app.request('/api/invitations/accept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...inviteeAuthHeaders,
      },
      body: JSON.stringify({ token: invitationToken }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('accepted')
    expect(json.inviteeId).toBe(inviteeUser.id)

    // Verify invitation status in the database
    const dbInvitation = await mockDb.query.invitations.findFirst({
      where: eq(invitations.invitationToken, invitationToken),
    })
    expect(dbInvitation?.status).toBe('accepted')
    expect(dbInvitation?.inviteeId).toBe(inviteeUser.id)
    expect(dbInvitation?.acceptedAt).toBeDefined()
  })

  it('should not accept an expired invitation', async () => {
    // Send an invitation that is already expired
    const expiredDate = subDays(new Date(), 1)
    const [expiredInvitation] = await mockDb
      .insert(invitations)
      .values({
        inviterId: user.id,
        inviteeEmail: 'expired@example.com',
        invitationToken: 'expired_token',
        status: 'pending',
        expiresAt: expiredDate,
        workspaceId: workspace.id,
      })
      .returning()

    // Create a new user
    const [inviteeUser] = await mockDb
      .insert(users)
      .values({
        email: 'expired@example.com',
        username: 'expireduser',
        passwordHash: 'hashed_password',
      })
      .returning()
    const inviteeAuthHeaders = generateAuthHeaders(inviteeUser.id)

    const res = await app.request('/api/invitations/accept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...inviteeAuthHeaders,
      },
      body: JSON.stringify({ token: expiredInvitation.invitationToken }),
    })

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invitation not found or already accepted/expired.')
  })

  it('should get pending invitations for the inviter', async () => {
    // Send a few invitations
    await app.request('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        inviteeEmail: 'pending1@example.com',
        workspaceId: workspace.id,
      }),
    })
    await app.request('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        inviteeEmail: 'pending2@example.com',
        workspaceId: workspace.id,
      }),
    })

    const res = await app.request('/api/invitations/pending', {
      method: 'GET',
      headers: authHeaders,
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.invitations).toBeInstanceOf(Array)
    expect(json.invitations.length).toBe(2)
    expect(json.invitations[0].status).toBe('pending')
  })

  it('should cancel a pending invitation', async () => {
    // Send an invitation
    const inviteeEmail = 'tocancel@example.com'
    const sendRes = await app.request('/api/invitations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        inviteeEmail,
        workspaceId: workspace.id,
      }),
    })
    const { id: invitationId } = await sendRes.json()

    const res = await app.request(`/api/invitations/${invitationId}`, {
      method: 'DELETE',
      headers: authHeaders,
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('cancelled')

    // Verify invitation status in the database
    const dbInvitation = await mockDb.query.invitations.findFirst({
      where: eq(invitations.id, invitationId),
    })
    expect(dbInvitation?.status).toBe('cancelled')
  })

  it('should not cancel an invitation by unauthorized user', async () => {
    // Send an invitation by user1
    const [user1] = await mockDb
      .insert(users)
      .values({
        email: 'user1@example.com',
        username: 'user1',
        passwordHash: 'hashed_password',
      })
      .returning()
    const user1AuthHeaders = generateAuthHeaders(user1.id)

    const sendRes = await app.request('/api/invitations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...user1AuthHeaders,
      },
      body: JSON.stringify({
        inviteeEmail: 'unauthorized@example.com',
        workspaceId: workspace.id,
      }),
    })
    const { id: invitationId } = await sendRes.json()

    // Try to cancel with user2 (who is not the inviter)
    const [user2] = await mockDb
      .insert(users)
      .values({
        email: 'user2@example.com',
        username: 'user2',
        passwordHash: 'hashed_password',
      })
      .returning()
    const user2AuthHeaders = generateAuthHeaders(user2.id)

    const res = await app.request(`/api/invitations/${invitationId}`, {
      method: 'DELETE',
      headers: user2AuthHeaders,
    })

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe(
      'Invitation not found, not pending, or you do not have permission to cancel.',
    )

    // Verify invitation status is still pending in the database
    const dbInvitation = await mockDb.query.invitations.findFirst({
      where: eq(invitations.id, invitationId),
    })
    expect(dbInvitation?.status).toBe('pending')
  })
})
