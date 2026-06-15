import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Clock,
  Users,
  Menu,
  LogOut,
  Briefcase,
  Calculator,
  WalletCards,
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
import { useAuth } from '@/hooks/useAuth';
import { canAccessFlowMath } from '@/lib/flowmath';
import { canAccessManagePay } from '@/lib/managepay';
import { useEffect } from 'react';

const mainNavItems = [
  { icon: LayoutDashboard, label: 'Home', href: '/employee/dashboard' },
  { icon: Clock, label: 'Attendance', href: '/employee/attendance' },
  { icon: Briefcase, label: 'Work', href: '/employee/work' },
  { icon: Users, label: 'Team', href: '/employee/team' },
];

const moreNavItems = [
  { label: 'Dashboard', href: '/employee/dashboard' },
  { label: 'Attendance', href: '/employee/attendance' },
  { label: 'Workspace', href: '/employee/work' },
  { label: 'Salary', href: '/employee/salary' },
  { label: 'Notifications', href: '/employee/notifications' },
  { label: 'Settings', href: '/employee/settings' },
];

export function EmployeeBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [hasFlowMathAccess, setHasFlowMathAccess] = useState(false);
  const [hasManagePayAccess, setHasManagePayAccess] = useState(false);

  const handleLogout = async () => {
    await signOut();
    setOpen(false);
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    let mounted = true;
    if (!user?.id) return;
    Promise.all([canAccessFlowMath(user.id), canAccessManagePay(user.id)])
      .then(([flowMathAllowed, managePayAllowed]) => {
        if (mounted) {
          setHasFlowMathAccess(flowMathAllowed);
          setHasManagePayAccess(managePayAllowed);
        }
      })
      .catch(() => {
        if (mounted) {
          setHasFlowMathAccess(false);
          setHasManagePayAccess(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-xl md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {mainNavItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full gap-0.5 text-[10px] font-medium transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
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
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-foreground hover:bg-muted/80'
                    )}
                  >
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              {hasFlowMathAccess ? (
                <Link
                  to="/flowmath/dashboard"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 p-2.5 rounded-lg text-xs font-medium transition-colors bg-muted text-foreground hover:bg-muted/80"
                >
                  <Calculator className="h-4 w-4" />
                  <span>FlowMath</span>
                </Link>
              ) : null}
              {hasManagePayAccess ? (
                <Link
                  to="/managepay/dashboard"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 p-2.5 rounded-lg text-xs font-medium transition-colors bg-muted text-foreground hover:bg-muted/80"
                >
                  <WalletCards className="h-4 w-4" />
                  <span>ManagePay</span>
                </Link>
              ) : null}
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
