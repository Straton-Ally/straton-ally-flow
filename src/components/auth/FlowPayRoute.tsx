import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { canAccessFlowPay } from "@/lib/flowpay";

export function FlowPayRoute({ children }: { children: React.ReactNode }) {
  const { user, session, isLoading } = useAuth();
  const location = useLocation();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      if (!user?.id) {
        setChecking(false);
        return;
      }

      try {
        const result = await canAccessFlowPay(user.id);
        if (mounted) setAllowed(result);
      } catch {
        if (mounted) setAllowed(false);
      } finally {
        if (mounted) setChecking(false);
      }
    }

    if (!isLoading) void checkAccess();
    return () => {
      mounted = false;
    };
  }, [isLoading, user?.id]);

  if (isLoading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading FlowPay...</p>
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!allowed) return <Navigate to={user?.role === "admin" ? "/admin/dashboard" : "/employee/dashboard"} replace />;

  return <>{children}</>;
}
