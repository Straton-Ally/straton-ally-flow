import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Award, CalendarCheck2, CheckCircle2, Clock3, Flame, Gauge } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isAfter,
  isSameDay,
  parseISO,
  startOfMonth,
  subDays,
} from 'date-fns';

type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave';

interface AttendanceRow {
  date: string;
  status: AttendanceStatus;
  in_time: string | null;
  check_in_at: string | null;
  out_time: string | null;
  total_work_minutes: number | null;
  notes: string | null;
}

const STATUS_META: Record<AttendanceStatus, { label: string; color: string; className: string; soft: string }> = {
  present: { label: 'Present', color: '#10b981', className: 'bg-emerald-500', soft: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' },
  absent: { label: 'Absent', color: '#ef4444', className: 'bg-red-500', soft: 'bg-red-500/12 text-red-700 dark:text-red-300' },
  half_day: { label: 'Half day', color: '#f59e0b', className: 'bg-amber-500', soft: 'bg-amber-500/12 text-amber-700 dark:text-amber-300' },
  leave: { label: 'Leave', color: '#64748b', className: 'bg-slate-400 dark:bg-slate-600', soft: 'bg-slate-500/12 text-slate-700 dark:text-slate-300' },
};

const FALLBACK_START_MINUTES = 9 * 60 + 15;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const asStatus = (value: string): AttendanceStatus => {
  if (value === 'absent' || value === 'half_day' || value === 'leave') return value;
  return 'present';
};

const timeToMinutes = (time: string | null) => {
  if (!time) return null;
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const getMinutesFromNotes = (notes: string | null) => {
  const match = notes?.match(/Total hours:\s*(\d{1,2}):(\d{2})/i);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const getWorkMinutes = (record: AttendanceRow) => record.total_work_minutes ?? getMinutesFromNotes(record.notes) ?? 0;

const formatMinutes = (minutes: number) => {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
};

const compactHours = (minutes: number) => `${Math.max(0, Math.round((minutes / 60) * 10) / 10)}h`;
const getMonthKey = (date: string | Date) => format(typeof date === 'string' ? parseISO(date) : date, 'yyyy-MM');

const buildMonthOptions = (records: AttendanceRow[]) => {
  const months = new Set([getMonthKey(new Date())]);
  records.forEach((record) => months.add(getMonthKey(record.date)));
  return Array.from(months)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 12)
    .map((value) => ({ value, label: format(new Date(`${value}-01T00:00:00`), 'MMM yyyy') }));
};

export function AttendanceStats() {
  const [allData, setAllData] = useState<AttendanceRow[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey(new Date()));
  const [scheduleStart, setScheduleStart] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAttendanceStats = async () => {
      setIsLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user?.id) return;

        const { data: employee } = await supabase
          .from('employees')
          .select('id, custom_work_start_time, duty_schedule_template_id')
          .eq('user_id', userData.user.id)
          .single();

        if (!employee) return;

        let startTime = employee.custom_work_start_time ? String(employee.custom_work_start_time).slice(0, 8) : null;
        if (!startTime && employee.duty_schedule_template_id) {
          const { data: template } = await supabase
            .from('duty_schedule_templates')
            .select('start_time')
            .eq('id', employee.duty_schedule_template_id)
            .maybeSingle();
          startTime = template?.start_time ? String(template.start_time).slice(0, 8) : null;
        }
        setScheduleStart(startTime);

        const { data } = await supabase
          .from('attendance')
          .select('date,status,in_time,check_in_at,out_time,total_work_minutes,notes')
          .eq('employee_id', employee.id)
          .gte('date', format(subDays(new Date(), 370), 'yyyy-MM-dd'))
          .lte('date', format(new Date(), 'yyyy-MM-dd'))
          .order('date', { ascending: true });

        const rows: AttendanceRow[] = (data ?? []).map((record) => ({
          date: record.date,
          status: ((record.in_time || record.check_in_at) && record.status === 'absent' ? 'present' : record.status) as 'present' | 'absent' | 'half_day' | 'leave',
          in_time: record.in_time,
          check_in_at: record.check_in_at,
          out_time: record.out_time,
          total_work_minutes: record.total_work_minutes,
          notes: record.notes,
        }));

        setAllData(rows);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchAttendanceStats();
  }, []);

  const monthOptions = useMemo(() => buildMonthOptions(allData), [allData]);
  const monthlyData = useMemo(() => allData.filter((record) => getMonthKey(record.date) === selectedMonth), [allData, selectedMonth]);

  const summary = useMemo(() => {
    const presentDays = monthlyData.filter((record) => record.status === 'present').length;
    const absentDays = monthlyData.filter((record) => record.status === 'absent').length;
    const halfDays = monthlyData.filter((record) => record.status === 'half_day').length;
    const leaveDays = monthlyData.filter((record) => record.status === 'leave').length;
    const workedDays = presentDays + halfDays;
    const recordedDays = monthlyData.length;
    const workMinutes = monthlyData.map(getWorkMinutes).filter((minutes) => minutes > 0);
    const totalMinutes = workMinutes.reduce((sum, minutes) => sum + minutes, 0);
    const averageMinutes = workMinutes.length ? totalMinutes / workMinutes.length : 0;
    const lateAfter = (timeToMinutes(scheduleStart) ?? FALLBACK_START_MINUTES) + 15;
    const lateDays = monthlyData.filter((record) => {
      if (record.status !== 'present' && record.status !== 'half_day') return false;
      const checkIn = timeToMinutes(record.in_time);
      return checkIn !== null && checkIn > lateAfter;
    }).length;
    const punctuality = workedDays ? Math.round(((workedDays - lateDays) / workedDays) * 100) : 0;
    const attendanceRate = recordedDays ? Math.round((workedDays / recordedDays) * 100) : 0;
    const longestDayMinutes = workMinutes.length ? Math.max(...workMinutes) : 0;

    const presentDates = new Set(allData.filter((record) => record.status === 'present' || record.status === 'half_day').map((record) => record.date));
    let currentStreak = 0;
    for (let cursor = new Date(); currentStreak < 370; cursor = subDays(cursor, 1)) {
      if (!presentDates.has(format(cursor, 'yyyy-MM-dd'))) break;
      currentStreak += 1;
    }

    let bestStreak = 0;
    let running = 0;
    allData.forEach((record) => {
      if (record.status === 'present' || record.status === 'half_day') {
        running += 1;
        bestStreak = Math.max(bestStreak, running);
      } else {
        running = 0;
      }
    });

    return { presentDays, absentDays, halfDays, leaveDays, workedDays, recordedDays, totalMinutes, averageMinutes, lateDays, punctuality, attendanceRate, currentStreak, bestStreak, longestDayMinutes };
  }, [allData, monthlyData, scheduleStart]);

  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(new Date(`${selectedMonth}-01T00:00:00`));
    const monthEnd = endOfMonth(monthStart);
    const recordsByDate = new Map(monthlyData.map((record) => [record.date, record]));

    return eachDayOfInterval({ start: monthStart, end: monthEnd }).map((day) => {
      const key = format(day, 'yyyy-MM-dd');
      const record = recordsByDate.get(key);
      const isFuture = isAfter(day, new Date()) && !isSameDay(day, new Date());
      return {
        day: format(day, 'd'),
        label: format(day, 'MMM d'),
        status: record?.status ?? null,
        hours: record ? Math.round((getWorkMinutes(record) / 60) * 10) / 10 : 0,
        isFuture,
      };
    });
  }, [monthlyData, selectedMonth]);

  const calendarCells = useMemo(() => {
    const monthStart = startOfMonth(new Date(`${selectedMonth}-01T00:00:00`));
    const blanks = Array.from({ length: monthStart.getDay() }, (_, index) => ({
      key: `blank-${index}`,
      empty: true,
      day: '',
      label: '',
      status: null as AttendanceStatus | null,
      hours: 0,
      inTime: null as string | null,
      isFuture: false,
    }));

    return [
      ...blanks,
      ...monthDays.map((day) => ({
        ...day,
        key: day.label,
        empty: false,
      })),
    ];
  }, [monthDays, selectedMonth]);

  const last35Days = useMemo(() => {
    const byDate = new Map(allData.map((record) => [record.date, record]));
    return eachDayOfInterval({ start: subDays(new Date(), 34), end: new Date() }).map((day) => {
      const key = format(day, 'yyyy-MM-dd');
      const record = byDate.get(key);
      return { key, label: format(day, 'MMM d'), status: record?.status ?? null };
    });
  }, [allData]);

  const kpis = [
    { label: 'Present', value: summary.workedDays, hint: 'days', icon: CheckCircle2, tone: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Average', value: formatMinutes(summary.averageMinutes), hint: 'per day', icon: Clock3, tone: 'text-sky-600 dark:text-sky-400' },
    { label: 'Late', value: summary.lateDays, hint: 'days', icon: AlertCircle, tone: 'text-amber-600 dark:text-amber-400' },
    { label: 'Absent', value: summary.absentDays, hint: 'days', icon: CalendarCheck2, tone: 'text-red-600 dark:text-red-400' },
    { label: 'Punctual', value: `${summary.punctuality}%`, hint: 'on time', icon: Award, tone: 'text-violet-600 dark:text-violet-400' },
    { label: 'Streak', value: summary.currentStreak, hint: 'days', icon: Flame, tone: 'text-orange-600 dark:text-orange-400' },
  ];

  const distribution = [
    { key: 'present' as AttendanceStatus, value: summary.presentDays },
    { key: 'half_day' as AttendanceStatus, value: summary.halfDays },
    { key: 'absent' as AttendanceStatus, value: summary.absentDays },
    { key: 'leave' as AttendanceStatus, value: summary.leaveDays },
  ];
  const maxDistribution = Math.max(1, ...distribution.map((item) => item.value));

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Performance</p>
          <h2 className="text-lg font-semibold text-foreground">Attendance stats</h2>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="h-9 w-full rounded-xl bg-card text-sm sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <CardContent className="p-0">
          <div className="grid border-b bg-muted/15 dark:bg-muted/10 sm:grid-cols-3 lg:grid-cols-6">
            {kpis.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex min-h-20 items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:border-r sm:last:border-r-0 lg:border-b-0">
                  <Icon className={`h-4 w-4 shrink-0 ${item.tone}`} />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <p className="truncate text-xl font-black leading-none text-foreground">{isLoading ? '--' : item.value}</p>
                      <span className="text-xs text-muted-foreground">{item.hint}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-0 lg:grid-cols-[1fr_300px]">
            <div className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">Work rhythm</p>
                  <p className="text-xs text-muted-foreground">{summary.recordedDays} records - {formatMinutes(summary.totalMinutes)} total - {summary.attendanceRate}% active</p>
                </div>
                <div className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
                  Best streak {summary.bestStreak}d
                </div>
              </div>

              <div className="mt-3 h-40 sm:h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthDays} margin={{ left: -24, right: 8, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="attendanceMinimalGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.26} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} stroke="currentColor" className="text-muted-foreground" />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="currentColor" className="text-muted-foreground" width={28} />
                    <Tooltip
                      cursor={{ stroke: 'hsl(var(--border))' }}
                      contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', boxShadow: 'var(--shadow-md)' }}
                      formatter={(value) => [`${value}h`, 'Hours']}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ''}
                    />
                    <Area type="monotone" dataKey="hours" stroke="#10b981" strokeWidth={2.5} fill="url(#attendanceMinimalGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 rounded-xl border bg-background/60 p-2 dark:bg-background/25">
                <div className="grid grid-cols-7 gap-1 px-1 pb-1">
                  {WEEKDAY_LABELS.map((label) => (
                    <div key={label} className="py-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {label}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarCells.map((day) => {
                    if (day.empty) {
                      return <div key={day.key} className="min-h-12 rounded-lg border border-transparent" />;
                    }

                    const status = day.status;
                    const meta = status ? STATUS_META[status] : null;
                    const statusText = meta?.label ?? (day.isFuture ? 'Upcoming' : 'No record');
                    const title = `${day.label} - ${statusText}${day.hours ? ` - ${day.hours}h` : ''}${day.inTime ? ` - In ${day.inTime.slice(0, 5)}` : ''}`;

                    return (
                      <div
                        key={day.key}
                        title={title}
                        className={`group min-h-12 rounded-lg border p-1.5 transition-colors ${
                          meta
                            ? `${meta.soft} border-transparent`
                            : day.isFuture
                              ? 'border-transparent bg-muted/10 text-muted-foreground/50'
                              : 'border-border/70 bg-muted/10 text-muted-foreground'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-xs font-semibold leading-none">{day.day}</span>
                          {meta && <span className={`h-1.5 w-1.5 rounded-full ${meta.className}`} />}
                        </div>
                        <div className="mt-2 truncate text-[10px] font-medium leading-none">
                          {day.hours ? `${day.hours}h` : status ? meta?.label : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <aside className="border-t bg-muted/10 p-4 dark:bg-muted/5 lg:border-l lg:border-t-0">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                <div className="rounded-xl border bg-background/60 p-3 dark:bg-background/30">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">Current streak</p>
                    <Flame className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <p className="mt-1 text-3xl font-black text-foreground">{summary.currentStreak}</p>
                  <p className="text-xs text-muted-foreground">days in a row</p>
                </div>
                <div className="rounded-xl border bg-background/60 p-3 dark:bg-background/30">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">Longest day</p>
                    <Gauge className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <p className="mt-1 text-2xl font-black text-foreground">{formatMinutes(summary.longestDayMinutes)}</p>
                  <p className="text-xs text-muted-foreground">single day peak</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-7 gap-1.5 rounded-xl border bg-background/60 p-2 dark:bg-background/30">
                {last35Days.map((day) => (
                  <div
                    key={day.key}
                    title={`${day.label}${day.status ? ` - ${STATUS_META[day.status].label}` : ''}`}
                    className={`aspect-square rounded-[5px] ${day.status ? STATUS_META[day.status].className : 'bg-muted/40'}`}
                  />
                ))}
              </div>

              <div className="mt-3 space-y-2">
                {distribution.map((item) => {
                  const meta = STATUS_META[item.key];
                  return (
                    <div key={item.key} className="grid grid-cols-[72px_1fr_28px] items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{meta.label}</span>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full ${meta.className}`} style={{ width: `${(item.value / maxDistribution) * 100}%` }} />
                      </div>
                      <strong className="text-right text-foreground">{item.value}</strong>
                    </div>
                  );
                })}
              </div>
            </aside>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

