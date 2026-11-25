import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { useMyProjects } from './api';
import { ColorDot } from './components/bits';
import { NewProjectDialog } from './components/dialogs';

export default function ProjectsHome() {
  const { can } = usePermissions();
  const { data: projects = [], isLoading } = useMyProjects();
  const active = projects.filter((p) => !p.archived_at);
  const archived = projects.filter((p) => p.archived_at);
  const canCreate = can('projects.create');
  const [newOpen, setNewOpen] = useState(false);
  const openNewProject = () => setNewOpen(true);

  return (
    <div className="page">
      {canCreate ? <NewProjectDialog open={newOpen} onOpenChange={setNewOpen} /> : null}
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Boards for everything the team is working on.</p>
        </div>
        {canCreate ? (
          <Button size="sm" className="gap-1.5" onClick={openNewProject}>
            <Plus className="h-4 w-4" /> New project
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg border border-border bg-muted/40" />
          ))}
        </div>
      ) : active.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-16 text-center">
          <FolderKanban className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-[14px] font-medium">No projects yet</p>
          <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
            {canCreate
              ? 'Create a project to start a board. Add your team and move cards from To do to Done.'
              : "You haven't been added to a project. Ask your manager to add you."}
          </p>
          {canCreate ? (
            <Button size="sm" className="mt-4 gap-1.5" onClick={openNewProject}>
              <Plus className="h-4 w-4" /> New project
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((p) => {
            const total = p.open_count + p.done_count;
            const pct = total === 0 ? 0 : Math.round((p.done_count / total) * 100);
            return (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-center gap-2">
                  <ColorDot color={p.color} />
                  <span className="truncate text-[14px] font-semibold">{p.name}</span>
                  <span className="ml-auto rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{p.key}</span>
                </div>
                <p className="mt-1.5 line-clamp-2 min-h-[36px] text-[12px] text-muted-foreground">{p.description || 'No description'}</p>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted" aria-label={`${pct}% done`}>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>
                    <span className="font-medium text-foreground">{p.open_count}</span> open
                  </span>
                  {p.my_open_count > 0 ? (
                    <span>
                      <span className="font-medium text-primary">{p.my_open_count}</span> yours
                    </span>
                  ) : null}
                  <span className="ml-auto">
                    {p.member_count} {p.member_count === 1 ? 'member' : 'members'}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {archived.length > 0 ? (
        <div className="mt-8">
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Archived</h2>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {archived.map((p) => (
              <li key={p.id}>
                <Link to={`/projects/${p.id}`} className="flex items-center gap-2 px-3 py-2 text-[13px] text-muted-foreground hover:bg-muted/40">
                  <ColorDot color={p.color} />
                  {p.name}
                  <span className="ml-auto font-mono text-[11px]">{p.key}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
