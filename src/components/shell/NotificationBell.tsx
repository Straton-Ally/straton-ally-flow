import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { getNotificationsHref } from './nav';

export const unreadNotificationsKey = (userId: string | undefined) => ['notifications', 'unread', userId] as const;

export function NotificationBell({ className }: { className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: unread = 0 } = useQuery({
    queryKey: unreadNotificationsKey(user?.id),
    enabled: Boolean(user?.id),
    staleTime: 30_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('work_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('is_read', false);
      if (error) throw error;
      return count ?? 0;
    },
  });

  if (!user) return null;

  return (
    <button
      type="button"
      onClick={() => navigate(getNotificationsHref(user))}
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      className={cn(
        'relative flex h-10 w-10 items-center justify-center rounded-md text-rail-foreground transition-colors',
        'hover:bg-white/5 hover:text-rail-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <Bell className="h-[18px] w-[18px]" />
      {unread > 0 ? (
        <span className="absolute right-1 top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-4 text-primary-foreground">
          {unread > 9 ? '9+' : unread}
        </span>
      ) : null}
    </button>
  );
}
