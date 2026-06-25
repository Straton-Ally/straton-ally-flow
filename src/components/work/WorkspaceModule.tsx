import { useEffect, useMemo, useRef, useState } from 'react';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  CircleDot,
  Download,
  Check,
  FileText,
  Flag,
  Hash,
  Image,
  KanbanSquare,
  Loader2,
  Lock,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  Reply,
  Search,
  Send,
  SmilePlus,
  X,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import type {
  ProjectTask,
  UserTeam,
  WorkChatMessage,
  WorkChatRoom,
  WorkChatAttachment,
  WorkProject,
  WorkTaskComment,
  WorkTaskAttachment,
  WorkTaskPriority,
  WorkTaskStatusV2,
  WorkTeam,
  WorkTeamMember,
  WorkTeamRole,
} from '@/lib/work-types';
import {
  createChatRoom,
  createProject,
  createTask,
  createTaskComment,
  deleteChatMessage,
  editChatMessage,
  fetchChatMessages,
  fetchChatRooms,
  fetchTaskAttachments,
  fetchProjectTasks,
  fetchProjects,
  fetchTaskComments,
  fetchUserTeams,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  sendChatMessage,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  updateTask,
  updateChatMessageReactions,
  uploadChatAttachment,
  uploadTaskAttachment,
} from '@/lib/work';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

type WorkspaceMode = 'admin' | 'employee';
type WorkspaceTab = 'tasks' | 'members' | 'chat';

const workspaceDb = supabase as any;

type ProfileOption = {
  id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  designation?: string | null;
};

type EmployeeDesignation = {
  user_id: string;
  designation: string | null;
};

type ProjectTaskWithComments = ProjectTask & {
  comments?: WorkTaskComment[];
  attachments?: WorkTaskAttachment[];
};

const visibleStatuses = TASK_STATUSES.filter((status) => status !== 'cancelled');

const statusColors: Record<WorkTaskStatusV2, string> = {
  backlog: 'bg-slate-500',
  todo: 'bg-blue-500',
  in_progress: 'bg-amber-500',
  review: 'bg-violet-500',
  done: 'bg-emerald-500',
  cancelled: 'bg-slate-400',
};

const taskManagerRoles: WorkTeamRole[] = ['owner', 'admin', 'team_lead', 'project_manager'];
const quickReactions = ['👍', '✅', '👀'];

interface WorkspaceModuleProps {
  mode: WorkspaceMode;
  initialTab?: WorkspaceTab;
}

export function WorkspaceModule({ mode, initialTab = 'tasks' }: WorkspaceModuleProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [teams, setTeams] = useState<WorkTeam[]>([]);
  const [userTeams, setUserTeams] = useState<UserTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [members, setMembers] = useState<WorkTeamMember[]>([]);
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [tasks, setTasks] = useState<Record<WorkTaskStatusV2, ProjectTaskWithComments[]>>(emptyTaskColumns());
  const [rooms, setRooms] = useState<WorkChatRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [messages, setMessages] = useState<WorkChatMessage[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);

  const [newTeam, setNewTeam] = useState({ name: '', description: '' });
  const [newMember, setNewMember] = useState({ userId: '', role: 'member' as WorkTeamRole });
  const [newProject, setNewProject] = useState({ name: '', description: '', color: '#2563EB' });
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as WorkTaskPriority,
    assignee_id: '',
    due_date: '',
  });
  const [newRoom, setNewRoom] = useState({ name: '', description: '', type: 'text' as WorkChatRoom['type'] });
  const [newMessage, setNewMessage] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<WorkChatMessage | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? null,
    [selectedTeamId, teams],
  );
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const memberIds = useMemo(() => new Set(members.map((member) => member.user_id)), [members]);
  const selectedUserTeam = useMemo(
    () => userTeams.find((team) => team.team_id === selectedTeamId),
    [selectedTeamId, userTeams],
  );
  const canManageTeam = mode === 'admin' || selectedUserTeam?.role === 'owner' || selectedUserTeam?.role === 'admin';
  const canManageTasks = mode === 'admin' || taskManagerRoles.includes(selectedUserTeam?.role as WorkTeamRole);
  const canCreateTask = canManageTasks;
  const totalTasks = useMemo(
    () => visibleStatuses.reduce((count, status) => count + tasks[status].length, 0),
    [tasks],
  );
  const allTasks = useMemo(
    () => visibleStatuses.flatMap((status) => tasks[status]),
    [tasks],
  );
  const selectedTask = useMemo(
    () => allTasks.find((task) => task.id === selectedTaskId) ?? null,
    [allTasks, selectedTaskId],
  );
  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  );
  const completedTasks = tasks.done.length;
  const boardProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const activeProjectCount = projects.filter((project) => project.status === 'active').length;
  const filteredMessages = useMemo(
    () => filterChatMessages(messages, chatSearch),
    [messages, chatSearch],
  );

  useEffect(() => {
    void loadInitialData();
  }, [mode, user?.id]);

  useEffect(() => {
    if (mode === 'employee' && activeTab === 'members') {
      setActiveTab('tasks');
    }
  }, [activeTab, mode]);

  useEffect(() => {
    if (!selectedTeamId) return;
    void loadTeamData(selectedTeamId);
  }, [selectedTeamId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setTasks(emptyTaskColumns());
      return;
    }
    setSelectedTaskId('');
    void loadTasks(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedRoomId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedRoomId);
  }, [selectedRoomId]);

  useEffect(() => {
    if (!selectedRoomId) return;

    const realtime = supabase
      .channel(`workspace-chat:${selectedRoomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_chat_messages',
          filter: `room_id=eq.${selectedRoomId}`,
        },
        () => {
          void loadMessages(selectedRoomId);
        },
      )
      .subscribe();

    return () => {
      realtime.unsubscribe();
    };
  }, [selectedRoomId]);

  const loadInitialData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [teamRows, profileRows] = await Promise.all([
        mode === 'admin' ? fetchAllTeams() : fetchTeamsForEmployee(user.id),
        fetchProfiles(),
      ]);
      setTeams(teamRows);
      setProfiles(profileRows);
      if (teamRows.length > 0) {
        setSelectedTeamId((current) => current || teamRows[0].id);
      } else {
        setSelectedTeamId('');
      }
    } catch (error) {
      toast({
        title: 'Workspace not loaded',
        description: errorMessage(error, 'Unable to load workspace data.'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllTeams = async () => {
    const { data, error } = await workspaceDb
      .from('work_teams')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return (data ?? []) as WorkTeam[];
  };

  const fetchTeamsForEmployee = async (userId: string) => {
    const rows = await fetchUserTeams(userId);
    setUserTeams(rows);
    return rows.map((team) => ({
      id: team.team_id,
      name: team.name,
      description: team.description,
      avatar_url: team.avatar_url,
      is_active: true,
      created_by: null,
      created_at: '',
      updated_at: '',
    })) as WorkTeam[];
  };

  const fetchProfiles = async () => {
    const { data, error } = await workspaceDb
      .from('profiles')
      .select('id,full_name,email,avatar_url')
      .order('full_name');
    if (error) throw error;
    return (data ?? []) as ProfileOption[];
  };

  const loadTeamData = async (teamId: string) => {
    try {
      const [memberRows, projectRows, roomRows] = await Promise.all([
        fetchMembers(teamId),
        fetchProjects(teamId),
        fetchChatRooms(teamId),
      ]);
      setMembers(memberRows);
      setProjects(projectRows);
      setRooms(roomRows);
      setSelectedProjectId(projectRows[0]?.id ?? '');
      setSelectedRoomId(roomRows.find((room) => room.is_default)?.id ?? roomRows[0]?.id ?? '');
    } catch (error) {
      toast({
        title: 'Team not loaded',
        description: errorMessage(error, 'Unable to load this team.'),
        variant: 'destructive',
      });
    }
  };

  const fetchMembers = async (teamId: string) => {
    const { data, error } = await workspaceDb
      .from('work_team_members')
      .select('*')
      .eq('team_id', teamId)
      .order('role');
    if (error) throw error;

    const rows = (data ?? []) as WorkTeamMember[];
    const userIds = rows.map((member) => member.user_id);
    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
    const designationsByUserId = new Map<string, string | null>();

    if (userIds.length > 0 && profiles.length === 0) {
      const freshProfiles = await fetchProfiles();
      setProfiles(freshProfiles);
      freshProfiles.forEach((profile) => profilesById.set(profile.id, profile));
    }

    if (userIds.length > 0) {
      const { data: employeeRows, error: employeeError } = await workspaceDb.rpc(
        'get_work_team_member_designations',
        { _team_id: teamId },
      );

      if (employeeError) throw employeeError;
      ((employeeRows ?? []) as EmployeeDesignation[]).forEach((employee) => {
        designationsByUserId.set(employee.user_id, employee.designation);
      });
    }

    return rows.map((member) => ({
      ...member,
      profile: {
        ...(profilesById.get(member.user_id) ?? member.profile),
        designation: designationsByUserId.get(member.user_id) ?? member.profile?.designation ?? null,
      },
    }));
  };

  const loadTasks = async (projectId: string) => {
    try {
      const rows = await fetchProjectTasks(projectId);
      const grouped = emptyTaskColumns();
      rows.forEach((task) => {
        grouped[task.status].push(task);
      });
      setTasks(grouped);
      const rowsWithComments = rows.filter((task) => task.comment_count > 0).slice(0, 24);
      if (rowsWithComments.length > 0) {
        const commentsByTask = await Promise.all(
          rowsWithComments.map(async (task) => ({
            taskId: task.id,
            comments: await fetchTaskComments(task.id),
          })),
        );
        setTasks((current) => {
          let next = current;
          commentsByTask.forEach(({ taskId, comments }) => {
            next = patchTask(next, taskId, { comments });
          });
          return next;
        });
      }
    } catch (error) {
      toast({
        title: 'Tasks not loaded',
        description: errorMessage(error, 'Unable to load project tasks.'),
        variant: 'destructive',
      });
    }
  };

  const loadMessages = async (roomId: string) => {
    try {
      const rows = await fetchChatMessages(roomId, 100);
      setMessages(rows.reverse());
    } catch (error) {
      toast({
        title: 'Messages not loaded',
        description: errorMessage(error, 'Unable to load chat messages.'),
        variant: 'destructive',
      });
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeam.name.trim() || !user?.id) return;
    setBusy(true);
    try {
      const { data: team, error } = await workspaceDb
        .from('work_teams')
        .insert({
          name: newTeam.name.trim(),
          description: newTeam.description.trim() || null,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;

      await workspaceDb.from('work_team_members').insert({
        team_id: team.id,
        user_id: user.id,
        role: 'owner',
      });
      await createChatRoom({
        team_id: team.id,
        name: 'general',
        description: 'Team-wide updates and discussion',
        type: 'text',
        is_default: true,
        created_by: user.id,
      });

      setNewTeam({ name: '', description: '' });
      setTeamDialogOpen(false);
      await loadInitialData();
      setSelectedTeamId(team.id);
      toast({ title: 'Team created' });
    } catch (error) {
      toast({
        title: 'Team not created',
        description: errorMessage(error, 'Unable to create team.'),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedTeamId || !newMember.userId) return;
    setBusy(true);
    try {
      const { error } = await workspaceDb.from('work_team_members').insert({
        team_id: selectedTeamId,
        user_id: newMember.userId,
        role: newMember.role,
      });
      if (error) throw error;
      setNewMember({ userId: '', role: 'member' });
      setMemberDialogOpen(false);
      await loadTeamData(selectedTeamId);
      toast({ title: 'Member added' });
    } catch (error) {
      toast({
        title: 'Member not added',
        description: errorMessage(error, 'Unable to add member.'),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (member: WorkTeamMember, role: WorkTeamRole) => {
    const previous = members;
    setMembers((current) => current.map((row) => (row.id === member.id ? { ...row, role } : row)));
    const { error } = await workspaceDb
      .from('work_team_members')
      .update({ role })
      .eq('team_id', member.team_id)
      .eq('user_id', member.user_id);
    if (error) {
      setMembers(previous);
      toast({ title: 'Role not updated', description: errorMessage(error, 'Unable to update role.'), variant: 'destructive' });
    }
  };

  const handleRemoveMember = async (member: WorkTeamMember) => {
    const previous = members;
    setMembers((current) => current.filter((row) => row.user_id !== member.user_id));
    const { error } = await workspaceDb
      .from('work_team_members')
      .delete()
      .eq('team_id', member.team_id)
      .eq('user_id', member.user_id);
    if (error) {
      setMembers(previous);
      toast({ title: 'Member not removed', description: errorMessage(error, 'Unable to remove member.'), variant: 'destructive' });
    }
  };

  const handleCreateProject = async () => {
    if (!selectedTeamId || !newProject.name.trim() || !user?.id) return;
    setBusy(true);
    try {
      const project = await createProject({
        team_id: selectedTeamId,
        name: newProject.name.trim(),
        description: newProject.description.trim() || null,
        color: newProject.color,
        created_by: user.id,
      });
      setNewProject({ name: '', description: '', color: '#2563EB' });
      setProjectDialogOpen(false);
      await loadTeamData(selectedTeamId);
      setSelectedProjectId(project.id);
      toast({ title: 'Project created' });
    } catch (error) {
      toast({
        title: 'Project not created',
        description: errorMessage(error, 'Unable to create project.'),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateTask = async () => {
    if (!selectedProjectId || !newTask.title.trim() || !user?.id) return;
    setBusy(true);
    try {
      await createTask({
        project_id: selectedProjectId,
        title: newTask.title.trim(),
        description: newTask.description.trim() || null,
        priority: newTask.priority,
        assignee_id: newTask.assignee_id || null,
        reporter_id: user.id,
        created_by: user.id,
        due_date: newTask.due_date || null,
      });
      setNewTask({ title: '', description: '', priority: 'medium', assignee_id: '', due_date: '' });
      setTaskDialogOpen(false);
      await loadTasks(selectedProjectId);
      toast({ title: 'Task created' });
    } catch (error) {
      toast({
        title: 'Task not created',
        description: errorMessage(error, 'Unable to create task.'),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleTaskStatus = async (task: ProjectTask, status: WorkTaskStatusV2) => {
    const previous = tasks;
    setTasks((current) => moveTask(current, task, status));
    try {
      await updateTask(task.id, { status, is_completed: status === 'done', completed_by: status === 'done' ? user?.id : null });
    } catch (error) {
      setTasks(previous);
      toast({
        title: 'Task not updated',
        description: errorMessage(error, 'Unable to update task.'),
        variant: 'destructive',
      });
    }
  };

  const handleTaskAssignee = async (task: ProjectTask, assigneeId: string | null) => {
    const previous = tasks;
    setTasks((current) =>
      patchTask(current, task.id, {
        assignee_id: assigneeId,
        assignee_name: assigneeId ? memberName(members.find((member) => member.user_id === assigneeId)) : null,
      }),
    );
    try {
      await updateTask(task.id, { assignee_id: assigneeId });
    } catch (error) {
      setTasks(previous);
      toast({
        title: 'Assignee not updated',
        description: errorMessage(error, 'Unable to assign this task.'),
        variant: 'destructive',
      });
    }
  };

  const handleTaskPatch = async (task: ProjectTask, updates: Partial<ProjectTaskWithComments>) => {
    const previous = tasks;
    setTasks((current) => patchTask(current, task.id, updates));
    try {
      await updateTask(task.id, updates as any);
      toast({ title: 'Task updated' });
    } catch (error) {
      setTasks(previous);
      toast({
        title: 'Task not updated',
        description: errorMessage(error, 'Unable to save task changes.'),
        variant: 'destructive',
      });
    }
  };

  const handleTaskAttachments = async (task: ProjectTaskWithComments, files: File[]) => {
    if (files.length === 0 || !user?.id) return;

    try {
      const attachments = await Promise.all(files.map((file) => uploadTaskAttachment(task.id, user.id, file)));
      const comment = await createTaskComment({
        task_id: task.id,
        user_id: user.id,
        content: `Attached ${attachments.length === 1 ? attachments[0].name : `${attachments.length} files`}.`,
      });
      setTasks((current) =>
        {
          const currentTask = findTask(current, task.id);
          return patchTask(current, task.id, {
            comments: [...(currentTask?.comments ?? []), comment],
            attachments: [...attachments, ...(currentTask?.attachments ?? [])],
            comment_count: (currentTask?.comment_count ?? task.comment_count) + 1,
          });
        },
      );
      toast({ title: 'Attachment uploaded' });
    } catch (error) {
      toast({
        title: 'Attachment not uploaded',
        description: errorMessage(error, 'Unable to upload selected files.'),
        variant: 'destructive',
      });
    }
  };

  const handleLoadComments = async (task: ProjectTaskWithComments) => {
    const comments = await fetchTaskComments(task.id);
    setTasks((current) => patchTask(current, task.id, { comments }));
  };

  const handleLoadAttachments = async (task: ProjectTaskWithComments) => {
    const attachments = await fetchTaskAttachments(task.id);
    setTasks((current) => patchTask(current, task.id, { attachments }));
  };

  const handleAddComment = async (task: ProjectTask) => {
    const content = commentDrafts[task.id]?.trim();
    if (!content || !user?.id) return;
    try {
      const comment = await createTaskComment({
        task_id: task.id,
        user_id: user.id,
        content,
      });
      setCommentDrafts((current) => ({ ...current, [task.id]: '' }));
      setTasks((current) =>
        {
          const currentTask = findTask(current, task.id);
          return patchTask(current, task.id, {
            comments: [...(currentTask?.comments ?? []), comment],
            comment_count: (currentTask?.comment_count ?? task.comment_count) + 1,
          });
        },
      );
    } catch (error) {
      toast({
        title: 'Comment not posted',
        description: errorMessage(error, 'Unable to post comment.'),
        variant: 'destructive',
      });
    }
  };

  const handleCreateRoom = async () => {
    if (!selectedTeamId || !newRoom.name.trim() || !user?.id) return;
    setBusy(true);
    try {
      const room = await createChatRoom({
        team_id: selectedTeamId,
        name: newRoom.name.trim(),
        description: newRoom.description.trim() || null,
        type: newRoom.type,
        created_by: user.id,
      });
      setNewRoom({ name: '', description: '', type: 'text' });
      setRoomDialogOpen(false);
      await loadTeamData(selectedTeamId);
      setSelectedRoomId(room.id);
      toast({ title: 'Chat room created' });
    } catch (error) {
      toast({
        title: 'Room not created',
        description: errorMessage(error, 'Unable to create chat room.'),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedRoomId || (!newMessage.trim() && pendingFiles.length === 0) || !user?.id) return;
    const content = newMessage.trim();
    const files = pendingFiles;
    setNewMessage('');
    setPendingFiles([]);
    try {
      const attachments = files.length > 0
        ? await Promise.all(files.map((file) => uploadChatAttachment(selectedRoomId, file)))
        : [];
      await sendChatMessage({
        room_id: selectedRoomId,
        parent_id: replyToMessage?.id ?? null,
        user_id: user.id,
        content: content || attachmentFallbackText(attachments),
        attachments,
      });
      setReplyToMessage(null);
      await loadMessages(selectedRoomId);
    } catch (error) {
      setNewMessage(content);
      setPendingFiles(files);
      toast({
        title: 'Message not sent',
        description: errorMessage(error, 'Unable to send message.'),
        variant: 'destructive',
      });
    }
  };

  const handleAttachFiles = (files: FileList | null) => {
    if (!files) return;
    setPendingFiles((current) => [...current, ...Array.from(files)]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleToggleReaction = async (message: WorkChatMessage, reaction: string) => {
    if (!user?.id) return;
    const previous = messages;
    const nextReactions = toggleReaction(message.reactions ?? {}, reaction, user.id);
    setMessages((current) =>
      current.map((row) => (row.id === message.id ? { ...row, reactions: nextReactions } : row)),
    );
    try {
      await updateChatMessageReactions(message.id, nextReactions);
    } catch (error) {
      setMessages(previous);
      toast({
        title: 'Reaction not saved',
        description: errorMessage(error, 'Unable to save reaction.'),
        variant: 'destructive',
      });
    }
  };

  const handleEditMessage = async (message: WorkChatMessage, content: string) => {
    if (!user?.id || message.user_id !== user.id) return;

    const nextContent = content.trim();
    if (!nextContent) {
      toast({
        title: 'Message not updated',
        description: 'Message cannot be empty.',
        variant: 'destructive',
      });
      return;
    }

    const previous = messages;
    setMessages((current) =>
      current.map((row) =>
        row.id === message.id
          ? { ...row, content: nextContent, is_edited: true, updated_at: new Date().toISOString() }
          : row,
      ),
    );

    try {
      await editChatMessage(message.id, nextContent);
      await loadMessages(selectedRoomId);
    } catch (error) {
      setMessages(previous);
      toast({
        title: 'Message not updated',
        description: errorMessage(error, 'Unable to edit this message.'),
        variant: 'destructive',
      });
    }
  };

  const handleDeleteMessage = async (message: WorkChatMessage) => {
    if (!user?.id || message.user_id !== user.id) return;
    if (!window.confirm('Delete this message?')) return;

    const previous = messages;
    setMessages((current) => current.filter((row) => row.id !== message.id));

    try {
      await deleteChatMessage(message.id);
    } catch (error) {
      setMessages(previous);
      toast({
        title: 'Message not deleted',
        description: errorMessage(error, 'Unable to delete this message.'),
        variant: 'destructive',
      });
    }
  };

  const availableProfiles = profiles.filter((profile) => !memberIds.has(profile.id));

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-lg">
      {teams.length === 0 ? (
        <div className="flex min-h-[520px] flex-col items-center justify-center gap-4 bg-background p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Briefcase className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Create your first workspace</h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {mode === 'admin'
                ? 'Teams, projects, task boards, channels, comments, and files will live here.'
                : 'Ask an admin to add you to a workspace team.'}
            </p>
          </div>
          {mode === 'admin' ? (
            <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Workspace
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Workspace</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <Field label="Name">
                    <Input value={newTeam.name} onChange={(event) => setNewTeam({ ...newTeam, name: event.target.value })} />
                  </Field>
                  <Field label="Description">
                    <Textarea value={newTeam.description} onChange={(event) => setNewTeam({ ...newTeam, description: event.target.value })} />
                  </Field>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreateTeam} disabled={busy || !newTeam.name.trim()}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      ) : (
        <div className="grid min-h-[calc(100vh-9rem)] grid-cols-1 xl:grid-cols-[76px_304px_minmax(0,1fr)]">
          <aside className="flex gap-2 border-b bg-primary/10 p-3 text-primary xl:flex-col xl:border-b-0 xl:border-r">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-[var(--shadow-teal-glow)]">
              WF
            </div>
            <div className="flex gap-2 overflow-x-auto xl:flex-col xl:overflow-visible">
              {teams.map((team) => (
                <button
                  key={team.id}
                  title={team.name}
                  onClick={() => setSelectedTeamId(team.id)}
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-semibold transition-all',
                    selectedTeamId === team.id ? 'bg-card text-primary shadow-[var(--shadow-card)]' : 'bg-card/70 text-primary/70 hover:bg-card hover:text-primary',
                  )}
                >
                  {initials(team.name)}
                </button>
              ))}
            </div>
            {mode === 'admin' ? (
              <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-primary/70 hover:bg-card hover:text-primary">
                    <Plus className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Workspace</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <Field label="Name">
                      <Input value={newTeam.name} onChange={(event) => setNewTeam({ ...newTeam, name: event.target.value })} />
                    </Field>
                    <Field label="Description">
                      <Textarea value={newTeam.description} onChange={(event) => setNewTeam({ ...newTeam, description: event.target.value })} />
                    </Field>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCreateTeam} disabled={busy || !newTeam.name.trim()}>
                      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null}
          </aside>

          <aside className="border-b bg-card text-foreground xl:border-b-0 xl:border-r">
            <div className="border-b bg-secondary/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Workspace</p>
                  <h2 className="truncate text-lg font-semibold">{selectedTeam?.name}</h2>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{selectedTeam?.description || 'Private work hub'}</p>
                </div>
                <Badge className="badge-success">Live</Badge>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <WorkspaceMetric label="People" value={members.length} />
                <WorkspaceMetric label="Projects" value={projects.length} />
                <WorkspaceMetric label="Done" value={`${boardProgress}%`} />
              </div>
            </div>

            <ScrollArea className="h-[calc(100vh-20rem)] xl:h-[calc(100vh-19rem)]">
              <div className="space-y-5 p-3">
                <section>
                  <div className="mb-2 flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Projects</span>
                    {canManageTeam ? (
                      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:bg-primary/10 hover:text-primary">
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Create Project</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-2">
                            <Field label="Name">
                              <Input value={newProject.name} onChange={(event) => setNewProject({ ...newProject, name: event.target.value })} />
                            </Field>
                            <Field label="Description">
                              <Textarea value={newProject.description} onChange={(event) => setNewProject({ ...newProject, description: event.target.value })} />
                            </Field>
                          </div>
                          <DialogFooter>
                            <Button onClick={handleCreateProject} disabled={busy || !newProject.name.trim()}>
                              Create
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    {projects.map((project) => (
                      <button
                        key={project.id}
                        onClick={() => {
                          setSelectedProjectId(project.id);
                          setActiveTab('tasks');
                        }}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
                          selectedProjectId === project.id && activeTab === 'tasks'
                            ? 'bg-primary/10 text-primary shadow-sm'
                            : 'text-foreground/80 hover:bg-secondary/60 hover:text-foreground',
                        )}
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color || '#14b8a6' }} />
                        <span className="min-w-0 flex-1 truncate">{project.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {project.status === 'active' ? 'Active' : project.status.replace('_', ' ')}
                        </span>
                      </button>
                    ))}
                    {projects.length === 0 ? <div className="px-3 py-2 text-sm text-muted-foreground">No projects yet</div> : null}
                  </div>
                </section>

                <section>
                  <div className="mb-2 flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Channels</span>
                    {canManageTeam ? (
                      <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:bg-primary/10 hover:text-primary">
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Create Channel</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-2">
                            <Field label="Name">
                              <Input value={newRoom.name} onChange={(event) => setNewRoom({ ...newRoom, name: event.target.value })} />
                            </Field>
                            <Field label="Description">
                              <Textarea value={newRoom.description} onChange={(event) => setNewRoom({ ...newRoom, description: event.target.value })} />
                            </Field>
                            <Field label="Type">
                              <Select value={newRoom.type} onValueChange={(type) => setNewRoom({ ...newRoom, type: type as WorkChatRoom['type'] })}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="text">Text</SelectItem>
                                  <SelectItem value="announcement">Announcement</SelectItem>
                                </SelectContent>
                              </Select>
                            </Field>
                            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                              <Lock className="mr-2 inline h-4 w-4" />
                              Channels inherit this workspace team privacy.
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={handleCreateRoom} disabled={busy || !newRoom.name.trim()}>
                              Create
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    {rooms.map((room) => (
                      <button
                        key={room.id}
                        onClick={() => {
                          setSelectedRoomId(room.id);
                          setActiveTab('chat');
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                          selectedRoomId === room.id && activeTab === 'chat'
                            ? 'bg-primary/10 text-primary shadow-sm'
                            : 'text-foreground/80 hover:bg-secondary/60 hover:text-foreground',
                        )}
                      >
                        {room.type === 'announcement' ? <Lock className="h-3.5 w-3.5" /> : <Hash className="h-3.5 w-3.5" />}
                        <span className="truncate">{room.name}</span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </ScrollArea>
          </aside>

          <main className="min-w-0 bg-background">
            <header className="flex flex-col gap-4 border-b bg-card/95 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="gap-1">
                    <Lock className="h-3 w-3" />
                    Private
                  </Badge>
                  {selectedUserTeam?.role ? <span className="text-xs text-muted-foreground">Your role: {roleLabel(selectedUserTeam.role)}</span> : null}
                </div>
                <h1 className="truncate text-2xl font-semibold">
                  {activeTab === 'chat' ? selectedRoom?.name || 'Team chat' : selectedProject?.name || 'Work board'}
                </h1>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {activeTab === 'chat'
                    ? selectedRoom?.description || 'Team channel with replies, reactions, and file sharing.'
                    : selectedProject?.description || 'Plan work, update progress, discuss tasks, and keep execution visible.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg border bg-muted p-1">
                  <MainTabButton active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} icon={<KanbanSquare className="h-4 w-4" />} label="Timeline" />
                  {mode === 'admin' ? <MainTabButton active={activeTab === 'members'} onClick={() => setActiveTab('members')} icon={<Users className="h-4 w-4" />} label="People" /> : null}
                  <MainTabButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageSquare className="h-4 w-4" />} label="Chat" />
                </div>

                {activeTab === 'tasks' && canCreateTask && selectedProjectId ? (
                  <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Task
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Task</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        <Field label="Title">
                          <Input value={newTask.title} onChange={(event) => setNewTask({ ...newTask, title: event.target.value })} />
                        </Field>
                        <Field label="Description">
                          <Textarea value={newTask.description} onChange={(event) => setNewTask({ ...newTask, description: event.target.value })} />
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Priority">
                            <Select value={newTask.priority} onValueChange={(priority) => setNewTask({ ...newTask, priority: priority as WorkTaskPriority })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TASK_PRIORITIES.map((priority) => (
                                  <SelectItem key={priority} value={priority}>
                                    {PRIORITY_LABELS[priority]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                          <Field label="Due Date">
                            <Input type="date" value={newTask.due_date} onChange={(event) => setNewTask({ ...newTask, due_date: event.target.value })} />
                          </Field>
                        </div>
                        <Field label="Assignee">
                          <Select value={newTask.assignee_id || 'unassigned'} onValueChange={(assignee_id) => setNewTask({ ...newTask, assignee_id: assignee_id === 'unassigned' ? '' : assignee_id })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {members.map((member) => (
                                <SelectItem key={member.user_id} value={member.user_id}>
                                  {member.profile?.full_name || member.profile?.email || member.user_id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleCreateTask} disabled={busy || !newTask.title.trim()}>
                          Create
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ) : null}

                {activeTab === 'members' && canManageTeam ? (
                  <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Member
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Member</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        <Field label="Employee">
                          <Select value={newMember.userId} onValueChange={(userId) => setNewMember({ ...newMember, userId })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select employee" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableProfiles.map((profile) => (
                                <SelectItem key={profile.id} value={profile.id}>
                                  {profile.full_name || profile.email || profile.id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Role">
                          <RoleSelect value={newMember.role} onChange={(role) => setNewMember({ ...newMember, role })} />
                        </Field>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAddMember} disabled={busy || !newMember.userId}>
                          Add
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ) : null}
              </div>
            </header>

            {activeTab === 'tasks' ? (
              <section className="p-4 lg:p-6">
                {!selectedProject ? (
                  <Card className="border-dashed">
                    <CardContent className="flex min-h-[520px] items-center justify-center p-8 text-center text-muted-foreground">
                      Create or select a project to start assigning tasks.
                    </CardContent>
                  </Card>
                ) : (
                  <ProjectTimeline
                    tasks={allTasks}
                    members={members}
                    selectedTaskId={selectedTaskId}
                    onSelectTask={(task) => {
                      setSelectedTaskId(task.id);
                      void handleLoadComments(task);
                    }}
                  />
                )}
              </section>
            ) : null}

            {mode === 'admin' && activeTab === 'members' ? (
              <section className="grid gap-4 p-4 xl:grid-cols-3">
                {members.map((member) => (
                  <Card key={member.id} className="overflow-hidden">
                    <CardContent className="space-y-4 p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={member.profile?.avatar_url || undefined} />
                          <AvatarFallback>{initials(member.profile?.full_name || member.profile?.email || 'U')}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{member.profile?.full_name || 'Unknown user'}</div>
                          <div className="truncate text-sm text-muted-foreground">{member.profile?.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        {canManageTeam ? <RoleSelect value={member.role} onChange={(role) => handleRoleChange(member, role)} /> : <Badge variant="secondary">{roleLabel(member.role)}</Badge>}
                        {canManageTeam && member.user_id !== user?.id ? (
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveMember(member)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </section>
            ) : null}

            {activeTab === 'chat' ? (
              <section className="grid h-[calc(100vh-18rem)] min-h-[420px] gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <Card className="flex min-h-0 flex-col overflow-hidden">
                  <CardHeader className="border-b py-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          {selectedRoom?.type === 'announcement' ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Hash className="h-4 w-4 text-muted-foreground" />}
                          {selectedRoom?.name || 'Team chat'}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {filteredMessages.length === messages.length ? `${messages.length} messages` : `${filteredMessages.length} of ${messages.length} messages`}
                        </p>
                      </div>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={chatSearch} onChange={(event) => setChatSearch(event.target.value)} placeholder="Search messages" className="h-9 w-full pl-8 sm:w-[260px]" />
                      </div>
                    </div>
                  </CardHeader>
                  <div className="border-b bg-card p-3">
                    {replyToMessage ? (
                      <div className="mb-2 flex items-start justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2">
                        <div className="min-w-0 text-xs">
                          <div className="font-medium">Replying to {replyToMessage.user?.full_name || 'Unknown user'}</div>
                          <div className="truncate text-muted-foreground">{replyToMessage.content}</div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyToMessage(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : null}
                    {pendingFiles.length > 0 ? (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {pendingFiles.map((file, index) => (
                          <div key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
                            {file.type.startsWith('image/') ? <Image className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                            <span className="max-w-[180px] truncate">{file.name}</span>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setPendingFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="flex gap-2 rounded-lg border bg-background p-2">
                      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => handleAttachFiles(event.target.files)} />
                      <Button type="button" variant="ghost" size="icon" disabled={!selectedRoomId} onClick={() => fileInputRef.current?.click()}>
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Textarea
                        value={newMessage}
                        onChange={(event) => setNewMessage(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            void handleSendMessage();
                          }
                        }}
                        placeholder={selectedRoomId ? `Message #${selectedRoom?.name || 'channel'}` : 'Select a channel'}
                        disabled={!selectedRoomId}
                        className="min-h-10 resize-none border-0 bg-transparent py-2 shadow-none focus-visible:ring-0"
                      />
                      <Button className="self-end" onClick={handleSendMessage} disabled={!selectedRoomId || (!newMessage.trim() && pendingFiles.length === 0)}>
                        <Send className="h-4 w-4" />
                        <span className="ml-2 hidden sm:inline">Send</span>
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="min-h-0 flex-1">
                    <div className="space-y-3 p-4">
                      {messages.length === 0 ? (
                        <div className="flex min-h-[420px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                          Start the team conversation.
                        </div>
                      ) : filteredMessages.length === 0 ? (
                        <div className="flex min-h-[420px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                          No messages match your search.
                        </div>
                      ) : (
                        filteredMessages.map((message) => (
                          <ChatMessageRow
                            key={message.id}
                            message={message}
                            currentUserId={user?.id}
                            onReply={setReplyToMessage}
                            onReact={handleToggleReaction}
                            onEdit={handleEditMessage}
                            onDelete={handleDeleteMessage}
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </Card>

                <aside className="space-y-4">
                  <Card>
                    <CardHeader className="border-b">
                      <CardTitle className="text-base">Channel details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 p-4">
                      <DetailTile label="Visibility" value="Workspace members" />
                      <DetailTile label="Type" value={selectedRoom?.type === 'announcement' ? 'Announcement' : 'Text channel'} />
                      <DetailTile label="Messages" value={messages.length} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="border-b">
                      <CardTitle className="text-base">People here</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 p-4">
                      {members.slice(0, 8).map((member) => (
                        <div key={member.id} className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.profile?.avatar_url || undefined} />
                            <AvatarFallback>{initials(member.profile?.full_name || member.profile?.email || 'U')}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{member.profile?.full_name || 'Unknown user'}</div>
                            <div className="text-xs text-muted-foreground">{roleLabel(member.role)}</div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </aside>
              </section>
            ) : null}
          </main>
        </div>
      )}

      <TaskDetailDialog
        task={selectedTask}
        open={Boolean(selectedTask)}
        members={members}
        canAssignTasks={canManageTasks}
        commentDraft={selectedTask ? commentDrafts[selectedTask.id] ?? '' : ''}
        onOpenChange={(open) => {
          if (!open) setSelectedTaskId('');
        }}
        onStatusChange={handleTaskStatus}
        onAssigneeChange={handleTaskAssignee}
        onUpdateTask={handleTaskPatch}
        onAttachFiles={handleTaskAttachments}
        onLoadComments={handleLoadComments}
        onLoadAttachments={handleLoadAttachments}
        onCommentDraft={(value) => {
          if (!selectedTask) return;
          setCommentDrafts((current) => ({ ...current, [selectedTask.id]: value }));
        }}
        onAddComment={handleAddComment}
      />
    </div>
  );
}

function WorkspaceMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2 shadow-sm">
      <div className="text-lg font-semibold leading-none">{value}</div>
      <div className="mt-1 truncate text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function MainTabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
        active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function DetailTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function ProjectTimeline({
  tasks,
  members,
  selectedTaskId,
  onSelectTask,
}: {
  tasks: ProjectTaskWithComments[];
  members: WorkTeamMember[];
  selectedTaskId: string;
  onSelectTask: (task: ProjectTaskWithComments) => void;
}) {
  const statusGroups = visibleStatuses
    .map((status) => ({
      status,
      tasks: tasks.filter((task) => task.status === status),
    }))
    .filter((group) => group.tasks.length > 0);
  const totalComments = tasks.reduce((count, task) => count + task.comment_count, 0);
  const doneCount = tasks.filter((task) => task.status === 'done').length;

  if (tasks.length === 0) {
    return (
      <div className="flex min-h-[520px] items-center justify-center rounded-lg border border-dashed bg-card p-8 text-center">
        <div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CircleDot className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">No project activity yet</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Add tasks or updates and this area will become a live execution timeline.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="rounded-lg border bg-card shadow-[var(--shadow-card)]">
        <div className="border-b bg-secondary/30 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Project timeline</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A hierarchy of tasks, progress updates, and employee comments.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{tasks.length} tasks</Badge>
              <Badge variant="outline">{totalComments} updates</Badge>
              <Badge className="badge-success">{doneCount} complete</Badge>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="relative space-y-8 pl-12 before:absolute before:left-[18px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
            {statusGroups.map((group) => (
              <section key={group.status} className="relative">
                <div className="absolute -left-[42px] top-0.5 flex h-9 w-9 items-center justify-center rounded-full border bg-card shadow-sm">
                  <CircleDot className={cn('h-4 w-4', statusTextColor(group.status))} />
                </div>
                <div className="mb-3 flex min-h-10 flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold">{STATUS_LABELS[group.status]}</h3>
                  <Badge variant="secondary">{group.tasks.length}</Badge>
                </div>

                <div className="space-y-3">
                  {group.tasks.map((task) => {
                    const comments = task.comments ?? [];
                    return (
                      <div key={task.id} className="space-y-3">
                        <button
                          type="button"
                          onClick={() => onSelectTask(task)}
                          className={cn(
                            'block w-full rounded-lg border bg-background text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-[var(--shadow-card)]',
                            selectedTaskId === task.id ? 'border-primary ring-2 ring-primary/15' : null,
                          )}
                        >
                          <div className="border-l-4 p-4" style={{ borderLeftColor: PRIORITY_COLORS[task.priority] }}>
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="font-semibold leading-6">{task.title}</h4>
                                  <Badge variant="outline">{PRIORITY_LABELS[task.priority]}</Badge>
                                  <Badge variant="secondary">Task</Badge>
                                </div>
                                {task.description ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{task.description}</p> : null}
                              </div>
                              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                {task.due_date ? (
                                  <span className="rounded-md border bg-card px-2 py-1">
                                    <Calendar className="mr-1 inline h-3 w-3" />
                                    {task.due_date}
                                  </span>
                                ) : null}
                                <span className="rounded-md border bg-card px-2 py-1">{task.assignee_name || 'Unassigned'}</span>
                              </div>
                            </div>
                          </div>
                        </button>

                        <div className="space-y-3 border-l border-dashed pl-5">
                          {comments.map((comment) => (
                            <button
                              key={comment.id}
                              type="button"
                              onClick={() => onSelectTask(task)}
                              className="block w-full rounded-lg border bg-background text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-[var(--shadow-card)]"
                            >
                              <div className="border-l-4 border-l-primary/60 p-4">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary">Update</Badge>
                                    <Badge variant="outline">{task.title}</Badge>
                                  </div>
                                  <span className="text-xs text-muted-foreground">{format(new Date(comment.created_at), 'MMM d, h:mm a')}</span>
                                </div>
                                <div className="flex gap-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={comment.user?.avatar_url || undefined} />
                                    <AvatarFallback>{initials(comment.user?.full_name || 'U')}</AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <span className="font-medium text-foreground">{comment.user?.full_name || 'Unknown'}</span>
                                    <span className="text-muted-foreground">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
                                  </div>
                                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{comment.content}</p>
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                          {comments.length === 0 ? (
                            <div className="rounded-md border border-dashed bg-card/60 px-3 py-2 text-sm text-muted-foreground">
                              No employee update loaded yet. Open this task to add progress.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-base">Timeline pulse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <DetailTile label="Tasks" value={tasks.length} />
            <DetailTile label="Employee updates" value={totalComments} />
            <DetailTile label="Completion" value={`${Math.round((doneCount / tasks.length) * 100)}%`} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-base">Contributors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {members.slice(0, 6).map((member) => (
              <div key={member.id} className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={member.profile?.avatar_url || undefined} />
                  <AvatarFallback>{initials(member.profile?.full_name || member.profile?.email || 'U')}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{memberName(member)}</div>
                  <div className="truncate text-xs text-muted-foreground">{memberDesignation(member)}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function TaskDetailDialog({
  task,
  open,
  members,
  canAssignTasks,
  commentDraft,
  onOpenChange,
  onStatusChange,
  onAssigneeChange,
  onUpdateTask,
  onAttachFiles,
  onLoadComments,
  onLoadAttachments,
  onCommentDraft,
  onAddComment,
}: {
  task: ProjectTaskWithComments | null;
  open: boolean;
  members: WorkTeamMember[];
  canAssignTasks: boolean;
  commentDraft: string;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (task: ProjectTask, status: WorkTaskStatusV2) => void;
  onAssigneeChange: (task: ProjectTask, assigneeId: string | null) => void;
  onUpdateTask: (task: ProjectTask, updates: Partial<ProjectTaskWithComments>) => void;
  onAttachFiles: (task: ProjectTaskWithComments, files: File[]) => void;
  onLoadComments: (task: ProjectTaskWithComments) => void;
  onLoadAttachments: (task: ProjectTaskWithComments) => void;
  onCommentDraft: (value: string) => void;
  onAddComment: (task: ProjectTask) => void;
}) {
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [actionPanel, setActionPanel] = useState<'assignee' | 'labels' | 'dates' | 'attachment' | null>(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [labelDraft, setLabelDraft] = useState('');
  const [dateDraft, setDateDraft] = useState('');

  useEffect(() => {
    setActionPanel(null);
    setEditingDescription(false);
    setDescriptionDraft(task?.description ?? '');
    setLabelDraft((task?.tags ?? []).join(', '));
    setDateDraft(task?.due_date ?? '');
    if (task) {
      onLoadAttachments(task);
    }
  }, [task?.id, task?.description, task?.due_date, task?.tags]);

  if (!task) return null;

  const saveDescription = () => {
    onUpdateTask(task, { description: descriptionDraft.trim() || null });
    setEditingDescription(false);
  };

  const saveLabels = () => {
    const tags = labelDraft
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    onUpdateTask(task, { tags });
    setActionPanel(null);
  };

  const saveDate = () => {
    onUpdateTask(task, { due_date: dateDraft || null });
    setActionPanel(null);
  };

  const handleAttachmentInput = (files: FileList | null) => {
    const selectedFiles = files ? Array.from(files) : [];
    if (selectedFiles.length > 0) {
      onAttachFiles(task, selectedFiles);
      setActionPanel(null);
    }
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[88vh] max-h-[88vh] max-w-5xl grid-rows-[7rem_minmax(0,1fr)] gap-0 overflow-hidden p-0">
        <div className="h-28 border-b bg-gradient-to-r from-slate-100 via-secondary/70 to-primary/10" />
        <div className="grid min-h-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_360px]">
          <ScrollArea className="h-full">
            <div className="space-y-6 p-6">
              <DialogHeader className="space-y-3 text-left">
                <div className="flex items-start gap-3">
                  <CircleDot className={cn('mt-1 h-5 w-5', statusTextColor(task.status))} />
                  <div className="min-w-0">
                    <DialogTitle className="text-2xl leading-tight">{task.title}</DialogTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      In <span className="font-medium">{STATUS_LABELS[task.status]}</span>
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" disabled={!canAssignTasks} onClick={() => setActionPanel(actionPanel === 'assignee' ? null : 'assignee')}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add
                </Button>
                <Button variant="outline" size="sm" onClick={() => setActionPanel(actionPanel === 'labels' ? null : 'labels')}>
                  <Flag className="mr-2 h-4 w-4" />
                  Labels
                </Button>
                <Button variant="outline" size="sm" onClick={() => setActionPanel(actionPanel === 'dates' ? null : 'dates')}>
                  <Calendar className="mr-2 h-4 w-4" />
                  Dates
                </Button>
                <Button variant="outline" size="sm" onClick={() => setActionPanel(actionPanel === 'attachment' ? null : 'attachment')}>
                  <Paperclip className="mr-2 h-4 w-4" />
                  Attachment
                </Button>
              </div>

              {task.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {task.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              ) : null}

              {actionPanel ? (
                <div className="rounded-lg border bg-card p-4 shadow-sm">
                  {actionPanel === 'assignee' ? (
                    <div className="space-y-3">
                      <Label>Assignee</Label>
                      <Select value={task.assignee_id || 'unassigned'} onValueChange={(value) => onAssigneeChange(task, value === 'unassigned' ? null : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Assign" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {members.map((member) => (
                            <SelectItem key={member.user_id} value={member.user_id}>
                              {memberName(member)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  {actionPanel === 'labels' ? (
                    <div className="space-y-3">
                      <Label>Labels</Label>
                      <Input value={labelDraft} onChange={(event) => setLabelDraft(event.target.value)} placeholder="Design, Review, Client" />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setActionPanel(null)}>Cancel</Button>
                        <Button size="sm" onClick={saveLabels}>Save labels</Button>
                      </div>
                    </div>
                  ) : null}

                  {actionPanel === 'dates' ? (
                    <div className="space-y-3">
                      <Label>Due date</Label>
                      <Input type="date" value={dateDraft} onChange={(event) => setDateDraft(event.target.value)} />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setActionPanel(null)}>Cancel</Button>
                        <Button size="sm" onClick={saveDate}>Save date</Button>
                      </div>
                    </div>
                  ) : null}

                  {actionPanel === 'attachment' ? (
                    <div className="space-y-3">
                      <Label>Attachment</Label>
                      <input
                        ref={attachmentInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(event) => handleAttachmentInput(event.target.files)}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" onClick={() => attachmentInputRef.current?.click()}>
                          <Paperclip className="mr-2 h-4 w-4" />
                          Choose files
                        </Button>
                        <span className="text-sm text-muted-foreground">Selected files are recorded in task activity.</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Description
                  </h3>
                  {editingDescription ? (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditingDescription(false)}>Cancel</Button>
                      <Button size="sm" onClick={saveDescription}>Save</Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setEditingDescription(true)}>Edit</Button>
                  )}
                </div>
                {editingDescription ? (
                  <Textarea value={descriptionDraft} onChange={(event) => setDescriptionDraft(event.target.value)} className="min-h-[120px]" />
                ) : (
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
                    {task.description || 'No description yet.'}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  Attachments
                </h3>
                <div className="space-y-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  {(task.attachments ?? []).map((attachment) => (
                    <div key={attachment.id} className="flex items-center gap-3 rounded-md bg-background p-3">
                      {attachment.type.startsWith('image/') ? <Image className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-foreground">{attachment.name}</div>
                        <div className="text-xs">{formatFileSize(attachment.size)}</div>
                      </div>
                      <Button variant="outline" size="sm" disabled={!attachment.download_url} asChild={Boolean(attachment.download_url)}>
                        {attachment.download_url ? (
                          <a href={attachment.download_url} download={attachment.name}>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </a>
                        ) : (
                          <span>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </span>
                        )}
                      </Button>
                    </div>
                  ))}
                  {(task.attachments ?? []).length === 0 ? <div>No attachments yet.</div> : null}
                </div>
              </section>
            </div>
          </ScrollArea>

          <aside className="min-h-0 border-t bg-muted/20 lg:border-l lg:border-t-0">
            <ScrollArea className="h-full">
              <div className="space-y-5 p-5">
                <div className="grid grid-cols-2 gap-2">
                  <DetailTile label="Status" value={STATUS_LABELS[task.status]} />
                  <DetailTile label="Priority" value={PRIORITY_LABELS[task.priority]} />
                  <DetailTile label="Assignee" value={task.assignee_name || 'Unassigned'} />
                  <DetailTile label="Due" value={task.due_date || 'No date'} />
                </div>

                <div className="space-y-3 rounded-lg border bg-card p-3">
                  <h3 className="font-semibold">Update task</h3>
                  <Select value={task.status} onValueChange={(value) => onStatusChange(task, value as WorkTaskStatusV2)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleStatuses.map((item) => (
                        <SelectItem key={item} value={item}>
                          {STATUS_LABELS[item]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {canAssignTasks ? (
                    <Select value={task.assignee_id || 'unassigned'} onValueChange={(value) => onAssigneeChange(task, value === 'unassigned' ? null : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Assign" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {members.map((member) => (
                          <SelectItem key={member.user_id} value={member.user_id}>
                            {memberName(member)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>

                <div className="space-y-3 rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 font-semibold">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      Comments and activity
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => onLoadComments(task)}>
                      Load
                    </Button>
                  </div>
                  <Textarea
                    value={commentDraft}
                    onChange={(event) => onCommentDraft(event.target.value)}
                    placeholder="Write a comment..."
                    className="min-h-[78px] resize-none"
                  />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => onAddComment(task)} disabled={!commentDraft.trim()}>
                      <Send className="mr-2 h-4 w-4" />
                      Comment
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {(task.comments ?? []).map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={comment.user?.avatar_url || undefined} />
                          <AvatarFallback>{initials(comment.user?.full_name || 'U')}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-medium">{comment.user?.full_name || 'Unknown'}</span>
                            <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
                          </div>
                          <div className="mt-1 rounded-lg bg-background p-3 text-sm leading-6">{comment.content}</div>
                        </div>
                      </div>
                    ))}
                    {(task.comments ?? []).length === 0 ? (
                      <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                        No activity loaded yet.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChatMessageRow({
  message,
  currentUserId,
  onReply,
  onReact,
  onEdit,
  onDelete,
}: {
  message: WorkChatMessage;
  currentUserId?: string;
  onReply: (message: WorkChatMessage) => void;
  onReact: (message: WorkChatMessage, reaction: string) => void;
  onEdit: (message: WorkChatMessage, content: string) => void;
  onDelete: (message: WorkChatMessage) => void;
}) {
  const reactionEntries = Object.entries(message.reactions ?? {}).filter(([, userIds]) => userIds.length > 0);
  const canManageOwnMessage = currentUserId === message.user_id;
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(message.content);

  useEffect(() => {
    setEditDraft(message.content);
    setIsEditing(false);
  }, [message.content, message.id]);

  const saveEdit = () => {
    onEdit(message, editDraft);
    setIsEditing(false);
  };

  return (
    <div className="group flex gap-3 rounded-lg px-3 py-3 hover:bg-muted/40">
      <Avatar className="h-9 w-9">
        <AvatarImage src={message.user?.avatar_url || undefined} />
        <AvatarFallback>{initials(message.user?.full_name || 'U')}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium">{message.user?.full_name || 'Unknown user'}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
          </span>
          {message.is_edited ? <span className="text-xs text-muted-foreground">edited</span> : null}
        </div>
        {message.parent ? (
          <button
            type="button"
            onClick={() => onReply(message)}
            className="mt-2 block max-w-full rounded-md border-l-2 border-primary bg-muted/50 px-3 py-2 text-left text-xs"
          >
            <span className="block font-medium">{message.parent.user_full_name || 'Unknown user'}</span>
            <span className="line-clamp-2 text-muted-foreground">{message.parent.content}</span>
          </button>
        ) : null}
        {isEditing ? (
          <div className="mt-2 space-y-2">
            <Textarea
              value={editDraft}
              onChange={(event) => setEditDraft(event.target.value)}
              className="min-h-[84px] resize-none text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditDraft(message.content);
                  setIsEditing(false);
                }}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={!editDraft.trim()} onClick={saveEdit}>
                <Check className="mr-2 h-4 w-4" />
                Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">{message.content}</p>
        )}
        {message.attachments?.length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {message.attachments.map((attachment) => (
              <ChatAttachmentPreview key={attachment.path} attachment={attachment} />
            ))}
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {reactionEntries.map(([reaction, userIds]) => {
            const reacted = currentUserId ? userIds.includes(currentUserId) : false;
            return (
              <button
                key={reaction}
                type="button"
                onClick={() => onReact(message, reaction)}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-xs transition-colors',
                  reacted ? 'border-primary bg-primary/10 text-primary' : 'bg-background hover:bg-muted',
                )}
              >
                {reaction} {userIds.length}
              </button>
            );
          })}
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onReply(message)}>
            <Reply className="mr-1 h-3.5 w-3.5" />
            Reply
          </Button>
          {quickReactions.map((reaction) => (
            <Button
              key={reaction}
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-70 hover:opacity-100"
              onClick={() => onReact(message, reaction)}
            >
              <span className="text-sm">{reaction}</span>
            </Button>
          ))}
          {canManageOwnMessage ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                onClick={() => onDelete(message)}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Delete
              </Button>
            </>
          ) : null}
          <SmilePlus className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </div>
    </div>
  );
}

function ChatAttachmentPreview({ attachment }: { attachment: WorkChatAttachment }) {
  const isImage = attachment.type.startsWith('image/');
  const previewUrl = attachment.url || attachment.download_url || '';
  const downloadUrl = attachment.download_url || attachment.url || '';

  return (
    <div className="overflow-hidden rounded-md border bg-background">
      {isImage && previewUrl ? (
        <a href={previewUrl} target="_blank" rel="noreferrer">
          <img src={previewUrl} alt={attachment.name} className="h-36 w-full object-cover" />
        </a>
      ) : isImage ? (
        <div className="flex h-36 items-center justify-center bg-muted text-xs text-muted-foreground">
          Image preview unavailable
        </div>
      ) : null}
      <div className="flex items-center gap-2 p-2 text-xs">
        {isImage ? <Image className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{attachment.name}</div>
          <div className="text-muted-foreground">{formatFileSize(attachment.size)}</div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!downloadUrl} asChild={Boolean(downloadUrl)}>
          {downloadUrl ? (
            <a href={downloadUrl} download={attachment.name} aria-label={`Download ${attachment.name}`}>
              <Download className="h-4 w-4" />
            </a>
          ) : (
            <span aria-label={`Download ${attachment.name}`}>
              <Download className="h-4 w-4" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  status,
  commentDraft,
  canAssignTasks,
  selected,
  members,
  onSelect,
  onStatusChange,
  onAssigneeChange,
  onLoadComments,
  onCommentDraft,
  onAddComment,
}: {
  task: ProjectTaskWithComments;
  status: WorkTaskStatusV2;
  commentDraft: string;
  canAssignTasks: boolean;
  selected?: boolean;
  members: WorkTeamMember[];
  onSelect?: () => void;
  onStatusChange: (task: ProjectTask, status: WorkTaskStatusV2) => void;
  onAssigneeChange: (task: ProjectTask, assigneeId: string | null) => void;
  onLoadComments: (task: ProjectTaskWithComments) => void;
  onCommentDraft: (value: string) => void;
  onAddComment: (task: ProjectTask) => void;
}) {
  return (
    <Card
      className={cn(
        'rounded-lg border bg-card shadow-sm transition-all hover:shadow-md',
        selected ? 'border-primary ring-2 ring-primary/15' : null,
      )}
      onClick={onSelect}
    >
      <CardContent className="space-y-3 p-3">
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 text-sm font-semibold leading-5">{task.title}</h3>
            {status === 'done' ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" /> : null}
          </div>
          {task.description ? <p className="line-clamp-2 text-xs text-muted-foreground">{task.description}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1 rounded-md border px-2 py-1" style={{ color: PRIORITY_COLORS[task.priority] }}>
            <Flag className="h-3 w-3" />
            {PRIORITY_LABELS[task.priority]}
          </span>
          {task.due_date ? (
            <span className="flex items-center gap-1 rounded-md border px-2 py-1 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {task.due_date}
            </span>
          ) : null}
          {task.assignee_name ? <Badge variant="outline">{task.assignee_name}</Badge> : null}
        </div>
        <div className="grid gap-2">
          <Select value={status} onValueChange={(value) => onStatusChange(task, value as WorkTaskStatusV2)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {visibleStatuses.map((item) => (
                <SelectItem key={item} value={item}>
                  {STATUS_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        {canAssignTasks ? (
          <Select
            value={task.assignee_id || 'unassigned'}
            onValueChange={(value) => onAssigneeChange(task, value === 'unassigned' ? null : value)}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Assign" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {members.map((member) => (
                <SelectItem key={member.user_id} value={member.user_id}>
                  {memberName(member)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        </div>
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => onLoadComments(task)}>
            <MessageSquare className="mr-1 h-3 w-3" />
            {task.comments ? 'Refresh comments' : `Comments (${task.comment_count})`}
          </Button>
          {task.comments ? (
            <div className="space-y-2">
              {task.comments.map((comment) => (
                <div key={comment.id} className="rounded bg-muted p-2 text-xs">
                  <div className="font-medium">{comment.user?.full_name || 'Unknown'}</div>
                  <div className="whitespace-pre-wrap text-muted-foreground">{comment.content}</div>
                </div>
              ))}
              <div className="flex gap-1">
                <Input value={commentDraft} onChange={(event) => onCommentDraft(event.target.value)} placeholder="Respond" className="h-8 text-xs" />
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => onAddComment(task)}>
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function RoleSelect({ value, onChange }: { value: WorkTeamRole; onChange: (role: WorkTeamRole) => void }) {
  return (
    <Select value={value} onValueChange={(role) => onChange(role as WorkTeamRole)}>
      <SelectTrigger className="w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="owner">Owner</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="team_lead">Team Lead</SelectItem>
        <SelectItem value="project_manager">Project Manager</SelectItem>
        <SelectItem value="member">Member</SelectItem>
        <SelectItem value="guest">Guest</SelectItem>
      </SelectContent>
    </Select>
  );
}

function statusTextColor(status: WorkTaskStatusV2) {
  const colors: Record<WorkTaskStatusV2, string> = {
    backlog: 'text-slate-500',
    todo: 'text-blue-500',
    in_progress: 'text-amber-500',
    review: 'text-violet-500',
    done: 'text-emerald-500',
    cancelled: 'text-slate-400',
  };
  return colors[status];
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function emptyTaskColumns(): Record<WorkTaskStatusV2, ProjectTaskWithComments[]> {
  return {
    backlog: [],
    todo: [],
    in_progress: [],
    review: [],
    done: [],
    cancelled: [],
  };
}

function moveTask(
  columns: Record<WorkTaskStatusV2, ProjectTaskWithComments[]>,
  task: ProjectTask,
  status: WorkTaskStatusV2,
) {
  const next = emptyTaskColumns();
  TASK_STATUSES.forEach((columnStatus) => {
    next[columnStatus] = columns[columnStatus]
      .filter((item) => item.id !== task.id)
      .map((item) => ({ ...item }));
  });
  next[status].push({ ...task, status });
  return next;
}

function patchTask(
  columns: Record<WorkTaskStatusV2, ProjectTaskWithComments[]>,
  taskId: string,
  patch: Partial<ProjectTaskWithComments>,
) {
  const next = emptyTaskColumns();
  TASK_STATUSES.forEach((status) => {
    next[status] = columns[status].map((task) => (task.id === taskId ? { ...task, ...patch } : task));
  });
  return next;
}

function findTask(columns: Record<WorkTaskStatusV2, ProjectTaskWithComments[]>, taskId: string) {
  for (const status of TASK_STATUSES) {
    const task = columns[status].find((item) => item.id === taskId);
    if (task) return task;
  }
  return undefined;
}

function memberName(member: WorkTeamMember | undefined) {
  return member?.profile?.full_name || member?.profile?.email || member?.user_id || 'Unknown user';
}

function memberDesignation(member: WorkTeamMember) {
  return member.profile?.designation?.trim() || roleLabel(member.role);
}

function roleLabel(role: WorkTeamRole) {
  const labels: Record<WorkTeamRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    team_lead: 'Team Lead',
    project_manager: 'Project Manager',
    member: 'Member',
    guest: 'Guest',
  };
  return labels[role];
}

function toggleReaction(reactions: Record<string, string[]>, reaction: string, userId: string) {
  const next = Object.fromEntries(
    Object.entries(reactions).map(([key, value]) => [key, [...value]]),
  ) as Record<string, string[]>;
  const users = new Set(next[reaction] ?? []);
  if (users.has(userId)) {
    users.delete(userId);
  } else {
    users.add(userId);
  }

  if (users.size === 0) {
    delete next[reaction];
  } else {
    next[reaction] = Array.from(users);
  }

  return next;
}

function filterChatMessages(messages: WorkChatMessage[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return messages;

  return messages.filter((message) => {
    const searchable = [
      message.content,
      message.user?.full_name,
      message.parent?.content,
      message.parent?.user_full_name,
      ...(message.attachments ?? []).map((attachment) => attachment.name),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchable.includes(normalized);
  });
}

function attachmentFallbackText(attachments: WorkChatAttachment[]) {
  if (attachments.length === 0) return '';
  if (attachments.length === 1) return `Shared ${attachments[0].name}`;
  return `Shared ${attachments.length} files`;
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export default WorkspaceModule;


