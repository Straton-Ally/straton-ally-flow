import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Search, Bell, MessageSquare, LogOut } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

const navItems = [
  { label: 'Overview', href: '/admin/dashboard' },
  { label: 'Recruitment', href: '/admin/recruitment' },
  { label: 'Attendance', href: '/admin/attendance' },
  { label: 'Payroll Management', href: '/admin/salaries' },
  { label: 'Work Management', href: '/admin/work' },
  { label: 'Logs', href: '/admin/logs' },
];

export function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = user?.fullName?.split(' ')[0] || 'User';
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    const refreshUnreadCount = async () => {
      const { count } = await supabase
        .from('work_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setUnreadNotifications(count ?? 0);
    };

    refreshUnreadCount();

    const realtime = supabase
      .channel(`admin_work_notifications_badge:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'work_notifications', filter: `user_id=eq.${user.id}` },
        () => refreshUnreadCount(),
      )
      .subscribe();

    return () => {
      realtime.unsubscribe();
    };
  }, [user?.id]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/90 backdrop-blur-xl supports-[backdrop-filter]:bg-card/80">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-6">
          {/* Logo */}
          <Link to="/admin/dashboard" className="relative flex h-9 w-[132px] items-center overflow-hidden" aria-label="FLOW HR dashboard">
            <img 
              src="/logo.png" 
              alt="FLOW by Straton Ally" 
              className="absolute left-[-7px] top-[-54px] h-[150px] w-[150px] max-w-none object-contain"
            />
          </Link>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href === '/admin/dashboard' && location.pathname === '/admin');
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'nav-tab',
                    isActive
                      ? 'nav-tab-active'
                      : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Search + Actions */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search"
              className="w-[160px] lg:w-[200px] pl-9 h-8 text-sm bg-muted/50 border-0 focus-visible:ring-1"
            />
          </div>

          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MessageSquare className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 relative"
            onClick={() => navigate('/admin/notifications')}
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadNotifications > 0 ? (
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
            ) : null}
          </Button>

          <ThemeToggle />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 rounded-full p-0">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                    {firstName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.fullName || 'User'}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/admin/settings" className="cursor-pointer">
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                <LogOut className="h-4 w-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
