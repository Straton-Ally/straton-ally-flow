import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, BookOpen, Landmark, ReceiptText, Users, Settings, WalletCards, FileBarChart, LogOut, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { label: "Dashboard", href: "/flowmath/dashboard", icon: LayoutDashboard },
  { label: "Accounts", href: "/flowmath/accounts", icon: Landmark },
  { label: "Journal", href: "/flowmath/journal", icon: BookOpen },
  { label: "Ledger", href: "/flowmath/ledger", icon: ReceiptText },
  { label: "Payroll", href: "/flowmath/payroll", icon: WalletCards },
  { label: "Vendors", href: "/flowmath/vendors", icon: Users },
  { label: "Customers", href: "/flowmath/customers", icon: Users },
  { label: "Expenses", href: "/flowmath/expenses", icon: ReceiptText },
  { label: "Invoices", href: "/flowmath/invoices", icon: ReceiptText },
  { label: "Bills", href: "/flowmath/bills", icon: ReceiptText },
  { label: "Reports", href: "/flowmath/reports", icon: FileBarChart },
  { label: "Settings", href: "/flowmath/settings", icon: Settings },
];

export function FlowMathLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card/90 backdrop-blur-xl supports-[backdrop-filter]:bg-card/80">
        <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link to="/flowmath/dashboard" className="relative flex h-10 w-[150px] shrink-0 items-center overflow-hidden" aria-label="FlowMath dashboard">
              <img
                src="/flowmath_logo.png"
                alt="FlowMath"
                className="h-full w-full object-contain object-left"
              />
            </Link>
            <nav className="hidden max-w-[72vw] items-center gap-1 overflow-x-auto lg:flex">
              {navItems.map((item) => {
                const active = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn("nav-tab whitespace-nowrap", active ? "nav-tab-active" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(user?.role === "admin" ? "/admin/dashboard" : "/employee/dashboard")}>
              <ArrowLeftRight className="h-4 w-4" />
              FlowHR
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Log out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="overflow-x-hidden">
        <div className="px-4 md:px-6 py-5 max-w-[1500px] mx-auto pb-24">
          <Outlet />
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-xl lg:hidden">
        <div className="flex h-16 items-center gap-1 overflow-x-auto px-2">
          {navItems.slice(0, 8).map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn("flex min-w-[72px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium", active ? "text-primary" : "text-muted-foreground")}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
