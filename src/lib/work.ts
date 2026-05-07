import { supabase } from '@/integrations/supabase/client';
import type {
  WorkTeam,
  WorkTeamMember,
  WorkProject,
  WorkProjectMember,
  WorkTaskV2,
  WorkTaskComment,
  WorkTaskAttachment,
  WorkChatRoom,
  WorkChatMessage,
  WorkChatAttachment,
  WorkTaskStatusV2,
  WorkTaskPriority,
  UserTeam,
  ProjectTask,
} from './work-types';

const workDb = supabase as any;

export type {
  ProjectTask,
  UserTeam,
  WorkChatMessage,
  WorkChatAttachment,
  WorkChatRoom,
  WorkProject,
  WorkProjectMember,
  WorkTaskComment,
  WorkTaskAttachment,
  WorkTaskPriority,
  WorkTaskStatusV2,
  WorkTaskV2,
  WorkTeam,
  WorkTeamMember,
  WorkTeamRole,
} from './work-types';

export async function fetchUserTeams(userId: string): Promise<UserTeam[]> {
  const { data, error } = await workDb.rpc('get_user_teams', { user_uuid: userId });
  if (error) throw error;
  return (data ?? []) as UserTeam[];
}

export async function fetchTeams(): Promise<WorkTeam[]> {
  const { data, error } = await workDb.from('work_teams').select('*').eq('is_active', true).order('name');
  if (error) throw error;
  return (data ?? []) as WorkTeam[];
}

export async function createTeam(team: Partial<WorkTeam>): Promise<WorkTeam> {
  const { data, error } = await workDb.from('work_teams').insert(team).select().single();
  if (error) throw error;
  return data as WorkTeam;
}

export async function updateTeam(id: string, updates: Partial<WorkTeam>): Promise<WorkTeam> {
  const { data, error } = await workDb.from('work_teams').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as WorkTeam;
}

export async function fetchTeamMembers(teamId: string): Promise<WorkTeamMember[]> {
  const { data, error } = await workDb.from('work_team_members')
    .select('*')
    .eq('team_id', teamId)
    .order('role');
  if (error) throw error;
  return (data ?? []) as WorkTeamMember[];
}

export async function addTeamMember(member: Partial<WorkTeamMember>): Promise<WorkTeamMember> {
  const { data, error } = await workDb.from('work_team_members').insert(member).select().single();
  if (error) throw error;
  return data as WorkTeamMember;
}

export async function removeTeamMember(teamId: string, userId: string): Promise<void> {
  const { error } = await workDb.from('work_team_members').delete().eq('team_id', teamId).eq('user_id', userId);
  if (error) throw error;
}

export async function fetchProjects(teamId: string): Promise<WorkProject[]> {
  const { data, error } = await workDb.from('work_projects')
    .select('*')
    .eq('team_id', teamId)
    .order('name');
  if (error) throw error;
  return (data ?? []) as WorkProject[];
}

export async function createProject(project: Partial<WorkProject>): Promise<WorkProject> {
  const { data, error } = await workDb.from('work_projects').insert(project).select().single();
  if (error) throw error;
  return data as WorkProject;
}

export async function updateProject(id: string, updates: Partial<WorkProject>): Promise<WorkProject> {
  const { data, error } = await workDb.from('work_projects').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as WorkProject;
}

export async function fetchProject(projectId: string): Promise<WorkProject | null> {
  const { data, error } = await workDb.from('work_projects').select('*').eq('id', projectId).maybeSingle();
  if (error) throw error;
  return data as WorkProject | null;
}

export async function fetchProjectTasks(projectId: string, statusFilter?: WorkTaskStatusV2): Promise<ProjectTask[]> {
  let query = workDb
    .from('work_tasks_v2')
    .select('id,title,description,status,priority,assignee_id,due_date,tags,created_at,position')
    .eq('project_id', projectId)
    .is('parent_id', null)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) throw error;

  const tasks = (data ?? []) as Array<{
    id: string;
    title: string;
    description: string | null;
    status: WorkTaskStatusV2;
    priority: WorkTaskPriority;
    assignee_id: string | null;
    due_date: string | null;
    tags: string[] | null;
    created_at: string;
  }>;
  if (tasks.length === 0) return [];

  const taskIds = tasks.map((task) => task.id);
  const assigneeIds = Array.from(new Set(tasks.map((task) => task.assignee_id).filter(Boolean))) as string[];
  const [profiles, employees, subtasks, comments] = await Promise.all([
    fetchProfilesById(assigneeIds),
    fetchEmployeesByUserId(assigneeIds),
    workDb.from('work_tasks_v2').select('parent_id').in('parent_id', taskIds),
    workDb.from('work_task_comments').select('task_id').in('task_id', taskIds),
  ]);

  if (subtasks.error) throw subtasks.error;
  if (comments.error) throw comments.error;

  const subtaskCounts = countBy((subtasks.data ?? []) as Array<{ parent_id: string | null }>, 'parent_id');
  const commentCounts = countBy((comments.data ?? []) as Array<{ task_id: string }>, 'task_id');

  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assignee_id: task.assignee_id,
    assignee_name: task.assignee_id
      ? profiles.get(task.assignee_id)?.full_name ?? employees.get(task.assignee_id)?.employee_id ?? null
      : null,
    due_date: task.due_date,
    tags: task.tags ?? [],
    subtask_count: subtaskCounts.get(task.id) ?? 0,
    comment_count: commentCounts.get(task.id) ?? 0,
    created_at: task.created_at,
  }));
}

export async function fetchTask(taskId: string): Promise<WorkTaskV2 | null> {
  const { data, error } = await workDb.from('work_tasks_v2')
    .select('*')
    .eq('id', taskId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const task = data as WorkTaskV2;
  if (!task.assignee_id) return task;

  const { data: profile } = await workDb.from('profiles')
    .select('full_name, avatar_url')
    .eq('id', task.assignee_id)
    .maybeSingle();

  return {
    ...task,
    assignee: profile ?? undefined,
  };
}

export async function createTask(task: Partial<WorkTaskV2>): Promise<WorkTaskV2> {
  const { data, error } = await workDb.from('work_tasks_v2').insert(task).select().single();
  if (error) throw error;
  return data as WorkTaskV2;
}

export async function updateTask(id: string, updates: Partial<WorkTaskV2>): Promise<WorkTaskV2> {
  if (updates.is_completed) {
    updates.completed_at = new Date().toISOString();
  }
  const { data, error } = await workDb.from('work_tasks_v2')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as WorkTaskV2;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await workDb.from('work_tasks_v2').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchTaskComments(taskId: string): Promise<WorkTaskComment[]> {
  const { data, error } = await workDb.from('work_task_comments')
    .select('*')
    .eq('task_id', taskId)
    .is('parent_id', null)
    .order('created_at');
  if (error) throw error;
  const comments = (data ?? []) as WorkTaskComment[];
  const profiles = await fetchProfilesById(comments.map((comment) => comment.user_id));
  return comments.map((comment) => ({
    ...comment,
    user: profiles.get(comment.user_id),
  }));
}

export async function createTaskComment(comment: Partial<WorkTaskComment>): Promise<WorkTaskComment> {
  const { data, error } = await workDb.from('work_task_comments').insert(comment).select().single();
  if (error) throw error;
  return data as WorkTaskComment;
}

export async function updateTaskComment(id: string, updates: Partial<WorkTaskComment>): Promise<WorkTaskComment> {
  const { data, error } = await workDb.from('work_task_comments')
    .update({ ...updates, is_edited: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as WorkTaskComment;
}

export async function deleteTaskComment(id: string): Promise<void> {
  const { error } = await workDb.from('work_task_comments').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchTaskAttachments(taskId: string): Promise<WorkTaskAttachment[]> {
  const { data, error } = await workDb
    .from('work_task_attachments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return hydrateTaskAttachments((data ?? []) as WorkTaskAttachment[]);
}

export async function uploadTaskAttachment(taskId: string, userId: string, file: File): Promise<WorkTaskAttachment> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${taskId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const type = file.type || 'application/octet-stream';

  const { error: uploadError } = await workDb.storage
    .from('work-task-attachments')
    .upload(path, file, { contentType: type });
  if (uploadError) throw uploadError;

  const { data, error } = await workDb
    .from('work_task_attachments')
    .insert({
      task_id: taskId,
      user_id: userId,
      name: file.name,
      type,
      size: file.size,
      path,
    })
    .select()
    .single();
  if (error) throw error;

  const [attachment] = await hydrateTaskAttachments([data as WorkTaskAttachment]);
  return attachment;
}

export async function fetchChatRooms(teamId: string): Promise<WorkChatRoom[]> {
  const { data, error } = await workDb.from('work_chat_rooms')
    .select('*')
    .eq('team_id', teamId)
    .order('is_default', { ascending: false })
    .order('name');
  if (error) throw error;
  return (data ?? []) as WorkChatRoom[];
}

export async function createChatRoom(room: Partial<WorkChatRoom>): Promise<WorkChatRoom> {
  const { data, error } = await workDb.from('work_chat_rooms').insert(room).select().single();
  if (error) throw error;
  return data as WorkChatRoom;
}

export async function fetchChatMessages(roomId: string, limit = 50): Promise<WorkChatMessage[]> {
  const { data, error } = await workDb.rpc('get_work_chat_messages', {
    room_uuid: roomId,
    limit_count: limit,
  });
  if (error) throw error;
  return Promise.all(((data ?? []) as Array<WorkChatMessage & {
    user_full_name?: string | null;
    user_avatar_url?: string | null;
    parent_content?: string | null;
    parent_user_full_name?: string | null;
  }>).map(async (message) => ({
    id: message.id,
    room_id: message.room_id,
    parent_id: message.parent_id,
    user_id: message.user_id,
    content: message.content,
    mentions: message.mentions ?? [],
    attachments: await hydrateChatAttachments(message.attachments ?? []),
    reactions: message.reactions ?? {},
    is_edited: message.is_edited,
    created_at: message.created_at,
    updated_at: message.updated_at,
    user: {
      full_name: message.user_full_name || 'Unknown user',
      avatar_url: message.user_avatar_url ?? null,
    },
    parent: message.parent_id
      ? {
          id: message.parent_id,
          content: message.parent_content ?? '',
          user_full_name: message.parent_user_full_name ?? null,
        }
      : null,
  })));
}

export async function sendChatMessage(message: Partial<WorkChatMessage>): Promise<WorkChatMessage> {
  const { data, error } = await workDb.from('work_chat_messages').insert(message).select().single();
  if (error) throw error;
  return data as WorkChatMessage;
}

export async function uploadChatAttachment(roomId: string, file: File): Promise<WorkChatAttachment> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${roomId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const { error } = await workDb.storage
    .from('work-chat-attachments')
    .upload(path, file, { contentType: file.type || 'application/octet-stream' });
  if (error) throw error;

  return {
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    path,
  };
}

export async function editChatMessage(id: string, content: string): Promise<WorkChatMessage> {
  const { data, error } = await workDb.from('work_chat_messages')
    .update({ content, is_edited: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as WorkChatMessage;
}

export async function updateChatMessageReactions(
  id: string,
  reactions: Record<string, string[]>,
): Promise<WorkChatMessage> {
  const { data, error } = await workDb.rpc('set_work_chat_message_reactions', {
    message_uuid: id,
    next_reactions: reactions,
  });
  if (error) throw error;
  return data as WorkChatMessage;
}

export async function deleteChatMessage(id: string): Promise<void> {
  const { error } = await workDb.from('work_chat_messages').delete().eq('id', id);
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

async function fetchProfilesById(userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  const profiles = new Map<string, { full_name: string; avatar_url: string | null }>();
  if (ids.length === 0) return profiles;

  const { data, error } = await workDb.from('profiles')
    .select('id,full_name,avatar_url')
    .in('id', ids);
  if (error) throw error;

  for (const profile of data ?? []) {
    profiles.set(profile.id, {
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
    });
  }

  return profiles;
}

async function fetchEmployeesByUserId(userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  const employees = new Map<string, { employee_id: string }>();
  if (ids.length === 0) return employees;

  const { data, error } = await workDb.from('employees')
    .select('user_id,employee_id')
    .in('user_id', ids);
  if (error) throw error;

  for (const employee of data ?? []) {
    if (employee.user_id) {
      employees.set(employee.user_id, { employee_id: employee.employee_id });
    }
  }

  return employees;
}

async function hydrateChatAttachments(attachments: WorkChatAttachment[]) {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];

  return Promise.all(attachments.map(async (attachment) => {
    if (!attachment.path) return attachment;
    const [{ data }, { data: downloadData }] = await Promise.all([
      workDb.storage
      .from('work-chat-attachments')
        .createSignedUrl(attachment.path, 60 * 60),
      workDb.storage
        .from('work-chat-attachments')
        .createSignedUrl(attachment.path, 60 * 60, { download: attachment.name }),
    ]);
    return {
      ...attachment,
      url: data?.signedUrl ?? null,
      download_url: downloadData?.signedUrl ?? data?.signedUrl ?? null,
    };
  }));
}

async function hydrateTaskAttachments(attachments: WorkTaskAttachment[]) {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];

  return Promise.all(attachments.map(async (attachment) => {
    if (!attachment.path) return attachment;
    const [{ data }, { data: downloadData }] = await Promise.all([
      workDb.storage
        .from('work-task-attachments')
        .createSignedUrl(attachment.path, 60 * 60),
      workDb.storage
        .from('work-task-attachments')
        .createSignedUrl(attachment.path, 60 * 60, { download: attachment.name }),
    ]);
    return {
      ...attachment,
      url: data?.signedUrl ?? null,
      download_url: downloadData?.signedUrl ?? data?.signedUrl ?? null,
    };
  }));
}

function countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return rows.reduce((counts, row) => {
    const value = row[key];
    if (typeof value === 'string') {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return counts;
  }, new Map<string, number>());
}


