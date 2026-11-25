import type { AccessRole, AuthUser } from '@/lib/auth';

/**
 * Client-side permission map. This only decides what the UI shows; the
 * database (RLS + guard triggers) is what actually enforces access.
 */
export type Permission =
  | 'chat.use'
  | 'projects.use'
  | 'projects.create'
  | 'attendance.self'
  | 'attendance.team'
  | 'people.view'
  | 'people.manage'
  | 'departments.manage'
  | 'salaries.view'
  | 'permissions.manage'
  | 'logs.view'
  | 'settings.manage'
  | 'notifications.view'
  | 'flowmath.use'
  | 'flowpay.use';

const ROLE_PERMISSIONS: Record<AccessRole, ReadonlySet<Permission>> = {
  member: new Set<Permission>([
    'chat.use',
    'projects.use',
    'attendance.self',
    'notifications.view',
  ]),
  manager: new Set<Permission>([
    'chat.use',
    'projects.use',
    'projects.create',
    'attendance.self',
    'attendance.team',
    'people.view',
    'salaries.view',
    'notifications.view',
  ]),
  admin: new Set<Permission>([
    'chat.use',
    'projects.use',
    'projects.create',
    'attendance.self',
    'attendance.team',
    'people.view',
    'people.manage',
    'departments.manage',
    'salaries.view',
    'permissions.manage',
    'logs.view',
    'settings.manage',
    'notifications.view',
  ]),
};

export function can(user: AuthUser | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  if (permission === 'flowmath.use') return user.canAccessFlowMath;
  if (permission === 'flowpay.use') return user.canAccessFlowPay;
  return ROLE_PERMISSIONS[user.accessRole]?.has(permission) ?? false;
}

export function roleLabel(role: AccessRole | undefined): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'manager':
      return 'Manager';
    default:
      return 'Member';
  }
}
