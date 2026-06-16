import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Building2, FileText, LayoutDashboard, LogOut, ReceiptText, Settings, Users, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { label: "Dashboard", href: "/managepay/dashboard", icon: LayoutDashboard },
  { label: "Invoices", href: "/managepay/invoices", icon: FileText },
  { label: "Clients", href: "/managepay/clients", icon: Users },
  { label: "Companies", href: "/managepay/companies", icon: Building2 },
  { label: "Settings", href: "/managepay/settings", icon: Settings },
];

export function ManagePayLayout() {
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
            <Link to="/managepay/dashboard" className="flex items-center gap-2 font-semibold" aria-label="ManagePay dashboard">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <WalletCards className="h-4 w-4" />
              </span>
              <span className="hidden text-lg sm:inline">ManagePay</span>
            </Link>
            <nav className="hidden max-w-[70vw] items-center gap-1 overflow-x-auto lg:flex">
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
              <ReceiptText className="h-4 w-4" />
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
        <div className="mx-auto max-w-[1500px] px-4 py-5 pb-24 md:px-6">
          <Outlet />
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-xl lg:hidden">
        <div className="flex h-16 items-center gap-1 overflow-x-auto px-2">
          {navItems.map((item) => {
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
