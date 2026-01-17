export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode = 500,
    public code = 'INTERNAL_ERROR',
    public details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id ${id} not found` : `${resource} not found`,
      404,
      'NOT_FOUND',
    )
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED')
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN')
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super('Validation failed', 400, 'VALIDATION_ERROR', details)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT')
  }
}

// Helper to safely get authenticated user from context
export function getAuthUser<
  T extends { user?: { id: string; workspaceId?: string | null } | null },
>(vars: T): NonNullable<T['user']> {
  const user = vars.user
  if (!user) {
    throw new UnauthorizedError('User not authenticated')
  }
  return user
}

// Helper to safely get workspace ID from user
export function getWorkspaceId(user: { workspaceId?: string | null }): string {
  const workspaceId = user.workspaceId
  if (!workspaceId) {
    throw new ForbiddenError('No workspace selected')
  }
  return workspaceId
}
