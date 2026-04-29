import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  Plus,
  Search,
  MoreHorizontal,
  Calendar,
  User,
  Building2,
  Edit,
  Trash2,
  PlayCircle,
  PauseCircle,
  RotateCcw,
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
import { formatTime12h } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface DutySchedule {
  id: string;
  employee_id: string;
  office_id: string;
  schedule_name: string;
  shift_type: 'regular' | 'rotating' | 'flexible' | 'night';
  start_time: string;
  end_time: string;
  break_duration: string;
  work_days: string[];
  is_active: boolean;
  effective_date: string;
  expiry_date: string | null;
  created_at: string;
  employee: {
    employee_id: string;
    profile: {
      full_name: string;
      email: string;
    };
  };
  office: {
    name: string;
  };
}

interface DutyScheduleSelectRow {
  id: string;
  employee_id: string;
  office_id: string;
  schedule_name: string;
  shift_type: 'regular' | 'rotating' | 'flexible' | 'night';
  start_time: string;
  end_time: string;
  break_duration: string | null;
  work_days: string[] | null;
  is_active: boolean;
  effective_date: string;
  expiry_date: string | null;
  created_at: string;
}

interface EmployeeSelectRow {
  id: string;
  user_id: string;
  employee_id: string;
}

interface ProfileSelectRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

export default function DutySchedules() {
  const [schedules, setSchedules] = useState<DutySchedule[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchSchedules = async () => {
    setIsLoading(true);
    try {
      const scheduleClient = supabase as unknown as {
        from: (table: 'duty_schedules') => {
          select: (columns: string) => {
            order: (
              column: 'created_at',
              options: { ascending: boolean },
            ) => Promise<{ data: DutyScheduleSelectRow[] | null; error: Error | null }>;
          };
        };
      };
      const { data, error } = await scheduleClient
        .from('duty_schedules')
        .select('id,employee_id,office_id,schedule_name,shift_type,start_time,end_time,break_duration,work_days,is_active,effective_date,expiry_date,created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = data ?? [];
      const employeeIds = Array.from(new Set(rows.map((row) => row.employee_id)));
      const officeIds = Array.from(new Set(rows.map((row) => row.office_id)));

      const { data: employeesData, error: employeesError } = employeeIds.length
        ? await supabase.from('employees').select('id,user_id,employee_id').in('id', employeeIds)
        : { data: [], error: null };
      if (employeesError) throw employeesError;

      const employeeRows = (employeesData ?? []) as EmployeeSelectRow[];
      const userIds = employeeRows.map((employee) => employee.user_id);

      const { data: profilesData, error: profilesError } = userIds.length
        ? await supabase.from('profiles').select('id,full_name,email').in('id', userIds)
        : { data: [], error: null };
      if (profilesError) throw profilesError;

      const { data: officesData, error: officesError } = officeIds.length
        ? await supabase.from('offices').select('id,name').in('id', officeIds)
        : { data: [], error: null };
      if (officesError) throw officesError;

      const employeesById = new Map<string, EmployeeSelectRow>();
      for (const employee of employeeRows) employeesById.set(employee.id, employee);

      const profilesById = new Map<string, ProfileSelectRow>();
      for (const profile of (profilesData ?? []) as ProfileSelectRow[]) profilesById.set(profile.id, profile);

      const officesById = new Map<string, { id: string; name: string }>();
      for (const office of (officesData ?? []) as { id: string; name: string }[]) officesById.set(office.id, office);

      setSchedules(
        rows.map((row) => {
          const employee = employeesById.get(row.employee_id);
          const profile = employee ? profilesById.get(employee.user_id) : null;
          const office = officesById.get(row.office_id);

          return {
            ...row,
            break_duration: row.break_duration ?? '00:00:00',
            work_days: row.work_days ?? [],
            employee: {
              employee_id: employee?.employee_id ?? '—',
              profile: {
                full_name: profile?.full_name ?? 'Unknown employee',
                email: profile?.email ?? '',
              },
            },
            office: {
              name: office?.name ?? 'Unknown office',
            },
          };
        }),
      );
    } catch (error) {
      console.error('Error fetching duty schedules:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch duty schedules',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const filteredSchedules = schedules.filter((schedule) =>
    schedule.schedule_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    schedule.employee.profile.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    schedule.employee.profile.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    schedule.office.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStatusToggle = async (scheduleId: string, currentStatus: boolean) => {
    try {
      const scheduleClient = supabase as unknown as {
        from: (table: 'duty_schedules') => {
          update: (values: { is_active: boolean }) => {
            eq: (column: 'id', value: string) => Promise<{ error: Error | null }>;
          };
        };
      };
      const { error } = await scheduleClient.from('duty_schedules').update({ is_active: !currentStatus }).eq('id', scheduleId);
      if (error) throw error;
      toast({
        title: 'Status updated',
        description: `Schedule has been ${!currentStatus ? 'activated' : 'deactivated'}`,
      });
      fetchSchedules();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update schedule status',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this duty schedule?')) return;

    try {
      const scheduleClient = supabase as unknown as {
        from: (table: 'duty_schedules') => {
          delete: () => {
            eq: (column: 'id', value: string) => Promise<{ error: Error | null }>;
          };
        };
      };
      const { error } = await scheduleClient.from('duty_schedules').delete().eq('id', scheduleId);
      if (error) throw error;
      toast({
        title: 'Schedule deleted',
        description: 'Duty schedule has been removed successfully',
      });
      fetchSchedules();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete duty schedule',
        variant: 'destructive',
      });
    }
  };

  const getShiftTypeIcon = (shiftType: string) => {
    switch (shiftType) {
      case 'regular':
        return <Clock className="h-4 w-4" />;
      case 'rotating':
        return <RotateCcw className="h-4 w-4" />;
      case 'flexible':
        return <PlayCircle className="h-4 w-4" />;
      case 'night':
        return <PauseCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getShiftTypeColor = (shiftType: string): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (shiftType) {
      case 'regular':
        return 'default';
      case 'rotating':
        return 'secondary';
      case 'flexible':
        return 'outline';
      case 'night':
        return 'destructive';
      default:
        return 'default';
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Duty Schedules</h1>
          <p className="text-muted-foreground mt-1">
            Manage employee work schedules and shift assignments
          </p>
        </div>
        <Link to="/admin/duty-schedules/new">
          <Button variant="accent" size="lg">
            <Plus className="h-5 w-5 mr-2" />
            Add Schedule
          </Button>
        </Link>
      </div>

      {/* Search and Filters */}
      <Card className="card-elevated">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search schedules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="secondary" className="text-sm">
              {filteredSchedules.length} schedules
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Schedules Table */}
      <Card className="card-elevated">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filteredSchedules.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground">No duty schedules found</p>
              <Link to="/admin/duty-schedules/new" className="mt-4 inline-block">
                <Button variant="outline">Create your first schedule</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Office</TableHead>
                  <TableHead>Shift Time</TableHead>
                  <TableHead>Work Days</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSchedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{schedule.schedule_name}</p>
                          <Badge variant={getShiftTypeColor(schedule.shift_type)} className="text-xs">
                            {getShiftTypeIcon(schedule.shift_type)}
                            <span className="ml-1">{schedule.shift_type}</span>
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <p className="font-medium">{schedule.employee.profile.full_name}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">{schedule.employee.profile.email}</p>
                        <code className="text-xs bg-secondary px-2 py-1 rounded">
                          {schedule.employee.employee_id}
                        </code>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span>{schedule.office.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3" />
                          {formatTime12h(schedule.start_time)} – {formatTime12h(schedule.end_time)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Break: {schedule.break_duration}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {schedule.work_days.map((day) => (
                          <Badge key={day} variant="outline" className="text-xs capitalize">
                            {day.slice(0, 3)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">
                          {format(new Date(schedule.effective_date), 'MMM d, yyyy')}
                        </div>
                        {schedule.expiry_date && (
                          <div className="text-xs text-muted-foreground">
                            to {format(new Date(schedule.expiry_date), 'MMM d, yyyy')}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            schedule.is_active ? 'badge-success' : 'badge-destructive'
                          }
                        >
                          {schedule.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Switch
                          checked={schedule.is_active}
                          onCheckedChange={() => handleStatusToggle(schedule.id, schedule.is_active)}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/admin/duty-schedules/${schedule.id}/edit`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={`/admin/duty-schedules/${schedule.id}/duplicate`}>
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Duplicate
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(schedule.id)}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
