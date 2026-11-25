import { useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { can, type Permission } from '@/lib/permissions';

export function usePermissions() {
  const { user } = useAuth();
  const check = useCallback((permission: Permission) => can(user, permission), [user]);
  return { can: check, role: user?.accessRole ?? 'member', user };
}
