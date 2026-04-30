import { supabase } from '@/integrations/supabase/client';
import type {
  WorkTeam,
  WorkTeamMember,
  WorkProject,
  WorkProjectMember,
  WorkTaskV2,
  WorkTaskComment,
  WorkChatRoom,
  WorkChatMessage,
  WorkTaskStatusV2,
  WorkTaskPriority,
  UserTeam,
  ProjectTask,
} from './work-types';

export async function fetchUserTeams(userId: string): Promise<UserTeam[]> {
  const { data, error } = await supabase.rpc('get_user_teams', { user_uuid: userId });
  if (error) throw error;
  return (data ?? []) as UserTeam[];
}

export async function fetchTeams(): Promise<WorkTeam[]> {
  const { data, error } = await supabase.from('work_teams').select('*').eq('is_active', true).order('name');
  if (error) throw error;
  return (data ?? []) as WorkTeam[];
}

export async function createTeam(team: Partial<WorkTeam>): Promise<WorkTeam> {
  const { data, error } = await supabase.from('work_teams').insert(team).select().single();
  if (error) throw error;
  return data as WorkTeam;
}

export async function updateTeam(id: string, updates: Partial<WorkTeam>): Promise<WorkTeam> {
  const { data, error } = await supabase.from('work_teams').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as WorkTeam;
}

export async function fetchTeamMembers(teamId: string): Promise<WorkTeamMember[]> {
  const { data, error } = await supabase
    .from('work_team_members')
    .select('*')
    .eq('team_id', teamId)
    .order('role');
  if (error) throw error;
  return (data ?? []) as WorkTeamMember[];
}

export async function addTeamMember(member: Partial<WorkTeamMember>): Promise<WorkTeamMember> {
  const { data, error } = await supabase.from('work_team_members').insert(member).select().single();
  if (error) throw error;
  return data as WorkTeamMember;
}

export async function removeTeamMember(teamId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('work_team_members').delete().eq('team_id', teamId).eq('user_id', userId);
  if (error) throw error;
}

export async function fetchProjects(teamId: string): Promise<WorkProject[]> {
  const { data, error } = await supabase
    .from('work_projects')
    .select('*')
    .eq('team_id', teamId)
    .order('name');
  if (error) throw error;
  return (data ?? []) as WorkProject[];
}

export async function createProject(project: Partial<WorkProject>): Promise<WorkProject> {
  const { data, error } = await supabase.from('work_projects').insert(project).select().single();
  if (error) throw error;
  return data as WorkProject;
}

export async function updateProject(id: string, updates: Partial<WorkProject>): Promise<WorkProject> {
  const { data, error } = await supabase.from('work_projects').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as WorkProject;
}

export async function fetchProject(projectId: string): Promise<WorkProject | null> {
  const { data, error } = await supabase.from('work_projects').select('*').eq('id', projectId).maybeSingle();
  if (error) throw error;
  return data as WorkProject | null;
}

export async function fetchProjectTasks(projectId: string, statusFilter?: WorkTaskStatusV2): Promise<ProjectTask[]> {
  const { data, error } = await supabase.rpc('get_project_tasks', {
    project_uuid: projectId,
    status_filter: statusFilter ?? null,
  });
  if (error) throw error;
  return (data ?? []) as ProjectTask[];
}

export async function fetchTask(taskId: string): Promise<WorkTaskV2 | null> {
  const { data, error } = await supabase
    .from('work_tasks_v2')
    .select('*, assignee:assignee_id(full_name, avatar_url)')
    .eq('id', taskId)
    .maybeSingle();
  if (error) throw error;
  return data as WorkTaskV2 | null;
}

export async function createTask(task: Partial<WorkTaskV2>): Promise<WorkTaskV2> {
  const { data, error } = await supabase.from('work_tasks_v2').insert(task).select().single();
  if (error) throw error;
  return data as WorkTaskV2;
}

export async function updateTask(id: string, updates: Partial<WorkTaskV2>): Promise<WorkTaskV2> {
  if (updates.is_completed) {
    updates.completed_at = new Date().toISOString();
  }
  const { data, error } = await supabase
    .from('work_tasks_v2')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as WorkTaskV2;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('work_tasks_v2').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchTaskComments(taskId: string): Promise<WorkTaskComment[]> {
  const { data, error } = await supabase
    .from('work_task_comments')
    .select('*, user:user_id(full_name, avatar_url)')
    .eq('task_id', taskId)
    .is('parent_id', null)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as WorkTaskComment[];
}

export async function createTaskComment(comment: Partial<WorkTaskComment>): Promise<WorkTaskComment> {
  const { data, error } = await supabase.from('work_task_comments').insert(comment).select().single();
  if (error) throw error;
  return data as WorkTaskComment;
}

export async function updateTaskComment(id: string, updates: Partial<WorkTaskComment>): Promise<WorkTaskComment> {
  const { data, error } = await supabase
    .from('work_task_comments')
    .update({ ...updates, is_edited: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as WorkTaskComment;
}

export async function deleteTaskComment(id: string): Promise<void> {
  const { error } = await supabase.from('work_task_comments').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchChatRooms(teamId: string): Promise<WorkChatRoom[]> {
  const { data, error } = await supabase
    .from('work_chat_rooms')
    .select('*')
    .eq('team_id', teamId)
    .order('is_default', { ascending: false })
    .order('name');
  if (error) throw error;
  return (data ?? []) as WorkChatRoom[];
}

export async function createChatRoom(room: Partial<WorkChatRoom>): Promise<WorkChatRoom> {
  const { data, error } = await supabase.from('work_chat_rooms').insert(room).select().single();
  if (error) throw error;
  return data as WorkChatRoom;
}

export async function fetchChatMessages(roomId: string, limit = 50): Promise<WorkChatMessage[]> {
  const { data, error } = await supabase
    .from('work_chat_messages')
    .select('*, user:user_id(full_name, avatar_url)')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as WorkChatMessage[];
}

export async function sendChatMessage(message: Partial<WorkChatMessage>): Promise<WorkChatMessage> {
  const { data, error } = await supabase.from('work_chat_messages').insert(message).select().single();
  if (error) throw error;
  return data as WorkChatMessage;
}

export async function editChatMessage(id: string, content: string): Promise<WorkChatMessage> {
  const { data, error } = await supabase
    .from('work_chat_messages')
    .update({ content, is_edited: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as WorkChatMessage;
}

export async function deleteChatMessage(id: string): Promise<void> {
  const { error } = await supabase.from('work_chat_messages').delete().eq('id', id);
  if (error) throw error;
}

export const TASK_STATUSES: WorkTaskStatusV2[] = ['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled'];
export const TASK_PRIORITIES: WorkTaskPriority[] = ['low', 'medium', 'high', 'urgent'];
export const STATUS_LABELS: Record<WorkTaskStatusV2, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'In Review',
  done: 'Done',
  cancelled: 'Cancelled',
};
export const PRIORITY_LABELS: Record<WorkTaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};
export const PRIORITY_COLORS: Record<WorkTaskPriority, string> = {
  low: '#94A3B8',
  medium: '#3B82F6',
  high: '#F59E0B',
  urgent: '#EF4444',
};