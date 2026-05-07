import { Button } from '@/components/ui/button';

interface DashboardHeaderProps {
  userName: string;
  userRole?: string;
}

export function DashboardHeader({ userName }: DashboardHeaderProps) {
  const firstName = userName?.split(' ')[0] || 'Admin';

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-display font-bold md:text-3xl">
          Hello, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Ready to streamline your HR tasks and boost productivity?
        </p>
      </div>
      
      {/* Quick Action Buttons */}
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" className="h-9 px-3">
          Add Attendance
        </Button>
        <Button variant="outline" size="sm" className="h-9 px-3">
          Update Payroll
        </Button>
        <Button variant="accent" size="sm" className="h-9 px-3">
          New Task
        </Button>
      </div>
    </header>
  );
}
