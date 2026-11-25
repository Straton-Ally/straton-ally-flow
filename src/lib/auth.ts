import { supabase } from "@/utils/supabase";
import type { User } from "@supabase/supabase-js";

/** Legacy primary role used by existing admin/employee pages. */
export type AppRole = 'admin' | 'employee';

/** Access level used for RBAC: admin > manager > member. */
export type AccessRole = 'admin' | 'manager' | 'member';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: AppRole | null;
  /** Admin, Manager or Member. Managers are covered by reporting lines and office-lead flags. */
  accessRole: AccessRole;
  /** True for managers. Kept for existing pages that still read it. */
  isTeamLead: boolean;
  officeId: string | null;
  employeeId: string | null;
  avatarUrl: string | null;
  canAccessFlowMath: boolean;
  canAccessFlowPay: boolean;
}

interface GetMeResponse {
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  status: string | null;
  role: AccessRole;
  employee: { id: string; office_id: string | null } | null;
  can_access_flowmath: boolean;
  can_access_flowpay: boolean;
}

const ALLOWED_DOMAIN = "@stratonally.com";

export function isAllowedEmail(email: string): boolean {
  return email.toLowerCase().endsWith(ALLOWED_DOMAIN);
}

export async function signIn(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  // Validate email domain
  if (!isAllowedEmail(email)) {
    return { user: null, error: `Only ${ALLOWED_DOMAIN} email addresses are allowed` };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { user: null, error: error.message };
  }

  return { user: data.user, error: null };
}

export async function requestPasswordReset(email: string): Promise<{ error: string | null }> {
  if (!isAllowedEmail(email)) {
    return { error: `Only ${ALLOWED_DOMAIN} email addresses are allowed` };
  }

  const redirectTo = `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function updatePassword(password: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** One round trip: profile, access role, employee record and module access. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data, error } = await supabase.rpc('get_me');
  if (error || !data) return null;

  const me = data as unknown as GetMeResponse;
  const accessRole: AccessRole = me.role ?? 'member';

  return {
    id: me.user_id,
    email: me.email || '',
    fullName: me.full_name || 'User',
    role: accessRole === 'admin' ? 'admin' : 'employee',
    accessRole,
    isTeamLead: accessRole === 'manager',
    officeId: me.employee?.office_id ?? null,
    employeeId: me.employee?.id ?? null,
    avatarUrl: me.avatar_url || null,
    canAccessFlowMath: Boolean(me.can_access_flowmath),
    canAccessFlowPay: Boolean(me.can_access_flowpay),
  };
}

export async function getUserRole(userId: string): Promise<AppRole | null> {
  const { data } = await supabase
    .rpc('get_user_role', { _user_id: userId });
  
  return data as AppRole | null;
}

export function getRedirectPath(role: AppRole | null, isTeamLead = false): string {
  if (role === 'admin' || isTeamLead) return '/admin/dashboard';
  if (role === 'employee') return '/employee/dashboard';
  return '/login';
}
