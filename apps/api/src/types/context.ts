import type { Database } from '@repo/db'
import type { Role } from '@repo/shared'

export type AuthUser = {
  id: string // Local user ID (UUID)
  clerkId: string // Clerk user ID
  email: string
  name: string
  role: Role
  orgId: string | null // Clerk organization ID
  workspaceId: string | null // Local workspace ID
}

export type Variables = {
  db: Database
  user: AuthUser | null
  requestId: string
}
