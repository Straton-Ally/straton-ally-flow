export type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'none';
export type StatusCategory = 'todo' | 'doing' | 'done';
export type ProjectRole = 'lead' | 'member' | 'viewer';

export interface ProjectSummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  color: string;
  lead_id: string | null;
  archived_at: string | null;
  my_role: ProjectRole | 'admin' | null;
  member_count: number;
  open_count: number;
  done_count: number;
  my_open_count: number;
  updated_at: string;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description: string | null;
  color: string;
  lead_id: string | null;
  archived_at: string | null;
  created_by: string | null;
}

export interface ProjectStatus {
  id: string;
  project_id: string;
  name: string;
  category: StatusCategory;
  position: number;
}

export interface ProjectMember {
  project_id: string;
  user_id: string;
  role: ProjectRole;
}

export interface Label {
  id: string;
  project_id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;
  project_id: string;
  number: number;
  status_id: string;
  title: string;
  description: string;
  priority: Priority;
  assignee_id: string | null;
  reporter_id: string | null;
  due_date: string | null;
  position: number;
  parent_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  task_labels: { label_id: string }[];
}

export interface TaskComment {
  id: string;
  task_id: string;
  project_id: string;
  user_id: string | null;
  body: string;
  mentions: string[];
  edited_at: string | null;
  created_at: string;
}

export interface TaskActivity {
  id: number;
  task_id: string;
  actor_id: string | null;
  kind: 'created' | 'status' | 'assignee' | 'priority' | 'due_date' | 'title' | 'comment';
  data: Record<string, unknown>;
  created_at: string;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  uploader_id: string | null;
  created_at: string;
}

export interface MyTask {
  id: string;
  project_id: string;
  project_key: string;
  project_name: string;
  project_color: string;
  number: number;
  title: string;
  priority: Priority;
  due_date: string | null;
  status_id: string;
  status_name: string;
  status_category: StatusCategory;
  parent_id: string | null;
  updated_at: string;
}
