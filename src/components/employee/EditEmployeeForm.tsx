import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Loader2, Save, Clock } from 'lucide-react';
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
  duty_schedule_template_id: optionalUuid,
  custom_work_start_time: z.string().optional(),
  custom_work_end_time: z.string().optional(),
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

interface DutyScheduleTemplate {
  id: string;
  schedule_name: string;
  shift_type: string;
  start_time: string;
  end_time: string;
  work_days: string[];
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
  duty_schedule_template_id: string | null;
  custom_work_start_time: string | null;
  custom_work_end_time: string | null;
  profile: { full_name: string; email: string; status: string; avatar_url: string | null };
  department: { id: string; name: string } | null;
}

interface EditEmployeeFormProps {
  employeeId: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function EditEmployeeForm({ employeeId, onSuccess, onCancel }: EditEmployeeFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [scheduleTemplates, setScheduleTemplates] = useState<DutyScheduleTemplate[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [currentSalary, setCurrentSalary] = useState<SalaryRecord | null>(null);
  const [dutyScheduleMode, setDutyScheduleMode] = useState<'none' | 'template' | 'manual'>('none');

  const form = useForm<EmployeeFormData>({ resolver: zodResolver(employeeSchema) });

  useEffect(() => {
    if (!employeeId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const baseSelect = 'id, employee_id, user_id, designation, joining_date, phone, address, emergency_contact, department_id, is_team_lead, work_location, duty_schedule_template_id, custom_work_start_time, custom_work_end_time';
        const firstAttempt = await supabase.from('employees').select(`${baseSelect}, gender`).eq('id', employeeId).single();
        const errMsg = firstAttempt.error && typeof firstAttempt.error === 'object' && 'message' in firstAttempt.error
          ? String((firstAttempt.error as { message?: unknown }).message) : '';
        const shouldRetry = Boolean(firstAttempt.error) && errMsg.toLowerCase().includes('gender') && (errMsg.includes('does not exist') || errMsg.includes('column'));

        const result = shouldRetry
          ? await supabase.from('employees').select(baseSelect).eq('id', employeeId).single()
          : firstAttempt;

        if (result.error) throw result.error;
        const employeeData = result.data as typeof result.data & { gender?: string | null; is_team_lead?: boolean; work_location?: 'remote' | 'on_site' | null };

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, email, status, avatar_url')
          .eq('id', employeeData.user_id)
          .single();
        if (profileError) throw profileError;

        const { data: departmentData } = employeeData.department_id
          ? await supabase.from('departments').select('id, name').eq('id', employeeData.department_id).single()
          : { data: null };

        const salaryRes = await supabase
          .from('salaries')
          .select('id, employee_id, salary_type, amount, effective_date, is_current, created_at')
          .eq('employee_id', employeeData.id)
          .eq('is_current', true)
          .maybeSingle();
        const salaryFallback = salaryRes.data
          ? salaryRes
          : await supabase.from('salaries').select('id, employee_id, salary_type, amount, effective_date, is_current, created_at')
              .eq('employee_id', employeeData.id)
              .order('effective_date', { ascending: false })
              .limit(1)
              .maybeSingle();

        const sal = salaryFallback.data;
        const emp = employeeData as typeof employeeData & { duty_schedule_template_id?: string | null; custom_work_start_time?: string | null; custom_work_end_time?: string | null };
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
          duty_schedule_template_id: emp.duty_schedule_template_id ?? null,
          custom_work_start_time: emp.custom_work_start_time ?? null,
          custom_work_end_time: emp.custom_work_end_time ?? null,
          profile: { full_name: profileData.full_name, email: profileData.email, status: profileData.status, avatar_url: profileData.avatar_url },
          department: departmentData,
        };
        setEmployee(normalizedEmployee);
        setCurrentSalary(sal ? {
          id: sal.id,
          employee_id: sal.employee_id,
          salary_type: sal.salary_type as 'monthly' | 'hourly',
          amount: sal.amount,
          effective_date: sal.effective_date,
          is_current: sal.is_current,
          created_at: sal.created_at,
        } : null);

        const startTime = normalizedEmployee.custom_work_start_time ? String(normalizedEmployee.custom_work_start_time).slice(0, 5) : '';
        const endTime = normalizedEmployee.custom_work_end_time ? String(normalizedEmployee.custom_work_end_time).slice(0, 5) : '';
        setDutyScheduleMode(normalizedEmployee.duty_schedule_template_id ? 'template' : (startTime || endTime ? 'manual' : 'none'));
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
          salary_type: sal ? (sal.salary_type as 'monthly' | 'hourly') : undefined,
          salary_amount: sal ? String(sal.amount) : '',
          salary_effective_date: sal?.effective_date || normalizedEmployee.joining_date,
          duty_schedule_template_id: normalizedEmployee.duty_schedule_template_id || '',
          custom_work_start_time: startTime,
          custom_work_end_time: endTime,
        });
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to load employee', variant: 'destructive' });
        onCancel();
      } finally {
        setIsLoading(false);
      }
    };

    const fetchDepts = async () => {
      const { data } = await supabase.from('departments').select('id, name').order('name');
      setDepartments(data || []);
    };
    const fetchTemplates = async () => {
      const { data } = await supabase.from('duty_schedule_templates').select('id, schedule_name, shift_type, start_time, end_time, work_days').eq('is_active', true).order('schedule_name');
      setScheduleTemplates((data as DutyScheduleTemplate[]) || []);
    };

    fetchData();
    fetchDepts();
    fetchTemplates();
  }, [employeeId, form, onCancel, toast]);

  const onSubmit = async (data: EmployeeFormData) => {
    if (!employeeId || !employee) return;
    setIsSaving(true);
    try {
      const hasAnySalary = Boolean(data.salary_type) || Boolean(data.salary_amount) || Boolean(data.salary_effective_date);
      const shouldUpdateSalary = Boolean(data.salary_type) && Boolean(data.salary_amount) && Boolean(data.salary_effective_date);
      if (hasAnySalary && !shouldUpdateSalary) {
        toast({ title: 'Error', description: 'Please fill salary type, amount, and effective date', variant: 'destructive' });
        return;
      }

      await supabase.from('profiles').update({ full_name: data.full_name, email: data.email, status: data.status }).eq('id', employee.user_id);

      const dutyTemplateId = dutyScheduleMode === 'template' && data.duty_schedule_template_id && data.duty_schedule_template_id.trim() ? data.duty_schedule_template_id : null;
      const customStart = dutyScheduleMode === 'manual' && data.custom_work_start_time && data.custom_work_start_time.trim()
        ? (data.custom_work_start_time.length === 5 ? data.custom_work_start_time + ':00' : data.custom_work_start_time)
        : null;
      const customEnd = dutyScheduleMode === 'manual' && data.custom_work_end_time && data.custom_work_end_time.trim()
        ? (data.custom_work_end_time.length === 5 ? data.custom_work_end_time + ':00' : data.custom_work_end_time)
        : null;

      const payload = {
        gender: data.gender,
        joining_date: data.joining_date,
        designation: data.designation,
        department_id: data.department_id || null,
        phone: data.phone,
        address: data.address,
        emergency_contact: data.emergency_contact,
        is_team_lead: data.is_team_lead ?? false,
        work_location: data.work_location ?? 'on_site',
        duty_schedule_template_id: dutyTemplateId,
        custom_work_start_time: customStart,
        custom_work_end_time: customEnd,
      };
      const updateResult = await supabase.from('employees').update(payload).eq('id', employeeId);
      if (updateResult.error) {
        const msg = typeof updateResult.error === 'object' && 'message' in updateResult.error ? String((updateResult.error as { message?: unknown }).message) : '';
        if (msg.toLowerCase().includes('gender') && (msg.includes('does not exist') || msg.includes('column'))) {
          const { gender: _g, ...payloadWithoutGender } = payload;
          await supabase.from('employees').update(payloadWithoutGender).eq('id', employeeId);
        } else throw updateResult.error;
      }

      if (shouldUpdateSalary) {
        const nextType = data.salary_type as 'monthly' | 'hourly';
        const nextAmount = parseFloat(data.salary_amount as string);
        const nextDate = data.salary_effective_date as string;
        const sameAsCurrent = currentSalary && currentSalary.salary_type === nextType && currentSalary.amount === nextAmount && currentSalary.effective_date === nextDate && currentSalary.is_current;
        if (!sameAsCurrent) {
          await supabase.from('salaries').update({ is_current: false }).eq('employee_id', employeeId).eq('is_current', true);
          await supabase.from('salaries').insert({
            employee_id: employeeId,
            salary_type: nextType,
            amount: nextAmount,
            effective_date: nextDate,
            is_current: true,
          }).select().single();
        }
      }

      toast({ title: 'Success', description: 'Employee updated successfully' });
      onSuccess();
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to update employee', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!employeeId) return null;
  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading...</div>;
  if (!employee) return null;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input {...form.register('full_name')} placeholder="Full name" />
              {form.formState.errors.full_name && <p className="text-sm text-destructive">{form.formState.errors.full_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={form.watch('gender')} onValueChange={(v) => form.setValue('gender', v as 'male' | 'female' | 'other')}>
                <SelectTrigger><SelectValue placeholder="Gender" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input {...form.register('email')} type="email" />
              {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input {...form.register('phone')} placeholder="Phone" />
            </div>
            <div className="space-y-2">
              <Label>Designation</Label>
              <Input {...form.register('designation')} placeholder="Designation" />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={form.watch('department_id')} onValueChange={(v) => form.setValue('department_id', v)}>
                <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Joining Date</Label>
              <Input {...form.register('joining_date')} type="date" />
              {form.formState.errors.joining_date && <p className="text-sm text-destructive">{form.formState.errors.joining_date.message}</p>}
            </div>
            <div className="space-y-2 sm:col-span-2 flex items-center space-x-2">
              <Checkbox id="ee-teamLead" checked={form.watch('is_team_lead')} onCheckedChange={(c) => form.setValue('is_team_lead', !!c)} />
              <label htmlFor="ee-teamLead" className="text-sm font-medium">Team lead</label>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Work arrangement</Label>
              {form.watch('work_location') === 'remote' && <p className="text-xs text-destructive">Note: Selecting Remote will remove any location/IP restriction.</p>}
              <div className="flex items-center gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox id="ee-remote" checked={form.watch('work_location') === 'remote'} onCheckedChange={(c) => form.setValue('work_location', c ? 'remote' : 'on_site')} />
                  <label htmlFor="ee-remote" className="text-sm font-medium">Remote</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="ee-onsite" checked={form.watch('work_location') === 'on_site'} onCheckedChange={(c) => form.setValue('work_location', c ? 'on_site' : 'on_site')} />
                  <label htmlFor="ee-onsite" className="text-sm font-medium">On-site</label>
                </div>
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Address</Label>
              <Textarea {...form.register('address')} placeholder="Address" rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Emergency Contact</Label>
              <Input {...form.register('emergency_contact')} placeholder="Emergency contact" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.watch('status')} onValueChange={(v) => form.setValue('status', v as 'active' | 'inactive')}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Duty / Work schedule
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Use a pre-defined schedule, or set manual times for this employee.</p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Schedule type</Label>
              <Select
                value={dutyScheduleMode}
                onValueChange={(v) => {
                  const mode = v as 'none' | 'template' | 'manual';
                  setDutyScheduleMode(mode);
                  if (mode === 'none') {
                    form.setValue('duty_schedule_template_id', '');
                    form.setValue('custom_work_start_time', '');
                    form.setValue('custom_work_end_time', '');
                  } else if (mode === 'template') {
                    form.setValue('custom_work_start_time', '');
                    form.setValue('custom_work_end_time', '');
                  } else {
                    form.setValue('duty_schedule_template_id', '');
                  }
                }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No schedule</SelectItem>
                  <SelectItem value="template">Pre-defined schedule</SelectItem>
                  <SelectItem value="manual">Manual timing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {dutyScheduleMode === 'template' && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Select schedule</Label>
                <Select value={form.watch('duty_schedule_template_id')} onValueChange={(v) => form.setValue('duty_schedule_template_id', v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select a schedule..." />
                  </SelectTrigger>
                  <SelectContent>
                    {scheduleTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.schedule_name} ({formatTime12h(t.start_time)} – {formatTime12h(t.end_time)}, {t.shift_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {dutyScheduleMode === 'manual' && (
              <>
                <div className="space-y-2">
                  <Label>Start time</Label>
                  <Input {...form.register('custom_work_start_time')} type="time" className="h-10" />
                </div>
                <div className="space-y-2">
                  <Label>End time</Label>
                  <Input {...form.register('custom_work_end_time')} type="time" className="h-10" />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Salary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Salary Type</Label>
              <Select value={form.watch('salary_type')} onValueChange={(v) => form.setValue('salary_type', v as 'monthly' | 'hourly')}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input {...form.register('salary_amount')} type="number" placeholder="0.00" />
              {form.formState.errors.salary_amount && <p className="text-sm text-destructive">{form.formState.errors.salary_amount.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Effective Date</Label>
              <Input {...form.register('salary_effective_date')} type="date" />
            </div>
            {currentSalary && (
              <p className="text-sm text-muted-foreground sm:col-span-3">
                Current: {formatCurrencyPKR(currentSalary.amount)} ({currentSalary.salary_type}) effective {format(new Date(currentSalary.effective_date), 'MMM d, yyyy')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : <><Save className="h-4 w-4 mr-2" />Save Changes</>}
        </Button>
      </div>
    </form>
  );
}
