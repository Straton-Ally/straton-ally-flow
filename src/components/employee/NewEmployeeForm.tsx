import { useState, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { createUserAsAdmin } from '@/lib/auth-service';
import { formatTime12h } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

const employeeSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  employeeId: z.string().min(1, 'Employee ID is required'),
  gender: z.enum(['male', 'female', 'other'], { required_error: 'Gender is required' }),
  email: z
    .string()
    .min(1, 'Email username is required')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid email username format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  departmentId: z.string().optional(),
  designation: z.string().optional(),
  joiningDate: z.string().min(1, 'Joining date is required'),
  phone: z.string().optional(),
  address: z.string().optional(),
  role: z.enum(['admin', 'employee']),
  isTeamLead: z.boolean().optional(),
  workLocation: z.enum(['remote', 'on_site']).nullable().optional(),
  salaryType: z.enum(['monthly', 'hourly']).optional(),
  salaryAmount: z.string().optional(),
  dutyScheduleMode: z.enum(['none', 'template', 'manual']).optional(),
  dutyScheduleTemplateId: z.string().optional(),
  customWorkStartTime: z.string().optional(),
  customWorkEndTime: z.string().optional(),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

interface Department {
  id: string;
  name: string;
}

interface DutyScheduleTemplate {
  id: string;
  schedule_name: string;
  shift_type: string;
  start_time: string;
  end_time: string;
  work_days: string[];
}

interface NewEmployeeFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function NewEmployeeForm({ onSuccess, onCancel }: NewEmployeeFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [scheduleTemplates, setScheduleTemplates] = useState<DutyScheduleTemplate[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      role: 'employee',
      joiningDate: new Date().toISOString().split('T')[0],
      isTeamLead: false,
      workLocation: 'on_site',
      dutyScheduleMode: 'none',
    },
  });

  const workLocation = watch('workLocation');
  const dutyScheduleMode = watch('dutyScheduleMode');

  const handleRemoteChange = (checked: boolean) => {
    setValue('workLocation', checked ? 'remote' : 'on_site');
  };
  const handleOnSiteChange = () => {
    setValue('workLocation', 'on_site');
  };

  useEffect(() => {
    async function fetchDepartments() {
      const { data } = await supabase.from('departments').select('id, name').order('name');
      if (data) setDepartments(data);
    }
    async function fetchScheduleTemplates() {
      const { data } = await supabase.from('duty_schedule_templates').select('id, schedule_name, shift_type, start_time, end_time, work_days').eq('is_active', true).order('schedule_name');
      if (data) setScheduleTemplates(data as DutyScheduleTemplate[]);
    }
    fetchDepartments();
    fetchScheduleTemplates();
  }, []);

  const onSubmit = async (data: EmployeeFormData) => {
    setIsLoading(true);
    try {
      const user = await createUserAsAdmin({
        email: `${data.email}@stratonally.com`,
        password: data.password,
        fullName: data.fullName,
        role: data.role,
      });
      const userId = user.id;

      await supabase.from('profiles').update({ full_name: data.fullName }).eq('id', userId);

      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: userId,
        role: data.role,
      });
      if (roleError) throw roleError;

      const dutyTemplateId = data.dutyScheduleMode === 'template' && data.dutyScheduleTemplateId ? data.dutyScheduleTemplateId : null;
      const customStart = data.dutyScheduleMode === 'manual' && data.customWorkStartTime ? (data.customWorkStartTime.length === 5 ? data.customWorkStartTime + ':00' : data.customWorkStartTime) : null;
      const customEnd = data.dutyScheduleMode === 'manual' && data.customWorkEndTime ? (data.customWorkEndTime.length === 5 ? data.customWorkEndTime + ':00' : data.customWorkEndTime) : null;

      const { data: employeeData, error: empError } = await supabase
        .from('employees')
        .insert({
          user_id: userId,
          employee_id: data.employeeId.trim(),
          gender: data.gender,
          department_id: data.departmentId || null,
          designation: data.designation || null,
          joining_date: data.joiningDate,
          phone: data.phone || null,
          address: data.address || null,
          is_team_lead: data.isTeamLead ?? false,
          work_location: data.workLocation ?? 'on_site',
          duty_schedule_template_id: dutyTemplateId,
          custom_work_start_time: customStart,
          custom_work_end_time: customEnd,
        })
        .select()
        .single();

      if (empError) throw empError;

      if (data.salaryAmount && data.salaryType) {
        await supabase.from('salaries').insert({
          employee_id: employeeData.id,
          salary_type: data.salaryType,
          amount: parseFloat(data.salaryAmount),
          effective_date: data.joiningDate,
          is_current: true,
        });
      }

      toast({
        title: 'Employee created',
        description: `${data.fullName} (${data.employeeId}) has been added successfully`,
      });
      onSuccess();
    } catch (error: unknown) {
      console.error('Error creating employee:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create employee',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Basic Information</CardTitle>
            <CardDescription className="text-xs">Personal and account details</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ne-fullName">Full Name *</Label>
              <Input id="ne-fullName" placeholder="Full name" {...register('fullName')} className="h-10" />
              {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Gender *</Label>
              <Select onValueChange={(v) => setValue('gender', v as 'male' | 'female' | 'other')}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {errors.gender && <p className="text-sm text-destructive">{errors.gender.message}</p>}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ne-email">Email Username *</Label>
              <div className="flex">
                <Input id="ne-email" placeholder="john.doe" {...register('email')} className="h-10 rounded-r-none" />
                <div className="flex items-center px-3 h-10 border border-l-0 border-input bg-muted rounded-r-md text-sm text-muted-foreground">
                  @stratonally.com
                </div>
              </div>
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ne-employeeId">Employee ID *</Label>
              <Input id="ne-employeeId" placeholder="e.g. SAEMP001" {...register('employeeId')} className="h-10" />
              {errors.employeeId && <p className="text-sm text-destructive">{errors.employeeId.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ne-password">Password *</Label>
              <Input id="ne-password" type="password" placeholder="Min. 8 characters" {...register('password')} className="h-10" />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ne-phone">Phone</Label>
              <Input id="ne-phone" placeholder="+1 234 567 890" {...register('phone')} className="h-10" />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={watch('role')} onValueChange={(v) => setValue('role', v as 'admin' | 'employee')}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Work Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Select onValueChange={(v) => setValue('departmentId', v)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ne-designation">Designation</Label>
              <Input id="ne-designation" placeholder="Software Engineer" {...register('designation')} className="h-10" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ne-joiningDate">Joining Date *</Label>
              <Input id="ne-joiningDate" type="date" {...register('joiningDate')} className="h-10" />
              {errors.joiningDate && <p className="text-sm text-destructive">{errors.joiningDate.message}</p>}
            </div>
            <div className="space-y-2 sm:col-span-2 flex items-center space-x-2">
              <Checkbox id="ne-teamLead" checked={watch('isTeamLead')} onCheckedChange={(c) => setValue('isTeamLead', !!c)} />
              <label htmlFor="ne-teamLead" className="text-sm font-medium">Team lead</label>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Work arrangement</Label>
              {workLocation === 'remote' && (
                <p className="text-xs text-destructive">Note: Selecting Remote will remove any location/IP restriction for the employee.</p>
              )}
              <div className="flex items-center gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox id="ne-remote" checked={workLocation === 'remote'} onCheckedChange={handleRemoteChange} />
                  <label htmlFor="ne-remote" className="text-sm font-medium">Remote</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="ne-onsite" checked={workLocation === 'on_site'} onCheckedChange={handleOnSiteChange} />
                  <label htmlFor="ne-onsite" className="text-sm font-medium">On-site</label>
                </div>
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ne-address">Address</Label>
              <Textarea id="ne-address" placeholder="Full address" {...register('address')} rows={2} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Duty / Work schedule
            </CardTitle>
            <CardDescription className="text-xs">Use a pre-defined schedule, or set manual times for this employee.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Schedule type</Label>
              <Select value={dutyScheduleMode ?? 'none'} onValueChange={(v) => setValue('dutyScheduleMode', v as 'none' | 'template' | 'manual')}>
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
                <Select onValueChange={(v) => setValue('dutyScheduleTemplateId', v)}>
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
                  <Input type="time" {...register('customWorkStartTime')} className="h-10" />
                </div>
                <div className="space-y-2">
                  <Label>End time</Label>
                  <Input type="time" {...register('customWorkEndTime')} className="h-10" />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Salary (optional)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Salary Type</Label>
              <Select onValueChange={(v) => setValue('salaryType', v as 'monthly' | 'hourly')}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ne-salaryAmount">Amount</Label>
              <Input id="ne-salaryAmount" type="number" placeholder="0.00" {...register('salaryAmount')} className="h-10" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" variant="accent" disabled={isLoading}>
          {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating...</> : <><Save className="h-4 w-4 mr-2" />Create Employee</>}
        </Button>
      </div>
    </form>
  );
}
