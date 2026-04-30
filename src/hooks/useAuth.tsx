import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AuthUser, getCurrentUser, getRedirectPath } from '@/lib/auth';
import type { Session } from '@supabase/supabase-js';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
  skipRedirect: boolean;
  setSkipRedirect: (skip: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const PASSWORD_RESET_PATH = '/reset-password';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [skipRedirect, setSkipRedirect] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const fetchUser = async () => {
    const authUser = await getCurrentUser();
    setUser(authUser);
    return authUser;
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);

        if (event === 'PASSWORD_RECOVERY') {
          navigate(PASSWORD_RESET_PATH, { replace: true });
          setIsLoading(false);
          return;
        }
        
        if (event === 'SIGNED_IN' && newSession && !skipRedirect) {
          if (location.pathname === PASSWORD_RESET_PATH) {
            setIsLoading(false);
            return;
          }

          // Use setTimeout to prevent state update conflicts
          setTimeout(async () => {
            const authUser = await fetchUser();
            // Check if this is a user creation that should skip redirect
            const shouldSkip = newSession.user?.user_metadata?.created_by_admin;
            
            // Only redirect if we have a user with a role and we're not on admin pages
            // and this isn't a user creation operation
            if (authUser?.role && !location.pathname.startsWith('/admin') && !shouldSkip) {
              const redirectPath = getRedirectPath(authUser.role);
              navigate(redirectPath, { replace: true });
            }
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setSkipRedirect(false);
          navigate('/login', { replace: true });
        }
      }
    );

    // THEN get initial session
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      setSession(initialSession);
      if (initialSession) {
        await fetchUser();
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    const playNotificationSound = () => {
      try {
        const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;
        const audioContext = new AudioContextClass();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.4);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.42);
      } catch {
        // Sound is best effort; browsers may block it until the user interacts with the page.
      }
    };

    const submitOvertimeRequest = async (attendanceId?: string) => {
      if (!attendanceId) {
        window.location.href = '/employee/attendance';
        return;
      }

      const { error } = await (supabase as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: Error | null }>;
      }).rpc('submit_overtime_request', {
        _attendance_id: attendanceId,
        _reason: 'Working overtime',
      });

      if (error) {
        toast({
          title: 'Overtime request failed',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'OT request submitted',
        description: 'OT request submitted to Team Lead/Supervisor.',
      });
    };

    const channel = supabase
      .channel(`work_notifications_popup:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'work_notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (typeof window === 'undefined') return;

          const isFocused =
            typeof document !== 'undefined' &&
            (document.visibilityState === 'visible' && (typeof document.hasFocus !== 'function' || document.hasFocus()));

          const row = payload.new as unknown as {
            id?: string;
            title?: string;
            body?: string | null;
            office_id?: string | null;
            channel_id?: string | null;
            type?: string;
            action_url?: string | null;
            metadata?: { attendance_id?: string } | null;
          };

          const url = row.action_url || (user?.role === 'admin' ? '/admin/work' : '/employee/work');

          playNotificationSound();

          if (row.type === 'attendance_checkout_reminder') {
            toast({
              title: row.title || 'Checkout reminder',
              description: row.body || 'Your scheduled checkout is almost due.',
              action: (
                <ToastAction altText="Request overtime" onClick={() => submitOvertimeRequest(row.metadata?.attendance_id)}>
                  I am working overtime
                </ToastAction>
              ),
            });
          } else if (isFocused) {
            toast({
              title: row.title || 'Notification',
              description: row.body || undefined,
            });
          }

          const canNotify =
            typeof Notification !== 'undefined' &&
            Notification.permission === 'granted' &&
            !isFocused;

          if (!canNotify) return;

          void (async () => {
            const registration = await navigator.serviceWorker?.getRegistration();
            const pushSubscription = await registration?.pushManager?.getSubscription?.();

            if (pushSubscription) {
              return;
            }

            if (registration) {
              await registration.showNotification(row.title || 'Notification', {
                body: row.body || undefined,
                tag: row.id,
                data: { url },
              });
              return;
            }

            const notification = new Notification(row.title || 'Notification', {
              body: row.body || undefined,
              tag: row.id,
              data: { url },
            });

            notification.onclick = () => {
              notification.close();
              window.focus();
              window.location.href = url;
            };

            window.setTimeout(() => notification.close(), 8000);
          })();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [session?.user?.id, user?.role]);

  const refetch = async () => {
    await fetchUser();
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, refetch, skipRedirect, setSkipRedirect }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
