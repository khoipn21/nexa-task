export type Role = 'super_admin' | 'pm' | 'member' | 'guest'

export type Permission =
  | 'workspace:read'
  | 'workspace:update'
  | 'workspace:delete'
  | 'workspace:invite'
  | 'project:create'
  | 'project:read'
  | 'project:update'
  | 'project:delete'
  | 'task:create'
  | 'task:read'
  | 'task:update'
  | 'task:delete'
  | 'task:assign'
  | 'comment:create'
  | 'comment:read'
  | 'comment:update'
  | 'comment:delete'

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    'workspace:read',
    'workspace:update',
    'workspace:delete',
    'workspace:invite',
    'project:create',
    'project:read',
    'project:update',
    'project:delete',
    'task:create',
    'task:read',
    'task:update',
    'task:delete',
    'task:assign',
    'comment:create',
    'comment:read',
    'comment:update',
    'comment:delete',
  ],
  pm: [
    'workspace:read',
    'workspace:invite',
    'project:create',
    'project:read',
    'project:update',
    'task:create',
    'task:read',
    'task:update',
    'task:assign',
    'comment:create',
    'comment:read',
    'comment:update',
    'comment:delete',
  ],
  member: [
    'workspace:read',
    'project:read',
    'task:create',
    'task:read',
    'task:update',
    'comment:create',
    'comment:read',
    'comment:update',
  ],
  guest: ['workspace:read', 'project:read', 'task:read', 'comment:read'],
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function hasAnyPermission(
  role: Role,
  permissions: Permission[],
): boolean {
  return permissions.some((p) => hasPermission(role, p))
}

export function hasAllPermissions(
  role: Role,
  permissions: Permission[],
): boolean {
  return permissions.every((p) => hasPermission(role, p))
}
