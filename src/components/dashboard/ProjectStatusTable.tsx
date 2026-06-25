import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  department: string;
  progress: number;
  deadline: string;
  status: 'on-track' | 'in-progress' | 'delayed';
}

interface ProjectStatusTableProps {
  projects: Project[];
}

export function ProjectStatusTable({ projects }: ProjectStatusTableProps) {
  const getStatusBadge = (status: Project['status']) => {
    const config = {
      'on-track': { label: 'On Track', className: 'text-primary' },
      'in-progress': { label: 'In Progress', className: 'text-warning' },
      'delayed': { label: 'Delayed', className: 'text-destructive' },
    };
    return config[status];
  };

  return (
    <div className="card-elevated p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-medium text-xs">Project Status Overview</h3>
          <p className="text-[9px] text-muted-foreground mt-0.5">
            Track project completion and department responsibility
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-5 text-[9px] gap-0.5 px-1.5">
          <Plus className="h-2.5 w-2.5" />
          Add Project
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto -mx-3">
        <table className="w-full min-w-[400px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-[9px] font-medium text-muted-foreground pb-1.5 pl-3">
                Project Name
              </th>
              <th className="text-left text-[9px] font-medium text-muted-foreground pb-1.5">
                Department
              </th>
              <th className="text-left text-[9px] font-medium text-muted-foreground pb-1.5">
                Progress
              </th>
              <th className="text-left text-[9px] font-medium text-muted-foreground pb-1.5">
                Deadline
              </th>
              <th className="text-right text-[9px] font-medium text-muted-foreground pb-1.5 pr-3">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const status = getStatusBadge(project.status);
              return (
                <tr key={project.id} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5 pl-3">
                    <span className="text-[10px] font-medium">{project.name}</span>
                  </td>
                  <td className="py-1.5">
                    <span className="text-[10px] text-muted-foreground">{project.department}</span>
                  </td>
                  <td className="py-1.5">
                    <span className="text-[10px] text-muted-foreground">{project.progress}%</span>
                  </td>
                  <td className="py-1.5">
                    <span className="text-[10px] text-muted-foreground">{project.deadline}</span>
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    <span className={cn('text-[9px] font-medium flex items-center gap-0.5 justify-end', status.className)}>
                      <span className="w-1 h-1 rounded-full bg-current" />
                      {status.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
