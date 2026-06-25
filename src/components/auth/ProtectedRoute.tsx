import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppRole } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, session, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const hasAllowedRole = Boolean(allowedRoles && user?.role && allowedRoles.includes(user.role));
  const hasTeamLeadAdminAccess = Boolean(allowedRoles?.includes('admin') && user?.isTeamLead);

  if (allowedRoles && !hasAllowedRole && !hasTeamLeadAdminAccess) {
    // Redirect to appropriate dashboard based on role
    if (user?.role === 'admin' || user?.isTeamLead) {
      return <Navigate to="/admin/dashboard" replace />;
    }
    if (user?.role === 'employee') {
      return <Navigate to="/employee/dashboard" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
