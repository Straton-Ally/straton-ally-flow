import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheckBig } from 'lucide-react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useMyTasks } from './api';
import type { MyTask } from './types';
import { ColorDot, DueChip, PriorityIcon, StatusIcon } from './components/bits';

function bucket(task: MyTask) {
  if (!task.due_date) return 'Later';
  const days = differenceInCalendarDays(parseISO(task.due_date), new Date());
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Today';
  if (days <= 7) return 'This week';
  return 'Later';
}

const ORDER = ['Overdue', 'Today', 'This week', 'Later'];

export default function MyTasksPage() {
  const { data: tasks = [], isLoading } = useMyTasks();
  const groups = useMemo(() => {
    const map = new Map<string, MyTask[]>();
    for (const t of tasks) map.set(bucket(t), [...(map.get(bucket(t)) ?? []), t]);
    return ORDER.filter((k) => map.has(k)).map((k) => [k, map.get(k)!] as const);
  }, [tasks]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">My tasks</h1>
          <p className="page-subtitle">Everything assigned to you that isn't done, across all projects.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-muted/60" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border px-6 py-16 text-center">
          <CircleCheckBig className="h-8 w-8 text-primary" aria-hidden />
          <p className="mt-3 text-[14px] font-medium">You're all caught up</p>
          <p className="mt-1 text-[13px] text-muted-foreground">Nothing is assigned to you right now.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([name, rows]) => (
            <section key={name} aria-label={name}>
              <h2 className={`mb-1.5 text-[12px] font-semibold uppercase tracking-wide ${name === 'Overdue' ? 'text-destructive' : 'text-muted-foreground'}`}>
                {name} <span className="font-medium">{rows.length}</span>
              </h2>
              <ul className="overflow-hidden rounded-lg border border-border bg-card">
                {rows.map((t) => (
                  <li key={t.id} className="border-b border-border/60 last:border-0">
                    <Link
                      to={`/projects/${t.project_id}?task=${t.id}`}
                      className="flex h-10 items-center gap-3 px-3 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                    >
                      <PriorityIcon priority={t.priority} />
                      <span className="w-16 shrink-0 text-[12px] tabular-nums text-muted-foreground">
                        {t.project_key}-{t.number}
                      </span>
                      <StatusIcon category={t.status_category} name={t.status_name} />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{t.title}</span>
                      <span className="hidden items-center gap-1.5 text-[12px] text-muted-foreground sm:flex">
                        <ColorDot color={t.project_color} />
                        {t.project_name}
                      </span>
                      <DueChip due={t.due_date} className="w-20 shrink-0 justify-end" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
