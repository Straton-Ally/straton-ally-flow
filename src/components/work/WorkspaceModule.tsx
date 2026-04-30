import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  FileText,
  Flag,
  Image,
  Loader2,
  MessageSquare,
  Paperclip,
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
import { formatDistanceToNow } from 'date-fns';
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
  fetchChatMessages,
  fetchChatRooms,
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

const workspaceDb = supabase as any;

type ProfileOption = {
  id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
};

type ProjectTaskWithComments = ProjectTask & {
  comments?: WorkTaskComment[];
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

export function WorkspaceModule({ mode }: { mode: WorkspaceMode }) {
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
  const [activeTab, setActiveTab] = useState<'tasks' | 'members' | 'chat'>('tasks');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

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
    void loadTasks(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedRoomId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedRoomId);
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

    if (userIds.length > 0 && profiles.length === 0) {
      const freshProfiles = await fetchProfiles();
      setProfiles(freshProfiles);
      freshProfiles.forEach((profile) => profilesById.set(profile.id, profile));
    }

    return rows.map((member) => ({
      ...member,
      profile: profilesById.get(member.user_id) ?? member.profile,
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

  const handleLoadComments = async (task: ProjectTaskWithComments) => {
    if (task.comments) return;
    const comments = await fetchTaskComments(task.id);
    setTasks((current) => patchTask(current, task.id, { comments }));
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
        patchTask(current, task.id, {
          comments: [...(findTask(current, task.id)?.comments ?? []), comment],
          comment_count: task.comment_count + 1,
        }),
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

  const availableProfiles = profiles.filter((profile) => !memberIds.has(profile.id));

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workspace</h1>
          <p className="text-muted-foreground">
            Teams, roles, projects, task responses, and team chat in one place.
          </p>
        </div>
        {mode === 'admin' ? (
          <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Team
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Team</DialogTitle>
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

      {teams.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
            <Briefcase className="h-10 w-10 text-muted-foreground" />
            <div>
              <h2 className="font-semibold">No workspace teams yet</h2>
              <p className="text-sm text-muted-foreground">
                {mode === 'admin'
                  ? 'Create a team and add employees to start assigning work.'
                  : 'Ask an admin to add you to a workspace team.'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-muted-foreground" />
                Teams
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {teams.map((team) => (
                <button
                  key={team.id}
                  className={cn(
                    'w-full rounded-md border px-3 py-3 text-left transition-colors',
                    selectedTeamId === team.id ? 'border-primary bg-primary/10 shadow-sm' : 'hover:bg-muted',
                  )}
                  onClick={() => setSelectedTeamId(team.id)}
                >
                  <div className="font-medium">{team.name}</div>
                  {team.description ? <div className="line-clamp-2 text-xs text-muted-foreground">{team.description}</div> : null}
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="min-w-0 space-y-4">
            <div className="rounded-md border bg-card px-4 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold">{selectedTeam?.name}</h2>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-md border px-2 py-1">{members.length} members</span>
                    <span className="rounded-md border px-2 py-1">{projects.length} projects</span>
                    <span className="rounded-md border px-2 py-1">{totalTasks} active tasks</span>
                    {selectedUserTeam?.role ? <span className="rounded-md border px-2 py-1">Your role: {roleLabel(selectedUserTeam.role)}</span> : null}
                  </div>
                </div>
                {canManageTeam ? (
                  <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline">
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
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="space-y-4">
              <TabsList className={cn('grid w-full max-w-sm', mode === 'admin' ? 'grid-cols-3' : 'grid-cols-2')}>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                {mode === 'admin' ? <TabsTrigger value="members">Roles</TabsTrigger> : null}
                <TabsTrigger value="chat">Chat</TabsTrigger>
              </TabsList>

              <TabsContent value="tasks" className="space-y-4">
                <div className="flex flex-col gap-3 rounded-md border bg-card px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                    <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                      <SelectTrigger className="w-full sm:w-[260px]">
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {canManageTeam ? (
                      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Plus className="mr-1 h-4 w-4" />
                            Project
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
                    {selectedProject?.description ? (
                      <p className="line-clamp-1 text-sm text-muted-foreground">{selectedProject.description}</p>
                    ) : null}
                  </div>

                  {canCreateTask && selectedProjectId ? (
                    <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="mr-1 h-4 w-4" />
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
                </div>

                {!selectedProject ? (
                  <Card className="border-dashed">
                    <CardContent className="flex min-h-[300px] items-center justify-center p-8 text-center text-muted-foreground">
                      Create or select a project to start assigning tasks.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-5">
                    {visibleStatuses.map((status) => (
                      <div key={status} className="flex min-h-[420px] min-w-0 flex-col rounded-md border bg-muted/20">
                        <div className={cn('flex items-center justify-between rounded-t-md px-3 py-2 text-sm font-medium text-white', statusColors[status])}>
                          <span>{STATUS_LABELS[status]}</span>
                          <span className="rounded bg-white/20 px-1.5 text-xs">{tasks[status].length}</span>
                        </div>
                        <div className="flex flex-1 flex-col gap-2 p-2">
                          {tasks[status].length === 0 ? (
                            <div className="flex flex-1 items-center justify-center rounded-md border border-dashed bg-background/40 px-3 py-8 text-center text-xs text-muted-foreground">
                              No tasks
                            </div>
                          ) : (
                            tasks[status].map((task) => (
                              <TaskCard
                                key={task.id}
                                task={task}
                                status={status}
                              onStatusChange={handleTaskStatus}
                              canAssignTasks={canManageTasks}
                              members={members}
                              onAssigneeChange={handleTaskAssignee}
                              onLoadComments={handleLoadComments}
                                commentDraft={commentDrafts[task.id] ?? ''}
                                onCommentDraft={(value) => setCommentDrafts((current) => ({ ...current, [task.id]: value }))}
                                onAddComment={handleAddComment}
                              />
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {mode === 'admin' ? (
                <TabsContent value="members">
                  <Card>
                    <CardContent className="divide-y p-0">
                      {members.map((member) => (
                        <div key={member.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={member.profile?.avatar_url || undefined} />
                              <AvatarFallback>{initials(member.profile?.full_name || member.profile?.email || 'U')}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{member.profile?.full_name || 'Unknown user'}</div>
                              <div className="text-sm text-muted-foreground">{member.profile?.email}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {canManageTeam ? (
                              <RoleSelect value={member.role} onChange={(role) => handleRoleChange(member, role)} />
                            ) : (
                              <Badge variant="secondary">{roleLabel(member.role)}</Badge>
                            )}
                            {canManageTeam && member.user_id !== user?.id ? (
                              <Button variant="ghost" size="icon" onClick={() => handleRemoveMember(member)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>
              ) : null}

              <TabsContent value="chat">
                <div className="grid min-h-[560px] gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Rooms</CardTitle>
                        {canManageTeam ? (
                          <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Plus className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Create Chat Room</DialogTitle>
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
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {rooms.map((room) => (
                        <button
                          key={room.id}
                          onClick={() => setSelectedRoomId(room.id)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm',
                            selectedRoomId === room.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
                          )}
                        >
                          <MessageSquare className="h-4 w-4" />
                          <span className="truncate">{room.name}</span>
                        </button>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="flex h-[640px] min-h-[560px] flex-col overflow-hidden">
                    <CardHeader className="border-b py-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <CardTitle className="text-base">
                            {rooms.find((room) => room.id === selectedRoomId)?.name || 'Team chat'}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {filteredMessages.length === messages.length
                              ? `${messages.length} messages`
                              : `${filteredMessages.length} of ${messages.length} messages`}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={chatSearch}
                              onChange={(event) => setChatSearch(event.target.value)}
                              placeholder="Search messages"
                              className="h-9 w-full pl-8 sm:w-[220px]"
                            />
                          </div>
                          <Badge variant="outline" className="w-fit font-normal">
                            Team visible
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <ScrollArea className="min-h-0 flex-1 p-4">
                      <div className="space-y-4">
                        {messages.length === 0 ? (
                          <div className="flex min-h-[320px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                            Start the team conversation.
                          </div>
                        ) : filteredMessages.length === 0 ? (
                          <div className="flex min-h-[320px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
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
                            />
                          ))
                        )}
                      </div>
                    </ScrollArea>
                    <div className="border-t p-3">
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
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => setPendingFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(event) => handleAttachFiles(event.target.files)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={!selectedRoomId}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Paperclip className="h-4 w-4" />
                        </Button>
                        <Input
                          value={newMessage}
                          onChange={(event) => setNewMessage(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              void handleSendMessage();
                            }
                          }}
                          placeholder={selectedRoomId ? 'Message the team' : 'Select a room'}
                          disabled={!selectedRoomId}
                        />
                        <Button onClick={handleSendMessage} disabled={!selectedRoomId || (!newMessage.trim() && pendingFiles.length === 0)}>
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatMessageRow({
  message,
  currentUserId,
  onReply,
  onReact,
}: {
  message: WorkChatMessage;
  currentUserId?: string;
  onReply: (message: WorkChatMessage) => void;
  onReact: (message: WorkChatMessage, reaction: string) => void;
}) {
  const reactionEntries = Object.entries(message.reactions ?? {}).filter(([, userIds]) => userIds.length > 0);

  return (
    <div className="group flex gap-3 rounded-md px-2 py-2 hover:bg-muted/40">
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
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.content}</p>
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
          <SmilePlus className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </div>
    </div>
  );
}

function ChatAttachmentPreview({ attachment }: { attachment: WorkChatAttachment }) {
  const isImage = attachment.type.startsWith('image/');

  return (
    <a
      href={attachment.url ?? '#'}
      target="_blank"
      rel="noreferrer"
      className="overflow-hidden rounded-md border bg-background hover:bg-muted/50"
    >
      {isImage && attachment.url ? (
        <img src={attachment.url} alt={attachment.name} className="h-36 w-full object-cover" />
      ) : null}
      <div className="flex items-center gap-2 p-2 text-xs">
        {isImage ? <Image className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{attachment.name}</div>
          <div className="text-muted-foreground">{formatFileSize(attachment.size)}</div>
        </div>
      </div>
    </a>
  );
}

function TaskCard({
  task,
  status,
  commentDraft,
  canAssignTasks,
  members,
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
  members: WorkTeamMember[];
  onStatusChange: (task: ProjectTask, status: WorkTaskStatusV2) => void;
  onAssigneeChange: (task: ProjectTask, assigneeId: string | null) => void;
  onLoadComments: (task: ProjectTaskWithComments) => void;
  onCommentDraft: (value: string) => void;
  onAddComment: (task: ProjectTask) => void;
}) {
  return (
    <Card className="rounded-md">
      <CardContent className="space-y-3 p-3">
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 text-sm font-medium">{task.title}</h3>
            {status === 'done' ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" /> : null}
          </div>
          {task.description ? <p className="line-clamp-2 text-xs text-muted-foreground">{task.description}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1" style={{ color: PRIORITY_COLORS[task.priority] }}>
            <Flag className="h-3 w-3" />
            {PRIORITY_LABELS[task.priority]}
          </span>
          {task.due_date ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {task.due_date}
            </span>
          ) : null}
          {task.assignee_name ? <Badge variant="outline">{task.assignee_name}</Badge> : null}
        </div>
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
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onLoadComments(task)}>
            <MessageSquare className="mr-1 h-3 w-3" />
            {task.comments ? 'Hide/refresh responses' : `Responses (${task.comment_count})`}
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


