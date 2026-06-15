import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Calendar, Clock, Search, Plus, Check, X, Coffee, LogOutIcon, Edit, Trash2, Filter, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { formatTime12h } from '@/lib/utils';
import { formatTimeOnlyInTimeZone, PAKISTAN_TIME_ZONE, UK_TIME_ZONE, zonedTimeToUtc } from '@/lib/timezones';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const ATTENDANCE_GRACE_MINUTES = 15;

interface AttendanceRecord {
  id: string;
  date: string;
  in_time: string | null;
  out_time: string | null;
  check_in_at: string | null;
  status: string;
  attendance_time_zone_name: string | null;
  attendance_time_zone: string | null;
  check_in_uk_time: string | null;
  check_out_uk_time: string | null;
  break_duration: string | null;
  break_total_minutes: number;
  total_work_minutes: number | null;
  employee: {
    id: string;
    employee_id: string;
    full_name: string;
    office_id: string | null;
    office_name: string | null;
  };
  /** Scheduled start/end for this date (from template or custom), for badge logic */
  scheduleStart?: string | null;
  scheduleEnd?: string | null;
}

interface Employee {
  id: string;
  employee_id: string;
  user_id: string;
  full_name: string;
  office_id: string | null;
  office_name: string | null;
}

interface Office {
  id: string;
  name: string;
}

interface EarlyCheckoutRequestRow {
  id: string;
  employee_id: string;
  date: string;
  reason: string;
  requested_checkout_time: string;
  status: string;
  created_at: string;
  reviewed_at?: string | null;
  response_notes?: string | null;
  employee?: { employee_id: string; full_name?: string };
}

interface OvertimeRequestRow {
  id: string;
  attendance_id: string;
  employee_id: string;
  date: string;
  reason: string;
  status: 'pending' | 'approved' | 'declined';
  requested_at: string;
  reviewed_at?: string | null;
  response_notes?: string | null;
  employee?: { employee_id: string; full_name?: string };
}

export default function Attendance() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    officeId: '_all',
    status: '_all',
    timeFrom: '',
    timeTo: '',
  });
  const [earlyRequests, setEarlyRequests] = useState<EarlyCheckoutRequestRow[]>([]);
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequestRow[]>([]);
  const [reviewModal, setReviewModal] = useState<{ id: string; employeeName: string; reason: string; time: string } | null>(null);
  const [overtimeReviewModal, setOvertimeReviewModal] = useState<{ id: string; employeeName: string; reason: string } | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'decline' | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const { toast } = useToast();

  // New attendance form state
  const [newAttendance, setNewAttendance] = useState({
    employeeId: '',
    inTime: '',
    outTime: '',
    breakMinutes: '0',
    status: 'present',
  });
  const [editAttendance, setEditAttendance] = useState({
    date: selectedDate,
    inTime: '',
    outTime: '',
    breakMinutes: '0',
    status: 'present',
  });

  const normalizeTime = (time: string | null | undefined) => {
    if (!time) return '';
    const [hours = '00', minutes = '00'] = time.split(':');
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
  };

  const timeToMinutes = (time: string | null | undefined) => {
    const normalized = normalizeTime(time);
    if (!normalized) return null;
    const [hours, minutes] = normalized.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const hasCheckIn = (record: Pick<AttendanceRecord, 'in_time' | 'check_in_at'>) => Boolean(record.in_time || record.check_in_at);

  const getEffectiveStatus = (record: Pick<AttendanceRecord, 'status' | 'in_time' | 'check_in_at'>) => {
    if (hasCheckIn(record) && record.status === 'absent') return 'present';
    return record.status;
  };

  const dateTimeIso = (date: string, time: string) => {
    if (!date || !time) return null;
    return zonedTimeToUtc(date, time, PAKISTAN_TIME_ZONE)?.toISOString() ?? null;
  };

  const timeInZoneFromPakistan = (date: string, time: string, timeZone: string) => {
    const utc = zonedTimeToUtc(date, time, PAKISTAN_TIME_ZONE);
    return utc ? formatTimeOnlyInTimeZone(utc, timeZone, false) : null;
  };

  const calculateWorkMinutes = (inTime: string, outTime: string, breakMinutes = 0) => {
    const start = timeToMinutes(inTime);
    const end = timeToMinutes(outTime);
    if (start === null || end === null || end < start) return null;
    return Math.max(0, end - start - Math.max(0, breakMinutes));
  };

  const formatWorkMinutes = (minutes: number | null | undefined) => {
    if (minutes === null || minutes === undefined) return '-';
    const safe = Math.max(0, Math.floor(minutes));
    return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      officeId: '_all',
      status: '_all',
      timeFrom: '',
      timeTo: '',
    });
  };

  const fetchEmployees = async () => {
    if (user?.isTeamLead && !user.officeId) {
      setEmployees([]);
      return;
    }

    let employeesQuery = supabase
      .from('employees')
      .select('id, employee_id, user_id, office_id')
      .order('employee_id');
    if (user?.isTeamLead && user.officeId) {
      employeesQuery = employeesQuery.eq('office_id', user.officeId);
    }
    const { data: employeesData } = await employeesQuery;

    if (employeesData) {
      const officeIds = [...new Set(employeesData.map((emp) => emp.office_id).filter(Boolean))] as string[];
      const officesById = new Map<string, string>();
      if (officeIds.length > 0) {
        const { data: officeRows } = await supabase.from('offices').select('id, name').in('id', officeIds);
        officeRows?.forEach((office) => officesById.set(office.id, office.name));
      }

      const withNames = await Promise.all(
        employeesData.map(async (emp) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', emp.user_id)
            .single();
          return {
            ...emp,
            full_name: profile?.full_name || 'Unknown',
            office_name: emp.office_id ? officesById.get(emp.office_id) ?? null : null,
          };
        })
      );
      setEmployees(withNames);
    }
  };

  const fetchOffices = async () => {
    if (user?.isTeamLead && !user.officeId) {
      setOffices([]);
      return;
    }

    let officesQuery = supabase.from('offices').select('id, name').order('name');
    if (user?.isTeamLead && user.officeId) {
      officesQuery = officesQuery.eq('id', user.officeId);
    }
    const { data, error } = await officesQuery;
    if (error) {
      console.error('Error fetching offices:', error);
      return;
    }
    setOffices(
      (data ?? []).map((office) => ({
        id: office.id,
        name: office.name,
      })),
    );
  };

  const fetchAttendance = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          id,
          date,
          in_time,
          out_time,
          check_in_at,
          break_duration,
          break_total_minutes,
          status,
          attendance_time_zone_name,
          attendance_time_zone,
          check_in_uk_time,
          check_out_uk_time,
          total_work_minutes,
          employee_id
        `)
        .eq('date', selectedDate)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const selectedDayName = dayNames[new Date(selectedDate + 'T12:00:00').getDay()];

        const withEmployeeInfo = await Promise.all(
          data.map(async (record) => {
            const { data: emp } = await supabase
              .from('employees')
              .select('id, employee_id, user_id, office_id, duty_schedule_template_id, custom_work_start_time, custom_work_end_time')
              .eq('id', record.employee_id)
              .single();

            if (user?.isTeamLead && (!user.officeId || emp?.office_id !== user.officeId)) {
              return null;
            }

            let fullName = 'Unknown';
            let officeName: string | null = null;
            let scheduleStart: string | null = null;
            let scheduleEnd: string | null = null;

            if (emp) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', emp.user_id)
                .single();
              fullName = profile?.full_name || 'Unknown';

              if (emp.office_id) {
                const { data: office } = await supabase.from('offices').select('name').eq('id', emp.office_id).single();
                officeName = office?.name ?? null;
              }

              if (emp.custom_work_start_time) scheduleStart = String(emp.custom_work_start_time).slice(0, 8);
              if (emp.custom_work_end_time) scheduleEnd = String(emp.custom_work_end_time).slice(0, 8);
              if ((!scheduleStart || !scheduleEnd) && emp.duty_schedule_template_id) {
                const { data: template } = await supabase
                  .from('duty_schedule_templates')
                  .select('start_time, end_time, work_days')
                  .eq('id', emp.duty_schedule_template_id)
                  .single();
                const workDays = (template?.work_days as string[] | null) ?? [];
                if (template && workDays.map((d) => d?.toLowerCase()).includes(selectedDayName)) {
                  if (!scheduleStart && template.start_time) scheduleStart = String(template.start_time).slice(0, 8);
                  if (!scheduleEnd && template.end_time) scheduleEnd = String(template.end_time).slice(0, 8);
                }
              }
            }

            return {
              ...record,
              employee: {
                id: emp?.id || '',
                employee_id: emp?.employee_id || '',
                full_name: fullName,
                office_id: emp?.office_id ?? null,
                office_name: officeName,
              },
              scheduleStart: scheduleStart ?? null,
              scheduleEnd: scheduleEnd ?? null,
            };
          })
        );
        setAttendance(withEmployeeInfo.filter((record): record is AttendanceRecord => Boolean(record)));
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchOffices();
  }, [user?.isTeamLead, user?.officeId]);

  useEffect(() => {
    fetchAttendance();
  }, [selectedDate, user?.isTeamLead, user?.officeId]);

  const handleAddAttendance = async () => {
    if (!newAttendance.employeeId) {
      toast({
        title: 'Error',
        description: 'Please select an employee',
        variant: 'destructive',
      });
      return;
    }

    try {
      const breakMinutes = Math.max(0, Number(newAttendance.breakMinutes) || 0);
      const checkInUkTime = timeInZoneFromPakistan(selectedDate, newAttendance.inTime, UK_TIME_ZONE);
      const checkOutUkTime = timeInZoneFromPakistan(selectedDate, newAttendance.outTime, UK_TIME_ZONE);
      const { error } = await supabase.from('attendance').insert({
        employee_id: newAttendance.employeeId,
        date: selectedDate,
        in_time: newAttendance.inTime || null,
        out_time: newAttendance.outTime || null,
        check_in_at: dateTimeIso(selectedDate, newAttendance.inTime),
        check_out_at: dateTimeIso(selectedDate, newAttendance.outTime),
        attendance_time_zone_name: 'Pakistan Time',
        attendance_time_zone: PAKISTAN_TIME_ZONE,
        check_in_local_time: newAttendance.inTime || null,
        check_out_local_time: newAttendance.outTime || null,
        check_in_uk_time: checkInUkTime,
        check_out_uk_time: checkOutUkTime,
        break_start_at: null,
        break_total_minutes: breakMinutes,
        break_duration: `${breakMinutes} minutes`,
        total_work_minutes: calculateWorkMinutes(newAttendance.inTime, newAttendance.outTime, breakMinutes),
        status: newAttendance.status,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Attendance record added',
      });

      setIsDialogOpen(false);
      setNewAttendance({ employeeId: '', inTime: '', outTime: '', breakMinutes: '0', status: 'present' });
      fetchAttendance();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add attendance',
        variant: 'destructive',
      });
    }
  };

  const openEditAttendance = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setEditAttendance({
      date: record.date,
      inTime: normalizeTime(record.in_time),
      outTime: normalizeTime(record.out_time),
      breakMinutes: String(record.break_total_minutes ?? 0),
      status: record.status,
    });
  };

  const handleUpdateAttendance = async () => {
    if (!editingRecord) return;
    setIsSavingEdit(true);
    try {
      const breakMinutes = Math.max(0, Number(editAttendance.breakMinutes) || 0);
      const totalWorkMinutes = calculateWorkMinutes(editAttendance.inTime, editAttendance.outTime, breakMinutes);
      const checkInUkTime = timeInZoneFromPakistan(editAttendance.date, editAttendance.inTime, UK_TIME_ZONE);
      const checkOutUkTime = timeInZoneFromPakistan(editAttendance.date, editAttendance.outTime, UK_TIME_ZONE);
      const { error } = await supabase
        .from('attendance')
        .update({
          date: editAttendance.date,
          in_time: editAttendance.inTime || null,
          out_time: editAttendance.outTime || null,
          check_in_at: dateTimeIso(editAttendance.date, editAttendance.inTime),
          check_out_at: dateTimeIso(editAttendance.date, editAttendance.outTime),
          attendance_time_zone_name: 'Pakistan Time',
          attendance_time_zone: PAKISTAN_TIME_ZONE,
          check_in_local_time: editAttendance.inTime || null,
          check_out_local_time: editAttendance.outTime || null,
          check_in_uk_time: checkInUkTime,
          check_out_uk_time: checkOutUkTime,
          break_start_at: null,
          break_total_minutes: breakMinutes,
          break_duration: `${breakMinutes} minutes`,
          total_work_minutes: totalWorkMinutes,
          status: editAttendance.status,
        })
        .eq('id', editingRecord.id);

      if (error) throw error;

      toast({
        title: 'Attendance updated',
        description: `${editingRecord.employee.full_name}'s record was saved.`,
      });
      setEditingRecord(null);
      fetchAttendance();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update attendance',
        variant: 'destructive',
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteAttendance = async (record: AttendanceRecord) => {
    const confirmed = window.confirm(`Delete attendance record for ${record.employee.full_name} on ${format(new Date(record.date + 'T12:00:00'), 'MMM d, yyyy')}?`);
    if (!confirmed) return;

    setDeletingRecordId(record.id);
    try {
      const { error } = await supabase.from('attendance').delete().eq('id', record.id);
      if (error) throw error;

      toast({
        title: 'Attendance deleted',
        description: `${record.employee.full_name}'s record was removed.`,
      });
      fetchAttendance();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete attendance',
        variant: 'destructive',
      });
    } finally {
      setDeletingRecordId(null);
    }
  };

  const fetchEarlyCheckoutRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('early_checkout_requests')
        .select('id, employee_id, date, reason, requested_checkout_time, status, created_at, reviewed_at, response_notes')
        .eq('date', selectedDate)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data?.length) {
        const withNames = await Promise.all(
          (data as EarlyCheckoutRequestRow[]).map(async (row) => {
            const { data: emp } = await supabase
              .from('employees')
              .select('id, employee_id, user_id, office_id')
              .eq('id', row.employee_id)
              .single();
            if (user?.isTeamLead && (!user.officeId || emp?.office_id !== user.officeId)) return null;
            if (!emp) return { ...row, employee: { employee_id: '', full_name: 'Unknown' } };
            const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', emp.user_id).single();
            return {
              ...row,
              employee: { employee_id: emp.employee_id, full_name: profile?.full_name ?? 'Unknown' },
            };
          }),
        );
        setEarlyRequests(withNames.filter((row): row is EarlyCheckoutRequestRow => Boolean(row)));
      } else {
        setEarlyRequests([]);
      }
    } catch (e) {
      console.error('Error fetching early checkout requests:', e);
      setEarlyRequests([]);
    }
  };

  const fetchOvertimeRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance_overtime_requests')
        .select('id, attendance_id, employee_id, date, reason, status, requested_at, reviewed_at, response_notes')
        .eq('date', selectedDate)
        .order('requested_at', { ascending: false });

      if (error) throw error;

      if (data?.length) {
        const withNames = await Promise.all(
          (data as OvertimeRequestRow[]).map(async (row) => {
            const { data: emp } = await supabase
              .from('employees')
              .select('id, employee_id, user_id, office_id')
              .eq('id', row.employee_id)
              .single();
            if (user?.isTeamLead && (!user.officeId || emp?.office_id !== user.officeId)) return null;
            if (!emp) return { ...row, employee: { employee_id: '', full_name: 'Unknown' } };
            const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', emp.user_id).single();
            return {
              ...row,
              employee: { employee_id: emp.employee_id, full_name: profile?.full_name ?? 'Unknown' },
            };
          }),
        );
        setOvertimeRequests(withNames.filter((row): row is OvertimeRequestRow => Boolean(row)));
      } else {
        setOvertimeRequests([]);
      }
    } catch (e) {
      console.error('Error fetching overtime requests:', e);
      setOvertimeRequests([]);
    }
  };

  const openReview = (req: EarlyCheckoutRequestRow, action: 'approve' | 'decline') => {
    setReviewModal({
      id: req.id,
      employeeName: req.employee?.full_name ?? 'Unknown',
      reason: req.reason,
      time: req.requested_checkout_time,
    });
    setReviewAction(action);
    setReviewNotes('');
  };

  const submitReview = async () => {
    if (!reviewModal || !reviewAction) return;
    setReviewSubmitting(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('early_checkout_requests')
        .update({
          status: reviewAction === 'approve' ? 'approved' : 'declined',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.user?.id ?? null,
          response_notes: reviewNotes.trim() || null,
        })
        .eq('id', reviewModal.id);

      if (error) throw error;
      toast({
        title: reviewAction === 'approve' ? 'Request approved' : 'Request declined',
        description: reviewAction === 'approve'
          ? 'The employee can now check out at the requested time.'
          : 'The employee has been notified.',
      });
      setReviewModal(null);
      setReviewAction(null);
      setReviewNotes('');
      await fetchEarlyCheckoutRequests();
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to update request',
        variant: 'destructive',
      });
    } finally {
      setReviewSubmitting(false);
    }
  };

  const openOvertimeReview = (req: OvertimeRequestRow, action: 'approve' | 'decline') => {
    setOvertimeReviewModal({
      id: req.id,
      employeeName: req.employee?.full_name ?? 'Unknown',
      reason: req.reason,
    });
    setReviewAction(action);
    setReviewNotes('');
  };

  const submitOvertimeReview = async () => {
    if (!overtimeReviewModal || !reviewAction) return;
    setReviewSubmitting(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('attendance_overtime_requests')
        .update({
          status: reviewAction === 'approve' ? 'approved' : 'declined',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.user?.id ?? null,
          response_notes: reviewNotes.trim() || null,
        })
        .eq('id', overtimeReviewModal.id);

      if (error) throw error;
      toast({
        title: reviewAction === 'approve' ? 'OT approved' : 'OT declined',
        description: reviewAction === 'approve'
          ? 'The employee can stay checked in and check out when finished.'
          : 'The employee has been notified. Auto checkout will apply if they are past the grace period.',
      });
      setOvertimeReviewModal(null);
      setReviewAction(null);
      setReviewNotes('');
      await fetchOvertimeRequests();
      await fetchAttendance();
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to update OT request',
        variant: 'destructive',
      });
    } finally {
      setReviewSubmitting(false);
    }
  };

  useEffect(() => {
    fetchEarlyCheckoutRequests();
    fetchOvertimeRequests();
  }, [selectedDate, user?.isTeamLead, user?.officeId]);

  /** Compare two time strings "HH:mm:ss" or "HH:mm". Returns -1 if a < b, 0 if equal, 1 if a > b */
  const compareTime = (a: string | null | undefined, b: string | null | undefined): number => {
    if (!a || !b) return 0;
    const parts = (t: string) => t.trim().split(':');
    const toNorm = (t: string) => {
      const p = parts(t);
      const h = (p[0] ?? '0').padStart(2, '0');
      const m = (p[1] ?? '0').padStart(2, '0');
      const s = (p[2] ?? '0').padStart(2, '0');
      return `${h}:${m}:${s}`;
    };
    const na = toNorm(a);
    const nb = toNorm(b);
    if (na < nb) return -1;
    if (na > nb) return 1;
    return 0;
  };

  const getStatusBadge = (record: AttendanceRecord) => {
    const effectiveStatus = getEffectiveStatus(record);

    switch (effectiveStatus) {
      case 'present':
        return <Badge className="badge-success"><Check className="h-3 w-3 mr-1" />Present</Badge>;
      case 'absent':
        return <Badge className="badge-destructive"><X className="h-3 w-3 mr-1" />Absent</Badge>;
      case 'half_day':
        return <Badge className="badge-warning"><Coffee className="h-3 w-3 mr-1" />Half Day</Badge>;
      case 'leave':
        return <Badge className="badge-info">On Leave</Badge>;
      default:
        return <Badge variant="secondary">{effectiveStatus}</Badge>;
    }
  };

  const getTimingBadges = (record: AttendanceRecord) => {
    const badges: React.ReactNode[] = [];
    const { in_time, out_time, scheduleStart, scheduleEnd } = record;
    if (getEffectiveStatus(record) === 'absent') return badges;
    if (scheduleStart && in_time) {
      const inMinutes = timeToMinutes(in_time);
      const startMinutes = timeToMinutes(scheduleStart);
      if (inMinutes !== null && startMinutes !== null) {
        if (inMinutes < startMinutes) {
          badges.push(<Badge key="early-in" variant="secondary" className="text-xs bg-green-100 text-green-800 border-0">Early check-in</Badge>);
        } else if (inMinutes > startMinutes && inMinutes <= startMinutes + ATTENDANCE_GRACE_MINUTES) {
          badges.push(<Badge key="grace-period" variant="secondary" className="text-xs bg-blue-100 text-blue-800 border-0">Grace period</Badge>);
        } else if (inMinutes > startMinutes + ATTENDANCE_GRACE_MINUTES) {
          badges.push(<Badge key="late" variant="secondary" className="text-xs bg-amber-100 text-amber-800 border-0">Late</Badge>);
        }
      }
    }
    if (scheduleEnd && out_time) {
      const cmpOut = compareTime(out_time, scheduleEnd);
      if (cmpOut < 0) badges.push(<Badge key="early-out" variant="secondary" className="text-xs bg-blue-100 text-blue-800 border-0">Early check-out</Badge>);
    }
    return badges;
  };

  const filteredAttendance = attendance.filter((record) => {
    const q = filters.search.trim().toLowerCase();
    const matchesSearch = !q
      || record.employee.full_name.toLowerCase().includes(q)
      || record.employee.employee_id.toLowerCase().includes(q);
    const matchesOffice = filters.officeId === '_all'
      || (filters.officeId === '_unassigned' ? !record.employee.office_id : record.employee.office_id === filters.officeId);
    const matchesStatus = filters.status === '_all' || getEffectiveStatus(record) === filters.status;

    const from = timeToMinutes(filters.timeFrom);
    const to = timeToMinutes(filters.timeTo);
    const inMinutes = timeToMinutes(record.in_time);
    const outMinutes = timeToMinutes(record.out_time);
    const matchesTimeFrom = from === null || (inMinutes !== null && inMinutes >= from) || (outMinutes !== null && outMinutes >= from);
    const matchesTimeTo = to === null || (inMinutes !== null && inMinutes <= to) || (outMinutes !== null && outMinutes <= to);

    return matchesSearch && matchesOffice && matchesStatus && matchesTimeFrom && matchesTimeTo;
  });

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Attendance</h1>
          <p className="text-muted-foreground mt-1">Track and manage employee attendance</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="accent" size="lg" className="w-full sm:w-auto">
              <Plus className="h-5 w-5 mr-2" />
              Mark Attendance
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark Attendance</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select
                  value={newAttendance.employeeId}
                  onValueChange={(value) =>
                    setNewAttendance({ ...newAttendance, employeeId: value, breakMinutes: '0' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_id}){emp.office_name ? ` - ${emp.office_name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>In Time</Label>
                  <Input
                    type="time"
                    value={newAttendance.inTime}
                    onChange={(e) =>
                      setNewAttendance({ ...newAttendance, inTime: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Out Time</Label>
                  <Input
                    type="time"
                    value={newAttendance.outTime}
                    onChange={(e) =>
                      setNewAttendance({ ...newAttendance, outTime: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Break minutes</Label>
                <Input
                  type="number"
                  min="0"
                  value={newAttendance.breakMinutes}
                  onChange={(e) => setNewAttendance({ ...newAttendance, breakMinutes: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Defaults to the employee office SOP break.</p>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={newAttendance.status}
                  onValueChange={(value) =>
                    setNewAttendance({ ...newAttendance, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="half_day">Half Day</SelectItem>
                    <SelectItem value="leave">Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full" variant="accent" onClick={handleAddAttendance}>
                Save Attendance
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Early check-out requests */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogOutIcon className="h-5 w-5" />
            Early check-out requests
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Requests for {format(new Date(selectedDate + 'T12:00:00'), 'MMMM d, yyyy')}. Approve or decline pending; approved and rejected are listed below.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {(() => {
            const pending = earlyRequests.filter((r) => r.status === 'pending');
            const approved = earlyRequests.filter((r) => r.status === 'approved');
            const declined = earlyRequests.filter((r) => r.status === 'declined');
            return (
              <>
                {/* Pending */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Pending</h3>
                  {pending.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No pending requests.</p>
                  ) : (
                    <div className="space-y-3">
                      {pending.map((req) => (
                        <div
                          key={req.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                        >
                          <div className="min-w-0">
                            <p className="font-medium">{req.employee?.full_name ?? 'Unknown'}</p>
                            <p className="text-sm text-muted-foreground">
                              {req.employee?.employee_id} · {format(new Date(req.date), 'MMM d, yyyy')} · Leave at {formatTime12h(req.requested_checkout_time)}
                            </p>
                            <p className="text-sm mt-1">{req.reason}</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => openReview(req, 'approve')}>
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => openReview(req, 'decline')}>
                              <X className="h-4 w-4 mr-1" />
                              Decline
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Approved */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Approved</h3>
                  {approved.length === 0 ? (
                    <p className="text-muted-foreground text-sm">None.</p>
                  ) : (
                    <div className="space-y-3">
                      {approved.map((req) => (
                        <div key={req.id} className="rounded-lg border p-3">
                          <p className="font-medium">{req.employee?.full_name ?? 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">
                            {req.employee?.employee_id} · {format(new Date(req.date), 'MMM d, yyyy')} · Leave at {formatTime12h(req.requested_checkout_time)}
                          </p>
                          <p className="text-sm mt-1">{req.reason}</p>
                          {req.reviewed_at && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Reviewed {format(new Date(req.reviewed_at), 'MMM d, yyyy h:mm a')}
                              {req.response_notes ? ` · ${req.response_notes}` : ''}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Rejected */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Rejected</h3>
                  {declined.length === 0 ? (
                    <p className="text-muted-foreground text-sm">None.</p>
                  ) : (
                    <div className="space-y-3">
                      {declined.map((req) => (
                        <div key={req.id} className="rounded-lg border p-3">
                          <p className="font-medium">{req.employee?.full_name ?? 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">
                            {req.employee?.employee_id} · {format(new Date(req.date), 'MMM d, yyyy')} · Leave at {formatTime12h(req.requested_checkout_time)}
                          </p>
                          <p className="text-sm mt-1">{req.reason}</p>
                          {req.reviewed_at && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Reviewed {format(new Date(req.reviewed_at), 'MMM d, yyyy h:mm a')}
                              {req.response_notes ? ` · ${req.response_notes}` : ''}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* Overtime requests */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Overtime requests
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Employees who choose "I am working overtime" stay checked in while the request is pending. Declined requests return to auto checkout.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {(() => {
            const pending = overtimeRequests.filter((r) => r.status === 'pending');
            const approved = overtimeRequests.filter((r) => r.status === 'approved');
            const declined = overtimeRequests.filter((r) => r.status === 'declined');
            return (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Pending</h3>
                  {pending.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No pending OT requests.</p>
                  ) : (
                    <div className="space-y-3">
                      {pending.map((req) => (
                        <div key={req.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                          <div className="min-w-0">
                            <p className="font-medium">{req.employee?.full_name ?? 'Unknown'}</p>
                            <p className="text-sm text-muted-foreground">
                              {req.employee?.employee_id} · {format(new Date(req.date), 'MMM d, yyyy')} · Requested {format(new Date(req.requested_at), 'h:mm a')}
                            </p>
                            <p className="text-sm mt-1">{req.reason}</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => openOvertimeReview(req, 'approve')}>
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => openOvertimeReview(req, 'decline')}>
                              <X className="h-4 w-4 mr-1" />
                              Decline
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Approved</h3>
                  {approved.length === 0 ? (
                    <p className="text-muted-foreground text-sm">None.</p>
                  ) : (
                    <div className="space-y-3">
                      {approved.map((req) => (
                        <div key={req.id} className="rounded-lg border p-3">
                          <p className="font-medium">{req.employee?.full_name ?? 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{req.employee?.employee_id} · {format(new Date(req.date), 'MMM d, yyyy')}</p>
                          <p className="text-sm mt-1">{req.reason}</p>
                          {req.reviewed_at && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Reviewed {format(new Date(req.reviewed_at), 'MMM d, yyyy h:mm a')}
                              {req.response_notes ? ` · ${req.response_notes}` : ''}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Declined</h3>
                  {declined.length === 0 ? (
                    <p className="text-muted-foreground text-sm">None.</p>
                  ) : (
                    <div className="space-y-3">
                      {declined.map((req) => (
                        <div key={req.id} className="rounded-lg border p-3">
                          <p className="font-medium">{req.employee?.full_name ?? 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{req.employee?.employee_id} · {format(new Date(req.date), 'MMM d, yyyy')}</p>
                          <p className="text-sm mt-1">{req.reason}</p>
                          {req.reviewed_at && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Reviewed {format(new Date(req.reviewed_at), 'MMM d, yyyy h:mm a')}
                              {req.response_notes ? ` · ${req.response_notes}` : ''}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="card-elevated">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-muted-foreground" />
                <h2 className="font-semibold">Filters</h2>
              </div>
              <Button variant="outline" size="sm" onClick={resetFilters} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2 xl:col-span-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    placeholder="Employee name or ID"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Office</Label>
                <Select value={filters.officeId} onValueChange={(value) => setFilters({ ...filters, officeId: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All offices</SelectItem>
                    <SelectItem value="_unassigned">No office</SelectItem>
                    {offices.map((office) => (
                      <SelectItem key={office.id} value={office.id}>
                        {office.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All statuses</SelectItem>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="half_day">Half Day</SelectItem>
                    <SelectItem value="leave">Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3 md:col-span-2 xl:col-span-1">
                <div className="space-y-2">
                  <Label>From</Label>
                  <Input
                    type="time"
                    value={filters.timeFrom}
                    onChange={(e) => setFilters({ ...filters, timeFrom: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <Input
                    type="time"
                    value={filters.timeTo}
                    onChange={(e) => setFilters({ ...filters, timeTo: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <Badge variant="secondary" className="text-sm w-fit">
              {filteredAttendance.length} of {attendance.length} records
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <Card className="card-elevated">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : attendance.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground">No attendance records for this date</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setIsDialogOpen(true)}
              >
                Mark attendance
              </Button>
            </div>
          ) : filteredAttendance.length === 0 ? (
            <div className="p-8 text-center">
              <Search className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground">No attendance records match these filters</p>
              <Button variant="outline" className="mt-4" onClick={resetFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Office</TableHead>
                  <TableHead>Time Zone</TableHead>
                  <TableHead>In Time</TableHead>
                  <TableHead>Out Time</TableHead>
                  <TableHead>Break</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAttendance.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {record.employee.full_name}
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-secondary px-2 py-1 rounded">
                        {record.employee.employee_id}
                      </code>
                    </TableCell>
                    <TableCell>{record.employee.office_name ?? 'No office'}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{record.attendance_time_zone_name ?? '—'}</p>
                        {record.attendance_time_zone && <p className="text-xs text-muted-foreground">{record.attendance_time_zone}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{formatTime12h(record.in_time)}</p>
                        {record.check_in_uk_time && <p className="text-xs text-muted-foreground">UK: {formatTime12h(record.check_in_uk_time)}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{formatTime12h(record.out_time)}</p>
                        {record.check_out_uk_time && <p className="text-xs text-muted-foreground">UK: {formatTime12h(record.check_out_uk_time)}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatWorkMinutes(record.break_total_minutes)}</TableCell>
                    <TableCell className="font-medium tabular-nums">{formatWorkMinutes(record.total_work_minutes)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {getStatusBadge(record)}
                        {getTimingBadges(record)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditAttendance(record)} title="Edit attendance">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteAttendance(record)}
                          disabled={deletingRecordId === record.id}
                          title="Delete attendance"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit attendance modal */}
      <Dialog open={!!editingRecord} onOpenChange={(open) => !open && setEditingRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Attendance</DialogTitle>
          </DialogHeader>
          {editingRecord && (
            <div className="space-y-4 pt-2">
              <div>
                <p className="font-medium">{editingRecord.employee.full_name}</p>
                <p className="text-sm text-muted-foreground">
                  {editingRecord.employee.employee_id}
                  {editingRecord.employee.office_name ? ` · ${editingRecord.employee.office_name}` : ''}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={editAttendance.date}
                  onChange={(e) => setEditAttendance({ ...editAttendance, date: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>In Time</Label>
                  <Input
                    type="time"
                    value={editAttendance.inTime}
                    onChange={(e) => setEditAttendance({ ...editAttendance, inTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Out Time</Label>
                  <Input
                    type="time"
                    value={editAttendance.outTime}
                    onChange={(e) => setEditAttendance({ ...editAttendance, outTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Break minutes</Label>
                <Input
                  type="number"
                  min="0"
                  value={editAttendance.breakMinutes}
                  onChange={(e) => setEditAttendance({ ...editAttendance, breakMinutes: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Use this to correct forgotten or unfinished breaks.</p>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editAttendance.status}
                  onValueChange={(value) => setEditAttendance({ ...editAttendance, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="half_day">Half Day</SelectItem>
                    <SelectItem value="leave">Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditingRecord(null)} disabled={isSavingEdit}>
                  Cancel
                </Button>
                <Button variant="accent" onClick={handleUpdateAttendance} disabled={isSavingEdit}>
                  {isSavingEdit ? 'Saving...' : 'Save changes'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Review early checkout modal */}
      <Dialog open={!!reviewModal} onOpenChange={(open) => !open && setReviewModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewAction === 'approve' ? 'Approve' : 'Decline'} early check-out</DialogTitle>
          </DialogHeader>
          {reviewModal && (
            <>
              <p className="text-sm">
                <span className="font-medium">{reviewModal.employeeName}</span> requested to leave at {formatTime12h(reviewModal.time)}.
              </p>
              <p className="text-sm text-muted-foreground">Reason: {reviewModal.reason}</p>
              <div className="space-y-2">
                <Label>Response notes (optional)</Label>
                <Textarea
                  placeholder="e.g. Approved for medical appointment"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setReviewModal(null)} disabled={reviewSubmitting}>
                  Cancel
                </Button>
                <Button
                  variant={reviewAction === 'decline' ? 'destructive' : 'default'}
                  className={reviewAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                  onClick={submitReview}
                  disabled={reviewSubmitting}
                >
                  {reviewSubmitting ? 'Saving...' : reviewAction === 'approve' ? 'Approve' : 'Decline'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!overtimeReviewModal} onOpenChange={(open) => !open && setOvertimeReviewModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewAction === 'approve' ? 'Approve' : 'Decline'} overtime</DialogTitle>
          </DialogHeader>
          {overtimeReviewModal && (
            <>
              <p className="text-sm">
                <span className="font-medium">{overtimeReviewModal.employeeName}</span> requested overtime approval.
              </p>
              <p className="text-sm text-muted-foreground">Reason: {overtimeReviewModal.reason}</p>
              <div className="space-y-2">
                <Label>{reviewAction === 'decline' ? 'Decline reason' : 'Response notes'} (optional)</Label>
                <Textarea
                  placeholder={reviewAction === 'decline' ? 'e.g. Coverage is not approved today' : 'e.g. Approved for production release'}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOvertimeReviewModal(null)} disabled={reviewSubmitting}>
                  Cancel
                </Button>
                <Button
                  variant={reviewAction === 'decline' ? 'destructive' : 'default'}
                  className={reviewAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                  onClick={submitOvertimeReview}
                  disabled={reviewSubmitting}
                >
                  {reviewSubmitting ? 'Saving...' : reviewAction === 'approve' ? 'Approve' : 'Decline'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
