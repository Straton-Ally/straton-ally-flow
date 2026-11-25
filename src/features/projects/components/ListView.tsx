import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PersonAvatar } from '@/features/chat/components/PersonAvatar';
import type { DirectoryPerson } from '@/features/chat/types';
import type { Label, ProjectStatus, Task } from '../types';
import { DueChip, LabelChip, PriorityIcon, StatusIcon } from './bits';

interface ListViewProps {
  projectKey: string;
  statuses: ProjectStatus[];
  tasks: Task[];
  labelsById: Map<string, Label>;
  peopleById: Map<string, DirectoryPerson>;
  onOpenTask: (task: Task) => void;
}

/** Tasks grouped by status, Linear-style dense rows. */
export function ListView({ projectKey, statuses, tasks, labelsById, peopleById, onOpenTask }: ListViewProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <div className="h-full overflow-y-auto pb-8">
      {statuses.map((status) => {
        const rows = tasks.filter((t) => t.status_id === status.id).sort((a, b) => a.position - b.position);
        const done = status.category === 'done';
        return (
          <section key={status.id} aria-label={status.name}>
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [status.id]: !c[status.id] }))}
              aria-expanded={!collapsed[status.id]}
              className="sticky top-0 z-10 flex h-9 w-full items-center gap-2 border-b border-border bg-muted/60 px-4 text-left backdrop-blur"
            >
              <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', collapsed[status.id] && '-rotate-90')} aria-hidden />
              <StatusIcon category={status.category} name={status.name} />
              <span className="text-[13px] font-semibold">{status.name}</span>
              <span className="text-[12px] tabular-nums text-muted-foreground">{rows.length}</span>
            </button>
            {!collapsed[status.id] ? (
              <ul>
                {rows.map((task) => {
                  const assignee = task.assignee_id ? peopleById.get(task.assignee_id) : undefined;
                  const labels = task.task_labels.map((l) => labelsById.get(l.label_id)).filter((l): l is Label => Boolean(l));
                  return (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => onOpenTask(task)}
                        className="flex h-10 w-full items-center gap-3 border-b border-border/60 px-4 text-left hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                      >
                        <PriorityIcon priority={task.priority} />
                        <span className="w-16 shrink-0 text-[12px] tabular-nums text-muted-foreground">
                          {projectKey}-{task.number}
                        </span>
                        <StatusIcon category={status.category} name={status.name} />
                        <span className={cn('min-w-0 flex-1 truncate text-[13px]', done && 'text-muted-foreground')}>{task.title}</span>
                        <span className="hidden items-center gap-1 md:flex">
                          {labels.slice(0, 3).map((l) => (
                            <LabelChip key={l.id} label={l} />
                          ))}
                        </span>
                        <DueChip due={task.due_date} done={done} className="w-20 shrink-0 justify-end" />
                        <span className="w-6 shrink-0">
                          {assignee ? <PersonAvatar person={assignee} className="h-6 w-6 rounded-full" /> : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {rows.length === 0 ? <li className="px-4 py-2.5 text-[12px] text-muted-foreground">No tasks</li> : null}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
