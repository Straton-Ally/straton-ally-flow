import { memo } from 'react';
import { ListTree } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PersonAvatar } from '@/features/chat/components/PersonAvatar';
import type { DirectoryPerson } from '@/features/chat/types';
import type { Label, Task } from '../types';
import { DueChip, LabelChip, PriorityIcon } from './bits';

interface TaskCardProps {
  task: Task;
  projectKey: string;
  labelsById: Map<string, Label>;
  assignee?: DirectoryPerson;
  subtasks?: { total: number; done: number };
  done?: boolean;
  dragging?: boolean;
  overlay?: boolean;
  onOpen?: () => void;
}

export const TaskCard = memo(function TaskCard({
  task,
  projectKey,
  labelsById,
  assignee,
  subtasks,
  done,
  dragging,
  overlay,
  onOpen,
}: TaskCardProps) {
  const labels = task.task_labels.map((l) => labelsById.get(l.label_id)).filter((l): l is Label => Boolean(l));
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen?.();
      }}
      className={cn(
        'group cursor-pointer select-none rounded-md border border-border bg-card p-2.5 text-left shadow-[0_1px_0_hsl(var(--border))] outline-none transition-colors',
        'hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring',
        dragging && 'opacity-40',
        overlay && 'rotate-[1.5deg] cursor-grabbing shadow-lg',
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
          {projectKey}-{task.number}
        </span>
        <span className="ml-auto">
          {assignee ? <PersonAvatar person={assignee} className="h-5 w-5 rounded-full" /> : null}
        </span>
      </div>
      <p className={cn('mt-1 line-clamp-3 text-[13px] font-medium leading-snug', done && 'text-muted-foreground line-through decoration-muted-foreground/40')}>
        {task.title}
      </p>
      {labels.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {labels.map((label) => (
            <LabelChip key={label.id} label={label} />
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex items-center gap-2.5">
        <PriorityIcon priority={task.priority} className="h-3.5 w-3.5" />
        <DueChip due={task.due_date} done={done} />
        {subtasks && subtasks.total > 0 ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <ListTree className="h-3 w-3" aria-hidden />
            {subtasks.done}/{subtasks.total}
          </span>
        ) : null}
      </div>
    </div>
  );
});
