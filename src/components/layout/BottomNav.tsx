import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Clock,
  Wallet,
  Menu,
  LogOut,
  Settings,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useState } from 'react';
import { signOut } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const mainNavItems = [
  { icon: LayoutDashboard, label: 'Home', href: '/admin/dashboard' },
  { icon: Users, label: 'Team', href: '/admin/recruitment?tab=employees' },
  { icon: Clock, label: 'Attendance', href: '/admin/attendance' },
  { icon: Wallet, label: 'Payroll', href: '/admin/salaries' },
];

const moreNavItems = [
  { label: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Employees', href: '/admin/recruitment?tab=employees' },
  { label: 'Attendance', href: '/admin/attendance' },
  { label: 'Payroll', href: '/admin/salaries' },
  { label: 'Leave Management', href: '/admin/leave' },
  { label: 'Recruitment', href: '/admin/recruitment' },
  { label: 'Work Management', href: '/admin/work' },
  { label: 'Logs', href: '/admin/logs' },
  { label: 'Settings', href: '/admin/settings' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    setOpen(false);
    navigate('/login', { replace: true });
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden">
      <div className="flex items-center justify-around h-14 px-2">
        {mainNavItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full gap-0.5 text-[10px] font-medium transition-colors',
                isActive
                  ? 'text-success'
                  : 'text-muted-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive && 'text-success')} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center flex-1 h-full gap-0.5 text-[10px] font-medium text-muted-foreground">
              <Menu className="h-5 w-5" />
              <span>More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-2xl">
            <SheetHeader className="pb-3">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-left text-base">Menu</SheetTitle>
                <ThemeToggle />
              </div>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-2 pb-4">
              {moreNavItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-2 p-2.5 rounded-lg text-xs font-medium transition-colors',
                      isActive
                        ? 'bg-success/10 text-success'
                        : 'bg-muted text-foreground hover:bg-muted/80'
                    )}
                  >
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
            <div className="border-t border-border pt-3 pb-2">
              <Button 
                variant="ghost" 
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 h-10"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Log out
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
