import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type {
  Label,
  MyTask,
  Project,
  ProjectMember,
  ProjectRole,
  ProjectStatus,
  ProjectSummary,
  Task,
  TaskActivity,
  TaskAttachment,
  TaskComment,
} from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const TASK_COLUMNS =
  'id, project_id, number, status_id, title, description, priority, assignee_id, reporter_id, due_date, position, parent_id, completed_at, created_at, updated_at, task_labels(label_id)';

export const projectKeys = {
  list: () => ['projects', 'list'] as const,
  myTasks: () => ['projects', 'my-tasks'] as const,
  project: (id: string) => ['projects', 'project', id] as const,
  tasks: (id: string) => ['projects', 'tasks', id] as const,
  task: (id: string) => ['projects', 'task', id] as const,
  file: (path: string) => ['projects', 'file', path] as const,
};

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

// ------------------------------------------------------------------ queries

export function useMyProjects() {
  return useQuery({
    queryKey: projectKeys.list(),
    queryFn: async () => unwrap<ProjectSummary[]>(await db.rpc('get_my_projects')) ?? [],
  });
}

export function useMyTasks() {
  return useQuery({
    queryKey: projectKeys.myTasks(),
    queryFn: async () => unwrap<MyTask[]>(await db.rpc('get_my_tasks')) ?? [],
  });
}

export interface ProjectBundle {
  project: Project;
  statuses: ProjectStatus[];
  members: ProjectMember[];
  labels: Label[];
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.project(projectId ?? ''),
    enabled: Boolean(projectId),
    queryFn: async (): Promise<ProjectBundle | null> => {
      const [project, statuses, members, labels] = await Promise.all([
        db.from('projects').select('id, key, name, description, color, lead_id, archived_at, created_by').eq('id', projectId).maybeSingle(),
        db.from('project_statuses').select('id, project_id, name, category, position').eq('project_id', projectId).order('position'),
        db.from('project_members').select('project_id, user_id, role').eq('project_id', projectId),
        db.from('labels').select('id, project_id, name, color').eq('project_id', projectId).order('name'),
      ]);
      const p = unwrap<Project | null>(project);
      if (!p) return null;
      return {
        project: p,
        statuses: unwrap<ProjectStatus[]>(statuses) ?? [],
        members: unwrap<ProjectMember[]>(members) ?? [],
        labels: unwrap<Label[]>(labels) ?? [],
      };
    },
  });
}

/** Every task of a project (top-level and subtasks); boards filter client-side. */
export function useProjectTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.tasks(projectId ?? ''),
    enabled: Boolean(projectId),
    queryFn: async () =>
      unwrap<Task[]>(
        await db.from('tasks').select(TASK_COLUMNS).eq('project_id', projectId).order('position').limit(5000),
      ) ?? [],
  });
}

export interface TaskDetail {
  comments: TaskComment[];
  activity: TaskActivity[];
  attachments: TaskAttachment[];
}

export function useTaskDetail(taskId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.task(taskId ?? ''),
    enabled: Boolean(taskId),
    queryFn: async (): Promise<TaskDetail> => {
      const [comments, activity, attachments] = await Promise.all([
        db.from('task_comments').select('id, task_id, project_id, user_id, body, mentions, edited_at, created_at').eq('task_id', taskId).order('created_at'),
        db.from('task_activity').select('id, task_id, actor_id, kind, data, created_at').eq('task_id', taskId).neq('kind', 'comment').order('created_at'),
        db.from('task_attachments').select('id, task_id, file_name, mime_type, size_bytes, storage_path, uploader_id, created_at').eq('task_id', taskId).order('created_at'),
      ]);
      return {
        comments: unwrap<TaskComment[]>(comments) ?? [],
        activity: unwrap<TaskActivity[]>(activity) ?? [],
        attachments: unwrap<TaskAttachment[]>(attachments) ?? [],
      };
    },
  });
}

export function useSignedProjectFile(path: string) {
  return useQuery({
    queryKey: projectKeys.file(path),
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('project-files').createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

// ------------------------------------------------------------------ cache helpers

function patchTask(queryClient: QueryClient, projectId: string, taskId: string, patch: Partial<Task>) {
  queryClient.setQueryData<Task[]>(projectKeys.tasks(projectId), (old) =>
    old?.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
  );
}

function upsertTask(queryClient: QueryClient, task: Task) {
  queryClient.setQueryData<Task[]>(projectKeys.tasks(task.project_id), (old) => {
    if (!old) return old;
    const exists = old.some((t) => t.id === task.id);
    return exists
      ? old.map((t) => (t.id === task.id ? { ...t, ...task, task_labels: task.task_labels ?? t.task_labels } : t))
      : [...old, { ...task, task_labels: task.task_labels ?? [] }];
  });
}

/** Live board: RLS-checked task changes from other people patch the cache. */
export function useProjectRealtime(projectId: string | undefined) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`project:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id?: string }).id;
            queryClient.setQueryData<Task[]>(projectKeys.tasks(projectId), (old) => old?.filter((t) => t.id !== id));
            return;
          }
          const row = payload.new as Task;
          upsertTask(queryClient, { ...row, task_labels: undefined as unknown as Task['task_labels'] });
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'task_comments', filter: `project_id=eq.${projectId}` },
        (payload) => {
          const row = payload.new as TaskComment;
          void queryClient.invalidateQueries({ queryKey: projectKeys.task(row.task_id) });
        },
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [projectId, queryClient]);
}

// ------------------------------------------------------------------ mutations

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string; key: string; description: string; color: string; memberIds: string[] }) => {
      const project = unwrap<{ id: string }>(
        await db
          .from('projects')
          .insert({ name: input.name, key: input.key, description: input.description || null, color: input.color, created_by: user!.id })
          .select('id')
          .single(),
      );
      const others = input.memberIds.filter((id) => id !== user!.id);
      if (others.length > 0) {
        unwrap(await db.from('project_members').insert(others.map((id) => ({ project_id: project.id, user_id: id, role: 'member' }))));
      }
      return project.id;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: projectKeys.list() }),
  });
}

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Pick<Project, 'name' | 'description' | 'color' | 'archived_at'>>) =>
      unwrap(await db.from('projects').update(patch).eq('id', projectId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.project(projectId) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.list() });
    },
  });
}

export function useProjectMembersMutations(projectId: string) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: projectKeys.project(projectId) });
    void queryClient.invalidateQueries({ queryKey: projectKeys.list() });
  };
  const add = useMutation({
    mutationFn: async ({ userIds, role }: { userIds: string[]; role: ProjectRole }) =>
      unwrap(await db.from('project_members').insert(userIds.map((id) => ({ project_id: projectId, user_id: id, role })))),
    onSuccess: refresh,
  });
  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: ProjectRole }) =>
      unwrap(await db.from('project_members').update({ role }).eq('project_id', projectId).eq('user_id', userId)),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (userId: string) =>
      unwrap(await db.from('project_members').delete().eq('project_id', projectId).eq('user_id', userId)),
    onSuccess: refresh,
  });
  return { add, setRole, remove };
}

export function useStatusMutations(projectId: string) {
  const queryClient = useQueryClient();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: projectKeys.project(projectId) });
  const create = useMutation({
    mutationFn: async (input: { name: string; category: ProjectStatus['category']; position: number }) =>
      unwrap(await db.from('project_statuses').insert({ project_id: projectId, ...input })),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<ProjectStatus, 'name' | 'category' | 'position'>> }) =>
      unwrap(await db.from('project_statuses').update(patch).eq('id', id)),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => unwrap(await db.from('project_statuses').delete().eq('id', id)),
    onSuccess: refresh,
  });
  return { create, update, remove };
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      title: string;
      statusId?: string;
      assigneeId?: string | null;
      priority?: Task['priority'];
      dueDate?: string | null;
      parentId?: string | null;
      position?: number;
    }) =>
      unwrap<Task>(
        await db
          .from('tasks')
          .insert({
            project_id: input.projectId,
            title: input.title,
            status_id: input.statusId ?? null,
            assignee_id: input.assigneeId ?? null,
            priority: input.priority ?? 'none',
            due_date: input.dueDate ?? null,
            parent_id: input.parentId ?? null,
            position: input.position ?? 0,
            reporter_id: user!.id,
          })
          .select(TASK_COLUMNS)
          .single(),
      ),
    onSuccess: (task) => {
      upsertTask(queryClient, task);
      void queryClient.invalidateQueries({ queryKey: projectKeys.list() });
      void queryClient.invalidateQueries({ queryKey: projectKeys.myTasks() });
    },
  });
}

export type TaskPatch = Partial<Pick<Task, 'title' | 'description' | 'priority' | 'assignee_id' | 'due_date' | 'status_id' | 'position'>>;

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ task, patch }: { task: Pick<Task, 'id' | 'project_id'>; patch: TaskPatch }) =>
      unwrap<Task>(await db.from('tasks').update(patch).eq('id', task.id).select(TASK_COLUMNS).single()),
    onMutate: ({ task, patch }) => {
      const previous = queryClient.getQueryData<Task[]>(projectKeys.tasks(task.project_id));
      patchTask(queryClient, task.project_id, task.id, patch);
      return { previous };
    },
    onError: (_e, { task }, context) => {
      if (context?.previous) queryClient.setQueryData(projectKeys.tasks(task.project_id), context.previous);
    },
    onSuccess: (row) => {
      upsertTask(queryClient, row);
      void queryClient.invalidateQueries({ queryKey: projectKeys.task(row.id) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.myTasks() });
      void queryClient.invalidateQueries({ queryKey: projectKeys.list() });
    },
  });
}

export function useRebalanceColumn(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (statusId: string) => unwrap(await db.rpc('rebalance_status_column', { _status_id: statusId })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: projectKeys.tasks(projectId) }),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (task: Pick<Task, 'id' | 'project_id'>) => unwrap(await db.from('tasks').delete().eq('id', task.id)),
    onSuccess: (_d, task) => {
      queryClient.setQueryData<Task[]>(projectKeys.tasks(task.project_id), (old) =>
        old?.filter((t) => t.id !== task.id && t.parent_id !== task.id),
      );
      void queryClient.invalidateQueries({ queryKey: projectKeys.list() });
      void queryClient.invalidateQueries({ queryKey: projectKeys.myTasks() });
    },
  });
}

export function useLabelMutations(projectId: string) {
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: async (input: { name: string; color: string }) =>
      unwrap<Label>(await db.from('labels').insert({ project_id: projectId, ...input }).select('id, project_id, name, color').single()),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: projectKeys.project(projectId) }),
  });
  const toggle = useMutation({
    mutationFn: async ({ task, labelId, on }: { task: Task; labelId: string; on: boolean }) =>
      on
        ? unwrap(await db.from('task_labels').insert({ task_id: task.id, label_id: labelId, project_id: projectId }))
        : unwrap(await db.from('task_labels').delete().eq('task_id', task.id).eq('label_id', labelId)),
    onMutate: ({ task, labelId, on }) =>
      patchTask(queryClient, projectId, task.id, {
        task_labels: on ? [...task.task_labels, { label_id: labelId }] : task.task_labels.filter((l) => l.label_id !== labelId),
      }),
    onError: () => void queryClient.invalidateQueries({ queryKey: projectKeys.tasks(projectId) }),
  });
  return { create, toggle };
}

export function useCommentMutations(task: Pick<Task, 'id' | 'project_id'>) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: projectKeys.task(task.id) });
  const add = useMutation({
    mutationFn: async ({ body, mentions }: { body: string; mentions: string[] }) =>
      unwrap(
        await db.from('task_comments').insert({ task_id: task.id, project_id: task.project_id, user_id: user!.id, body, mentions }),
      ),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (commentId: string) => unwrap(await db.from('task_comments').delete().eq('id', commentId)),
    onSuccess: refresh,
  });
  return { add, remove };
}

export function useAttachmentMutations(task: Pick<Task, 'id' | 'project_id'>) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: projectKeys.task(task.id) });
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        const path = `${task.project_id}/${task.id}/${crypto.randomUUID()}/${file.name}`;
        const { error } = await supabase.storage.from('project-files').upload(path, file, { contentType: file.type || undefined });
        if (error) throw error;
        unwrap(
          await db.from('task_attachments').insert({
            task_id: task.id,
            project_id: task.project_id,
            uploader_id: user!.id,
            storage_path: path,
            file_name: file.name,
            mime_type: file.type || null,
            size_bytes: file.size,
          }),
        );
      }
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (attachment: TaskAttachment) => {
      unwrap(await db.from('task_attachments').delete().eq('id', attachment.id));
      await supabase.storage.from('project-files').remove([attachment.storage_path]);
    },
    onSuccess: refresh,
  });
  return { upload, remove };
}
