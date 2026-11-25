import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { AppRole } from '@/lib/auth';
import { can, type Permission } from '@/lib/permissions';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Legacy: 'admin' also admits managers; 'employee' admits everyone signed in. */
  allowedRoles?: AppRole[];
  /** Preferred: require a specific permission. */
  require?: Permission;
}

export function ProtectedRoute({ children, allowedRoles, require }: ProtectedRouteProps) {
  const { user, session, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  if (!session || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const home = user.accessRole === 'member' ? '/employee/dashboard' : '/admin/dashboard';

  if (require && !can(user, require)) {
    return <Navigate to={home} replace />;
  }

  if (allowedRoles) {
    const allowed =
      (allowedRoles.includes('admin') && user.accessRole !== 'member') ||
      allowedRoles.includes('employee');
    if (!allowed) return <Navigate to={home} replace />;
  }

  return <>{children}</>;
}
