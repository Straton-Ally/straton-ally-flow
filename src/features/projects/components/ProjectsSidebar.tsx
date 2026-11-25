import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CircleUserRound, LayoutGrid, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { useMyProjects } from '../api';
import { NewProjectDialog } from './dialogs';
import { ColorDot } from './bits';

export default function ProjectsSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const { can } = usePermissions();
  const { data: projects = [], isLoading } = useMyProjects();
  const active = projects.filter((p) => !p.archived_at);
  const myOpen = projects.reduce((n, p) => n + p.my_open_count, 0);
  const [newOpen, setNewOpen] = useState(false);

  const row = (href: string, label: string, icon: ReactNode, isActive: boolean, badge?: number) => (
    <Link
      to={href}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex h-8 items-center gap-2 rounded-md px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive ? 'sidebar-item-active' : 'text-sidebar-foreground hover:bg-sidebar-accent/60',
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge ? <span className="text-[11px] tabular-nums text-muted-foreground">{badge}</span> : null}
    </Link>
  );

  return (
    <nav aria-label="Projects" className="px-2 pb-4 pt-2">
      {row('/projects/my-tasks', 'My tasks', <CircleUserRound className="h-4 w-4 shrink-0" aria-hidden />, pathname === '/projects/my-tasks', myOpen)}
      {row('/projects', 'All projects', <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />, pathname === '/projects')}

      <div className="mt-3 flex h-7 items-center px-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Your projects</span>
        {can('projects.create') ? (
          <button
            type="button"
            aria-label="New project"
            onClick={() => setNewOpen(true)}
            className="ml-auto flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {isLoading ? (
        <div className="space-y-2 px-2 pt-1" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : active.length === 0 ? (
        <p className="px-2 py-1 text-[12px] text-muted-foreground">No projects yet</p>
      ) : (
        <ul>
          {active.map((p) => (
            <li key={p.id}>
              {row(`/projects/${p.id}`, p.name, <ColorDot color={p.color} className="mx-[3px]" />, pathname === `/projects/${p.id}`, p.my_open_count || undefined)}
            </li>
          ))}
        </ul>
      )}
      {can('projects.create') ? <NewProjectDialog open={newOpen} onOpenChange={setNewOpen} /> : null}
    </nav>
  );
}
