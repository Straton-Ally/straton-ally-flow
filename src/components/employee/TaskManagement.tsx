import { useState, useEffect } from 'react';
import { CheckSquare, Plus, Calendar, Clock, User, Tag, MoreHorizontal, Search, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchEmployeeOptions,
  fetchWorkTasks,
  toDbStatus,
  type EmployeeOption,
  type WorkTask as Task,
} from '@/lib/work-tasks';

interface TaskColumn {
  id: string;
  title: string;
  status: Task['status'];
  tasks: Task[];
}

export function TaskManagement() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    assignee: '',
    due_date: '',
    tags: [],
    project: '',
    estimated_hours: 0
  });
  const { toast } = useToast();

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const [taskRows, employeeRows] = await Promise.all([fetchWorkTasks(), fetchEmployeeOptions()]);
      setTasks(taskRows);
      setEmployeeOptions(employeeRows);
    } catch (error) {
      toast({
        title: 'Unable to load tasks',
        description: error instanceof Error ? error.message : 'Failed to fetch work tasks.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, []);

  const columns: TaskColumn[] = [
    {
      id: 'todo',
      title: 'To Do',
      status: 'todo',
      tasks: tasks.filter(task => task.status === 'todo')
    },
    {
      id: 'in_progress',
      title: 'In Progress',
      status: 'in_progress',
      tasks: tasks.filter(task => task.status === 'in_progress')
    },
    {
      id: 'review',
      title: 'Review',
      status: 'review',
      tasks: tasks.filter(task => task.status === 'review')
    },
    {
      id: 'completed',
      title: 'Completed',
      status: 'completed',
      tasks: tasks.filter(task => task.status === 'completed')
    }
  ];

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
    const matchesAssignee = filterAssignee === 'all' || task.assignee === filterAssignee;
    
    return matchesSearch && matchesPriority && matchesAssignee;
  });

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'todo':
        return 'bg-gray-100 text-gray-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'review':
        return 'bg-purple-100 text-purple-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCreateTask = () => {
    if (!newTask.title || !newTask.assignee || !newTask.due_date) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    void (async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;

        const assignee = employeeOptions.find((employee) => employee.full_name === newTask.assignee);
        const { error } = await supabase.from('work_tasks').insert({
          title: newTask.title!,
          description: newTask.description || null,
          status: toDbStatus(newTask.status as Task['status']),
          priority: newTask.priority as Task['priority'],
          assignee_id: assignee?.id ?? null,
          creator_id: authData.user?.id ?? null,
          due_date: newTask.due_date ? new Date(newTask.due_date).toISOString() : null,
          time_spent: 0,
          tags: newTask.tags || [],
        });

        if (error) throw error;

        setNewTask({
          title: '',
          description: '',
          status: 'todo',
          priority: 'medium',
          assignee: '',
          due_date: '',
          tags: [],
          project: '',
          estimated_hours: 0
        });
        setIsCreateDialogOpen(false);
        await loadTasks();

        toast({
          title: "Task Created",
          description: "Your task has been created successfully.",
        });
      } catch (error) {
        toast({
          title: 'Task not created',
          description: error instanceof Error ? error.message : 'Failed to create task.',
          variant: 'destructive',
        });
      }
    })();
  };

  const handleStatusChange = (taskId: string, newStatus: Task['status']) => {
    void (async () => {
      try {
        const { error } = await supabase
          .from('work_tasks')
          .update({ status: toDbStatus(newStatus) })
          .eq('id', taskId);

        if (error) throw error;

        setTasks(tasks.map(task => 
          task.id === taskId 
            ? { ...task, status: newStatus, updated_at: new Date().toISOString().split('T')[0] }
            : task
        ));
        
        toast({
          title: "Task Updated",
          description: `Task moved to ${newStatus.replace('_', ' ')}.`,
        });
      } catch (error) {
        toast({
          title: 'Task not updated',
          description: error instanceof Error ? error.message : 'Failed to update task.',
          variant: 'destructive',
        });
      }
    })();
  };

  const handleDeleteTask = (taskId: string) => {
    void (async () => {
      try {
        const { error } = await supabase.from('work_tasks').delete().eq('id', taskId);
        if (error) throw error;
        setTasks(tasks.filter(task => task.id !== taskId));
        toast({
          title: "Task Deleted",
          description: "The task has been deleted.",
        });
      } catch (error) {
        toast({
          title: 'Task not deleted',
          description: error instanceof Error ? error.message : 'You may not have permission to delete this task.',
          variant: 'destructive',
        });
      }
    })();
  };

  const TaskCard = ({ task }: { task: Task }) => (
    <Card className="mb-3 cursor-pointer hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-medium text-sm leading-tight">{task.title}</h4>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleDeleteTask(task.id)}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {task.description}
        </p>
        
        <div className="flex items-center gap-2 mb-3">
          <Badge className={getPriorityColor(task.priority)}>
            {task.priority}
          </Badge>
          {task.tags.map(tag => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {task.assignee}
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {task.due_date}
          </div>
        </div>
        
        {task.estimated_hours && (
          <div className="mt-2 text-xs text-muted-foreground">
            {task.actual_hours || 0}h / {task.estimated_hours}h
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Task Management</h3>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Enter task title"
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Enter task description"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={newTask.priority} onValueChange={(value) => setNewTask({ ...newTask, priority: value as Task['priority'] })}>
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
                
                <div>
                  <Label htmlFor="assignee">Assignee *</Label>
                  <Select value={newTask.assignee || ''} onValueChange={(value) => setNewTask({ ...newTask, assignee: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Assign to" />
                    </SelectTrigger>
                    <SelectContent>
                      {employeeOptions.map((employee) => (
                        <SelectItem key={employee.id} value={employee.full_name}>
                          {employee.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="due_date">Due Date *</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="estimated_hours">Est. Hours</Label>
                  <Input
                    id="estimated_hours"
                    type="number"
                    value={newTask.estimated_hours}
                    onChange={(e) => setNewTask({ ...newTask, estimated_hours: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="project">Project</Label>
                <Input
                  id="project"
                  value={newTask.project}
                  onChange={(e) => setNewTask({ ...newTask, project: e.target.value })}
                  placeholder="Project name"
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTask}>
                  Create Task
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignees</SelectItem>
            {employeeOptions.map((employee) => (
              <SelectItem key={employee.id} value={employee.full_name}>
                {employee.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <Card className="md:col-span-2 lg:col-span-4">
            <CardContent className="py-10 text-center text-muted-foreground">Loading tasks...</CardContent>
          </Card>
        ) : columns.map(column => (
          <Card key={column.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>{column.title}</span>
                <Badge variant="secondary" className="text-xs">
                  {column.tasks.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {column.tasks
                .filter(task => filteredTasks.includes(task))
                .map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
              
              {column.tasks.filter(task => filteredTasks.includes(task)).length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No tasks</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
