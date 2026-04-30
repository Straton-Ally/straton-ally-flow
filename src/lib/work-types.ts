export type WorkTeamRole = 'owner' | 'admin' | 'team_lead' | 'project_manager' | 'member' | 'guest'
export type WorkProjectStatus = 'active' | 'on_hold' | 'archived'
export type WorkTaskStatusV2 = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled'
export type WorkTaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type WorkChatRoomType = 'text' | 'announcement'

export interface WorkTeam {
  id: string
  name: string
  description: string | null
  avatar_url: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface WorkTeamMember {
  id: string
  team_id: string
  user_id: string
  role: WorkTeamRole
  joined_at: string
  profile?: {
    full_name: string
    email: string
    avatar_url: string | null
  }
}

export interface WorkProject {
  id: string
  team_id: string
  name: string
  description: string | null
  color: string
  status: WorkProjectStatus
  start_date: string | null
  end_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface WorkProjectMember {
  id: string
  project_id: string
  user_id: string
  role: 'owner' | 'member'
  joined_at: string
}

export interface WorkTaskV2 {
  id: string
  project_id: string
  parent_id: string | null
  title: string
  description: string | null
  status: WorkTaskStatusV2
  priority: WorkTaskPriority
  assignee_id: string | null
  reporter_id: string | null
  due_date: string | null
  start_date: string | null
  estimated_hours: number | null
  actual_hours: number | null
  position: number
  is_completed: boolean
  completed_at: string | null
  completed_by: string | null
  tags: string[]
  created_by: string | null
  created_at: string
  updated_at: string
  assignee?: {
    full_name: string
    avatar_url: string | null
  }
  subtasks?: WorkTaskV2[]
  comments?: WorkTaskComment[]
}

export interface WorkTaskComment {
  id: string
  task_id: string
  parent_id: string | null
  user_id: string
  content: string
  mentions: string[]
  is_edited: boolean
  created_at: string
  updated_at: string
  user?: {
    full_name: string
    avatar_url: string | null
  }
  replies?: WorkTaskComment[]
}

export interface WorkChatRoom {
  id: string
  team_id: string
  name: string
  description: string | null
  type: WorkChatRoomType
  is_default: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface WorkChatAttachment {
  name: string
  type: string
  size: number
  path: string
  url?: string | null
}

export interface WorkChatMessage {
  id: string
  room_id: string
  parent_id: string | null
  user_id: string
  content: string
  mentions: string[]
  attachments: WorkChatAttachment[]
  reactions: Record<string, string[]>
  is_edited: boolean
  created_at: string
  updated_at: string
  user?: {
    full_name: string
    avatar_url: string | null
  }
  parent?: {
    id: string
    content: string
    user_full_name: string | null
  } | null
}

export interface UserTeam {
  team_id: string
  name: string
  description: string | null
  avatar_url: string | null
  role: WorkTeamRole
  member_count: number
}

export interface ProjectTask {
  id: string
  title: string
  description: string | null
  status: WorkTaskStatusV2
  priority: WorkTaskPriority
  assignee_id: string | null
  assignee_name: string | null
  due_date: string | null
  tags: string[]
  subtask_count: number
  comment_count: number
  created_at: string
}
