import { useState, useEffect, useRef } from 'react';
import { CalendarCheck, Coffee, Clock, LogIn, LogOut, LogOutIcon, MapPin, Radar, ShieldCheck, TimerReset, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatTime12h } from '@/lib/utils';
import { format } from 'date-fns';

interface AttendanceRecord {
  id: string;
  date: string;
  in_time: string | null;
  out_time: string | null;
  break_duration: string | null;
  break_start_at: string | null;
  break_total_minutes: number;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_ip: string | null;
  check_out_ip: string | null;
  check_in_location: { lat: number; lng: number; accuracy?: number } | null;
  check_out_location: { lat: number; lng: number; accuracy?: number } | null;
  total_work_minutes: number | null;
  status: 'present' | 'absent' | 'half_day' | 'leave';
  notes: string | null;
  created_at: string;
  employee_id: string;
}

interface LocationInfo {
  isAllowed: boolean;
  ipAllowed: boolean;
  geoAllowed: boolean;
  requireIpWhitelist: boolean;
  requireGeoFencing: boolean;
  officeName: string | null;
  currentIP: string | null;
  distance: number | null;
  reason: string | null;
}

interface OfficeSettingsRow {
  allowed_ip_ranges: string[] | null;
  require_ip_whitelist: boolean;
  geo_fencing_enabled: boolean;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number | null;
}

interface OfficeWithSettingsRow {
  id: string;
  name: string;
  is_active: boolean;
  office_settings: OfficeSettingsRow[] | null;
}

export function AttendanceSystem() {
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [officeSettings, setOfficeSettings] = useState<{
    officeName: string;
    isActive: boolean;
    allowedIpRanges: string[];
    requireIpWhitelist: boolean;
    geoFencingEnabled: boolean;
    latitude: number | null;
    longitude: number | null;
    radiusMeters: number | null;
  } | null>(null);
  const [locationInfo, setLocationInfo] = useState<LocationInfo>({
    isAllowed: false,
    ipAllowed: false,
    geoAllowed: false,
    requireIpWhitelist: false,
    requireGeoFencing: false,
    officeName: null,
    currentIP: null,
    distance: null,
    reason: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [use12HourTime, setUse12HourTime] = useState(true);
  const [scheduledEndTime, setScheduledEndTime] = useState<string | null>(null);
  const [earlyCheckoutRequest, setEarlyCheckoutRequest] = useState<{
    id: string;
    status: 'pending' | 'approved' | 'declined';
    requested_checkout_time: string;
    reason: string;
  } | null>(null);
  const [todayEarlyRequestCount, setTodayEarlyRequestCount] = useState(0);
  const [approvedCheckoutTime, setApprovedCheckoutTime] = useState<string | null>(null);
  const [earlyRequestModalOpen, setEarlyRequestModalOpen] = useState(false);
  const [earlyRequestReason, setEarlyRequestReason] = useState('');
  const [earlyRequestTime, setEarlyRequestTime] = useState('');
  const [earlyRequestSubmitting, setEarlyRequestSubmitting] = useState(false);
  const lastBreakSyncRef = useRef(0);
  const { toast } = useToast();

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('attendance_time_format');
    if (raw === '12h') setUse12HourTime(true);
    if (raw === '24h') setUse12HourTime(false);
  }, []);

  useEffect(() => {
    localStorage.setItem('attendance_time_format', use12HourTime ? '12h' : '24h');
  }, [use12HourTime]);

  useEffect(() => {
    if (!attendance?.id || !attendance.break_start_at || attendance.out_time) {
      lastBreakSyncRef.current = 0;
      return;
    }

    const nowMs = currentTime.getTime();
    if (nowMs - lastBreakSyncRef.current < 15000) return;
    lastBreakSyncRef.current = nowMs;

    const breakStart = new Date(attendance.break_start_at);
    const activeBreakSeconds = Math.max(0, Math.floor((nowMs - breakStart.getTime()) / 1000));
    const liveBreakDuration = formatDuration((attendance.break_total_minutes ?? 0) * 60 + activeBreakSeconds);

    void supabase
      .from('attendance')
      .update({
        break_duration: liveBreakDuration,
        status: 'present',
      })
      .eq('id', attendance.id);
  }, [attendance?.id, attendance?.break_start_at, attendance?.out_time, attendance?.break_total_minutes, currentTime]);

  // Fetch today's attendance and check location
  useEffect(() => {
    void (async () => {
      await loadEmployeeOfficeContext();
    })();
  }, []);

  const getErrorMessage = (error: unknown) => {
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
    return 'Unknown error';
  };

  const ipv4ToInt = (ip: string) => {
    const parts = ip.split('.').map((p) => Number(p));
    if (parts.length !== 4) return null;
    if (parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
    return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
  };

  const isIpv4InCidr = (ip: string, cidr: string) => {
    const trimmed = cidr.trim();
    if (!trimmed) return false;

    const [networkStr, prefixStr] = trimmed.includes('/') ? trimmed.split('/') : [trimmed, '32'];
    const prefix = Number(prefixStr);
    if (!Number.isFinite(prefix) || prefix < 0 || prefix > 32) return false;

    const ipInt = ipv4ToInt(ip);
    const networkInt = ipv4ToInt(networkStr);
    if (ipInt === null || networkInt === null) return false;

    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (ipInt & mask) === (networkInt & mask);
  };

  const isIpAllowed = (ip: string, allowedRanges: string[]) => {
    return allowedRanges.some((range) => isIpv4InCidr(ip, range));
  };

  const haversineDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const formatMinutes = (minutes: number | null | undefined) => {
    if (minutes === null || minutes === undefined) return '—';
    const safe = Math.max(0, Math.floor(minutes));
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  /** Time string "HH:mm:ss" or "HH:mm" to minutes since midnight */
  const timeToMinutesSinceMidnight = (t: string | null | undefined): number | null => {
    if (!t || typeof t !== 'string') return null;
    const parts = t.trim().split(':').map(Number);
    if (parts.length < 2) return null;
    const h = parts[0] ?? 0;
    const m = parts[1] ?? 0;
    const s = parts[2] ?? 0;
    return h * 60 + m + s / 60;
  };

  /** Live duty duration in seconds (excludes break). Updates with currentTime. */
  const getDutyDurationSeconds = (): number | null => {
    if (!attendance?.in_time) return null;
    const inMins = timeToMinutesSinceMidnight(attendance.in_time);
    if (inMins === null) return null;
    const dateOnly = format(currentTime, 'yyyy-MM-dd');
    const recordDate = attendance.date;
    if (dateOnly !== recordDate) return null;

    let breakMinutesSoFar = attendance.break_total_minutes ?? 0;
    if (attendance.break_start_at) {
      const breakStart = new Date(attendance.break_start_at);
      breakMinutesSoFar += (currentTime.getTime() - breakStart.getTime()) / 60000;
    }

    if (attendance.out_time) {
      const outMins = timeToMinutesSinceMidnight(attendance.out_time);
      if (outMins === null) return null;
      const dutyMins = Math.max(0, outMins - inMins - (attendance.break_total_minutes ?? 0));
      return Math.round(dutyMins * 60);
    }

    const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes() + currentTime.getSeconds() / 60;
    const dutyMins = Math.max(0, nowMins - inMins - breakMinutesSoFar);
    return Math.round(dutyMins * 60);
  };

  const getLiveBreakTotalSeconds = (): number | null => {
    if (!attendance) return null;

    let totalSeconds = Math.max(0, (attendance.break_total_minutes ?? 0) * 60);
    if (!attendance.break_start_at || attendance.out_time) return totalSeconds;

    const breakStart = new Date(attendance.break_start_at);
    const breakStartMs = breakStart.getTime();
    if (Number.isNaN(breakStartMs)) return totalSeconds;

    totalSeconds += Math.max(0, Math.floor((currentTime.getTime() - breakStartMs) / 1000));
    return totalSeconds;
  };

  const formatDuration = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  };

  const getGeoPosition = async () => {
    if (!navigator.geolocation) return null;
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        });
      });
      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
    } catch {
      return null;
    }
  };

  const loadEmployeeOfficeContext = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user?.id) return;

      const { data: employeeRow, error: employeeError } = await supabase
        .from('employees')
        .select('id, office_id, duty_schedule_template_id, custom_work_end_time')
        .eq('user_id', userData.user.id)
        .single();

      if (employeeError) throw employeeError;
      if (!employeeRow) return;

      const employee = employeeRow as typeof employeeRow & {
        duty_schedule_template_id?: string | null;
        custom_work_end_time?: string | null;
        duty_schedule_templates?: { end_time: string } | null;
      };

      let endTime: string | null = null;
      if (employee.custom_work_end_time) {
        endTime = String(employee.custom_work_end_time).slice(0, 8);
      } else if (employee.duty_schedule_template_id) {
        const { data: template } = await supabase
          .from('duty_schedule_templates')
          .select('end_time')
          .eq('id', employee.duty_schedule_template_id)
          .single();
        if (template?.end_time) endTime = String(template.end_time).slice(0, 8);
      }
      setScheduledEndTime(endTime);

      setEmployeeId(employee.id);
      setOfficeId(employee.office_id);

      if (!employee.office_id) {
        setOfficeSettings(null);
        setLocationInfo({
          isAllowed: false,
          ipAllowed: false,
          geoAllowed: false,
          requireIpWhitelist: false,
          requireGeoFencing: false,
          officeName: null,
          currentIP: null,
          distance: null,
          reason: 'No office assigned. Please contact admin.',
        });
        await fetchTodayAttendance(employee.id);
        return;
      }

      const { data: officeData, error: officeError } = await supabase
        .from('offices')
        .select(
          'id,name,is_active,office_settings(allowed_ip_ranges,require_ip_whitelist,geo_fencing_enabled,latitude,longitude,radius_meters)',
        )
        .eq('id', employee.office_id)
        .maybeSingle();

      if (officeError) throw officeError;
      if (!officeData) {
        setOfficeSettings(null);
        setLocationInfo({
          isAllowed: false,
          ipAllowed: false,
          geoAllowed: false,
          requireIpWhitelist: false,
          requireGeoFencing: false,
          officeName: null,
          currentIP: null,
          distance: null,
          reason: 'Office not found. Please contact admin.',
        });
        await fetchTodayAttendance(employee.id);
        return;
      }

      const officeRow = officeData as unknown as OfficeWithSettingsRow;
      const rawSettings = officeRow.office_settings?.[0] ?? null;

      const normalized = {
        officeName: officeRow.name,
        isActive: Boolean(officeRow.is_active),
        allowedIpRanges: (rawSettings?.allowed_ip_ranges ?? []) as string[],
        requireIpWhitelist: Boolean(rawSettings?.require_ip_whitelist),
        geoFencingEnabled: Boolean(rawSettings?.geo_fencing_enabled),
        latitude: rawSettings?.latitude === null || rawSettings?.latitude === undefined ? null : Number(rawSettings.latitude),
        longitude:
          rawSettings?.longitude === null || rawSettings?.longitude === undefined ? null : Number(rawSettings.longitude),
        radiusMeters:
          rawSettings?.radius_meters === null || rawSettings?.radius_meters === undefined ? null : Number(rawSettings.radius_meters),
      };

      setOfficeSettings(normalized);
      await fetchTodayAttendance(employee.id);
      await refreshLocation(normalized);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const fetchTodayAttendance = async (empId?: string) => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const effectiveEmployeeId = empId ?? employeeId;
      if (!effectiveEmployeeId) return;

      // Get today's attendance
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select(
          'id,date,in_time,out_time,break_duration,break_start_at,break_total_minutes,status,notes,created_at,employee_id,check_in_at,check_out_at,check_in_ip,check_out_ip,check_in_location,check_out_location,total_work_minutes',
        )
        .eq('employee_id', effectiveEmployeeId)
        .eq('date', today)
        .maybeSingle();

      if (attendanceData) {
        const checkInLocation =
          (attendanceData.check_in_location as unknown as { lat: number; lng: number; accuracy?: number } | null) ??
          null;
        const checkOutLocation =
          (attendanceData.check_out_location as unknown as { lat: number; lng: number; accuracy?: number } | null) ??
          null;

        setAttendance({
          id: attendanceData.id,
          date: attendanceData.date,
          in_time: attendanceData.in_time,
          out_time: attendanceData.out_time,
          break_duration: attendanceData.break_duration,
          break_start_at: attendanceData.break_start_at,
          break_total_minutes: attendanceData.break_total_minutes ?? 0,
          check_in_at: attendanceData.check_in_at,
          check_out_at: attendanceData.check_out_at,
          check_in_ip: attendanceData.check_in_ip,
          check_out_ip: attendanceData.check_out_ip,
          check_in_location: checkInLocation,
          check_out_location: checkOutLocation,
          total_work_minutes: attendanceData.total_work_minutes,
          status: (attendanceData.in_time && attendanceData.status === 'absent' ? 'present' : attendanceData.status) as 'present' | 'absent' | 'half_day' | 'leave',
          notes: attendanceData.notes,
          created_at: attendanceData.created_at,
          employee_id: attendanceData.employee_id,
        });
      } else {
        setAttendance(null);
      }

      // Fetch all of today's early checkout requests (latest first) for badge and 3-per-day limit
      const { data: earlyRequestsToday } = await supabase
        .from('early_checkout_requests')
        .select('id, status, requested_checkout_time, reason')
        .eq('employee_id', effectiveEmployeeId)
        .eq('date', today)
        .order('created_at', { ascending: false });
      const list = earlyRequestsToday ?? [];
      setTodayEarlyRequestCount(list.length);
      const latest = list[0];
      setEarlyCheckoutRequest(
        latest
          ? {
              id: latest.id,
              status: latest.status as 'pending' | 'approved' | 'declined',
              requested_checkout_time: String(latest.requested_checkout_time).slice(0, 8),
              reason: latest.reason ?? '',
            }
          : null,
      );
      const latestApproved = list.find((r) => r.status === 'approved');
      setApprovedCheckoutTime(
        latestApproved ? String(latestApproved.requested_checkout_time).slice(0, 8) : null,
      );
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const refreshLocation = async (settingsOverride?: typeof officeSettings) => {
    const settings = settingsOverride ?? officeSettings;
    if (!settings) return;

    try {
      if (!settings.isActive) {
        const computed: LocationInfo = {
          isAllowed: false,
          ipAllowed: false,
          geoAllowed: false,
          requireIpWhitelist: settings.requireIpWhitelist,
          requireGeoFencing: settings.geoFencingEnabled,
          officeName: settings.officeName,
          currentIP: null,
          distance: null,
          reason: 'Office is inactive. Attendance cannot be marked.',
        };
        setLocationInfo(computed);
        return { info: computed, geo: null as { lat: number; lng: number; accuracy?: number } | null };
      }

      const response = await fetch('https://api.ipify.org?format=json');
      const data = (await response.json()) as { ip?: string };
      const ip = data?.ip ?? null;

      const requireIp = settings.requireIpWhitelist;
      const requireGeo = settings.geoFencingEnabled;

      const ipAllowed = !requireIp || (!!ip && isIpAllowed(ip, settings.allowedIpRanges));

      let geoAllowed = !requireGeo;
      let distance: number | null = null;
      let geo: { lat: number; lng: number; accuracy?: number } | null = null;

      if (requireGeo) {
        const officeLat = settings.latitude;
        const officeLng = settings.longitude;
        const radius = settings.radiusMeters ?? 100;

        geo = await getGeoPosition();

        if (geo && officeLat !== null && officeLng !== null) {
          distance = haversineDistanceMeters(geo.lat, geo.lng, officeLat, officeLng);
          geoAllowed = distance <= radius;
        } else {
          geoAllowed = false;
        }
      }

      const isAllowed = ipAllowed && geoAllowed;
      const reason = isAllowed
        ? null
        : !ipAllowed && requireIp
          ? 'Your network is not allowed for this office.'
          : !geoAllowed && requireGeo
            ? 'You are outside the allowed office location.'
            : 'Attendance cannot be marked.';

      const computed: LocationInfo = {
        isAllowed,
        ipAllowed,
        geoAllowed,
        requireIpWhitelist: requireIp,
        requireGeoFencing: requireGeo,
        officeName: settings.officeName,
        currentIP: ip,
        distance,
        reason,
      };
      setLocationInfo(computed);
      return { info: computed, geo };
    } catch (error) {
      console.error('Error checking location:', error);
      const computed: LocationInfo = {
        isAllowed: false,
        ipAllowed: false,
        geoAllowed: false,
        requireIpWhitelist: settings.requireIpWhitelist,
        requireGeoFencing: settings.geoFencingEnabled,
        officeName: settings.officeName,
        currentIP: null,
        distance: null,
        reason: 'Failed to verify location/network.',
      };
      setLocationInfo(computed);
      return { info: computed, geo: null as { lat: number; lng: number; accuracy?: number } | null };
    }
  };

  const handleCheckIn = async () => {
    if (!employeeId) return;
    if (!officeSettings) return;
    const refreshed = await refreshLocation();
    if (!refreshed?.info.isAllowed) {
      toast({
        title: "Location Restricted",
        description: refreshed?.info.reason || "You can only mark attendance from the allowed network and location.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const nowTime = format(new Date(), 'HH:mm:ss');
      const nowIso = new Date().toISOString();

      // Check if already checked in
      if (attendance?.in_time) {
        toast({
          title: "Already Checked In",
          description: "You have already checked in today.",
          variant: "destructive"
        });
        return;
      }

      const { data, error } = await supabase
        .from('attendance')
        .upsert({
          employee_id: employeeId,
          date: today,
          in_time: nowTime,
          check_in_at: nowIso,
          check_in_ip: refreshed.info.currentIP,
          check_in_location: refreshed.geo,
          status: 'present',
          break_start_at: null,
          break_total_minutes: 0,
          total_work_minutes: null,
          notes: null,
        }, { onConflict: 'employee_id,date' })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const checkInLocation =
          (data.check_in_location as unknown as { lat: number; lng: number; accuracy?: number } | null) ?? null;
        const checkOutLocation =
          (data.check_out_location as unknown as { lat: number; lng: number; accuracy?: number } | null) ?? null;

        setAttendance({
          id: data.id,
          date: data.date,
          in_time: data.in_time,
          out_time: data.out_time,
          break_duration: data.break_duration,
          break_start_at: data.break_start_at,
          break_total_minutes: data.break_total_minutes ?? 0,
          check_in_at: data.check_in_at,
          check_out_at: data.check_out_at,
          check_in_ip: data.check_in_ip,
          check_out_ip: data.check_out_ip,
          check_in_location: checkInLocation,
          check_out_location: checkOutLocation,
          total_work_minutes: data.total_work_minutes,
          status: (data.in_time && data.status === 'absent' ? 'present' : data.status) as 'present' | 'absent' | 'half_day' | 'leave',
          notes: data.notes,
          created_at: data.created_at,
          employee_id: data.employee_id,
        });
      }

      toast({
        title: "Checked In Successfully",
        description: `You checked in at ${nowTime}`,
      });
    } catch (error) {
      console.error('Error checking in:', error);
      toast({
        title: "Error",
        description: getErrorMessage(error) || "Failed to check in. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getEarliestCheckoutTime = (): string | null => {
    if (approvedCheckoutTime) return approvedCheckoutTime;
    return scheduledEndTime;
  };

  const handleCheckOut = async () => {
    if (!attendance?.id) return;
    if (!officeSettings) return;
    const refreshed = await refreshLocation();
    if (!refreshed?.info.isAllowed) {
      toast({
        title: "Location Restricted",
        description: refreshed?.info.reason || "You can only mark attendance from the allowed network and location.",
        variant: "destructive"
      });
      return;
    }

    const earliest = getEarliestCheckoutTime();
    if (earliest) {
      const now = new Date();
      const [eh, em] = earliest.split(':').map(Number);
      const cutoff = new Date(now);
      cutoff.setHours(eh, em ?? 0, 0, 0);
      if (now < cutoff) {
        toast({
          title: "Cannot check out yet",
          description: `You must complete your duty hours. Earliest checkout time is ${formatTime12h(earliest)}.${approvedCheckoutTime ? ' (You have an approved early leave request for this time.)' : ''}`,
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);
    try {
      const nowTime = format(new Date(), 'HH:mm:ss');
      const nowIso = new Date().toISOString();

      const checkInAt = attendance.check_in_at
        ? new Date(attendance.check_in_at)
        : attendance.in_time
          ? new Date(`${attendance.date}T${attendance.in_time}`)
          : null;

      if (!checkInAt) throw new Error('Missing check-in time');

      const totalMinutesSinceCheckIn = Math.max(0, Math.floor((Date.now() - checkInAt.getTime()) / 60000));

      let breakTotal = attendance.break_total_minutes ?? 0;
      if (attendance.break_start_at) {
        const breakStart = new Date(attendance.break_start_at);
        const extraBreakSeconds = Math.max(0, Math.floor((Date.now() - breakStart.getTime()) / 1000));
        const extraBreakMinutes = Math.ceil(extraBreakSeconds / 60);
        breakTotal += extraBreakMinutes;
      }

      const workMinutes = Math.max(0, totalMinutesSinceCheckIn - breakTotal);
      const totalHoursStr = formatMinutes(workMinutes);
      const breakDurationStr = `${breakTotal} minutes`;

      const { error } = await supabase
        .from('attendance')
        .update({
          out_time: nowTime,
          check_out_at: nowIso,
          check_out_ip: refreshed.info.currentIP,
          check_out_location: refreshed.geo,
          break_start_at: null,
          break_total_minutes: breakTotal,
          break_duration: breakDurationStr,
          total_work_minutes: workMinutes,
          status: 'present',
          notes: `Total hours: ${totalHoursStr}`,
        })
        .eq('id', attendance.id);

      if (error) throw error;

      setAttendance((prev) =>
        prev
          ? {
              ...prev,
              out_time: nowTime,
              check_out_at: nowIso,
              check_out_ip: refreshed.info.currentIP,
              check_out_location: refreshed.geo,
              break_start_at: null,
              break_total_minutes: breakTotal,
              break_duration: breakDurationStr,
              total_work_minutes: workMinutes,
              status: 'present',
              notes: `Total hours: ${totalHoursStr}`,
            }
          : null,
      );
      toast({
        title: "Checked Out Successfully",
        description: `You checked out at ${nowTime}. Total hours: ${totalHoursStr}`,
      });
    } catch (error) {
      console.error('Error checking out:', error);
      toast({
        title: "Error",
        description: getErrorMessage(error) || "Failed to check out. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBreakStart = async () => {
    if (!attendance?.id || !attendance.in_time || attendance.out_time) return;
    if (attendance.break_start_at) return;
    if (!officeSettings) return;
    const refreshed = await refreshLocation();
    if (!refreshed?.info.isAllowed) {
      toast({
        title: "Location Restricted",
        description: refreshed?.info.reason || "You can only manage breaks from the allowed network and location.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase.from('attendance').update({ break_start_at: nowIso, break_duration: 'Break running: 0m 0s', status: 'present' }).eq('id', attendance.id);
      if (error) throw error;

      setAttendance((prev) => (prev ? { ...prev, break_start_at: nowIso, break_duration: 'Break running: 0m 0s', status: 'present' } : prev));
      toast({ title: "Break started" });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error) || "Failed to start break.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitEarlyCheckoutRequest = async () => {
    if (!employeeId || !earlyRequestReason.trim() || !earlyRequestTime.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please provide a reason and the time you want to leave.',
        variant: 'destructive',
      });
      return;
    }
    setEarlyRequestSubmitting(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const timeValue = earlyRequestTime.length === 5 ? `${earlyRequestTime}:00` : earlyRequestTime;
      const { error } = await supabase.from('early_checkout_requests').insert({
        employee_id: employeeId,
        date: today,
        reason: earlyRequestReason.trim(),
        requested_checkout_time: timeValue,
        status: 'pending',
      });
      if (error) throw error;
      toast({ title: 'Request submitted', description: 'Your early check-out request has been sent. You can check out at the requested time once approved.' });
      setEarlyRequestModalOpen(false);
      setEarlyRequestReason('');
      setEarlyRequestTime('');
      await fetchTodayAttendance(employeeId);
    } catch (e) {
      toast({
        title: 'Error',
        description: getErrorMessage(e) || 'Failed to submit request.',
        variant: 'destructive',
      });
    } finally {
      setEarlyRequestSubmitting(false);
    }
  };

  const handleBreakEnd = async () => {
    if (!attendance?.id || !attendance.break_start_at || attendance.out_time) return;
    if (!officeSettings) return;
    const refreshed = await refreshLocation();
    if (!refreshed?.info.isAllowed) {
      toast({
        title: "Location Restricted",
        description: refreshed?.info.reason || "You can only manage breaks from the allowed network and location.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const breakStart = new Date(attendance.break_start_at);
      const additionalSeconds = Math.max(0, Math.floor((Date.now() - breakStart.getTime()) / 1000));
      const additionalMinutes = Math.ceil(additionalSeconds / 60);
      const newTotal = (attendance.break_total_minutes ?? 0) + additionalMinutes;
      const breakDurationStr = formatDuration((attendance.break_total_minutes ?? 0) * 60 + additionalSeconds);

      const { error } = await supabase
        .from('attendance')
        .update({ break_start_at: null, break_total_minutes: newTotal, break_duration: breakDurationStr, status: 'present' })
        .eq('id', attendance.id);

      if (error) throw error;

      setAttendance((prev) =>
        prev ? { ...prev, break_start_at: null, break_total_minutes: newTotal, break_duration: breakDurationStr, status: 'present' } : prev,
      );
      toast({ title: "Break ended" });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: getErrorMessage(error) || "Failed to end break.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getEffectiveAttendanceStatus = (record: AttendanceRecord) => {
    if (record.in_time && record.status === 'absent') return 'present';
    return record.status;
  };

  const getStatusBadge = () => {
    if (!attendance) return <Badge variant="outline" className="rounded-full">Not marked</Badge>;

    const effectiveStatus = getEffectiveAttendanceStatus(attendance);
    switch (effectiveStatus) {
      case 'present':
        return <Badge className="rounded-full bg-emerald-500/12 text-emerald-700 hover:bg-emerald-500/12 dark:text-emerald-300">Present</Badge>;
      case 'half_day':
        return <Badge className="rounded-full bg-amber-500/12 text-amber-700 hover:bg-amber-500/12 dark:text-amber-300">Half day</Badge>;
      default:
        return <Badge variant="secondary" className="rounded-full capitalize">{effectiveStatus.replace('_', ' ')}</Badge>;
    }
  };

  const todayTotal = attendance?.total_work_minutes !== null && attendance?.total_work_minutes !== undefined
    ? formatMinutes(attendance.total_work_minutes)
    : attendance?.notes?.includes('Total hours')
      ? attendance.notes.split('Total hours: ')[1]
      : '--';
  const dutySeconds = getDutyDurationSeconds();
  const liveBreakSeconds = getLiveBreakTotalSeconds();
  const locationChecking = !locationInfo.currentIP || (locationInfo.requireGeoFencing && locationInfo.distance === null && !locationInfo.reason);
  const timeChips = [
    { label: 'In', value: formatTime12h(attendance?.in_time), icon: LogIn },
    { label: 'Out', value: formatTime12h(attendance?.out_time), icon: LogOut },
    { label: 'Break', value: liveBreakSeconds === null ? '--' : formatDuration(liveBreakSeconds), icon: Coffee },
    { label: 'Total', value: todayTotal, icon: TimerReset },
  ];

  return (
    <div className="grid gap-3 xl:grid-cols-[1fr_320px]">
      <Card className="rounded-2xl border bg-card shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {getStatusBadge()}
                {attendance?.break_start_at && <Badge className="rounded-full bg-amber-500/12 text-amber-700 hover:bg-amber-500/12 dark:text-amber-300">On break</Badge>}
                {!attendance?.out_time && attendance?.in_time && <Badge className="rounded-full bg-sky-500/12 text-sky-700 hover:bg-sky-500/12 dark:text-sky-300">Live</Badge>}
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Current time</p>
              <p className="mt-1 text-4xl font-black leading-none tracking-tight text-foreground md:text-5xl">
                {format(currentTime, use12HourTime ? 'hh:mm:ss a' : 'HH:mm:ss')}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{format(currentTime, 'EEEE, MMMM d, yyyy')}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-4 lg:w-[420px] lg:grid-cols-2">
              {timeChips.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-xl border bg-muted/20 p-3 dark:bg-muted/10">
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {item.label}</p>
                    <p className="mt-1 truncate text-lg font-bold text-foreground">{item.value}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {attendance?.in_time && (
            <div className="mt-4 rounded-xl border bg-foreground p-3 text-background dark:bg-slate-950 dark:text-white">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs text-background/70 dark:text-slate-400">Time on duty</p>
                  <p className="text-2xl font-black tabular-nums">{dutySeconds === null ? '--' : formatDuration(dutySeconds)}</p>
                  {attendance.break_start_at && liveBreakSeconds !== null && (
                    <p className="mt-1 text-xs text-amber-200 dark:text-amber-300">
                      Break timer: {formatDuration(liveBreakSeconds)}
                    </p>
                  )}
                </div>
                {!attendance?.out_time && <p className="text-xs text-background/70 dark:text-slate-400">Updating live</p>}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {!attendance?.in_time ? (
              <Button onClick={handleCheckIn} disabled={!locationInfo.isAllowed || isLoading} className="h-10 rounded-xl px-4">
                <LogIn className="mr-2 h-4 w-4" />
                Check in
              </Button>
            ) : (
              <>
                {!attendance?.out_time && (
                  <Button onClick={handleCheckOut} disabled={!locationInfo.isAllowed || isLoading} className="h-10 rounded-xl px-4">
                    <LogOut className="mr-2 h-4 w-4" />
                    Check out
                  </Button>
                )}
                {attendance?.in_time && !attendance?.out_time && (
                  attendance.break_start_at ? (
                    <Button variant="outline" onClick={handleBreakEnd} disabled={!locationInfo.isAllowed || isLoading} className="h-10 rounded-xl px-4">
                      <Coffee className="mr-2 h-4 w-4" />
                      End break
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={handleBreakStart} disabled={!locationInfo.isAllowed || isLoading} className="h-10 rounded-xl px-4">
                      <Coffee className="mr-2 h-4 w-4" />
                      Start break
                    </Button>
                  )
                )}
                {attendance?.in_time && !attendance?.out_time && !earlyCheckoutRequest && todayEarlyRequestCount < 3 && (
                  <Button variant="outline" onClick={() => setEarlyRequestModalOpen(true)} className="h-10 rounded-xl px-4">
                    <LogOutIcon className="mr-2 h-4 w-4" />
                    Early out
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="mt-3 space-y-2">
            {attendance?.in_time && !attendance?.out_time && (!earlyCheckoutRequest || earlyCheckoutRequest.status === 'declined') && todayEarlyRequestCount >= 3 && (
              <p className="text-sm text-muted-foreground">You can only submit 3 early check-out requests per day.</p>
            )}
            {attendance?.in_time && !attendance?.out_time && earlyCheckoutRequest && earlyCheckoutRequest.status !== 'declined' && (
              <div className="flex flex-wrap items-center gap-2">
                {earlyCheckoutRequest.status === 'pending' && (
                  <Badge variant="secondary" className="rounded-full">
                    Early leave {formatTime12h(earlyCheckoutRequest.requested_checkout_time)} · Pending
                  </Badge>
                )}
                {earlyCheckoutRequest.status === 'approved' && (
                  <Badge className="rounded-full bg-emerald-600 hover:bg-emerald-600">
                    Early out approved · {formatTime12h(earlyCheckoutRequest.requested_checkout_time)}
                  </Badge>
                )}
              </div>
            )}
            {attendance?.in_time && !attendance?.out_time && earlyCheckoutRequest?.status === 'declined' && todayEarlyRequestCount < 3 && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="destructive" className="rounded-full">Early check-out declined</Badge>
                <Button variant="outline" size="sm" onClick={() => setEarlyRequestModalOpen(true)} className="rounded-xl">
                  Request again
                </Button>
              </div>
            )}
            {scheduledEndTime && attendance?.in_time && !attendance?.out_time && (
              <p className="rounded-xl border bg-muted/20 px-3 py-2 text-xs text-muted-foreground dark:bg-muted/10">
                Scheduled end: {formatTime12h(scheduledEndTime)}{approvedCheckoutTime ? ` · Approved: ${formatTime12h(approvedCheckoutTime)}` : ''}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm font-semibold">
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Access</span>
              <Badge className={locationInfo.isAllowed ? 'rounded-full bg-emerald-500/12 text-emerald-700 hover:bg-emerald-500/12 dark:text-emerald-300' : 'rounded-full'} variant={locationInfo.isAllowed ? 'secondary' : 'destructive'}>
                {locationChecking ? 'Checking' : locationInfo.isAllowed ? 'Allowed' : 'Blocked'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <Alert className={locationChecking ? 'rounded-xl border-border bg-muted/20 dark:bg-muted/10' : locationInfo.isAllowed ? 'rounded-xl border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200' : 'rounded-xl border-destructive/30 bg-destructive/10'}>
              <MapPin className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {locationChecking
                  ? `Checking${locationInfo.officeName ? ` · ${locationInfo.officeName}` : ''}`
                  : locationInfo.isAllowed
                    ? `Allowed${locationInfo.officeName ? ` · ${locationInfo.officeName}` : ''}`
                    : locationInfo.reason || 'Not allowed. Attendance cannot be marked.'}
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border bg-muted/20 p-3 dark:bg-muted/10">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wifi className="h-3.5 w-3.5" /> IP</p>
                <p className="mt-1 truncate text-sm font-semibold text-foreground">{locationInfo.currentIP || 'Checking'}</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3 dark:bg-muted/10">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Radar className="h-3.5 w-3.5" /> Distance</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {locationInfo.requireGeoFencing ? (locationInfo.distance === null ? 'Checking' : `${Math.round(locationInfo.distance)}m`) : 'None'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold"><CalendarCheck className="h-4 w-4 text-sky-600 dark:text-sky-400" /> Preferences</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between rounded-xl border bg-muted/20 p-3 dark:bg-muted/10">
              <div>
                <p className="text-sm font-medium text-foreground">Clock format</p>
                <p className="text-xs text-muted-foreground">12h or 24h display</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">24</span>
                <Switch checked={use12HourTime} onCheckedChange={setUse12HourTime} />
                <span className="text-xs text-muted-foreground">12</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={earlyRequestModalOpen} onOpenChange={setEarlyRequestModalOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request early check-out</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Submit a request to leave early. Your manager will review it. If approved, you can check out at the requested time.
          </p>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Reason for leaving early *</Label>
              <Textarea placeholder="e.g. Personal appointment, family matter..." value={earlyRequestReason} onChange={(e) => setEarlyRequestReason(e.target.value)} rows={3} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Time you want to leave *</Label>
              <Input type="time" value={earlyRequestTime} onChange={(e) => setEarlyRequestTime(e.target.value)} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEarlyRequestModalOpen(false)} disabled={earlyRequestSubmitting} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleSubmitEarlyCheckoutRequest} disabled={earlyRequestSubmitting} className="rounded-xl">
              {earlyRequestSubmitting ? 'Submitting...' : 'Submit request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


