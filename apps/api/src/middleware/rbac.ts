import type { Permission, Role } from '@repo/shared'
import { hasAnyPermission, hasPermission } from '@repo/shared'
import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { ForbiddenError, UnauthorizedError } from '../lib/errors'
import type { Variables } from '../types/context'

// Require specific role(s)
export const requireRole = (...allowedRoles: Role[]) => {
  return createMiddleware<{ Variables: Variables }>(async (c, next) => {
    const user = c.var.user

    if (!user) {
      throw new UnauthorizedError()
    }

    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenError(
        `Role ${user.role} not allowed. Required: ${allowedRoles.join(' or ')}`,
      )
    }

    await next()
  })
}

// Require specific permission(s)
export const requirePermission = (...permissions: Permission[]) => {
  return createMiddleware<{ Variables: Variables }>(async (c, next) => {
    const user = c.var.user

    if (!user) {
      throw new UnauthorizedError()
    }

    if (!hasAnyPermission(user.role, permissions)) {
      throw new ForbiddenError(
        `Permission denied. Required: ${permissions.join(' or ')}`,
      )
    }

    await next()
  })
}

// Check if user can modify resource
export const requireOwnerOrRole = (
  getOwnerId: (c: Context<{ Variables: Variables }>) => Promise<string | null>,
  ...allowedRoles: Role[]
) => {
  return createMiddleware<{ Variables: Variables }>(async (c, next) => {
    const user = c.var.user

    if (!user) {
      throw new UnauthorizedError()
    }

    // Super admin can do anything
    if (allowedRoles.includes(user.role)) {
      await next()
      return
    }

    // Check ownership
    const ownerId = await getOwnerId(c)
    if (ownerId !== user.id) {
      throw new ForbiddenError('You can only modify your own resources')
    }

    await next()
  })
}
