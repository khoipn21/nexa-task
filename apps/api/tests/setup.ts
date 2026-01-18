import { beforeAll, beforeEach } from 'bun:test'
import * as schema from '@repo/db/schema'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

// Use test database
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5433/nexa_task'

const pool = new Pool({
  connectionString: TEST_DB_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})
export const testDb = drizzle(pool, { schema })

// Cleanup pool on process exit instead of afterAll to avoid parallel test issues
process.on('exit', () => {
  pool.end().catch(() => {})
})
process.on('SIGINT', () => {
  pool.end().catch(() => {})
  process.exit(0)
})
process.on('SIGTERM', () => {
  pool.end().catch(() => {})
  process.exit(0)
})

beforeAll(async () => {
  // Ensure test database exists and is ready
  try {
    await pool.query('SELECT 1')
  } catch (error) {
    console.error('Test database connection failed:', error)
    throw error
  }
})

beforeEach(async () => {
  // Clean tables before each test in correct order (respecting foreign keys)
  await testDb.delete(schema.activityLogs)
  await testDb.delete(schema.comments)
  await testDb.delete(schema.attachments)
  await testDb.delete(schema.taskWatchers)
  await testDb.delete(schema.taskDependencies)
  await testDb.delete(schema.tasks)
  await testDb.delete(schema.workflowStatuses)
  await testDb.delete(schema.projects)
  await testDb.delete(schema.invitations)
  await testDb.delete(schema.workspaceMembers)
  await testDb.delete(schema.workspaces)
  await testDb.delete(schema.users)
})
