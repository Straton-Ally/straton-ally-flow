import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Banknote,
  Clock,
  Shield,
  Settings,
  FileText,
  LogOut,
  ChevronRight,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOut } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

const navItems = [
  {
    title: 'Dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Recruitment',
    href: '/admin/recruitment',
    icon: Users,
  },
  {
    title: 'Departments',
    href: '/admin/departments',
    icon: Building2,
  },
  {
    title: 'Attendance',
    href: '/admin/attendance',
    icon: Clock,
  },
  {
    title: 'Salary & Wages',
    href: '/admin/salaries',
    icon: Banknote,
  },
  {
    title: 'Leave Management',
    href: '/admin/leave',
    icon: Calendar,
  },
  {
    title: 'Permissions',
    href: '/admin/permissions',
    icon: Shield,
  },
  {
    title: 'Logs',
    href: '/admin/logs',
    icon: FileText,
  },
];

const settingsItems = [
  {
    title: 'Settings',
    href: '/admin/settings',
    icon: Settings,
  },
];

export function AdminSidebar() {
  const location = useLocation();
  const { user } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  const isActive = (href: string) => location.pathname === href;

  return (
    <aside className="flex flex-col h-screen w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5">
        <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
          <span className="text-sidebar-primary-foreground font-display font-bold text-lg">F</span>
        </div>
        <div>
          <h1 className="font-display font-bold text-lg text-sidebar-foreground">FLOW</h1>
          <p className="text-xs text-sidebar-foreground/60">Admin Portal</p>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive(item.href)
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.title}</span>
              {isActive(item.href) && (
                <ChevronRight className="ml-auto h-4 w-4" />
              )}
            </Link>
          ))}
        </div>

        <Separator className="my-4 bg-sidebar-border" />

        <div className="space-y-1">
          {settingsItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive(item.href)
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.title}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent/50">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user?.avatarUrl || undefined} />
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
              {user?.fullName?.charAt(0) || 'A'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.fullName || 'Admin'}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
