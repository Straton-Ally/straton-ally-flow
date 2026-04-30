import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchTask,
  fetchTaskComments,
  createTaskComment,
  updateTaskComment,
  deleteTaskComment,
  updateTask,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type WorkTaskV2,
  type WorkTaskComment,
} from '@/lib/work';
import { cn } from '@/lib/utils';
import { 
  ArrowLeft, 
  Calendar, 
  Flag, 
  Clock, 
  MessageSquare,
  Loader2,
  Trash2,
  Edit3,
  CheckCircle2,
  Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDistanceToNow, format } from 'date-fns';

export function TaskDetail() {
  const { taskId } = useParams();
  const { user } = useAuth();
  const [task, setTask] = useState<WorkTaskV2 | null>(null);
  const [comments, setComments] = useState<WorkTaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);

  useEffect(() => {
    if (taskId) {
      loadTask();
    }
  }, [taskId]);

  const loadTask = async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const [taskData, commentsData] = await Promise.all([
        fetchTask(taskId),
        fetchTaskComments(taskId),
      ]);
      setTask(taskData);
      setComments(commentsData);
    } catch (error) {
      console.error('Failed to load task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !taskId || !user) return;
    setSendingComment(true);
    try {
      await createTaskComment({
        task_id: taskId,
        user_id: user.id,
        content: newComment.trim(),
      });
      setNewComment('');
      loadTask();
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setSendingComment(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!taskId) return;
    try {
      await updateTask(taskId, { status: status as WorkTaskV2['status'] });
      loadTask();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handlePriorityChange = async (priority: string) => {
    if (!taskId) return;
    try {
      await updateTask(taskId, { priority: priority as WorkTaskV2['priority'] });
      loadTask();
    } catch (error) {
      console.error('Failed to update priority:', error);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteTaskComment(commentId);
      loadTask();
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Task not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold">{task.title}</h2>
            {task.description && (
              <p className="text-muted-foreground mt-1">{task.description}</p>
            )}
          </div>
          {task.is_completed && (
            <Badge variant="default" className="bg-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Completed
            </Badge>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Status</Label>
              <Select value={task.status} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Priority</Label>
              <Select value={task.priority} onValueChange={handlePriorityChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Due Date
              </Label>
              <Input type="date" value={task.due_date || ''} onChange={(e) => {}} />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Estimated Hours
              </Label>
              <Input type="number" value={task.estimated_hours || ''} placeholder="0" />
            </div>
          </div>

          {task.assignee && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Assignee</Label>
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  {task.assignee.avatar_url ? (
                    <AvatarImage src={task.assignee.avatar_url} />
                  ) : (
                    <AvatarFallback>
                      {task.assignee.full_name?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <span>{task.assignee.full_name}</span>
              </div>
            </div>
          )}

          <Separator />

          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Comments ({comments.length})
            </h3>

            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3 group">
                  <Avatar className="h-8 w-8">
                    {comment.user?.avatar_url ? (
                      <AvatarImage src={comment.user.avatar_url} />
                    ) : (
                      <AvatarFallback>
                        {comment.user?.full_name?.slice(0, 2).toUpperCase() || 'U'}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-sm">
                        {comment.user?.full_name || 'Unknown'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </span>
                      {comment.is_edited && (
                        <span className="text-xs text-muted-foreground">(edited)</span>
                      )}
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
                  </div>
                  {comment.user_id === user?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={() => handleDeleteComment(comment.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Textarea
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[80px]"
              />
              <Button onClick={handleAddComment} disabled={sendingComment || !newComment.trim()}>
                {sendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export default TaskDetail;