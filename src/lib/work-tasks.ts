import { supabase } from '@/integrations/supabase/client';

export type WorkTaskStatus = 'todo' | 'in_progress' | 'review' | 'completed';
export type WorkTaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type WorkTask = {
  id: string;
  title: string;
  description: string;
  status: WorkTaskStatus;
  priority: WorkTaskPriority;
  assignee_id: string | null;
  assignee: string;
  due_date: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  project: string;
  estimated_hours?: number;
  actual_hours?: number;
};

export type EmployeeOption = {
  id: string;
  user_id: string;
  employee_id: string;
  full_name: string;
  email: string;
};

type WorkTaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_id: string | null;
  due_date: string | null;
  time_spent: number | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

type EmployeeRow = {
  id: string;
  user_id: string;
  employee_id: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

const toUiStatus = (status: string): WorkTaskStatus =>
  status === 'complete' || status === 'completed' ? 'completed' : (status as WorkTaskStatus);

export const toDbStatus = (status: WorkTaskStatus) => (status === 'completed' ? 'complete' : status);

const toDateOnly = (value: string | null) => (value ? value.slice(0, 10) : '');

export async function fetchEmployeeOptions(): Promise<EmployeeOption[]> {
  const { data: employeesData, error: employeesError } = await supabase
    .from('employees')
    .select('id,user_id,employee_id')
    .order('employee_id', { ascending: true });

  if (employeesError) throw employeesError;

  const employees = (employeesData ?? []) as EmployeeRow[];
  if (employees.length === 0) return [];

  const userIds = employees.map((employee) => employee.user_id);
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id,full_name,email')
    .in('id', userIds);

  if (profilesError) throw profilesError;

  const profilesById = new Map<string, ProfileRow>();
  for (const profile of (profilesData ?? []) as ProfileRow[]) {
    profilesById.set(profile.id, profile);
  }

  return employees.map((employee) => {
    const profile = profilesById.get(employee.user_id);
    return {
      id: employee.id,
      user_id: employee.user_id,
      employee_id: employee.employee_id,
      full_name: profile?.full_name || employee.employee_id,
      email: profile?.email || '',
    };
  });
}

export async function fetchWorkTasks(options: { assigneeId?: string } = {}): Promise<WorkTask[]> {
  let query = supabase
    .from('work_tasks')
    .select('id,title,description,status,priority,assignee_id,due_date,time_spent,tags,created_at,updated_at')
    .order('created_at', { ascending: false });

  if (options.assigneeId) {
    query = query.eq('assignee_id', options.assigneeId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as WorkTaskRow[];
  const assigneeIds = Array.from(new Set(rows.map((task) => task.assignee_id).filter((id): id is string => Boolean(id))));
  const employeeOptions = assigneeIds.length > 0 ? await fetchEmployeeOptions() : [];
  const employeesById = new Map(employeeOptions.map((employee) => [employee.id, employee]));

  return rows.map((row) => {
    const assignee = row.assignee_id ? employeesById.get(row.assignee_id) : null;
    return {
      id: row.id,
      title: row.title,
      description: row.description ?? '',
      status: toUiStatus(row.status),
      priority: row.priority as WorkTaskPriority,
      assignee_id: row.assignee_id,
      assignee: assignee?.full_name ?? 'Unassigned',
      due_date: toDateOnly(row.due_date),
      created_at: toDateOnly(row.created_at),
      updated_at: toDateOnly(row.updated_at),
      tags: row.tags ?? [],
      project: '',
      actual_hours: Math.round((row.time_spent ?? 0) / 60),
    };
  });
}

export async function fetchCurrentEmployeeId(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('employees').select('id').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}
