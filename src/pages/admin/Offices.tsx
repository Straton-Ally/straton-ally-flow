import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Plus,
  Search,
  MoreHorizontal,
  MapPin,
  Phone,
  Mail,
  Clock,
  Globe,
  Shield,
  Edit,
  Trash2,
  Settings,
  Users,
  Wifi,
  WifiOff,
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
import { formatTime12h } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

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
  created_at: string;
  settings: {
    work_start_time: string;
    work_end_time: string;
    timezone: string;
    require_ip_whitelist: boolean;
    geo_fencing_enabled: boolean;
  } | null;
  _count: {
    employees: number;
    departments: number;
  };
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
  created_at: string;
  office_settings:
    | {
        work_start_time: string;
        work_end_time: string;
        timezone: string;
        require_ip_whitelist: boolean;
        geo_fencing_enabled: boolean;
      }
    | {
        work_start_time: string;
        work_end_time: string;
        timezone: string;
        require_ip_whitelist: boolean;
        geo_fencing_enabled: boolean;
      }[]
    | null;
}

export default function Offices() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchOffices = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('offices')
        .select('id,name,address,city,country,postal_code,phone,email,is_active,created_at,office_settings(work_start_time,work_end_time,timezone,require_ip_whitelist,geo_fencing_enabled)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = (data ?? []) as OfficeSelectRow[];
      const officeIds = rows.map((office) => office.id);
      const counts = await Promise.all(
        officeIds.map(async (officeId) => {
          const [{ count: employeesCount }, departmentsResult] = await Promise.all([
            supabase.from('employees').select('*', { count: 'exact', head: true }).eq('office_id', officeId),
            (supabase as unknown as {
              from: (table: 'office_departments') => {
                select: (
                  columns: string,
                  options: { count: 'exact'; head: true },
                ) => {
                  eq: (column: 'office_id', value: string) => Promise<{ count: number | null; error: Error | null }>;
                };
              };
            })
              .from('office_departments')
              .select('*', { count: 'exact', head: true })
              .eq('office_id', officeId),
          ]);

          if (departmentsResult.error) throw departmentsResult.error;
          return [officeId, { employees: employeesCount ?? 0, departments: departmentsResult.count ?? 0 }] as const;
        }),
      );
      const countsByOffice = new Map(counts);

      setOffices(
        rows.map((office) => {
          const settings = Array.isArray(office.office_settings) ? office.office_settings[0] : office.office_settings;
          return {
            id: office.id,
            name: office.name,
            address: office.address,
            city: office.city,
            country: office.country,
            postal_code: office.postal_code,
            phone: office.phone,
            email: office.email,
            is_active: office.is_active,
            created_at: office.created_at,
            settings: settings ?? null,
            _count: countsByOffice.get(office.id) ?? { employees: 0, departments: 0 },
          };
        }),
      );
    } catch (error) {
      console.error('Error fetching offices:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch offices',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOffices();
  }, []);

  const filteredOffices = offices.filter((office) =>
    office.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    office.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
    office.country.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStatusToggle = async (officeId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from('offices').update({ is_active: !currentStatus }).eq('id', officeId);
      if (error) throw error;
      toast({
        title: 'Status updated',
        description: `Office has been ${!currentStatus ? 'activated' : 'deactivated'}`,
      });
      fetchOffices();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (officeId: string) => {
    if (!confirm('Are you sure you want to delete this office? This action cannot be undone.')) return;

    try {
      const { error } = await supabase.from('offices').delete().eq('id', officeId);
      if (error) throw error;
      toast({
        title: 'Office deleted',
        description: 'Office has been removed successfully',
      });
      fetchOffices();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete office',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Offices</h1>
          <p className="text-muted-foreground mt-1">
            Manage office locations and their configurations
          </p>
        </div>
        <Link to="/admin/offices/new">
          <Button variant="accent" size="lg">
            <Plus className="h-5 w-5 mr-2" />
            Add Office
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
                placeholder="Search offices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="secondary" className="text-sm">
              {filteredOffices.length} offices
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Offices Table */}
      <Card className="card-elevated">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filteredOffices.length === 0 ? (
            <div className="p-8 text-center">
              <Building2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground">No offices found</p>
              <Link to="/admin/offices/new" className="mt-4 inline-block">
                <Button variant="outline">Add your first office</Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Office</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Working Hours</TableHead>
                  <TableHead>Security</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOffices.map((office) => (
                  <TableRow key={office.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{office.name}</p>
                        <p className="text-sm text-muted-foreground">{office.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3" />
                          {office.city}, {office.country}
                        </div>
                        <div className="text-xs text-muted-foreground">{office.address}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {office.settings ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3" />
                            {formatTime12h(office.settings.work_start_time)} – {formatTime12h(office.settings.work_end_time)}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Globe className="h-3 w-3" />
                            {office.settings.timezone}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {office.settings?.require_ip_whitelist && (
                          <Badge variant="outline" className="text-xs">
                            <Wifi className="h-3 w-3 mr-1" />
                            IP Restricted
                          </Badge>
                        )}
                        {office.settings?.geo_fencing_enabled && (
                          <Badge variant="outline" className="text-xs">
                            <MapPin className="h-3 w-3 mr-1" />
                            Geo Fencing
                          </Badge>
                        )}
                        {!office.settings?.require_ip_whitelist && !office.settings?.geo_fencing_enabled && (
                          <span className="text-xs text-muted-foreground">No restrictions</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Users className="h-3 w-3" />
                          {office._count.employees} employees
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {office._count.departments} departments
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            office.is_active ? 'badge-success' : 'badge-destructive'
                          }
                        >
                          {office.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Switch
                          checked={office.is_active}
                          onCheckedChange={() => handleStatusToggle(office.id, office.is_active)}
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
                            <Link to={`/admin/offices/${office.id}/edit`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={`/admin/offices/${office.id}/settings`}>
                              <Settings className="h-4 w-4 mr-2" />
                              Settings
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={`/admin/offices/${office.id}/access-control`}>
                              <Shield className="h-4 w-4 mr-2" />
                              Access Control
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(office.id)}
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
