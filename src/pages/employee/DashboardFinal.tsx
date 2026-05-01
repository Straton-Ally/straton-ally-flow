import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, CheckSquare, Clock, Banknote, Briefcase, Bell, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getDateInTimeZone, PAKISTAN_TIME_ZONE } from '@/lib/timezones';

const workspaceDb = supabase as any;

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [todayStatus, setTodayStatus] = useState('Not Marked');
  const [nextAttendanceAction, setNextAttendanceAction] = useState('Next: Check In');
  const [monthPresentDays, setMonthPresentDays] = useState<number | null>(null);
  const [salaryAmount, setSalaryAmount] = useState<number | null>(null);
  const [salaryType, setSalaryType] = useState<string | null>(null);
  const [isSalaryVisible, setIsSalaryVisible] = useState(false);
  const [tasksTotal, setTasksTotal] = useState(0);
  const [tasksPending, setTasksPending] = useState(0);

  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    const derive = (
      record:
        | {
            in_time: string | null;
            out_time: string | null;
            break_start_at: string | null;
            check_in_at: string | null;
            check_out_at: string | null;
            status: string | null;
          }
        | null
        | undefined,
    ) => {
      const checkedIn = Boolean(record?.in_time || record?.check_in_at);
      const checkedOut = Boolean(record?.out_time || record?.check_out_at);
      const onBreak = Boolean(record?.break_start_at) && checkedIn && !checkedOut;

      if (!checkedIn) {
        if (record?.status === 'leave') return { label: 'Leave', next: 'No action today' };
        if (record?.status === 'absent') return { label: 'Absent', next: 'No action today' };
        if (record?.status === 'half_day') return { label: 'Half Day', next: 'No action today' };
        return { label: 'Not Marked', next: 'Next: Check In' };
      }

      if (checkedOut) return { label: 'Checked Out', next: 'Done Today' };
      if (onBreak) return { label: 'On Break', next: 'Next: End Break' };
      return { label: 'Present', next: 'Next: Check Out' };
    };

    const fetchTodayStatus = async () => {
      if (!user?.id) return;

      const today = getDateInTimeZone(new Date(), PAKISTAN_TIME_ZONE);
      const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (employeeError || !employee?.id) {
        setTodayStatus('Not Assigned');
        setNextAttendanceAction('Contact HR');
        setMonthPresentDays(null);
        setSalaryAmount(null);
        setSalaryType(null);
        setTasksTotal(0);
        setTasksPending(0);
        return;
      }

      const [openAttendanceResult, todayAttendanceResult, monthAttendanceResult, salaryResult] = await Promise.all([
        supabase
          .from('attendance')
          .select('in_time,out_time,break_start_at,check_in_at,check_out_at,status')
          .eq('employee_id', employee.id)
          .not('in_time', 'is', null)
          .is('out_time', null)
          .order('check_in_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('attendance')
          .select('in_time,out_time,break_start_at,check_in_at,check_out_at,status')
          .eq('employee_id', employee.id)
          .eq('date', today)
          .maybeSingle(),
        supabase
          .from('attendance')
          .select('status')
          .eq('employee_id', employee.id)
          .gte('date', monthStart)
          .lte('date', monthEnd),
        supabase
          .from('salaries')
          .select('amount,salary_type')
          .eq('employee_id', employee.id)
          .eq('is_current', true)
          .order('effective_date', { ascending: false })
          .maybeSingle(),
      ]);

      const computed = derive(openAttendanceResult.data ?? todayAttendanceResult.data);
      setTodayStatus(computed.label);
      setNextAttendanceAction(computed.next);

      const monthRows = monthAttendanceResult.data ?? [];
      const presentDays = monthRows.filter((row) => row.status === 'present').length;
      setMonthPresentDays(presentDays);

      if (salaryResult.data) {
        setSalaryAmount(salaryResult.data.amount ?? null);
        setSalaryType(salaryResult.data.salary_type ?? null);
      } else {
        setSalaryAmount(null);
        setSalaryType(null);
      }

      const { data: employeeTasks } = await workspaceDb
        .from('work_tasks_v2')
        .select('id,status')
        .eq('assignee_id', user.id);

      const taskRows = (employeeTasks ?? []) as Array<{ id: string; status: string }>;
      setTasksTotal(taskRows.length);
      setTasksPending(taskRows.filter((task) => task.status !== 'done' && task.status !== 'cancelled').length);
    };

    fetchTodayStatus();
  }, [user?.id]);

  const attendanceIndicatorClass =
    todayStatus === 'Not Marked'
      ? 'bg-red-500'
      : todayStatus === 'On Break'
        ? 'bg-orange-500'
        : todayStatus === 'Checked Out'
          ? 'bg-blue-500'
          : 'bg-success';

  const statusPillClass =
    todayStatus === 'Not Marked'
      ? 'bg-red-500/10 text-red-600'
      : todayStatus === 'On Break'
        ? 'bg-orange-500/10 text-orange-600'
        : todayStatus === 'Checked Out'
          ? 'bg-blue-500/10 text-blue-600'
          : todayStatus === 'Leave'
            ? 'bg-purple-500/10 text-purple-600'
            : todayStatus === 'Absent'
              ? 'bg-zinc-500/10 text-zinc-600'
              : todayStatus === 'Half Day'
                ? 'bg-yellow-500/10 text-yellow-600'
                : 'bg-success/10 text-success';

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(amount);

  const salaryLabel =
    salaryAmount === null
      ? '—'
      : salaryType === 'hourly'
        ? `${formatCurrency(salaryAmount)}/hr`
        : formatCurrency(salaryAmount);
  const hiddenSalaryLabel = salaryAmount === null ? '—' : '******';
  const displayedSalaryLabel = isSalaryVisible ? salaryLabel : hiddenSalaryLabel;

  const quickActions = [
    {
      title: 'Mark Attendance',
      subtitle: nextAttendanceAction,
      icon: Clock,
      href: '/employee/attendance',
      indicatorClass: attendanceIndicatorClass,
    },
    {
      title: 'Tasks',
      subtitle: `${tasksPending} pending`,
      icon: CheckSquare,
      href: '/employee/work',
      indicatorClass: 'bg-success',
    },
    {
      title: 'Salary',
      subtitle: displayedSalaryLabel,
      icon: Banknote,
      href: '/employee/salary',
      indicatorClass: 'bg-success',
    },
    {
      title: 'Notifications',
      subtitle: 'View updates',
      icon: Bell,
      href: '/employee/notifications',
      indicatorClass: 'bg-success',
    },
    {
      title: 'Workspace',
      subtitle: 'Teams and chat',
      icon: Briefcase,
      href: '/employee/work',
      indicatorClass: 'bg-blue-500',
    },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <Card className="card-elevated overflow-hidden">
            <CardContent className="p-4 md:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-1">
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                    {greeting}, {user?.fullName?.split(' ')[0]}
                  </h2>
                  <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${statusPillClass}`}>
                    <span className={`h-2 w-2 rounded-full ${attendanceIndicatorClass}`} />
                    {todayStatus}
                  </span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">{nextAttendanceAction}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardContent className="p-3 md:p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">Today</p>
                      <p className="text-base font-semibold">{todayStatus}</p>
                    </div>
                    <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center">
                      <Clock className="h-4 w-4 text-foreground" />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">This Month</p>
                      <p className="text-base font-semibold">{monthPresentDays === null ? '—' : `${monthPresentDays} Days`}</p>
                    </div>
                    <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center">
                      <Calendar className="h-4 w-4 text-foreground" />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs text-muted-foreground">Salary</p>
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-base font-semibold">{displayedSalaryLabel}</p>
                        <button
                          type="button"
                          onClick={() => setIsSalaryVisible((visible) => !visible)}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={isSalaryVisible ? 'Hide salary' : 'Show salary'}
                        >
                          {isSalaryVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center">
                      <Banknote className="h-4 w-4 text-foreground" />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">Tasks</p>
                      <p className="text-base font-semibold">{tasksTotal}</p>
                    </div>
                    <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center">
                      <CheckSquare className="h-4 w-4 text-foreground" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.href}
                      type="button"
                      onClick={() => navigate(action.href)}
                      className="group flex flex-col items-start gap-2 rounded-xl border border-border bg-muted/30 p-3 text-left transition-colors hover:bg-muted/60"
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                          <Icon className="h-4 w-4 text-foreground" />
                        </div>
                        <span className={`h-2 w-2 rounded-full ${action.indicatorClass}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-5 truncate">{action.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{action.subtitle}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="card-elevated">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Activity</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1">
              <div className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-muted/40 transition-colors">
                <div className="mt-1 h-2 w-2 bg-blue-500 rounded-full" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">Task assigned: "Design new landing page"</p>
                  <p className="text-xs text-muted-foreground">2 hours ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-muted/40 transition-colors">
                <div className="mt-1 h-2 w-2 bg-success rounded-full" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">Salary processed for January 2024</p>
                  <p className="text-xs text-muted-foreground">1 day ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-muted/40 transition-colors">
                <div className="mt-1 h-2 w-2 bg-purple-500 rounded-full" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">Team meeting scheduled for tomorrow</p>
                  <p className="text-xs text-muted-foreground">2 days ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-muted/40 transition-colors">
                <div className="mt-1 h-2 w-2 bg-orange-500 rounded-full" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">Leave request approved for Feb 5-7</p>
                  <p className="text-xs text-muted-foreground">3 days ago</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
