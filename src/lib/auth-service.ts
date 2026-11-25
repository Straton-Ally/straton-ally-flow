import { supabase } from '@/integrations/supabase/client';

/**
 * Creates a login for a new employee through the admin-only
 * `admin-create-user` edge function. The admin's own session is untouched.
 */
export async function createUserAsAdmin(userData: {
  email: string;
  password: string;
  fullName: string;
  role: 'admin' | 'employee';
}): Promise<{ id: string; email?: string }> {
  const { data, error } = await supabase.functions.invoke<{ user?: { id: string; email?: string }; error?: string }>(
    'admin-create-user',
    {
      body: {
        email: userData.email,
        password: userData.password,
        fullName: userData.fullName,
      },
    },
  );

  if (error) {
    // FunctionsHttpError carries the JSON body with our error message
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === 'function') {
      const body = await context.json().catch(() => null);
      if (body?.error) throw new Error(body.error);
    }
    throw error;
  }
  if (!data?.user) throw new Error(data?.error ?? 'Failed to create user');

  return data.user;
}
