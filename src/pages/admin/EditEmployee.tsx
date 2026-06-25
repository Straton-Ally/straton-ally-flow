import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  ArrowLeft,
  Save,
  User,
  Building2,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Clock,
  Shield,
  Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { formatCurrencyPKR, formatTime12h } from '@/lib/utils';

const optionalUuid = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().uuid().optional(),
);

const optionalNumberString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount').optional(),
);

const employeeSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  gender: z.enum(['male', 'female', 'other'], { required_error: 'Gender is required' }),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  designation: z.string().optional(),
  department_id: optionalUuid,
  joining_date: z.string().min(1, 'Joining date is required'),
  address: z.string().optional(),
  emergency_contact: z.string().optional(),
  status: z.enum(['active', 'inactive']),
  is_team_lead: z.boolean().optional(),
  work_location: z.enum(['remote', 'on_site']).nullable().optional(),
  salary_type: z.enum(['monthly', 'hourly']).optional(),
  salary_amount: optionalNumberString,
  salary_effective_date: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().optional(),
  ),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

interface SalaryRecord {
  id: string;
  employee_id: string;
  salary_type: 'monthly' | 'hourly';
  amount: number;
  effective_date: string;
  is_current: boolean;
  created_at: string;
}

interface Employee {
  id: string;
  employee_id: string;
  user_id: string;
  gender: string | null;
  designation: string | null;
  joining_date: string;
  phone: string | null;
  address: string | null;
  emergency_contact: string | null;
  is_team_lead: boolean;
  work_location: 'remote' | 'on_site' | null;
  profile: {
    full_name: string;
    email: string;
    status: string;
    avatar_url: string | null;
  };
  department: {
    id: string;
    name: string;
  } | null;
  access_control: {
    id: string;
    access_level: string;
    office_id: string;
    office: {
      name: string;
    };
  } | null;
  duty_schedule: {
    id: string;
    schedule_name: string;
    shift_type: string;
    start_time: string;
    end_time: string;
    work_days: string[];
  } | null;
}

export default function EditEmployee() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [offices, setOffices] = useState<Array<{ id: string; name: string }>>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [currentSalary, setCurrentSalary] = useState<SalaryRecord | null>(null);

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
  });

  useEffect(() => {
    const fetchEmployeeData = async () => {
      if (!id) return;

      try {
        const baseSelect =
          'id, employee_id, user_id, designation, joining_date, phone, address, emergency_contact, department_id, is_team_lead, work_location';
        const selectWithGender = `${baseSelect}, gender`;
        const selectWithoutGender = baseSelect;

        const firstAttempt = await supabase
          .from('employees')
          .select(selectWithGender)
          .eq('id', id)
          .single();

        const firstErrorMessage =
          firstAttempt.error && typeof firstAttempt.error === 'object' && 'message' in firstAttempt.error
            ? String((firstAttempt.error as { message?: unknown }).message)
            : '';

        const shouldRetryWithoutGender =
          Boolean(firstAttempt.error) &&
          firstErrorMessage.toLowerCase().includes('gender') &&
          (firstErrorMessage.toLowerCase().includes('does not exist') ||
            firstErrorMessage.toLowerCase().includes('column'));

        const employeeResult = shouldRetryWithoutGender
          ? await supabase.from('employees').select(selectWithoutGender).eq('id', id).single()
          : firstAttempt;

        if (employeeResult.error) throw employeeResult.error;

        if (employeeResult.data) {
          const employeeData = employeeResult.data as typeof employeeResult.data & {
            gender?: string | null;
            is_team_lead?: boolean;
            work_location?: 'remote' | 'on_site' | null;
          };

          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('full_name, email, status, avatar_url')
            .eq('id', employeeData.user_id)
            .single();

          if (profileError) throw profileError;

          const { data: departmentData, error: departmentError } = employeeData.department_id
            ? await supabase.from('departments').select('id, name').eq('id', employeeData.department_id).single()
            : { data: null, error: null };

          if (departmentError) throw departmentError;

          const currentSalaryResult = await supabase
            .from('salaries')
            .select('id, employee_id, salary_type, amount, effective_date, is_current, created_at')
            .eq('employee_id', employeeData.id)
            .eq('is_current', true)
            .maybeSingle();

          if (currentSalaryResult.error) throw currentSalaryResult.error;

          const salaryFallbackResult = currentSalaryResult.data
            ? currentSalaryResult
            : await supabase
                .from('salaries')
                .select('id, employee_id, salary_type, amount, effective_date, is_current, created_at')
                .eq('employee_id', employeeData.id)
                .order('effective_date', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

          if (salaryFallbackResult.error) throw salaryFallbackResult.error;

          const normalizedSalary = salaryFallbackResult.data
            ? {
                id: salaryFallbackResult.data.id,
                employee_id: salaryFallbackResult.data.employee_id,
                salary_type: salaryFallbackResult.data.salary_type as 'monthly' | 'hourly',
                amount: salaryFallbackResult.data.amount,
                effective_date: salaryFallbackResult.data.effective_date,
                is_current: salaryFallbackResult.data.is_current,
                created_at: salaryFallbackResult.data.created_at,
              }
            : null;

          const normalizedEmployee: Employee = {
            id: employeeData.id,
            employee_id: employeeData.employee_id,
            user_id: employeeData.user_id,
            gender: employeeData.gender ?? null,
            designation: employeeData.designation,
            joining_date: employeeData.joining_date,
            phone: employeeData.phone,
            address: employeeData.address,
            emergency_contact: employeeData.emergency_contact,
            is_team_lead: Boolean(employeeData.is_team_lead),
            work_location: employeeData.work_location === 'remote' || employeeData.work_location === 'on_site' ? employeeData.work_location : null,
            profile: {
              full_name: profileData.full_name,
              email: profileData.email,
              status: profileData.status,
              avatar_url: profileData.avatar_url,
            },
            department: departmentData,
            access_control: null,
            duty_schedule: null,
          };

          setEmployee(normalizedEmployee);
          setCurrentSalary(normalizedSalary);
          form.reset({
            full_name: normalizedEmployee.profile.full_name,
            gender: (normalizedEmployee.gender as 'male' | 'female' | 'other') || 'male',
            email: normalizedEmployee.profile.email,
            phone: normalizedEmployee.phone || '',
            designation: normalizedEmployee.designation || '',
            department_id: normalizedEmployee.department?.id || '',
            joining_date: normalizedEmployee.joining_date,
            address: normalizedEmployee.address || '',
            emergency_contact: normalizedEmployee.emergency_contact || '',
            status: normalizedEmployee.profile.status as 'active' | 'inactive',
            is_team_lead: normalizedEmployee.is_team_lead,
            work_location: normalizedEmployee.work_location || 'on_site',
            salary_type: normalizedSalary?.salary_type,
            salary_amount: normalizedSalary ? String(normalizedSalary.amount) : '',
            salary_effective_date: normalizedSalary?.effective_date || normalizedEmployee.joining_date,
          });
        }
      } catch (error) {
        const errorMessage =
          error && typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message) : '';
        console.error('Error fetching employee:', error);
        toast({
          title: 'Error',
          description: errorMessage ? `Failed to fetch employee data: ${errorMessage}` : 'Failed to fetch employee data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    const fetchDepartments = async () => {
      const { data } = await supabase.from('departments').select('id, name').order('name');
      setDepartments(data || []);
    };

    const fetchOffices = async () => {
      const { data, error } = await supabase.from('offices').select('id, name').eq('is_active', true).order('name');
      if (error) {
        console.error('Error fetching offices:', error);
        setOffices([]);
        return;
      }
      setOffices(data || []);
    };

    fetchEmployeeData();
    fetchDepartments();
    fetchOffices();
  }, [id, form, toast]);

  const onSubmit = async (data: EmployeeFormData) => {
    if (!id || !employee) return;

    setIsSaving(true);
    try {
      const hasAnySalaryField = Boolean(data.salary_type) || Boolean(data.salary_amount) || Boolean(data.salary_effective_date);
      const shouldUpdateSalary = Boolean(data.salary_type) && Boolean(data.salary_amount) && Boolean(data.salary_effective_date);

      if (hasAnySalaryField && !shouldUpdateSalary) {
        toast({
          title: 'Error',
          description: 'Please fill salary type, amount, and effective date',
          variant: 'destructive',
        });
        return;
      }

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          email: data.email,
          status: data.status,
        })
        .eq('id', employee.user_id);

      if (profileError) throw profileError;

      // Update employee record
      const employeeUpdatePayload = {
        gender: data.gender,
        joining_date: data.joining_date,
        designation: data.designation,
        department_id: data.department_id || null,
        phone: data.phone,
        address: data.address,
        emergency_contact: data.emergency_contact,
        is_team_lead: data.is_team_lead ?? false,
        work_location: data.work_location ?? 'on_site',
      };
      const employeeUpdateResult = await supabase
        .from('employees')
        .update(employeeUpdatePayload)
        .eq('id', id);

      if (employeeUpdateResult.error) {
        const msg =
          typeof employeeUpdateResult.error === 'object' && 'message' in employeeUpdateResult.error
            ? String((employeeUpdateResult.error as { message?: unknown }).message)
            : '';
        const canRetryWithoutGender =
          msg.toLowerCase().includes('gender') &&
          (msg.toLowerCase().includes('does not exist') || msg.toLowerCase().includes('column'));

        if (!canRetryWithoutGender) throw employeeUpdateResult.error;

        const { error: retryError } = await supabase
          .from('employees')
          .update({
            joining_date: data.joining_date,
            designation: data.designation,
            department_id: data.department_id || null,
            phone: data.phone,
            address: data.address,
            emergency_contact: data.emergency_contact,
            is_team_lead: data.is_team_lead ?? false,
            work_location: data.work_location ?? 'on_site',
          })
          .eq('id', id);

        if (retryError) throw retryError;
      }

      if (shouldUpdateSalary) {
        const nextSalaryType = data.salary_type as 'monthly' | 'hourly';
        const nextSalaryAmount = parseFloat(data.salary_amount as string);
        const nextSalaryEffectiveDate = data.salary_effective_date as string;

        const isSameAsCurrent =
          currentSalary &&
          currentSalary.salary_type === nextSalaryType &&
          currentSalary.amount === nextSalaryAmount &&
          currentSalary.effective_date === nextSalaryEffectiveDate &&
          currentSalary.is_current === true;

        if (!isSameAsCurrent) {
          const { error: markNotCurrentError } = await supabase
            .from('salaries')
            .update({ is_current: false })
            .eq('employee_id', id)
            .eq('is_current', true);

          if (markNotCurrentError) throw markNotCurrentError;

          const { error: insertSalaryError, data: insertedSalary } = await supabase
            .from('salaries')
            .insert({
              employee_id: id,
              salary_type: nextSalaryType,
              amount: nextSalaryAmount,
              effective_date: nextSalaryEffectiveDate,
              is_current: true,
            })
            .select('id, employee_id, salary_type, amount, effective_date, is_current, created_at')
            .single();

          if (insertSalaryError) throw insertSalaryError;

          setCurrentSalary({
            id: insertedSalary.id,
            employee_id: insertedSalary.employee_id,
            salary_type: insertedSalary.salary_type as 'monthly' | 'hourly',
            amount: insertedSalary.amount,
            effective_date: insertedSalary.effective_date,
            is_current: insertedSalary.is_current,
            created_at: insertedSalary.created_at,
          });
        }
      }

      toast({
        title: 'Success',
        description: 'Employee information updated successfully',
      });

      navigate('/admin/recruitment?tab=employees');
    } catch (error) {
      console.error('Error updating employee:', error);
      toast({
        title: 'Error',
        description: 'Failed to update employee information',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-center text-muted-foreground">Loading employee data...</div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-8">
        <div className="text-center text-muted-foreground">Employee not found</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/admin/recruitment?tab=employees')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Employees
          </Button>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Edit Employee</h1>
            <p className="text-muted-foreground mt-1">Update employee information and settings</p>
          </div>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Employee Overview */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Employee Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={employee.profile.avatar_url || ''} />
                <AvatarFallback className="text-lg">
                  {employee.profile.full_name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h3 className="text-xl font-semibold">{employee.profile.full_name}</h3>
                <p className="text-muted-foreground">{employee.profile.email}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">ID: {employee.employee_id}</Badge>
                  <Badge
                    className={
                      employee.profile.status === 'active'
                        ? 'badge-success'
                        : 'badge-destructive'
                    }
                  >
                    {employee.profile.status}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Basic Information */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  {...form.register('full_name')}
                  placeholder="Enter full name"
                />
                {form.formState.errors.full_name && (
                  <p className="text-sm text-destructive">{form.formState.errors.full_name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={form.watch('gender')} onValueChange={(value) => form.setValue('gender', value as 'male' | 'female' | 'other')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.gender && (
                  <p className="text-sm text-destructive">{form.formState.errors.gender.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  {...form.register('email')}
                  type="email"
                  placeholder="Enter email address"
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  {...form.register('phone')}
                  placeholder="Enter phone number"
                />
              </div>
              <div className="space-y-2">
                <Label>Designation</Label>
                <Input
                  {...form.register('designation')}
                  placeholder="Enter job designation"
                />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={form.watch('department_id')} onValueChange={(value) => form.setValue('department_id', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.department_id && (
                  <p className="text-sm text-destructive">{form.formState.errors.department_id.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Joining Date</Label>
                <Input
                  {...form.register('joining_date')}
                  type="date"
                />
                {form.formState.errors.joining_date && (
                  <p className="text-sm text-destructive">{form.formState.errors.joining_date.message}</p>
                )}
              </div>
              <div className="space-y-2 md:col-span-2 flex items-center space-x-2">
                <Checkbox
                  id="isTeamLead"
                  checked={form.watch('is_team_lead')}
                  onCheckedChange={(checked) => form.setValue('is_team_lead', !!checked)}
                />
                <label htmlFor="isTeamLead" className="text-sm font-medium leading-none">
                  Team lead (Only Select if the employee is a team lead)
                </label>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Work arrangement</Label>
                {form.watch('work_location') === 'remote' && (
                  <p className="text-xs text-destructive mb-2">Note: Selecting Remote will remove any location/IP restriction for the employee.</p>
                )}
                <div className="flex items-center gap-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="workLocationRemote"
                      checked={form.watch('work_location') === 'remote'}
                      onCheckedChange={(checked) => {
                        form.setValue('work_location', checked ? 'remote' : 'on_site');
                      }}
                    />
                    <label htmlFor="workLocationRemote" className="text-sm font-medium leading-none">
                      Remote
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="workLocationOnSite"
                      checked={form.watch('work_location') === 'on_site'}
                      onCheckedChange={(checked) => {
                        form.setValue('work_location', checked ? 'on_site' : 'on_site');
                      }}
                    />
                    <label htmlFor="workLocationOnSite" className="text-sm font-medium leading-none">
                      On-site
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea
                {...form.register('address')}
                placeholder="Enter full address"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Emergency Contact</Label>
              <Input
                {...form.register('emergency_contact')}
                placeholder="Enter emergency contact information"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.watch('status')} onValueChange={(value) => form.setValue('status', value as 'active' | 'inactive')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Salary Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Salary Type</Label>
                <Select
                  value={form.watch('salary_type')}
                  onValueChange={(value) => form.setValue('salary_type', value as 'monthly' | 'hourly')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  {...form.register('salary_amount')}
                  type="number"
                  placeholder="0.00"
                />
                {form.formState.errors.salary_amount && (
                  <p className="text-sm text-destructive">{form.formState.errors.salary_amount.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Effective Date</Label>
                <Input
                  {...form.register('salary_effective_date')}
                  type="date"
                />
              </div>
            </div>
            {currentSalary ? (
              <div className="text-sm text-muted-foreground">
                Current: {formatCurrencyPKR(currentSalary.amount)} ({currentSalary.salary_type}) effective {format(new Date(currentSalary.effective_date), 'MMM d, yyyy')}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No salary record found</div>
            )}
          </CardContent>
        </Card>

        {/* Access Control */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Access Control
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {employee.access_control ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                  <div>
                    <p className="font-medium">{employee.access_control.office.name}</p>
                    <p className="text-sm text-muted-foreground">Access Level: {employee.access_control.access_level}</p>
                  </div>
                  <Badge variant="outline">Active</Badge>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No access control configured</p>
            )}
          </CardContent>
        </Card>

        {/* Duty Schedule */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Duty Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {employee.duty_schedule ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                  <div>
                    <p className="font-medium">{employee.duty_schedule.schedule_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatTime12h(employee.duty_schedule.start_time)} – {formatTime12h(employee.duty_schedule.end_time)} ({employee.duty_schedule.shift_type})
                    </p>
                  </div>
                  <Badge variant="outline">Active</Badge>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No duty schedule configured</p>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/admin/recruitment?tab=employees')}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
