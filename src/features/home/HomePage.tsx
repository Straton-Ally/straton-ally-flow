import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { differenceInCalendarDays, formatDistanceToNowStrict, parseISO } from 'date-fns';
import { ArrowRight, Bell, CircleCheckBig, Clock, Hash, Inbox, KanbanSquare, Lock, MessagesSquare, UserCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { can } from '@/lib/permissions';
import { getDateInTimeZone, PAKISTAN_TIME_ZONE } from '@/lib/timezones';
import { useDirectory, useMyChannels } from '@/features/chat/api';
import { channelLabel } from '@/features/chat/format';
import { useMyTasks } from '@/features/projects/api';
import { ColorDot, DueChip, PriorityIcon } from '@/features/projects/components/bits';

const today = () => getDateInTimeZone(new Date(), PAKISTAN_TIME_ZONE);

interface ClockRow {
  in_time: string | null;
  out_time: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  break_start_at: string | null;
  status: string | null;
}

function clockState(row: ClockRow | null | undefined): { label: string; hint: string; tone: 'idle' | 'on' | 'done' } {
  const inAt = row?.check_in_at ?? row?.in_time;
  const outAt = row?.check_out_at ?? row?.out_time;
  if (!inAt) {
    if (row?.status === 'leave') return { label: 'On leave', hint: 'No action needed today', tone: 'done' };
    if (row?.status === 'absent') return { label: 'Absent', hint: 'Marked absent today', tone: 'done' };
    return { label: 'Not clocked in', hint: 'Clock in to start your day', tone: 'idle' };
  }
  if (outAt) return { label: 'Clocked out', hint: 'Done for today', tone: 'done' };
  if (row?.break_start_at) return { label: 'On break', hint: 'End your break when you are back', tone: 'on' };
  const time = row?.check_in_at
    ? new Date(row.check_in_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : String(row?.in_time ?? '').slice(0, 5);
  return { label: 'Clocked in', hint: `Since ${time}`, tone: 'on' };
}

function useMyClock(employeeId: string | null) {
  return useQuery({
    queryKey: ['home', 'clock', employeeId, today()],
    enabled: Boolean(employeeId),
    queryFn: async () => {
      const cols = 'in_time,out_time,check_in_at,check_out_at,break_start_at,status';
      // An open shift from yesterday (night shift) wins over today's row.
      const [open, todayRow] = await Promise.all([
        supabase.from('attendance').select(cols).eq('employee_id', employeeId!).not('in_time', 'is', null).is('out_time', null).order('check_in_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('attendance').select(cols).eq('employee_id', employeeId!).eq('date', today()).maybeSingle(),
      ]);
      return (open.data ?? todayRow.data ?? null) as ClockRow | null;
    },
  });
}

/** Team numbers for managers/admins. RLS limits rows to the people they manage. */
function useTeamToday(enabled: boolean) {
  return useQuery({
    queryKey: ['home', 'team', today()],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const [present, early, overtime] = await Promise.all([
        supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('date', today()).not('in_time', 'is', null),
        supabase.from('early_checkout_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('attendance_overtime_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
      const { data: team } = await supabase.rpc('get_my_manageable_attendance_employees');
      return {
        present: present.count ?? 0,
        teamSize: Array.isArray(team) && team.length > 0 ? team.length : null,
        pending: (early.count ?? 0) + (overtime.count ?? 0),
      };
    },
  });
}

function useRecentNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ['notifications', 'recent', userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('work_notifications')
        .select('id, title, body, action_url, is_read, created_at')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });
}

export default function HomePage() {
  const { user } = useAuth();
  const isLead = can(user, 'attendance.team');
  const clock = useMyClock(user?.employeeId ?? null);
  const team = useTeamToday(isLead);
  const tasks = useMyTasks();
  const channels = useMyChannels();
  const { byId } = useDirectory();
  const notifications = useRecentNotifications(user?.id);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.fullName?.split(' ')[0] ?? '';
  const attendanceHref = isLead ? '/admin/attendance' : '/employee/attendance';
  const notificationsHref = user?.accessRole === 'member' ? '/employee/notifications' : '/admin/notifications';

  const openTasks = useMemo(
    () =>
      [...(tasks.data ?? [])].sort((a, b) => {
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return b.updated_at.localeCompare(a.updated_at);
      }),
    [tasks.data],
  );
  const overdue = openTasks.filter((t) => t.due_date && differenceInCalendarDays(parseISO(t.due_date), new Date()) < 0).length;
  const unreadChannels = (channels.data ?? []).filter((c) => !c.muted && c.unread_count > 0).sort((a, b) => b.mention_count - a.mention_count || b.last_message_at.localeCompare(a.last_message_at));
  const unread = unreadChannels.reduce((n, c) => n + c.unread_count, 0);
  const mentions = (channels.data ?? []).reduce((n, c) => n + c.mention_count, 0);
  const state = clockState(clock.data);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {greeting}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="page-subtitle">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {user?.employeeId ? (
          <Stat
            to="/employee/attendance"
            icon={<Clock className="h-4 w-4" />}
            label="Today"
            value={clock.isLoading ? '—' : state.label}
            hint={clock.isLoading ? 'Loading…' : state.hint}
            dot={state.tone === 'on' ? 'bg-emerald-500' : state.tone === 'idle' ? 'bg-amber-500' : undefined}
          />
        ) : (
          <Stat to={attendanceHref} icon={<Clock className="h-4 w-4" />} label="Today" value="No employee record" hint="Attendance isn't set up for your account" />
        )}
        <Stat
          to="/projects/my-tasks"
          icon={<KanbanSquare className="h-4 w-4" />}
          label="My open tasks"
          value={tasks.isLoading ? '—' : String(openTasks.length)}
          hint={overdue > 0 ? `${overdue} overdue` : 'Nothing overdue'}
          hintTone={overdue > 0 ? 'text-destructive' : undefined}
        />
        <Stat
          to="/chat"
          icon={<MessagesSquare className="h-4 w-4" />}
          label="Unread messages"
          value={channels.isLoading ? '—' : String(unread)}
          hint={mentions > 0 ? `${mentions} ${mentions === 1 ? 'mention' : 'mentions'}` : `${unreadChannels.length} ${unreadChannels.length === 1 ? 'conversation' : 'conversations'}`}
          hintTone={mentions > 0 ? 'text-primary' : undefined}
        />
        {isLead ? (
          <Stat
            to={attendanceHref}
            icon={<UserCheck className="h-4 w-4" />}
            label="Team today"
            value={team.isLoading ? "—" : team.data?.teamSize != null ? `${team.data.present} / ${team.data.teamSize} in` : `${team.data?.present ?? 0} in`}
            hint={team.data && team.data.pending > 0 ? `${team.data.pending} ${team.data.pending === 1 ? 'request' : 'requests'} to review` : 'No requests waiting'}
            hintTone={team.data && team.data.pending > 0 ? 'text-amber-700 dark:text-amber-300' : undefined}
          />
        ) : (
          <Stat
            to={notificationsHref}
            icon={<Bell className="h-4 w-4" />}
            label="Notifications"
            value={notifications.isLoading ? '—' : String((notifications.data ?? []).filter((n) => !n.is_read).length)}
            hint="Unread of the latest 5"
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Up next" href="/projects/my-tasks" linkLabel="All my tasks">
          {tasks.isLoading ? (
            <Rows />
          ) : openTasks.length === 0 ? (
            <Empty icon={<CircleCheckBig className="h-5 w-5 text-primary" />} text="Nothing is assigned to you." />
          ) : (
            <ul>
              {openTasks.slice(0, 6).map((t) => (
                <li key={t.id} className="border-b border-border/60 last:border-0">
                  <Link to={`/projects/${t.project_id}?task=${t.id}`} className="flex h-10 items-center gap-3 px-3 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none">
                    <PriorityIcon priority={t.priority} />
                    <span className="w-14 shrink-0 text-[12px] tabular-nums text-muted-foreground">
                      {t.project_key}-{t.number}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px]">{t.title}</span>
                    <ColorDot color={t.project_color} className="hidden sm:block" />
                    <DueChip due={t.due_date} className="w-20 shrink-0 justify-end" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Unread" href="/chat" linkLabel="Open chat">
          {channels.isLoading ? (
            <Rows />
          ) : unreadChannels.length === 0 ? (
            <Empty icon={<Inbox className="h-5 w-5 text-muted-foreground" />} text="You're all caught up." />
          ) : (
            <ul>
              {unreadChannels.slice(0, 6).map((c) => (
                <li key={c.id} className="border-b border-border/60 last:border-0">
                  <Link to={`/chat/${c.id}`} className="flex h-10 items-center gap-2.5 px-3 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none">
                    {c.kind === 'private' ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : c.kind === 'dm' ? <MessagesSquare className="h-3.5 w-3.5 text-muted-foreground" /> : <Hash className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{channelLabel(c, byId, user?.id)}</span>
                    <span className="text-[11px] text-muted-foreground">{formatDistanceToNowStrict(new Date(c.last_message_at), { addSuffix: true })}</span>
                    {c.mention_count > 0 ? (
                      <span className="rounded-full bg-primary px-1.5 text-[11px] font-medium tabular-nums text-primary-foreground">@{c.mention_count}</span>
                    ) : (
                      <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium tabular-nums">{c.unread_count}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Recent notifications" href={notificationsHref} linkLabel="See all">
        {notifications.isLoading ? (
          <Rows count={3} />
        ) : (notifications.data ?? []).length === 0 ? (
          <Empty icon={<Bell className="h-5 w-5 text-muted-foreground" />} text="No notifications yet." />
        ) : (
          <ul>
            {(notifications.data ?? []).map((n) => {
              const body = (
                <>
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${n.is_read ? 'bg-transparent' : 'bg-primary'}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{n.title}</span>
                    {n.body ? <span className="block truncate text-[12px] text-muted-foreground">{n.body}</span> : null}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true })}</span>
                </>
              );
              const cls = 'flex items-start gap-2.5 px-3 py-2 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none';
              return (
                <li key={n.id} className="border-b border-border/60 last:border-0">
                  {n.action_url?.startsWith('/') ? (
                    <Link to={n.action_url} className={cls}>
                      {body}
                    </Link>
                  ) : (
                    <div className={cls}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Stat({
  to,
  icon,
  label,
  value,
  hint,
  hintTone,
  dot,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  hintTone?: string;
  dot?: string;
}) {
  return (
    <Link to={to} className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {dot ? <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden /> : null}
        <span className="truncate text-[18px] font-semibold tracking-tight">{value}</span>
      </div>
      <p className={`mt-0.5 truncate text-[12px] ${hintTone ?? 'text-muted-foreground'}`}>{hint}</p>
    </Link>
  );
}

function Panel({ title, href, linkLabel, children }: { title: string; href: string; linkLabel: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex h-10 items-center border-b border-border px-3">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        <Link to={href} className="ml-auto flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
          {linkLabel} <ArrowRight className="h-3 w-3" />
        </Link>
      </header>
      {children}
    </section>
  );
}

function Rows({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2 p-3" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-6 animate-pulse rounded bg-muted/60" />
      ))}
    </div>
  );
}

function Empty({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-[13px] text-muted-foreground">
      {icon}
      {text}
    </div>
  );
}
