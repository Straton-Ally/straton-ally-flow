import { useEffect, useMemo, useState } from 'react';
import { format, isToday, parseISO } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  Clock,
  Database,
  Download,
  Filter,
  FileText,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

type Severity = 'info' | 'warning' | 'critical';

type AdminLog = {
  id: string;
  source: string;
  category: string;
  eventType: string;
  severity: Severity;
  actor: string;
  actorDetail?: string | null;
  actorId?: string | null;
  target?: string | null;
  message: string;
  timestamp: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Json | null;
};

type EmployeeRow = Pick<
  Database['public']['Tables']['employees']['Row'],
  'id' | 'user_id' | 'employee_id' | 'designation'
>;

type ProfileRow = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'full_name' | 'email'
>;

const categoryOptions = ['all', 'auth', 'attendance', 'access', 'work', 'database'];
const severityOptions = ['all', 'info', 'warning', 'critical'];
const sourceOptions = [
  'all',
  'Audit Logs',
  'Login Logs',
  'Access Logs',
  'Attendance',
  'Early Checkout',
  'Work Notifications',
];

const normalizeText = (value: string | null | undefined) => value?.trim() || 'System';
const shortId = (value: string | null | undefined) => value ? value.slice(0, 8) : null;

const formatTimestamp = (value: string) => {
  try {
    return format(parseISO(value), 'dd MMM yyyy, hh:mm a');
  } catch {
    return value;
  }
};

const toCsvCell = (value: unknown) => {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const metadataSummary = (metadata: Json | null | undefined) => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const record = metadata as Record<string, Json | undefined>;
  const keys = Object.keys(record).filter((key) => record[key] != null);
  if (keys.length === 0) return null;
  return keys.slice(0, 4).join(', ');
};

export default function Logs() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);

    const [
      auditResult,
      loginResult,
      accessResult,
      attendanceResult,
      earlyCheckoutResult,
      notificationResult,
    ] = await Promise.all([
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('login_logs').select('*').order('login_at', { ascending: false }).limit(200),
      supabase.from('access_logs').select('*').order('timestamp', { ascending: false }).limit(200),
      supabase
        .from('attendance')
        .select('id, employee_id, date, status, in_time, out_time, break_start_at, check_in_at, check_out_at, created_at, last_verified_ip, attendance_time_zone_name, attendance_time_zone')
        .order('created_at', { ascending: false })
        .limit(250),
      supabase.from('early_checkout_requests').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('work_notifications').select('*').order('created_at', { ascending: false }).limit(200),
    ]);

    const errors = [
      auditResult.error,
      loginResult.error,
      accessResult.error,
      attendanceResult.error,
      earlyCheckoutResult.error,
      notificationResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      console.error('Error fetching admin logs:', errors);
      toast.error('Some log sources could not be loaded');
    }

    const employeeIds = new Set<string>();
    const profileIds = new Set<string>();

    loginResult.data?.forEach((row) => profileIds.add(row.user_id));
    attendanceResult.data?.forEach((row) => employeeIds.add(row.employee_id));
    earlyCheckoutResult.data?.forEach((row) => employeeIds.add(row.employee_id));
    accessResult.data?.forEach((row) => {
      if (row.employee_id) employeeIds.add(row.employee_id);
    });
    notificationResult.data?.forEach((row) => {
      profileIds.add(row.user_id);
      if (row.actor_id) profileIds.add(row.actor_id);
    });
    auditResult.data?.forEach((row) => {
      if (row.actor_user_id) profileIds.add(row.actor_user_id);
    });

    const employeesResult = employeeIds.size
      ? await supabase
          .from('employees')
          .select('id, user_id, employee_id, designation')
          .in('id', Array.from(employeeIds))
      : { data: [] as EmployeeRow[], error: null };

    employeesResult.data?.forEach((employee) => profileIds.add(employee.user_id));

    const profilesResult = profileIds.size
      ? await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', Array.from(profileIds))
      : { data: [] as ProfileRow[], error: null };

    if (employeesResult.error || profilesResult.error) {
      console.error('Error fetching log people context:', employeesResult.error || profilesResult.error);
    }

    const employeesById = new Map((employeesResult.data ?? []).map((employee) => [employee.id, employee]));
    const profilesById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));

    const employeeName = (employeeId: string | null | undefined) => {
      if (!employeeId) return 'Unknown employee';
      const employee = employeesById.get(employeeId);
      const profile = employee ? profilesById.get(employee.user_id) : null;
      return profile?.full_name || employee?.employee_id || 'Unknown employee';
    };

    const employeeDetail = (employeeId: string | null | undefined) => {
      if (!employeeId) return null;
      const employee = employeesById.get(employeeId);
      const profile = employee ? profilesById.get(employee.user_id) : null;
      return [
        employee?.employee_id ? `Emp ${employee.employee_id}` : null,
        profile?.email,
        `ID ${shortId(employeeId)}`,
      ].filter(Boolean).join(' • ');
    };

    const userName = (userId: string | null | undefined) => {
      if (!userId) return 'System';
      const profile = profilesById.get(userId);
      return profile?.full_name || profile?.email || userId;
    };

    const userDetail = (userId: string | null | undefined, fallbackEmail?: string | null) => {
      if (!userId && !fallbackEmail) return null;
      const profile = userId ? profilesById.get(userId) : null;
      return [
        fallbackEmail || profile?.email,
        userId ? `User ${shortId(userId)}` : null,
      ].filter(Boolean).join(' • ');
    };

    const nextLogs: AdminLog[] = [
      ...(auditResult.data ?? []).map((row) => ({
        id: `audit-${row.id}`,
        source: 'Audit Logs',
        category: row.category,
        eventType: row.event_type,
        severity: row.severity as Severity,
        actor: normalizeText(row.actor_name || row.actor_email || userName(row.actor_user_id)),
        actorDetail: userDetail(row.actor_user_id, row.actor_email),
        actorId: row.actor_user_id,
        target: row.target_table ? `${row.target_table}${row.target_id ? ` #${row.target_id.slice(0, 8)}` : ''}` : null,
        message: row.message,
        timestamp: row.created_at,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        metadata: row.metadata,
      })),
      ...(loginResult.data ?? []).map((row) => ({
        id: `login-${row.id}`,
        source: 'Login Logs',
        category: 'auth',
        eventType: row.success ? 'login_success' : 'login_failed',
        severity: row.success ? 'info' as Severity : 'warning' as Severity,
        actor: userName(row.user_id),
        actorDetail: userDetail(row.user_id),
        actorId: row.user_id,
        target: 'Authentication',
        message: row.success ? 'User signed in successfully' : 'User login attempt failed',
        timestamp: row.login_at,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        metadata: { success: row.success },
      })),
      ...(accessResult.data ?? []).map((row) => ({
        id: `access-${row.id}`,
        source: 'Access Logs',
        category: 'access',
        eventType: row.access_type,
        severity: row.success ? 'info' as Severity : 'critical' as Severity,
        actor: employeeName(row.employee_id),
        actorDetail: employeeDetail(row.employee_id),
        actorId: row.employee_id,
        target: `Office #${row.office_id.slice(0, 8)}`,
        message: row.success
          ? `Access ${row.access_type} recorded`
          : `Access denied${row.denial_reason ? `: ${row.denial_reason}` : ''}`,
        timestamp: row.timestamp,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        metadata: {
          access_method: row.access_method,
          location_data: row.location_data,
          denial_reason: row.denial_reason,
        },
      })),
      ...(attendanceResult.data ?? []).flatMap((row) => {
        const actor = employeeName(row.employee_id);
        const base = {
          category: 'attendance',
          actor,
          actorDetail: employeeDetail(row.employee_id),
          actorId: row.employee_id,
          target: row.date,
          ipAddress: row.last_verified_ip,
          metadata: {
            status: row.status,
            time_zone_name: row.attendance_time_zone_name,
            time_zone: row.attendance_time_zone,
          },
        };
        const entries: AdminLog[] = [
          {
            id: `attendance-created-${row.id}`,
            source: 'Attendance',
            eventType: 'attendance_record',
            severity: 'info',
            message: `${actor} attendance record is ${row.status}`,
            timestamp: row.created_at,
            ...base,
          },
        ];

        if (row.check_in_at || row.in_time) {
          entries.push({
            id: `attendance-in-${row.id}`,
            source: 'Attendance',
            eventType: 'check_in',
            severity: 'info',
            message: `${actor} checked in${row.in_time ? ` at ${row.in_time}` : ''}`,
            timestamp: row.check_in_at || row.created_at,
            ...base,
          });
        }

        if (row.check_out_at || row.out_time) {
          entries.push({
            id: `attendance-out-${row.id}`,
            source: 'Attendance',
            eventType: 'check_out',
            severity: 'info',
            message: `${actor} checked out${row.out_time ? ` at ${row.out_time}` : ''}`,
            timestamp: row.check_out_at || row.created_at,
            ...base,
          });
        }

        if (row.break_start_at) {
          entries.push({
            id: `attendance-break-${row.id}`,
            source: 'Attendance',
            eventType: 'break_started',
            severity: 'info',
            message: `${actor} started a break`,
            timestamp: row.break_start_at,
            ...base,
          });
        }

        return entries;
      }),
      ...(earlyCheckoutResult.data ?? []).map((row) => ({
        id: `early-checkout-${row.id}`,
        source: 'Early Checkout',
        category: 'attendance',
        eventType: `early_checkout_${row.status}`,
        severity: row.status === 'declined' ? 'warning' as Severity : 'info' as Severity,
        actor: employeeName(row.employee_id),
        actorDetail: employeeDetail(row.employee_id),
        actorId: row.employee_id,
        target: row.date,
        message: `${employeeName(row.employee_id)} requested early checkout for ${row.requested_checkout_time}`,
        timestamp: row.created_at,
        metadata: {
          reason: row.reason,
          status: row.status,
          reviewed_at: row.reviewed_at,
          reviewed_by: row.reviewed_by,
          response_notes: row.response_notes,
        },
      })),
      ...(notificationResult.data ?? []).map((row) => ({
        id: `notification-${row.id}`,
        source: 'Work Notifications',
        category: 'work',
        eventType: row.type,
        severity: 'info' as Severity,
        actor: row.actor_id ? userName(row.actor_id) : 'System',
        actorDetail: row.actor_id ? userDetail(row.actor_id) : null,
        actorId: row.actor_id,
        target: userName(row.user_id),
        message: row.body ? `${row.title}: ${row.body}` : row.title,
        timestamp: row.created_at,
        metadata: {
          user_id: row.user_id,
          office_id: row.office_id,
          channel_id: row.channel_id,
          is_read: row.is_read,
          read_at: row.read_at,
        },
      })),
    ];

    setLogs(nextLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    setLoading(false);
  };

  const filteredLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;

    return logs.filter((log) => {
      const timestamp = new Date(log.timestamp).getTime();
      const matchesSearch = !query || [
        log.actor,
        log.actorDetail || '',
        log.category,
        log.eventType,
        log.message,
        log.source,
        log.target || '',
        log.ipAddress || '',
      ].some((value) => value.toLowerCase().includes(query));

      return (
        matchesSearch &&
        (categoryFilter === 'all' || log.category === categoryFilter) &&
        (severityFilter === 'all' || log.severity === severityFilter) &&
        (sourceFilter === 'all' || log.source === sourceFilter) &&
        (!from || timestamp >= from) &&
        (!to || timestamp <= to)
      );
    });
  }, [categoryFilter, fromDate, logs, searchQuery, severityFilter, sourceFilter, toDate]);

  const stats = useMemo(() => {
    const todayCount = logs.filter((log) => {
      try {
        return isToday(parseISO(log.timestamp));
      } catch {
        return false;
      }
    }).length;

    return {
      total: logs.length,
      today: todayCount,
      warnings: logs.filter((log) => log.severity !== 'info').length,
      failed: logs.filter((log) => log.eventType.includes('failed') || log.message.toLowerCase().includes('denied')).length,
    };
  }, [logs]);

  const exportLogs = () => {
    const headers = [
      'Timestamp',
      'Source',
      'Category',
      'Event',
      'Severity',
      'Actor',
      'Actor Detail',
      'Target',
      'Message',
      'IP Address',
      'User Agent',
      'Metadata',
    ];
    const rows = filteredLogs.map((log) => [
      formatTimestamp(log.timestamp),
      log.source,
      log.category,
      log.eventType,
      log.severity,
      log.actor,
      log.actorDetail || '',
      log.target || '',
      log.message,
      log.ipAddress || '',
      log.userAgent || '',
      log.metadata ? JSON.stringify(log.metadata) : '',
    ]);
    const csv = [headers, ...rows].map((row) => row.map(toCsvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin-logs-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setSeverityFilter('all');
    setSourceFilter('all');
    setFromDate('');
    setToDate('');
  };

  const severityVariant = (severity: Severity) => {
    if (severity === 'critical') return 'destructive';
    if (severity === 'warning') return 'secondary';
    return 'outline';
  };

  return (
    <div className="w-full space-y-6 p-4 md:p-6 xl:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Logs</h1>
          <p className="text-muted-foreground mt-1">
            Monitor app activity, security events, attendance actions, and admin changes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={exportLogs} disabled={filteredLogs.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="card-elevated">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total logs</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <Activity className="h-8 w-8 text-success" />
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Today</p>
              <p className="text-2xl font-bold">{stats.today}</p>
            </div>
            <Clock className="h-8 w-8 text-blue-500" />
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Warnings</p>
              <p className="text-2xl font-bold">{stats.warnings}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Failed or denied</p>
              <p className="text-2xl font-bold">{stats.failed}</p>
            </div>
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </CardContent>
        </Card>
      </div>

      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>{filteredLogs.length} records match the current view</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-4 items-end">
            <div className="space-y-2 xl:col-span-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search actor, event, IP..."
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category === 'all' ? 'All categories' : category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {severityOptions.map((severity) => (
                    <SelectItem key={severity} value={severity}>
                      {severity === 'all' ? 'All severities' : severity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source === 'all' ? 'All sources' : source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>From</Label>
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </div>
            <Button variant="ghost" onClick={resetFilters} className="justify-self-start xl:justify-self-end">
              Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Activity Timeline
          </CardTitle>
          <CardDescription>Latest records from audit, login, access, attendance, and work activity.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-x-auto">
            <Table className="min-w-[1180px] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[165px]">Time</TableHead>
                  <TableHead className="w-[165px]">Source</TableHead>
                  <TableHead className="w-[240px]">Who did it</TableHead>
                  <TableHead className="w-[140px]">Event</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="w-[130px]">IP</TableHead>
                  <TableHead className="w-[105px] text-right">Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      Loading logs...
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      No logs found for the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(log.timestamp)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium whitespace-nowrap">{log.source}</p>
                            <p className="text-xs text-muted-foreground">{log.category}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium leading-tight break-words">{log.actor}</p>
                          {(log.actorDetail || log.actorId) && (
                            <p className="text-xs text-muted-foreground leading-tight break-all">
                              {log.actorDetail || `ID ${shortId(log.actorId)}`}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <Badge variant="outline" className="whitespace-nowrap">
                          {log.eventType.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="space-y-1">
                          <p className="text-sm leading-5 break-words">{log.message}</p>
                          {(log.target || metadataSummary(log.metadata)) && (
                            <p className="text-xs text-muted-foreground">
                              {log.target ? `Target: ${log.target}` : ''}
                              {log.target && metadataSummary(log.metadata) ? ' • ' : ''}
                              {metadataSummary(log.metadata) ? `Meta: ${metadataSummary(log.metadata)}` : ''}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {log.ipAddress || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={severityVariant(log.severity)} className="capitalize">
                          {log.severity}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
