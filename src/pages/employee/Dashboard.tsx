import { useEffect, useState } from 'react';
import { Clock, Calendar, Banknote, User, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { signOut } from '@/lib/auth';
import { formatTime12h } from '@/lib/utils';
import { format } from 'date-fns';

interface EmployeeData {
  employee_id: string;
  designation: string | null;
  department: string | null;
  joining_date: string;
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [employeeData, setEmployeeData] = useState<EmployeeData | null>(null);
  const [attendanceToday, setAttendanceToday] = useState<string>('Not Marked');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchEmployeeData() {
      if (!user?.id) return;

      try {
        // Fetch employee details
        const { data: empData } = await supabase
          .from('employees')
          .select(`
            employee_id,
            designation,
            joining_date,
            department_id,
            departments (name)
          `)
          .eq('user_id', user.id)
          .maybeSingle();

        if (empData) {
          const departmentName = (() => {
            const raw = (empData as unknown as { departments?: { name: string } | { name: string }[] | null }).departments;
            if (!raw) return null;
            return Array.isArray(raw) ? raw[0]?.name ?? null : raw.name ?? null;
          })();

          setEmployeeData({
            employee_id: empData.employee_id,
            designation: empData.designation,
            department: departmentName,
            joining_date: empData.joining_date,
          });

          // Fetch today's attendance
          const today = format(new Date(), 'yyyy-MM-dd');
          const { data: emp } = await supabase
            .from('employees')
            .select('id')
            .eq('user_id', user.id)
            .single();

          if (emp) {
            const { data: attendance } = await supabase
              .from('attendance')
              .select('status, in_time, check_in_at')
              .eq('employee_id', emp.id)
              .eq('date', today)
              .maybeSingle();

            if (attendance) {
              const checkedIn = Boolean(attendance.in_time || attendance.check_in_at);
              const statusLabel = checkedIn || attendance.status === 'present' ? 'Present' : attendance.status;
              setAttendanceToday(
                `${statusLabel} ${
                  attendance.in_time ? `at ${formatTime12h(attendance.in_time)}` : ''
                }`
              );
            }
          }
        }
      } catch (error) {
        console.error('Error fetching employee data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchEmployeeData();
  }, [user?.id]);

  const handleSignOut = async () => {
    await signOut();
  };

  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-accent-foreground font-display font-bold text-lg">F</span>
            </div>
            <div>
              <h1 className="font-display font-bold text-lg">FLOW</h1>
              <p className="text-xs text-muted-foreground">Employee Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="font-medium">{user?.fullName}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-accent text-accent-foreground">
                {user?.fullName?.charAt(0) || 'E'}
              </AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8 space-y-8">
        {/* Welcome */}
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">
            {greeting}, {user?.fullName?.split(' ')[0]}
          </h2>
          <p className="text-muted-foreground mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Today's Status"
            value={attendanceToday}
            icon={Clock}
          />
          <StatCard
            title="Department"
            value={employeeData?.department || 'Not Assigned'}
            icon={User}
          />
          <StatCard
            title="Employee ID"
            value={employeeData?.employee_id || '—'}
            icon={Calendar}
          />
          <StatCard
            title="Designation"
            value={employeeData?.designation || 'Not Set'}
            icon={Banknote}
          />
        </div>

        {/* Profile Card */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle>Your Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-6">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="bg-accent text-accent-foreground text-2xl">
                  {user?.fullName?.charAt(0) || 'E'}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-4 flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Full Name</p>
                    <p className="font-medium">{user?.fullName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{user?.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Employee ID</p>
                    <p className="font-medium">{employeeData?.employee_id || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Department</p>
                    <p className="font-medium">{employeeData?.department || 'Not Assigned'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Designation</p>
                    <p className="font-medium">{employeeData?.designation || 'Not Set'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Joined</p>
                    <p className="font-medium">
                      {employeeData?.joining_date
                        ? format(new Date(employeeData.joining_date), 'MMMM d, yyyy')
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-auto py-6 flex flex-col gap-2" disabled>
              <Clock className="h-6 w-6" />
              <span>View Attendance</span>
              <Badge variant="secondary">Coming Soon</Badge>
            </Button>
            <Button variant="outline" className="h-auto py-6 flex flex-col gap-2" disabled>
              <Calendar className="h-6 w-6" />
              <span>Request Leave</span>
              <Badge variant="secondary">Coming Soon</Badge>
            </Button>
            <Button variant="outline" className="h-auto py-6 flex flex-col gap-2" disabled>
              <Banknote className="h-6 w-6" />
              <span>View Payslip</span>
              <Badge variant="secondary">Coming Soon</Badge>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
