import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Users,
  Building2,
  Clock,
  Shield,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Calendar,
  MapPin,
  Wifi,
  WifiOff,
  Key,
  Lock,
  Unlock,
  PlayCircle,
  PauseCircle,
  RotateCcw,
  TrendingUp,
  UserCheck,
  Briefcase,
  Target,
  UserX,
  ArrowUp,
  ArrowDown,
  Settings,
  Globe2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { formatTime12h } from '@/lib/utils';
import { COMMON_TIME_ZONES, getSupportedTimeZones, isValidTimeZone } from '@/lib/timezones';
import { NewEmployeeForm } from '@/components/employee/NewEmployeeForm';
import { EditEmployeeForm } from '@/components/employee/EditEmployeeForm';

type ProfileStatus = 'active' | 'inactive' | 'locked';

interface OfficeSettings {
  work_start_time: string;
  work_end_time: string;
  timezone: string;
  allowed_ip_ranges: string[] | null;
  require_ip_whitelist: boolean;
  geo_fencing_enabled: boolean;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number | null;
}

interface Office {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  postal_code: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  settings: OfficeSettings | null;
}

interface EmployeeRow {
  id: string;
  employee_id: string;
  user_id: string;
  full_name: string;
  email: string;
  designation: string | null;
  department: string | null;
  office_id: string | null;
  office_name: string | null;
  work_location: 'remote' | 'on_site' | null;
  status: ProfileStatus;
  joining_date: string;
}

interface OfficeSettingsSelectRow {
  work_start_time: string;
  work_end_time: string;
  timezone: string;
  allowed_ip_ranges: string[] | null;
  require_ip_whitelist: boolean;
  geo_fencing_enabled: boolean;
  latitude: string | number | null;
  longitude: string | number | null;
  radius_meters: number | null;
}

interface OfficeSelectRow {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  postal_code: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  office_settings: OfficeSettingsSelectRow | OfficeSettingsSelectRow[] | null;
}

interface EmployeeSelectRow {
  id: string;
  user_id: string;
  employee_id: string;
  department_id: string | null;
  designation: string | null;
  joining_date: string;
  office_id: string | null;
  work_location: 'remote' | 'on_site' | null;
  created_at: string;
}

interface ProfileSelectRow {
  id: string;
  full_name: string;
  email: string;
  status: ProfileStatus;
}

interface DepartmentSelectRow {
  id: string;
  name: string;
}

interface OfficeNameSelectRow {
  id: string;
  name: string;
}

interface DutyScheduleTemplate {
  id: string;
  schedule_name: string;
  shift_type: 'regular' | 'rotating' | 'flexible' | 'night';
  start_time: string;
  end_time: string;
  work_days: string[];
  is_active: boolean;
  created_at?: string;
}

interface DepartmentOpsRow {
  id: string;
  name: string;
  description: string | null;
  employee_count: number;
}

interface AttendanceTimeZone {
  id: string;
  name: string;
  time_zone: string;
  is_active: boolean;
}

const WORK_DAYS_OPTIONS = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
] as const;

const mockAccessControls = [
  {
    id: '1',
    access_level: 'full',
    allowed_areas: ['main_office', 'server_room', 'conference_rooms'],
    ip_override: true,
    is_active: true,
    employee: {
      employee_id: 'EMP001',
      profile: { full_name: 'John Doe', email: 'john@example.com' },
    },
    office: {
      name: 'Headquarters',
      settings: { require_ip_whitelist: false, geo_fencing_enabled: false },
    },
  },
  {
    id: '2',
    access_level: 'restricted',
    allowed_areas: ['main_office', 'break_room'],
    ip_override: false,
    is_active: true,
    employee: {
      employee_id: 'EMP002',
      profile: { full_name: 'Jane Smith', email: 'jane@example.com' },
    },
    office: {
      name: 'Headquarters',
      settings: { require_ip_whitelist: true, geo_fencing_enabled: true },
    },
  },
];

type EmployeeSortField = 'name' | 'employee_id' | 'joining_date' | 'department' | 'designation' | 'status';
type SortOrder = 'asc' | 'desc';

export default function Recruitment() {
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs = ['employees', 'assignments', 'offices', 'schedules', 'access'] as const;
  const tabFromUrl = (() => {
    const t = searchParams.get('tab');
    return t && validTabs.includes(t as (typeof validTabs)[number]) ? t : 'employees';
  })();
  const [searchQuery, setSearchQuery] = useState('');
  const [employeesSearchQuery, setEmployeesSearchQuery] = useState('');
  const [employeesSortBy, setEmployeesSortBy] = useState<EmployeeSortField>('name');
  const [employeesSortOrder, setEmployeesSortOrder] = useState<SortOrder>('asc');
  type AssignmentSortField = EmployeeSortField | 'office';
  const [assignmentsSortBy, setAssignmentsSortBy] = useState<AssignmentSortField>('name');
  const [assignmentsSortOrder, setAssignmentsSortOrder] = useState<SortOrder>('asc');
  const [assignmentsOfficeId, setAssignmentsOfficeId] = useState<string>('');
  const [offices, setOffices] = useState<Office[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [isOfficesLoading, setIsOfficesLoading] = useState(true);
  const [isEmployeesLoading, setIsEmployeesLoading] = useState(true);
  const [isOfficeDialogOpen, setIsOfficeDialogOpen] = useState(false);
  const [editingOffice, setEditingOffice] = useState<Office | null>(null);
  const [officeForm, setOfficeForm] = useState({
    name: '',
    address: '',
    city: '',
    country: '',
    postal_code: '',
    phone: '',
    email: '',
    work_start_time: '09:00:00',
    work_end_time: '17:00:00',
    timezone: 'UTC',
    require_ip_whitelist: false,
    allowed_ip_ranges_text: '',
    geo_fencing_enabled: false,
    latitude: '',
    longitude: '',
    radius_meters: '100',
  });
  const [isOfficeSaving, setIsOfficeSaving] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [assignForm, setAssignForm] = useState<{ employeeId: string; officeId: string }>({
    employeeId: '',
    officeId: '',
  });
  const [isAssignSaving, setIsAssignSaving] = useState(false);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  // Operation/Settings: Duty schedule templates
  const [scheduleTemplates, setScheduleTemplates] = useState<DutyScheduleTemplate[]>([]);
  const [isScheduleTemplatesLoading, setIsScheduleTemplatesLoading] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [editingScheduleTemplate, setEditingScheduleTemplate] = useState<DutyScheduleTemplate | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    schedule_name: '',
    shift_type: 'regular' as DutyScheduleTemplate['shift_type'],
    start_time: '09:00',
    end_time: '17:00',
    work_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as string[],
    is_active: true,
  });
  const [isScheduleSaving, setIsScheduleSaving] = useState(false);
  // Operation/Settings: Departments
  const [departmentsOps, setDepartmentsOps] = useState<DepartmentOpsRow[]>([]);
  const [isDepartmentsOpsLoading, setIsDepartmentsOpsLoading] = useState(false);
  const [isDeptDialogOpen, setIsDeptDialogOpen] = useState(false);
  const [editingDeptOps, setEditingDeptOps] = useState<DepartmentOpsRow | null>(null);
  const [deptForm, setDeptForm] = useState({ name: '', description: '' });
  const [isDeptSaving, setIsDeptSaving] = useState(false);
  const [attendanceTimeZones, setAttendanceTimeZones] = useState<AttendanceTimeZone[]>([]);
  const [isTimeZonesLoading, setIsTimeZonesLoading] = useState(false);
  const [isTimeZoneDialogOpen, setIsTimeZoneDialogOpen] = useState(false);
  const [editingTimeZone, setEditingTimeZone] = useState<AttendanceTimeZone | null>(null);
  const [timeZoneForm, setTimeZoneForm] = useState({ name: '', time_zone: 'Europe/London', is_active: true });
  const [isTimeZoneSaving, setIsTimeZoneSaving] = useState(false);
  const supportedTimeZones = useMemo(() => {
    const zones = new Set([...COMMON_TIME_ZONES, ...getSupportedTimeZones()]);
    return Array.from(zones).sort((a, b) => a.localeCompare(b));
  }, []);
  const { toast } = useToast();

  const getErrorMessage = (error: unknown) => {
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
    return 'Unknown error';
  };

  const handleStatusToggle = (type: string, id: string, currentStatus: boolean) => {
    toast({
      title: 'Status updated',
      description: `${type} has been ${!currentStatus ? 'activated' : 'deactivated'}`,
    });
  };

  const handleDelete = (type: string, id: string) => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;
    
    toast({
      title: `${type} deleted`,
      description: `${type} has been removed successfully`,
    });
  };

  const getShiftTypeIcon = (shiftType: string) => {
    switch (shiftType) {
      case 'regular': return <Clock className="h-4 w-4" />;
      case 'rotating': return <RotateCcw className="h-4 w-4" />;
      case 'flexible': return <PlayCircle className="h-4 w-4" />;
      case 'night': return <PauseCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getAccessLevelColor = (level: string) => {
    switch (level) {
      case 'full': return 'badge-success';
      case 'restricted': return 'badge-warning';
      case 'read_only': return 'default';
      default: return 'default';
    }
  };

  const getAccessLevelIcon = (level: string) => {
    switch (level) {
      case 'full': return <Unlock className="h-4 w-4" />;
      case 'restricted': return <Lock className="h-4 w-4" />;
      case 'read_only': return <Key className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  const fetchOffices = async () => {
    try {
      setIsOfficesLoading(true);
      const { data, error } = await supabase
        .from('offices')
        .select(
          'id,name,address,city,country,postal_code,phone,email,is_active,office_settings(work_start_time,work_end_time,timezone,allowed_ip_ranges,require_ip_whitelist,geo_fencing_enabled,latitude,longitude,radius_meters)',
        )
        .order('created_at', { ascending: false });

      if (error) throw error;

      const toNumberOrNull = (value: string | number | null): number | null => {
        if (value === null) return null;
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
      };

      const rows = (data ?? []) as OfficeSelectRow[];

      const transformed: Office[] = rows.map((row) => {
        const rawSettings = Array.isArray(row.office_settings) ? row.office_settings[0] : row.office_settings;
        const settings: OfficeSettings | null = rawSettings
          ? {
              work_start_time: rawSettings.work_start_time,
              work_end_time: rawSettings.work_end_time,
              timezone: rawSettings.timezone,
              allowed_ip_ranges: rawSettings.allowed_ip_ranges ?? null,
              require_ip_whitelist: Boolean(rawSettings.require_ip_whitelist),
              geo_fencing_enabled: Boolean(rawSettings.geo_fencing_enabled),
              latitude: toNumberOrNull(rawSettings.latitude),
              longitude: toNumberOrNull(rawSettings.longitude),
              radius_meters: rawSettings.radius_meters === null ? null : Number(rawSettings.radius_meters),
            }
          : null;

        return {
          id: row.id,
          name: row.name,
          address: row.address,
          city: row.city,
          country: row.country,
          postal_code: row.postal_code,
          phone: row.phone,
          email: row.email,
          is_active: Boolean(row.is_active),
          settings,
        };
      });

      setOffices(transformed);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error) || 'Failed to fetch offices',
        variant: 'destructive',
      });
    } finally {
      setIsOfficesLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      setIsEmployeesLoading(true);
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('id,user_id,employee_id,department_id,designation,joining_date,office_id,work_location,created_at')
        .order('created_at', { ascending: false });

      if (employeesError) throw employeesError;

      const employeeRows = (employeesData ?? []) as EmployeeSelectRow[];
      const userIds = employeeRows.map((emp) => emp.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, status')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const departmentIds = employeeRows
        .map((emp) => emp.department_id)
        .filter((id): id is string => Boolean(id));
      const { data: departmentsData, error: departmentsError } = await supabase
        .from('departments')
        .select('id, name')
        .in('id', departmentIds);

      if (departmentsError) throw departmentsError;

      const officeIds = Array.from(
        new Set(employeeRows.map((emp) => emp.office_id).filter((id): id is string => Boolean(id))),
      );
      const { data: officesData, error: officesError } = await supabase
        .from('offices')
        .select('id, name')
        .in('id', officeIds);

      if (officesError) throw officesError;

      const profilesById = new Map<string, ProfileSelectRow>();
      for (const p of (profilesData ?? []) as ProfileSelectRow[]) profilesById.set(p.id, p);

      const departmentsById = new Map<string, DepartmentSelectRow>();
      for (const d of (departmentsData ?? []) as DepartmentSelectRow[]) departmentsById.set(d.id, d);

      const officesById = new Map<string, OfficeNameSelectRow>();
      for (const o of (officesData ?? []) as OfficeNameSelectRow[]) officesById.set(o.id, o);

      const transformed: EmployeeRow[] = employeeRows.map((emp) => {
        const profile = profilesById.get(emp.user_id);
        const department = emp.department_id ? departmentsById.get(emp.department_id) : null;
        const office = emp.office_id ? officesById.get(emp.office_id) : null;

        return {
          id: emp.id,
          employee_id: emp.employee_id,
          user_id: emp.user_id,
          full_name: profile?.full_name ?? '—',
          email: profile?.email ?? '—',
          designation: emp.designation ?? null,
          department: department?.name ?? null,
          office_id: emp.office_id ?? null,
          office_name: office?.name ?? null,
          work_location: emp.work_location ?? null,
          status: profile?.status ?? 'inactive',
          joining_date: emp.joining_date,
        };
      });

      setEmployees(transformed);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error) || 'Failed to fetch employees',
        variant: 'destructive',
      });
    } finally {
      setIsEmployeesLoading(false);
    }
  };

  const fetchScheduleTemplates = async () => {
    setIsScheduleTemplatesLoading(true);
    try {
      const { data, error } = await supabase.from('duty_schedule_templates').select('id, schedule_name, shift_type, start_time, end_time, work_days, is_active, created_at').order('schedule_name');
      if (error) throw error;
      const rows = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: row.id as string,
        schedule_name: row.schedule_name as string,
        shift_type: row.shift_type as DutyScheduleTemplate['shift_type'],
        start_time: String(row.start_time ?? '').slice(0, 5),
        end_time: String(row.end_time ?? '').slice(0, 5),
        work_days: Array.isArray(row.work_days) ? (row.work_days as string[]) : [],
        is_active: Boolean(row.is_active),
        created_at: row.created_at as string | undefined,
      }));
      setScheduleTemplates(rows);
    } catch (e) {
      toast({ title: 'Error', description: getErrorMessage(e) || 'Failed to load schedule templates', variant: 'destructive' });
    } finally {
      setIsScheduleTemplatesLoading(false);
    }
  };

  const fetchDepartmentsOps = async () => {
    setIsDepartmentsOpsLoading(true);
    try {
      const { data, error } = await supabase.from('departments').select('id, name, description').order('name');
      if (error) throw error;
      const list = (data ?? []) as { id: string; name: string; description: string | null }[];
      const withCounts = await Promise.all(
        list.map(async (dept) => {
          const { count } = await supabase.from('employees').select('*', { count: 'exact', head: true }).eq('department_id', dept.id);
          return { ...dept, employee_count: count ?? 0 };
        })
      );
      setDepartmentsOps(withCounts);
    } catch (e) {
      toast({ title: 'Error', description: getErrorMessage(e) || 'Failed to load departments', variant: 'destructive' });
    } finally {
      setIsDepartmentsOpsLoading(false);
    }
  };

  const fetchAttendanceTimeZones = async () => {
    setIsTimeZonesLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance_time_zones')
        .select('id, name, time_zone, is_active')
        .order('name');
      if (error) throw error;
      setAttendanceTimeZones((data ?? []) as AttendanceTimeZone[]);
    } catch (e) {
      toast({ title: 'Error', description: getErrorMessage(e) || 'Failed to load time zones', variant: 'destructive' });
    } finally {
      setIsTimeZonesLoading(false);
    }
  };

  useEffect(() => {
    fetchOffices();
    fetchEmployees();
    fetchScheduleTemplates();
    fetchDepartmentsOps();
    fetchAttendanceTimeZones();
  }, []);

  const openNewOfficeDialog = async () => {
    setEditingOffice(null);
    setOfficeForm({
      name: '',
      address: '',
      city: '',
      country: '',
      postal_code: '',
      phone: '',
      email: '',
      work_start_time: '09:00:00',
      work_end_time: '17:00:00',
      timezone: 'UTC',
      require_ip_whitelist: false,
      allowed_ip_ranges_text: '',
      geo_fencing_enabled: false,
      latitude: '',
      longitude: '',
      radius_meters: '100',
    });
    setIsOfficeDialogOpen(true);
  };

  const openEditOfficeDialog = (office: Office) => {
    setEditingOffice(office);
    setOfficeForm({
      name: office.name,
      address: office.address,
      city: office.city,
      country: office.country,
      postal_code: office.postal_code ?? '',
      phone: office.phone ?? '',
      email: office.email ?? '',
      work_start_time: office.settings?.work_start_time ?? '09:00:00',
      work_end_time: office.settings?.work_end_time ?? '17:00:00',
      timezone: office.settings?.timezone ?? 'UTC',
      require_ip_whitelist: Boolean(office.settings?.require_ip_whitelist),
      allowed_ip_ranges_text: (office.settings?.allowed_ip_ranges ?? []).join('\n'),
      geo_fencing_enabled: Boolean(office.settings?.geo_fencing_enabled),
      latitude: office.settings?.latitude === null || office.settings?.latitude === undefined ? '' : String(office.settings.latitude),
      longitude:
        office.settings?.longitude === null || office.settings?.longitude === undefined ? '' : String(office.settings.longitude),
      radius_meters:
        office.settings?.radius_meters === null || office.settings?.radius_meters === undefined ? '100' : String(office.settings.radius_meters),
    });
    setIsOfficeDialogOpen(true);
  };

  const setOfficeGeolocationFromBrowser = async () => {
    if (!navigator.geolocation) {
      toast({
        title: 'Geolocation unavailable',
        description: 'This browser does not support geolocation',
        variant: 'destructive',
      });
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        });
      });

      setOfficeForm((prev) => ({
        ...prev,
        latitude: String(position.coords.latitude),
        longitude: String(position.coords.longitude),
      }));
    } catch (error: unknown) {
      toast({
        title: 'Failed to get location',
        description: getErrorMessage(error) || 'Please allow location access and try again',
        variant: 'destructive',
      });
    }
  };

  const addCurrentIpToAllowedRanges = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = (await response.json()) as { ip?: string };
      const ip = data?.ip;
      if (!ip) throw new Error('Unable to detect IP');

      setOfficeForm((prev) => {
        const existing = prev.allowed_ip_ranges_text
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);

        const next = Array.from(new Set([...existing, `${ip}/32`]));
        return { ...prev, allowed_ip_ranges_text: next.join('\n') };
      });
    } catch (error: unknown) {
      toast({
        title: 'Failed to detect IP',
        description: getErrorMessage(error) || 'Could not fetch public IP',
        variant: 'destructive',
      });
    }
  };

  const saveOffice = async () => {
    if (!officeForm.name.trim() || !officeForm.address.trim() || !officeForm.city.trim() || !officeForm.country.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Name, address, city, and country are required',
        variant: 'destructive',
      });
      return;
    }

    const allowedIpRanges = officeForm.allowed_ip_ranges_text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const latitude = officeForm.latitude.trim() ? Number(officeForm.latitude.trim()) : null;
    const longitude = officeForm.longitude.trim() ? Number(officeForm.longitude.trim()) : null;
    const radiusMeters = officeForm.radius_meters.trim() ? Number(officeForm.radius_meters.trim()) : null;

    if ((latitude !== null && Number.isNaN(latitude)) || (longitude !== null && Number.isNaN(longitude)) || (radiusMeters !== null && Number.isNaN(radiusMeters))) {
      toast({
        title: 'Invalid values',
        description: 'Latitude/longitude/radius must be numbers',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsOfficeSaving(true);
      if (editingOffice) {
        const { error: officeError } = await supabase
          .from('offices')
          .update({
            name: officeForm.name.trim(),
            address: officeForm.address.trim(),
            city: officeForm.city.trim(),
            country: officeForm.country.trim(),
            postal_code: officeForm.postal_code.trim() || null,
            phone: officeForm.phone.trim() || null,
            email: officeForm.email.trim() || null,
          })
          .eq('id', editingOffice.id);

        if (officeError) throw officeError;

        const { error: settingsError } = await supabase.from('office_settings').upsert(
          {
            office_id: editingOffice.id,
            work_start_time: officeForm.work_start_time,
            work_end_time: officeForm.work_end_time,
            timezone: officeForm.timezone.trim() || 'UTC',
            require_ip_whitelist: officeForm.require_ip_whitelist,
            allowed_ip_ranges: allowedIpRanges.length ? allowedIpRanges : null,
            geo_fencing_enabled: officeForm.geo_fencing_enabled,
            latitude,
            longitude,
            radius_meters: radiusMeters,
          },
          { onConflict: 'office_id' },
        );

        if (settingsError) throw settingsError;

        toast({ title: 'Success', description: 'Office updated' });
      } else {
        const { data: createdOffice, error: officeError } = await supabase
          .from('offices')
          .insert({
            name: officeForm.name.trim(),
            address: officeForm.address.trim(),
            city: officeForm.city.trim(),
            country: officeForm.country.trim(),
            postal_code: officeForm.postal_code.trim() || null,
            phone: officeForm.phone.trim() || null,
            email: officeForm.email.trim() || null,
          })
          .select('id')
          .single();

        if (officeError) throw officeError;

        const officeId = createdOffice?.id as string | undefined;
        if (!officeId) throw new Error('Office creation failed');

        const { error: settingsError } = await supabase.from('office_settings').insert({
          office_id: officeId,
          work_start_time: officeForm.work_start_time,
          work_end_time: officeForm.work_end_time,
          timezone: officeForm.timezone.trim() || 'UTC',
          require_ip_whitelist: officeForm.require_ip_whitelist,
          allowed_ip_ranges: allowedIpRanges.length ? allowedIpRanges : null,
          geo_fencing_enabled: officeForm.geo_fencing_enabled,
          latitude,
          longitude,
          radius_meters: radiusMeters,
        });

        if (settingsError) throw settingsError;

        toast({ title: 'Success', description: 'Office created' });
      }

      setIsOfficeDialogOpen(false);
      setEditingOffice(null);
      await fetchOffices();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error) || 'Failed to save office',
        variant: 'destructive',
      });
    } finally {
      setIsOfficeSaving(false);
    }
  };

  const toggleOfficeActive = async (officeId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('offices')
        .update({ is_active: !currentStatus })
        .eq('id', officeId);

      if (error) throw error;

      toast({
        title: 'Status updated',
        description: `Office has been ${!currentStatus ? 'activated' : 'deactivated'}`,
      });

      await fetchOffices();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error) || 'Failed to update office status',
        variant: 'destructive',
      });
    }
  };

  const deleteOffice = async (officeId: string) => {
    if (!confirm('Are you sure you want to delete this office? This action cannot be undone.')) return;

    try {
      const { error } = await supabase.from('offices').delete().eq('id', officeId);
      if (error) throw error;

      toast({ title: 'Office deleted', description: 'Office has been removed successfully' });
      await fetchOffices();
      await fetchEmployees();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error) || 'Failed to delete office',
        variant: 'destructive',
      });
    }
  };

  const openAssignDialog = (employeeId?: string) => {
    const employee = employeeId ? employees.find((e) => e.id === employeeId) : undefined;
    const defaultOfficeId = employee?.work_location === 'remote' ? '_remote' : employee?.office_id ?? offices[0]?.id ?? '';
    setAssignForm({
      employeeId: employeeId ?? '',
      officeId: defaultOfficeId,
    });
    setIsAssignDialogOpen(true);
  };

  const saveAssignment = async () => {
    if (!assignForm.employeeId || !assignForm.officeId) return;

    try {
      setIsAssignSaving(true);
      const payload = assignForm.officeId === '_remote'
        ? { office_id: null, work_location: 'remote' as const }
        : { office_id: assignForm.officeId, work_location: 'on_site' as const };
      const { error } = await supabase
        .from('employees')
        .update(payload)
        .eq('id', assignForm.employeeId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: assignForm.officeId === '_remote' ? 'Employee marked as remote' : 'Employee assigned to office',
      });
      setIsAssignDialogOpen(false);
      await fetchEmployees();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error) || 'Failed to assign employee',
        variant: 'destructive',
      });
    } finally {
      setIsAssignSaving(false);
    }
  };

  const removeAssignment = async (employeeId: string) => {
    if (!confirm('Remove this employee from the office?')) return;

    try {
      const { error } = await supabase.from('employees').update({ office_id: null }).eq('id', employeeId);
      if (error) throw error;

      toast({ title: 'Success', description: 'Office assignment removed' });
      await fetchEmployees();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error) || 'Failed to remove assignment',
        variant: 'destructive',
      });
    }
  };

  const openScheduleDialog = (template?: DutyScheduleTemplate) => {
    if (template) {
      setEditingScheduleTemplate(template);
      setScheduleForm({
        schedule_name: template.schedule_name,
        shift_type: template.shift_type,
        start_time: template.start_time,
        end_time: template.end_time,
        work_days: template.work_days?.length ? [...template.work_days] : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        is_active: template.is_active,
      });
    } else {
      setEditingScheduleTemplate(null);
      setScheduleForm({
        schedule_name: '',
        shift_type: 'regular',
        start_time: '09:00',
        end_time: '17:00',
        work_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        is_active: true,
      });
    }
    setIsScheduleDialogOpen(true);
  };

  const toggleScheduleWorkDay = (day: string) => {
    setScheduleForm((prev) => ({
      ...prev,
      work_days: prev.work_days.includes(day)
        ? prev.work_days.filter((d) => d !== day)
        : [...prev.work_days, day],
    }));
  };

  const saveScheduleTemplate = async () => {
    if (!scheduleForm.schedule_name.trim()) {
      toast({ title: 'Error', description: 'Schedule name is required', variant: 'destructive' });
      return;
    }
    if (scheduleForm.work_days.length === 0) {
      toast({ title: 'Error', description: 'Select at least one work day', variant: 'destructive' });
      return;
    }
    try {
      setIsScheduleSaving(true);
      const startTime = scheduleForm.start_time.length === 5 ? scheduleForm.start_time + ':00' : scheduleForm.start_time;
      const endTime = scheduleForm.end_time.length === 5 ? scheduleForm.end_time + ':00' : scheduleForm.end_time;
      const payload = {
        schedule_name: scheduleForm.schedule_name.trim(),
        shift_type: scheduleForm.shift_type,
        start_time: startTime,
        end_time: endTime,
        work_days: scheduleForm.work_days,
        is_active: scheduleForm.is_active,
      };
      const scheduleTable = supabase.from('duty_schedule_templates');
      if (editingScheduleTemplate) {
        const { error } = await scheduleTable.update(payload).eq('id', editingScheduleTemplate.id);
        if (error) throw error;
        toast({ title: 'Success', description: 'Schedule updated' });
      } else {
        const { error } = await scheduleTable.insert(payload);
        if (error) throw error;
        toast({ title: 'Success', description: 'Schedule created' });
      }
      setIsScheduleDialogOpen(false);
      await fetchScheduleTemplates();
    } catch (e) {
      toast({ title: 'Error', description: getErrorMessage(e) || 'Failed to save schedule', variant: 'destructive' });
    } finally {
      setIsScheduleSaving(false);
    }
  };

  const deleteScheduleTemplate = async (id: string) => {
    if (!confirm('Delete this schedule template? Employees using it will have it cleared.')) return;
    try {
      const { error } = await supabase.from('duty_schedule_templates').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Success', description: 'Schedule deleted' });
      await fetchScheduleTemplates();
    } catch (e) {
      toast({ title: 'Error', description: getErrorMessage(e) || 'Failed to delete schedule', variant: 'destructive' });
    }
  };

  const openTimeZoneDialog = (zone?: AttendanceTimeZone) => {
    if (zone) {
      setEditingTimeZone(zone);
      setTimeZoneForm({ name: zone.name, time_zone: zone.time_zone, is_active: zone.is_active });
    } else {
      setEditingTimeZone(null);
      setTimeZoneForm({ name: '', time_zone: 'Europe/London', is_active: true });
    }
    setIsTimeZoneDialogOpen(true);
  };

  const saveAttendanceTimeZone = async () => {
    const name = timeZoneForm.name.trim();
    const timeZone = timeZoneForm.time_zone.trim();
    if (!name || !timeZone) {
      toast({ title: 'Missing fields', description: 'Name and time zone are required', variant: 'destructive' });
      return;
    }
    if (!isValidTimeZone(timeZone)) {
      toast({ title: 'Invalid time zone', description: 'Choose a valid IANA time zone such as Europe/London', variant: 'destructive' });
      return;
    }

    try {
      setIsTimeZoneSaving(true);
      const payload = { name, time_zone: timeZone, is_active: timeZoneForm.is_active };
      if (editingTimeZone) {
        const { error } = await supabase.from('attendance_time_zones').update(payload).eq('id', editingTimeZone.id);
        if (error) throw error;
        toast({ title: 'Success', description: 'Time zone updated' });
      } else {
        const { error } = await supabase.from('attendance_time_zones').insert(payload);
        if (error) throw error;
        toast({ title: 'Success', description: 'Time zone created' });
      }
      setIsTimeZoneDialogOpen(false);
      await fetchAttendanceTimeZones();
    } catch (e) {
      toast({ title: 'Error', description: getErrorMessage(e) || 'Failed to save time zone', variant: 'destructive' });
    } finally {
      setIsTimeZoneSaving(false);
    }
  };

  const deleteAttendanceTimeZone = async (id: string) => {
    if (!confirm('Delete this time zone? Existing attendance records will keep their saved timezone text.')) return;
    try {
      const { error } = await supabase.from('attendance_time_zones').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Success', description: 'Time zone deleted' });
      await fetchAttendanceTimeZones();
    } catch (e) {
      toast({ title: 'Error', description: getErrorMessage(e) || 'Failed to delete time zone', variant: 'destructive' });
    }
  };

  const openDeptDialog = (dept?: DepartmentOpsRow) => {
    if (dept) {
      setEditingDeptOps(dept);
      setDeptForm({ name: dept.name, description: dept.description ?? '' });
    } else {
      setEditingDeptOps(null);
      setDeptForm({ name: '', description: '' });
    }
    setIsDeptDialogOpen(true);
  };

  const saveDepartmentOps = async () => {
    if (!deptForm.name.trim()) {
      toast({ title: 'Error', description: 'Department name is required', variant: 'destructive' });
      return;
    }
    try {
      setIsDeptSaving(true);
      if (editingDeptOps) {
        const { error } = await supabase
          .from('departments')
          .update({ name: deptForm.name.trim(), description: deptForm.description.trim() || null })
          .eq('id', editingDeptOps.id);
        if (error) throw error;
        toast({ title: 'Success', description: 'Department updated' });
      } else {
        const { error } = await supabase.from('departments').insert({ name: deptForm.name.trim(), description: deptForm.description.trim() || null });
        if (error) throw error;
        toast({ title: 'Success', description: 'Department created' });
      }
      setIsDeptDialogOpen(false);
      await fetchDepartmentsOps();
      await fetchEmployees();
    } catch (e) {
      toast({ title: 'Error', description: getErrorMessage(e) || 'Failed to save department', variant: 'destructive' });
    } finally {
      setIsDeptSaving(false);
    }
  };

  const deleteDepartmentOps = async (id: string) => {
    if (!confirm('Are you sure you want to delete this department?')) return;
    try {
      const { error } = await supabase.from('departments').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Success', description: 'Department deleted' });
      await fetchDepartmentsOps();
      await fetchEmployees();
    } catch (e) {
      toast({ title: 'Error', description: getErrorMessage(e) || 'Failed to delete department', variant: 'destructive' });
    }
  };

  const handleEmployeeStatusToggle = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', userId);
      if (error) throw error;
      toast({ title: 'Status updated', description: `Employee has been ${newStatus}` });
      await fetchEmployees();
    } catch (error: unknown) {
      toast({ title: 'Error', description: getErrorMessage(error) || 'Failed to update status', variant: 'destructive' });
    }
  };

  const handleEmployeeDelete = async (employeeId: string) => {
    if (!confirm('Are you sure you want to delete this employee? This will permanently remove all their data.')) return;
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) {
      toast({ title: 'Error', description: 'Employee not found', variant: 'destructive' });
      return;
    }
    try {
      await supabase.from('salaries').delete().eq('employee_id', employeeId);
      await supabase.from('attendance').delete().eq('employee_id', employeeId);
      const { error: empError } = await supabase.from('employees').delete().eq('id', employeeId);
      if (empError) throw empError;
      await supabase.from('user_roles').delete().eq('user_id', employee.user_id);
      await supabase.from('profiles').delete().eq('id', employee.user_id);
      toast({ title: 'Employee deleted', description: 'Employee record and associated data have been removed' });
      await fetchEmployees();
    } catch (error: unknown) {
      toast({ title: 'Error', description: getErrorMessage(error) || 'Failed to delete employee', variant: 'destructive' });
    }
  };

  const filteredAndSortedEmployees = useMemo(() => {
    const q = employeesSearchQuery.trim().toLowerCase();
    const list = q
      ? employees.filter(
          (emp) =>
            emp.full_name.toLowerCase().includes(q) ||
            emp.email.toLowerCase().includes(q) ||
            emp.employee_id.toLowerCase().includes(q) ||
            (emp.department ?? '').toLowerCase().includes(q) ||
            (emp.designation ?? '').toLowerCase().includes(q)
        )
      : [...employees];
    const mult = employeesSortOrder === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      switch (employeesSortBy) {
        case 'name':
          aVal = a.full_name.toLowerCase();
          bVal = b.full_name.toLowerCase();
          return mult * (aVal < bVal ? -1 : aVal > bVal ? 1 : 0);
        case 'employee_id':
          aVal = a.employee_id.toLowerCase();
          bVal = b.employee_id.toLowerCase();
          return mult * (aVal < bVal ? -1 : aVal > bVal ? 1 : 0);
        case 'joining_date':
          aVal = new Date(a.joining_date).getTime();
          bVal = new Date(b.joining_date).getTime();
          return mult * (Number(aVal) - Number(bVal));
        case 'department':
          aVal = (a.department ?? '').toLowerCase();
          bVal = (b.department ?? '').toLowerCase();
          return mult * (aVal < bVal ? -1 : aVal > bVal ? 1 : 0);
        case 'designation':
          aVal = (a.designation ?? '').toLowerCase();
          bVal = (b.designation ?? '').toLowerCase();
          return mult * (aVal < bVal ? -1 : aVal > bVal ? 1 : 0);
        case 'status':
          aVal = (a.status ?? '').toLowerCase();
          bVal = (b.status ?? '').toLowerCase();
          return mult * (aVal < bVal ? -1 : aVal > bVal ? 1 : 0);
        default:
          return 0;
      }
    });
    return list;
  }, [employees, employeesSearchQuery, employeesSortBy, employeesSortOrder]);

  const filteredAndSortedAssignments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = employees;
    if (assignmentsOfficeId) {
      list = assignmentsOfficeId === '_remote'
        ? list.filter((emp) => emp.work_location === 'remote')
        : list.filter((emp) => emp.office_id === assignmentsOfficeId);
    }
    if (q) {
      list = list.filter(
        (emp) =>
          emp.full_name.toLowerCase().includes(q) ||
          emp.email.toLowerCase().includes(q) ||
          emp.employee_id.toLowerCase().includes(q) ||
          (emp.work_location === 'remote' ? 'remote' : emp.office_name ?? '').toLowerCase().includes(q) ||
          (emp.department ?? '').toLowerCase().includes(q) ||
          (emp.designation ?? '').toLowerCase().includes(q)
      );
    }
    const mult = assignmentsSortOrder === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      switch (assignmentsSortBy) {
        case 'name':
          aVal = a.full_name.toLowerCase();
          bVal = b.full_name.toLowerCase();
          return mult * (aVal < bVal ? -1 : aVal > bVal ? 1 : 0);
        case 'employee_id':
          aVal = a.employee_id.toLowerCase();
          bVal = b.employee_id.toLowerCase();
          return mult * (aVal < bVal ? -1 : aVal > bVal ? 1 : 0);
        case 'joining_date':
          aVal = new Date(a.joining_date).getTime();
          bVal = new Date(b.joining_date).getTime();
          return mult * (Number(aVal) - Number(bVal));
        case 'department':
          aVal = (a.department ?? '').toLowerCase();
          bVal = (b.department ?? '').toLowerCase();
          return mult * (aVal < bVal ? -1 : aVal > bVal ? 1 : 0);
        case 'designation':
          aVal = (a.designation ?? '').toLowerCase();
          bVal = (b.designation ?? '').toLowerCase();
          return mult * (aVal < bVal ? -1 : aVal > bVal ? 1 : 0);
        case 'status':
          aVal = (a.status ?? '').toLowerCase();
          bVal = (b.status ?? '').toLowerCase();
          return mult * (aVal < bVal ? -1 : aVal > bVal ? 1 : 0);
        case 'office':
          aVal = (a.work_location === 'remote' ? 'remote' : a.office_name ?? '').toLowerCase();
          bVal = (b.work_location === 'remote' ? 'remote' : b.office_name ?? '').toLowerCase();
          return mult * (aVal < bVal ? -1 : aVal > bVal ? 1 : 0);
        default:
          return 0;
      }
    });
    return list;
  }, [employees, searchQuery, assignmentsSortBy, assignmentsSortOrder, assignmentsOfficeId]);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Recruitment & Operations</h1>
          <p className="text-muted-foreground mt-1">
            Manage offices, duty schedules, access control, and recruitment activities
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Offices</p>
                <p className="text-2xl font-bold">{offices.length}</p>
              </div>
              <Building2 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <button
          type="button"
          onClick={() => setSearchParams({ tab: 'employees' })}
          className="block w-full rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ring-offset-background"
        >
          <Card className="card-elevated cursor-pointer hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Employees</p>
                  <p className="text-2xl font-bold">{employees.length}</p>
                </div>
                <Users className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </button>
        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Schedules</p>
                <p className="text-2xl font-bold">{scheduleTemplates.filter(s => s.is_active).length}</p>
              </div>
              <Clock className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Access Rules</p>
                <p className="text-2xl font-bold">{mockAccessControls.length}</p>
              </div>
              <Shield className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs
        value={tabFromUrl}
        onValueChange={(value) => setSearchParams({ tab: value })}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger
            value="employees"
            className="flex items-center gap-2 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 dark:data-[state=active]:bg-blue-950/50 dark:data-[state=active]:text-blue-200"
          >
            <UserCheck className="h-4 w-4" />
            Employees
          </TabsTrigger>
          <TabsTrigger
            value="assignments"
            className="flex items-center gap-2 data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-900 dark:data-[state=active]:bg-emerald-950/50 dark:data-[state=active]:text-emerald-200"
          >
            <Users className="h-4 w-4" />
            Employee Office
          </TabsTrigger>
          <TabsTrigger
            value="offices"
            className="flex items-center gap-2 data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900 dark:data-[state=active]:bg-amber-950/50 dark:data-[state=active]:text-amber-200"
          >
            <Building2 className="h-4 w-4" />
            Offices
          </TabsTrigger>
          <TabsTrigger
            value="schedules"
            className="flex items-center gap-2 data-[state=active]:bg-violet-100 data-[state=active]:text-violet-900 dark:data-[state=active]:bg-violet-950/50 dark:data-[state=active]:text-violet-200"
          >
            <Settings className="h-4 w-4" />
            Operation/Settings
          </TabsTrigger>
          <TabsTrigger
            value="access"
            className="flex items-center gap-2 data-[state=active]:bg-rose-100 data-[state=active]:text-rose-900 dark:data-[state=active]:bg-rose-950/50 dark:data-[state=active]:text-rose-200"
          >
            <Shield className="h-4 w-4" />
            Access Control
          </TabsTrigger>
        </TabsList>

        {/* Employee-Office Assignments Tab */}
        <TabsContent value="assignments" className="space-y-6">
          <Card className="card-elevated">
            <CardHeader>
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Employee-Office Assignments
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => openAssignDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Assign Employee
                  </Button>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
                  <div className="relative flex-1 sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search employees..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Sort by:</span>
                    <Select
                      value={assignmentsSortBy}
                      onValueChange={(v) => setAssignmentsSortBy(v as AssignmentSortField)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Employee Name</SelectItem>
                        <SelectItem value="employee_id">Employee ID</SelectItem>
                        <SelectItem value="joining_date">Joining Date</SelectItem>
                        <SelectItem value="department">Department</SelectItem>
                        <SelectItem value="designation">Designation</SelectItem>
                        <SelectItem value="office">Office</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={assignmentsSortOrder}
                      onValueChange={(v) => setAssignmentsSortOrder(v as SortOrder)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">
                          <span className="flex items-center gap-2">
                            <ArrowUp className="h-4 w-4" />
                            Ascending
                          </span>
                        </SelectItem>
                        <SelectItem value="desc">
                          <span className="flex items-center gap-2">
                            <ArrowDown className="h-4 w-4" />
                            Descending
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Office:</span>
                    <Select
                      value={assignmentsOfficeId || '_all'}
                      onValueChange={(v) => setAssignmentsOfficeId(v === '_all' ? '' : v)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All offices" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">All offices</SelectItem>
                        <SelectItem value="_remote">Remote</SelectItem>
                        {offices.map((office) => (
                          <SelectItem key={office.id} value={office.id}>
                            {office.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Badge variant="secondary" className="w-fit">
                    {filteredAndSortedAssignments.length} employees
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Office</TableHead>
                    <TableHead>Joining Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isEmployeesLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndSortedAssignments.map((employee) => (
                        <TableRow key={employee.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{employee.full_name}</p>
                              <p className="text-sm text-muted-foreground">{employee.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-sm bg-secondary px-2 py-1 rounded">
                              {employee.employee_id}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{employee.department ?? '—'}</Badge>
                          </TableCell>
                          <TableCell>{employee.designation ?? '—'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {employee.work_location === 'remote' ? (
                                <Wifi className="h-4 w-4" />
                              ) : (
                                <Building2 className="h-4 w-4" />
                              )}
                              <span>{employee.work_location === 'remote' ? 'Remote' : employee.office_name ?? 'Unassigned'}</span>
                            </div>
                          </TableCell>
                          <TableCell>{format(new Date(employee.joining_date), 'MMM d, yyyy')}</TableCell>
                          <TableCell>
                            <Badge className={employee.status === 'active' ? 'badge-success' : 'badge-destructive'}>
                              {employee.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openAssignDialog(employee.id)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Change Office
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => removeAssignment(employee.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remove Assignment
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Office Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {offices.map((office) => (
              <Card className="card-elevated" key={office.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {office.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Employees</span>
                      <Badge variant="outline">{employees.filter((emp) => emp.office_id === office.id).length}</Badge>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Employees:</p>
                      <div className="space-y-1">
                        {employees
                          .filter((emp) => emp.office_id === office.id)
                          .slice(0, 8)
                          .map((emp) => (
                            <div key={emp.id} className="flex items-center justify-between text-sm">
                              <span>{emp.full_name}</span>
                              <Badge variant="outline" className="text-xs">{emp.designation ?? '—'}</Badge>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Employees Tab */}
        <TabsContent value="employees" className="space-y-6">
          <Card className="card-elevated">
            <CardHeader>
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    All Employees
                  </CardTitle>
                  <Button variant="accent" size="sm" onClick={() => setIsAddEmployeeOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Employee
                  </Button>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
                  <div className="relative flex-1 sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search employees..."
                      value={employeesSearchQuery}
                      onChange={(e) => setEmployeesSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Sort by:</span>
                    <Select
                      value={employeesSortBy}
                      onValueChange={(v) => setEmployeesSortBy(v as EmployeeSortField)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Employee Name</SelectItem>
                        <SelectItem value="employee_id">Employee ID</SelectItem>
                        <SelectItem value="joining_date">Joining Date</SelectItem>
                        <SelectItem value="department">Department</SelectItem>
                        <SelectItem value="designation">Designation</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={employeesSortOrder}
                      onValueChange={(v) => setEmployeesSortOrder(v as SortOrder)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">
                          <span className="flex items-center gap-2">
                            <ArrowUp className="h-4 w-4" />
                            Ascending
                          </span>
                        </SelectItem>
                        <SelectItem value="desc">
                          <span className="flex items-center gap-2">
                            <ArrowDown className="h-4 w-4" />
                            Descending
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Badge variant="secondary" className="w-fit">
                    {filteredAndSortedEmployees.length} employees
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isEmployeesLoading ? (
                <div className="py-12 text-center text-muted-foreground">Loading...</div>
              ) : filteredAndSortedEmployees.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No employees found</p>
                  <Button variant="outline" className="mt-4" onClick={() => setIsAddEmployeeOpen(true)}>
                    Add your first employee
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Designation</TableHead>
                        <TableHead>Joining Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedEmployees.map((employee) => (
                        <TableRow key={employee.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-accent/20 text-accent-foreground">
                                  {employee.full_name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{employee.full_name}</p>
                                <p className="text-sm text-muted-foreground">{employee.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-sm bg-secondary px-2 py-1 rounded">{employee.employee_id}</code>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{employee.department ?? '—'}</Badge>
                          </TableCell>
                          <TableCell>{employee.designation ?? '—'}</TableCell>
                          <TableCell>{format(new Date(employee.joining_date), 'MMM d, yyyy')}</TableCell>
                          <TableCell>
                            <Badge className={employee.status === 'active' ? 'badge-success' : 'badge-destructive'}>
                              {employee.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setEditingEmployeeId(employee.id)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleEmployeeStatusToggle(employee.user_id, employee.status)}
                                >
                                  {employee.status === 'active' ? (
                                    <>
                                      <UserX className="h-4 w-4 mr-2" />
                                      Deactivate
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="h-4 w-4 mr-2" />
                                      Activate
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleEmployeeDelete(employee.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Offices Tab */}
        <TabsContent value="offices" className="space-y-6">
          <Card className="card-elevated">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Office Management
                </CardTitle>
                <Button variant="outline" size="sm" onClick={openNewOfficeDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Office
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isOfficesLoading ? (
                  <div className="py-8 text-center text-muted-foreground">Loading...</div>
                ) : offices.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">No offices found</div>
                ) : (
                  offices.map((office) => {
                    const employeesCount = employees.filter((emp) => emp.office_id === office.id).length;
                    const settings = office.settings;
                    const ipCount = settings?.allowed_ip_ranges?.length ?? 0;

                    return (
                      <div key={office.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <h3 className="font-semibold truncate">{office.name}</h3>
                            <p className="text-sm text-muted-foreground truncate">
                              {office.address} • {office.city}, {office.country}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={office.is_active ? 'badge-success' : 'badge-destructive'}>
                              {office.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            <Switch
                              checked={office.is_active}
                              onCheckedChange={() => toggleOfficeActive(office.id, office.is_active)}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditOfficeDialog(office)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={() => deleteOffice(office.id)}>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>
                              {formatTime12h(settings?.work_start_time)} – {formatTime12h(settings?.work_end_time)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            <span>{employeesCount} employees</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{settings?.timezone ?? '—'}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {!!settings?.require_ip_whitelist && (
                            <Badge variant="outline" className="text-xs">
                              <Wifi className="h-3 w-3 mr-1" />
                              IP Restricted ({ipCount})
                            </Badge>
                          )}
                          {!!settings?.geo_fencing_enabled && (
                            <Badge variant="outline" className="text-xs">
                              <MapPin className="h-3 w-3 mr-1" />
                              Geo Fencing
                            </Badge>
                          )}
                          {!!settings?.geo_fencing_enabled && settings?.latitude !== null && settings?.longitude !== null && (
                            <Badge variant="outline" className="text-xs">
                              {settings.latitude}, {settings.longitude} • {settings.radius_meters ?? 100}m
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Operation/Settings Tab: Duty schedule templates + Departments */}
        <TabsContent value="schedules" className="space-y-6">
          {/* Duty Schedule Templates */}
          <Card className="card-elevated">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Duty Schedule Templates
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => openScheduleDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Schedule
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Named schedules (e.g. Day Shift, Night Shift) used when adding or editing employees. Employees can also use manual times if no schedule is selected.
              </p>
            </CardHeader>
            <CardContent>
              {isScheduleTemplatesLoading ? (
                <div className="py-8 text-center text-muted-foreground">Loading...</div>
              ) : scheduleTemplates.length === 0 ? (
                <div className="py-8 text-center">
                  <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No schedule templates yet</p>
                  <Button variant="outline" className="mt-4" onClick={() => openScheduleDialog()}>
                    Add your first schedule
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {scheduleTemplates.map((schedule) => (
                    <div key={schedule.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{schedule.schedule_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {formatTime12h(schedule.start_time)} – {formatTime12h(schedule.end_time)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {getShiftTypeIcon(schedule.shift_type)}
                            <span className="ml-1 capitalize">{schedule.shift_type}</span>
                          </Badge>
                          <Button variant="ghost" size="icon" onClick={() => openScheduleDialog(schedule)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteScheduleTemplate(schedule.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(schedule.work_days ?? []).map((day) => (
                          <Badge key={day} variant="secondary" className="text-xs capitalize">
                            {day.slice(0, 3)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attendance Time Zones */}
          <Card className="card-elevated">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Globe2 className="h-5 w-5" />
                  Attendance Time Zones
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => openTimeZoneDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Time Zone
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Named time zones employees choose before check-in. UK Time should stay active for operations and reporting.
              </p>
            </CardHeader>
            <CardContent>
              {isTimeZonesLoading ? (
                <div className="py-8 text-center text-muted-foreground">Loading...</div>
              ) : attendanceTimeZones.length === 0 ? (
                <div className="py-8 text-center">
                  <Globe2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No attendance time zones yet</p>
                  <Button variant="outline" className="mt-4" onClick={() => openTimeZoneDialog()}>
                    Add your first time zone
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {attendanceTimeZones.map((zone) => (
                    <div key={zone.id} className="border rounded-lg p-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{zone.name}</h3>
                        <p className="text-sm text-muted-foreground truncate">{zone.time_zone}</p>
                        <Badge className={zone.is_active ? 'badge-success mt-2 text-xs' : 'badge-destructive mt-2 text-xs'}>
                          {zone.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => openTimeZoneDialog(zone)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteAttendanceTimeZone(zone.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Departments */}
          <Card className="card-elevated">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Departments
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => openDeptDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Department
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Departments are used when adding or editing employees.
              </p>
            </CardHeader>
            <CardContent>
              {isDepartmentsOpsLoading ? (
                <div className="py-8 text-center text-muted-foreground">Loading...</div>
              ) : departmentsOps.length === 0 ? (
                <div className="py-8 text-center">
                  <Briefcase className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No departments yet</p>
                  <Button variant="outline" className="mt-4" onClick={() => openDeptDialog()}>
                    Add your first department
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {departmentsOps.map((dept) => (
                    <div key={dept.id} className="border rounded-lg p-4 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{dept.name}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{dept.description || 'No description'}</p>
                        <Badge variant="secondary" className="mt-2 text-xs">
                          {dept.employee_count} employee{dept.employee_count !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => openDeptDialog(dept)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteDepartmentOps(dept.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Schedule template dialog */}
          <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingScheduleTemplate ? 'Edit Schedule Template' : 'New Schedule Template'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Schedule name</Label>
                  <Input
                    placeholder="e.g. Day Shift, Night Shift"
                    value={scheduleForm.schedule_name}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, schedule_name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start time</Label>
                    <Input
                      type="time"
                      value={scheduleForm.start_time}
                      onChange={(e) => setScheduleForm((f) => ({ ...f, start_time: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End time</Label>
                    <Input
                      type="time"
                      value={scheduleForm.end_time}
                      onChange={(e) => setScheduleForm((f) => ({ ...f, end_time: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Shift type</Label>
                  <Select
                    value={scheduleForm.shift_type}
                    onValueChange={(v) => setScheduleForm((f) => ({ ...f, shift_type: v as DutyScheduleTemplate['shift_type'] }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="night">Night</SelectItem>
                      <SelectItem value="flexible">Flexible</SelectItem>
                      <SelectItem value="rotating">Rotating</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Work days</Label>
                  <div className="flex flex-wrap gap-3">
                    {WORK_DAYS_OPTIONS.map(({ value, label }) => (
                      <label key={value} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={scheduleForm.work_days.includes(value)}
                          onCheckedChange={() => toggleScheduleWorkDay(value)}
                        />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={scheduleForm.is_active}
                    onCheckedChange={(v) => setScheduleForm((f) => ({ ...f, is_active: v }))}
                  />
                  <Label>Active</Label>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>Cancel</Button>
                  <Button onClick={saveScheduleTemplate} disabled={isScheduleSaving}>
                    {editingScheduleTemplate ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

          {/* Time zone dialog */}
          <Dialog open={isTimeZoneDialogOpen} onOpenChange={setIsTimeZoneDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingTimeZone ? 'Edit Time Zone' : 'New Time Zone'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    placeholder="e.g. UK Time, Pakistan Team"
                    value={timeZoneForm.name}
                    onChange={(e) => setTimeZoneForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time zone</Label>
                  <Select
                    value={timeZoneForm.time_zone}
                    onValueChange={(value) => setTimeZoneForm((f) => ({ ...f, time_zone: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select time zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {supportedTimeZones.map((zone) => (
                        <SelectItem key={zone} value={zone}>
                          {zone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={timeZoneForm.is_active}
                    onCheckedChange={(value) => setTimeZoneForm((f) => ({ ...f, is_active: value }))}
                  />
                  <Label>Active</Label>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsTimeZoneDialogOpen(false)}>Cancel</Button>
                  <Button onClick={saveAttendanceTimeZone} disabled={isTimeZoneSaving}>
                    {editingTimeZone ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

          {/* Department dialog */}
          <Dialog open={isDeptDialogOpen} onOpenChange={setIsDeptDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingDeptOps ? 'Edit Department' : 'New Department'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    placeholder="e.g. Engineering"
                    value={deptForm.name}
                    onChange={(e) => setDeptForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Brief description"
                    value={deptForm.description}
                    onChange={(e) => setDeptForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDeptDialogOpen(false)}>Cancel</Button>
                  <Button onClick={saveDepartmentOps} disabled={isDeptSaving}>
                    {editingDeptOps ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Access Control Tab */}
        <TabsContent value="access" className="space-y-6">
          <Card className="card-elevated">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Access Control
                </CardTitle>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Grant Access
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockAccessControls.map((access) => (
                  <div key={access.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{access.employee.profile.full_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {access.employee.profile.email} • {access.office.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getAccessLevelColor(access.access_level)}>
                          {getAccessLevelIcon(access.access_level)}
                          <span className="ml-1">{access.access_level.replace('_', ' ')}</span>
                        </Badge>
                        <Switch
                          checked={access.is_active}
                          onCheckedChange={() => handleStatusToggle('Access Control', access.id, access.is_active)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {access.allowed_areas.slice(0, 3).map((area) => (
                          <Badge key={area} variant="outline" className="text-xs">
                            {area.replace('_', ' ')}
                          </Badge>
                        ))}
                        {access.allowed_areas.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{access.allowed_areas.length - 3} more
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          {access.ip_override ? (
                            <Wifi className="h-4 w-4 text-green-600" />
                          ) : (
                            <WifiOff className="h-4 w-4 text-red-600" />
                          )}
                          <span>IP Override</span>
                        </div>
                        {access.office.settings.require_ip_whitelist && (
                          <Badge variant="outline" className="text-xs">
                            <Wifi className="h-3 w-3 mr-1" />
                            IP Restricted
                          </Badge>
                        )}
                        {access.office.settings.geo_fencing_enabled && (
                          <Badge variant="outline" className="text-xs">
                            <MapPin className="h-3 w-3 mr-1" />
                            Geo Fencing
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isOfficeDialogOpen} onOpenChange={setIsOfficeDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
            <DialogTitle>{editingOffice ? 'Edit Office' : 'Add Office'}</DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 min-h-0 px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={officeForm.name} onChange={(e) => setOfficeForm({ ...officeForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Country *</Label>
              <Input
                value={officeForm.country}
                onChange={(e) => setOfficeForm({ ...officeForm, country: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Address *</Label>
              <Textarea
                value={officeForm.address}
                onChange={(e) => setOfficeForm({ ...officeForm, address: e.target.value })}
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label>City *</Label>
              <Input value={officeForm.city} onChange={(e) => setOfficeForm({ ...officeForm, city: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Postal Code</Label>
              <Input
                value={officeForm.postal_code}
                onChange={(e) => setOfficeForm({ ...officeForm, postal_code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={officeForm.phone} onChange={(e) => setOfficeForm({ ...officeForm, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={officeForm.email} onChange={(e) => setOfficeForm({ ...officeForm, email: e.target.value })} />
            </div>
          </div>

          <div className="border-t pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Work Start</Label>
                <Input
                  type="time"
                  value={officeForm.work_start_time}
                  onChange={(e) => setOfficeForm({ ...officeForm, work_start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Work End</Label>
                <Input
                  type="time"
                  value={officeForm.work_end_time}
                  onChange={(e) => setOfficeForm({ ...officeForm, work_end_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input
                  value={officeForm.timezone}
                  onChange={(e) => setOfficeForm({ ...officeForm, timezone: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label>Require IP whitelist</Label>
              </div>
              <Switch
                checked={officeForm.require_ip_whitelist}
                onCheckedChange={(checked) => setOfficeForm({ ...officeForm, require_ip_whitelist: checked })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <Label>Allowed IP ranges (one per line)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addCurrentIpToAllowedRanges}>
                  Add my IP
                </Button>
              </div>
              <Textarea
                value={officeForm.allowed_ip_ranges_text}
                onChange={(e) => setOfficeForm({ ...officeForm, allowed_ip_ranges_text: e.target.value })}
                className="min-h-[110px]"
                placeholder="e.g. 192.168.1.0/24"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label>Enable geo fencing</Label>
              </div>
              <Switch
                checked={officeForm.geo_fencing_enabled}
                onCheckedChange={(checked) => setOfficeForm({ ...officeForm, geo_fencing_enabled: checked })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Latitude</Label>
                <Input
                  value={officeForm.latitude}
                  onChange={(e) => setOfficeForm({ ...officeForm, latitude: e.target.value })}
                  placeholder="e.g. 40.7128"
                />
              </div>
              <div className="space-y-2">
                <Label>Longitude</Label>
                <Input
                  value={officeForm.longitude}
                  onChange={(e) => setOfficeForm({ ...officeForm, longitude: e.target.value })}
                  placeholder="e.g. -74.0060"
                />
              </div>
              <div className="space-y-2">
                <Label>Radius (meters)</Label>
                <Input
                  type="number"
                  value={officeForm.radius_meters}
                  onChange={(e) => setOfficeForm({ ...officeForm, radius_meters: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={setOfficeGeolocationFromBrowser}>
                Use current location
              </Button>
            </div>
          </div>
          </div>

          <DialogFooter className="px-6 pb-6 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOfficeDialogOpen(false)}
              disabled={isOfficeSaving}
            >
              Cancel
            </Button>
            <Button type="button" variant="accent" onClick={saveOffice} disabled={isOfficeSaving}>
              {isOfficeSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Employee to Office</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select
                value={assignForm.employeeId}
                onValueChange={(value) => setAssignForm((prev) => ({ ...prev, employeeId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Office</Label>
              <Select
                value={assignForm.officeId}
                onValueChange={(value) => setAssignForm((prev) => ({ ...prev, officeId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select office" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_remote">Remote</SelectItem>
                  {offices.map((office) => (
                    <SelectItem key={office.id} value={office.id}>
                      {office.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAssignDialogOpen(false)}
              disabled={isAssignSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="accent"
              onClick={saveAssignment}
              disabled={!assignForm.employeeId || !assignForm.officeId || isAssignSaving}
            >
              {isAssignSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddEmployeeOpen} onOpenChange={setIsAddEmployeeOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
            <DialogTitle>Add New Employee</DialogTitle>
            <p className="text-sm text-muted-foreground">Create a new employee account and profile</p>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 px-6 pb-6">
            <NewEmployeeForm
              onSuccess={() => {
                setIsAddEmployeeOpen(false);
                fetchEmployees();
              }}
              onCancel={() => setIsAddEmployeeOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editingEmployeeId !== null} onOpenChange={(open) => !open && setEditingEmployeeId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
            <DialogTitle>Edit Employee</DialogTitle>
            <p className="text-sm text-muted-foreground">Update employee information</p>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 px-6 pb-6">
            <EditEmployeeForm
              employeeId={editingEmployeeId}
              onSuccess={() => {
                setEditingEmployeeId(null);
                fetchEmployees();
              }}
              onCancel={() => setEditingEmployeeId(null)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
