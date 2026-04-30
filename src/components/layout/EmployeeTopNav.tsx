import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Search, Bell, Briefcase, LogOut } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  { label: 'Dashboard', href: '/employee/dashboard' },
  { label: 'Attendance', href: '/employee/attendance' },
  { label: 'Workspace', href: '/employee/work' },
  { label: 'Salary', href: '/employee/salary' },
];

export function EmployeeTopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = user?.fullName?.split(' ')[0] || 'User';
  const [unreadWorkNotifications, setUnreadWorkNotifications] = useState(0);

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    if (!user?.id) return;

    const refreshUnreadCount = async () => {
      const { count } = await supabase
        .from('work_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setUnreadWorkNotifications(count ?? 0);
    };

    refreshUnreadCount();

    const realtime = supabase
      .channel(`work_notifications_badge:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'work_notifications', filter: `user_id=eq.${user.id}` },
        () => refreshUnreadCount()
      )
      .subscribe();

    return () => {
      realtime.unsubscribe();
    };
  }, [user?.id]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-6">
          {/* Logo */}
          <Link to="/employee/dashboard" className="flex items-center gap-2">
            <img 
              src="/logo.png" 
              alt="FLOW by Straton Ally" 
              className="w-32 h-32 rounded-lg object-contain mt-2"
            />
          </Link>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href === '/employee/dashboard' && location.pathname === '/employee');
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-success text-success-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
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

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/employee/work')} title="Workspace">
            <Briefcase className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 relative"
            onClick={() => navigate('/employee/notifications')}
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadWorkNotifications > 0 ? (
              <span className="absolute top-1 right-1 w-2 h-2 bg-success rounded-full" />
            ) : null}
          </Button>

          <ThemeToggle />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 rounded-full p-0">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatarUrl || ''} />
                  <AvatarFallback className="bg-success text-success-foreground text-xs font-medium">
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
              <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/employee/settings')}>
                Settings
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
