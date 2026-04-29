import { supabase } from "@/utils/supabase";
import type { User } from "@supabase/supabase-js";

export type AppRole = 'admin' | 'employee';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: AppRole | null;
  avatarUrl: string | null;
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

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  // Get role using RPC function
  const { data: role } = await supabase
    .rpc('get_user_role', { _user_id: user.id });

  return {
    id: user.id,
    email: user.email || '',
    fullName: profile?.full_name || 'User',
    role: role as AppRole | null,
    avatarUrl: profile?.avatar_url || null,
  };
}

export async function getUserRole(userId: string): Promise<AppRole | null> {
  const { data } = await supabase
    .rpc('get_user_role', { _user_id: userId });
  
  return data as AppRole | null;
}

export function getRedirectPath(role: AppRole | null): string {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'employee':
      return '/employee/dashboard';
    default:
      return '/login';
  }
}
