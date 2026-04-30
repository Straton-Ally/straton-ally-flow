import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchProjects,
  createProject,
  fetchProjectTasks,
  createTask,
  updateTask,
  deleteTask,
  TASK_STATUSES,
  STATUS_LABELS,
  PRIORITY_COLORS,
  type WorkTaskStatusV2,
  type ProjectTask,
  type WorkProject,
} from '@/lib/work';
import { cn } from '@/lib/utils';
import { Plus, Loader2, MoreVertical, Trash2, Calendar, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_COLORS: Record<WorkTaskStatusV2, string> = {
  backlog: '#64748B',
  todo: '#3B82F6',
  in_progress: '#F59E0B',
  review: '#8B5CF6',
  done: '#22C55E',
  cancelled: '#94A3B8',
};

export function ProjectBoard() {
  const { teamId, projectId } = useParams();
  const { user } = useAuth();
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [tasks, setTasks] = useState<Record<WorkTaskStatusV2, ProjectTask[]>>({
    backlog: [], todo: [], in_progress: [], review: [], done: [], cancelled: [],
  });
  const [loading, setLoading] = useState(true);
  const [creatingProject, setCreatingProject] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');

  useEffect(() => {
    if (teamId) {
      loadProjects();
    }
  }, [teamId]);

  useEffect(() => {
    if (projectId) {
      loadTasks();
    }
  }, [projectId]);

  const loadProjects = async () => {
    if (!teamId) return;
    try {
      const data = await fetchProjects(teamId);
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const loadTasks = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await fetchProjectTasks(projectId);
      const grouped = TASK_STATUSES.reduce((acc, status) => {
        acc[status] = data.filter((t) => t.status === status);
        return acc;
      }, {} as Record<WorkTaskStatusV2, ProjectTask[]>);
      setTasks(grouped);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !teamId) return;
    setCreatingProject(true);
    try {
      await createProject({
        team_id: teamId,
        name: newProjectName.trim(),
      });
      setNewProjectName('');
      loadProjects();
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setCreatingProject(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !projectId) return;
    setCreatingTask(true);
    try {
      await createTask({
        project_id: projectId,
        title: newTaskTitle.trim(),
        description: newTaskDesc.trim() || null,
        priority: newTaskPriority,
        assignee_id: newTaskAssignee || null,
        created_by: user?.id,
      });
      setNewTaskTitle('');
      setNewTaskDesc('');
      loadTasks();
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setCreatingTask(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: WorkTaskStatusV2) => {
    try {
      await updateTask(taskId, { status: newStatus });
      loadTasks();
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      loadTasks();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  if (!projectId) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Projects</h2>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input
                  placeholder="Project name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button onClick={handleCreateProject} disabled={creatingProject || !newProjectName.trim()}>
                  {creatingProject && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Project
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No projects yet</p>
            <p className="text-sm">Create a project to start managing tasks</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b flex items-center justify-between">
        <h2 className="font-semibold">Tasks</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                placeholder="Task title"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
              />
              <Textarea
                placeholder="Description (optional)"
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
              />
              <Select value={newTaskPriority} onValueChange={(v) => setNewTaskPriority(v as typeof newTaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateTask} disabled={creatingTask || !newTaskTitle.trim()}>
                {creatingTask && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Task
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex gap-2 p-2 min-h-full overflow-x-auto">
          {TASK_STATUSES.filter((s) => s !== 'cancelled').map((status) => (
            <div key={status} className="w-72 flex-shrink-0">
              <div
                className="p-2 rounded-t-lg font-medium text-white text-sm"
                style={{ backgroundColor: STATUS_COLORS[status] }}
              >
                {STATUS_LABELS[status]}
                <Badge variant="secondary" className="ml-2 bg-white/20">
                  {tasks[status].length}
                </Badge>
              </div>
              <div className="border-x border-b rounded-b-lg bg-muted/30 p-2 space-y-2 min-h-[200px]">
                {tasks[status].map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDeleteTask}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function ProjectCard({ project }: { project: WorkProject }) {
  return (
    <div className="p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors">
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: project.color }}
        />
        <span className="font-medium">{project.name}</span>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  onStatusChange,
  onDelete,
}: {
  task: ProjectTask;
  onStatusChange: (id: string, status: WorkTaskStatusV2) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="p-3 rounded-lg bg-background border shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{task.title}</p>
          {task.description && (
            <p className="text-xs text-muted-foreground truncate mt-1">{task.description}</p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-red-600">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <div
          className="flex items-center gap-1 text-xs"
          style={{ color: PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] }}
        >
          <Flag className="h-3 w-3" />
          {task.priority}
        </div>
        {task.due_date && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {task.due_date}
          </div>
        )}
        {task.comment_count > 0 && (
          <Badge variant="outline" className="text-xs">
            {task.comment_count}
          </Badge>
        )}
      </div>
    </div>
  );
}

export default ProjectBoard;