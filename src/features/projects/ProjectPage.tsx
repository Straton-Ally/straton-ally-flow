import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Archive, Columns3, List, Plus, Search, Settings2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useDirectory } from '@/features/chat/api';
import { PersonAvatar } from '@/features/chat/components/PersonAvatar';
import { useCreateTask, useProject, useProjectRealtime, useProjectTasks } from './api';
import { PRIORITIES } from './lib';
import type { Priority, Task } from './types';
import { Board } from './components/Board';
import { ColorDot } from './components/bits';
import { ProjectSettingsDialog } from './components/dialogs';
import { ListView } from './components/ListView';
import { TaskDrawer } from './components/TaskDrawer';

type View = 'board' | 'list';
const VIEW_KEY = 'flow.projects.view';

export default function ProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const taskId = searchParams.get('task') ?? undefined;

  const projectQuery = useProject(projectId);
  const tasksQuery = useProjectTasks(projectId);
  useProjectRealtime(projectId);
  const { byId: peopleById } = useDirectory();

  const [view, setView] = useState<View>(() => (localStorage.getItem(VIEW_KEY) as View) || 'board');
  const [query, setQuery] = useState('');
  const [assignee, setAssignee] = useState<string>('all');
  const [priority, setPriority] = useState<Priority | 'all'>('all');
  const [label, setLabel] = useState<string>('all');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const bundle = projectQuery.data;
  const allTasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const labelsById = useMemo(() => new Map((bundle?.labels ?? []).map((l) => [l.id, l])), [bundle?.labels]);

  const myRole = bundle?.members.find((m) => m.user_id === user?.id)?.role;
  const isAdmin = user?.accessRole === 'admin';
  const isLead = isAdmin || myRole === 'lead';
  const canEdit = isAdmin || myRole === 'lead' || myRole === 'member';
  const archived = Boolean(bundle?.project.archived_at);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allTasks.filter((t) => {
      if (t.parent_id) return false;
      if (assignee === 'me' && t.assignee_id !== user?.id) return false;
      if (assignee === 'none' && t.assignee_id) return false;
      if (assignee !== 'all' && assignee !== 'me' && assignee !== 'none' && t.assignee_id !== assignee) return false;
      if (priority !== 'all' && t.priority !== priority) return false;
      if (label !== 'all' && !t.task_labels.some((l) => l.label_id === label)) return false;
      if (q && !t.title.toLowerCase().includes(q) && !`${bundle?.project.key}-${t.number}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allTasks, assignee, priority, label, query, user?.id, bundle?.project.key]);

  const openTask = useCallback((id: string) => setSearchParams((p) => (p.set('task', id), p)), [setSearchParams]);
  const closeTask = useCallback(() => setSearchParams((p) => (p.delete('task'), p)), [setSearchParams]);
  const activeTask = taskId ? allTasks.find((t) => t.id === taskId) : undefined;
  const filtersOn = query || assignee !== 'all' || priority !== 'all' || label !== 'all';

  if (projectQuery.isLoading || tasksQuery.isLoading) {
    return (
      <div className="flex h-full gap-3 p-4" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-64 w-[272px] animate-pulse rounded-lg bg-muted/60" />
        ))}
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-[14px] font-medium">This project isn't available</p>
        <p className="text-[13px] text-muted-foreground">You may not be a member, or it no longer exists.</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate('/projects')}>
          All projects
        </Button>
      </div>
    );
  }

  const { project, statuses, members } = bundle;
  const firstTodo = statuses.find((s) => s.category === 'todo' && s.name.toLowerCase() !== 'backlog') ?? statuses[0];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <ColorDot color={project.color} />
        <h2 className="truncate text-[14px] font-semibold">{project.name}</h2>
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{project.key}</span>
        {archived ? (
          <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
            <Archive className="h-3 w-3" /> Archived
          </span>
        ) : null}
        {!canEdit ? <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">View only</span> : null}

        <div className="ml-auto flex items-center gap-1">
          <div className="mr-1 hidden -space-x-1.5 md:flex" aria-label={`${members.length} members`}>
            {members.slice(0, 5).map((m) => (
              <PersonAvatar key={m.user_id} person={peopleById.get(m.user_id)} className="h-6 w-6 rounded-full ring-2 ring-background" />
            ))}
            {members.length > 5 ? (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium ring-2 ring-background">
                +{members.length - 5}
              </span>
            ) : null}
          </div>
          <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="View">
            {(['board', 'list'] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => {
                  setView(v);
                  localStorage.setItem(VIEW_KEY, v);
                }}
                className={cn(
                  'flex h-6 items-center gap-1 rounded px-2 text-[12px] font-medium',
                  view === v ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {v === 'board' ? <Columns3 className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{v === 'board' ? 'Board' : 'List'}</span>
              </button>
            ))}
          </div>
          {isLead ? (
            <button
              type="button"
              aria-label="Project settings"
              title="Project settings"
              onClick={() => setSettingsOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          ) : null}
          {canEdit && firstTodo ? (
            <NewTaskButton projectId={project.id} statusId={firstTodo.id} onCreated={openTask} />
          ) : null}
        </div>
      </div>

      {/* filters */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter tasks"
            aria-label="Filter tasks"
            className="h-7 w-44 rounded-md border border-border bg-background pl-7 pr-2 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <FilterSelect label="Assignee" value={assignee} onChange={setAssignee}>
          <SelectItem value="all">Anyone</SelectItem>
          <SelectItem value="me">Assigned to me</SelectItem>
          <SelectItem value="none">Unassigned</SelectItem>
          {members
            .filter((m) => m.role !== 'viewer')
            .map((m) => (
              <SelectItem key={m.user_id} value={m.user_id}>
                {peopleById.get(m.user_id)?.full_name ?? 'Former member'}
              </SelectItem>
            ))}
        </FilterSelect>
        <FilterSelect label="Priority" value={priority} onChange={(v) => setPriority(v as Priority | 'all')}>
          <SelectItem value="all">Any priority</SelectItem>
          {PRIORITIES.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </FilterSelect>
        {bundle.labels.length > 0 ? (
          <FilterSelect label="Label" value={label} onChange={setLabel}>
            <SelectItem value="all">Any label</SelectItem>
            {bundle.labels.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </FilterSelect>
        ) : null}
        {filtersOn ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setAssignee('all');
              setPriority('all');
              setLabel('all');
            }}
            className="flex h-7 items-center gap-1 rounded-md px-2 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        ) : null}
        <span className="ml-auto text-[12px] tabular-nums text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? 'task' : 'tasks'}
        </span>
      </div>

      <div className="min-h-0 flex-1">
        {view === 'board' ? (
          <Board
            projectId={project.id}
            projectKey={project.key}
            statuses={statuses}
            tasks={filtered}
            allTasks={allTasks}
            labelsById={labelsById}
            peopleById={peopleById}
            canEdit={canEdit && !archived}
            onOpenTask={(t: Task) => openTask(t.id)}
          />
        ) : (
          <ListView
            projectKey={project.key}
            statuses={statuses}
            tasks={filtered}
            labelsById={labelsById}
            peopleById={peopleById}
            onOpenTask={(t: Task) => openTask(t.id)}
          />
        )}
      </div>

      <TaskDrawer
        task={activeTask}
        bundle={bundle}
        allTasks={allTasks}
        peopleById={peopleById}
        canEdit={canEdit && !archived}
        isLead={isLead}
        onOpenTask={openTask}
        onClose={closeTask}
      />
      {isLead ? <ProjectSettingsDialog bundle={bundle} open={settingsOpen} onOpenChange={setSettingsOpen} /> : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        className={cn('h-7 w-auto min-w-[110px] gap-1 px-2 text-[12px]', value !== 'all' && 'border-primary/40 bg-primary/5 text-primary')}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}


function NewTaskButton({ projectId, statusId, onCreated }: { projectId: string; statusId: string; onCreated: (id: string) => void }) {
  const create = useCreateTask();
  return (
    <Button
      size="sm"
      className="h-8 gap-1.5"
      disabled={create.isPending}
      onClick={() =>
        create.mutate(
          { projectId, statusId, title: 'Untitled task' },
          { onSuccess: (task) => onCreated(task.id), onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not create task') },
        )
      }
    >
      <Plus className="h-4 w-4" />
      <span className="hidden sm:inline">New task</span>
    </Button>
  );
}
