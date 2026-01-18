import type { Database } from '@repo/db'
import { users } from '@repo/db/schema'
import { eq } from 'drizzle-orm'

type ClerkUser = {
  id: string
  emailAddresses: { emailAddress: string }[]
  firstName: string | null
  lastName: string | null
  imageUrl: string | null
}

export async function syncUser(db: Database, clerkUser: ClerkUser) {
  const email = clerkUser.emailAddresses[0]?.emailAddress
  if (!email) throw new Error('User has no email')

  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || email

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkUser.id))
    .limit(1)

  if (existing) {
    // Update existing user
    const [updated] = await db
      .update(users)
      .set({
        email,
        name,
        avatarUrl: clerkUser.imageUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning()

    if (!updated) {
      throw new Error('Failed to update user')
    }
    return updated
  }

  // Create new user
  const [created] = await db
    .insert(users)
    .values({
      clerkId: clerkUser.id,
      email,
      name,
      avatarUrl: clerkUser.imageUrl,
    })
    .returning()

  if (!created) {
    throw new Error('Failed to create user')
  }
  return created
}

export async function getUserByClerkId(db: Database, clerkId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1)
  return user || null
}
