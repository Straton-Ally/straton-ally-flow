import { AlertOctagon, Calendar, Circle, CircleCheck, CircleDashed, CircleDot, Minus, SignalHigh, SignalLow, SignalMedium } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COLOR_DOT, LABEL_CHIP, dueLabel } from '../lib';
import type { Label, Priority, StatusCategory } from '../types';

export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  const base = cn('h-4 w-4 shrink-0', className);
  switch (priority) {
    case 'urgent':
      return <AlertOctagon className={cn(base, 'text-destructive')} aria-label="Urgent" />;
    case 'high':
      return <SignalHigh className={cn(base, 'text-foreground')} aria-label="High priority" />;
    case 'medium':
      return <SignalMedium className={cn(base, 'text-foreground/80')} aria-label="Medium priority" />;
    case 'low':
      return <SignalLow className={cn(base, 'text-muted-foreground')} aria-label="Low priority" />;
    default:
      return <Minus className={cn(base, 'text-muted-foreground/60')} aria-label="No priority" />;
  }
}

export function StatusIcon({ category, name, className }: { category: StatusCategory; name?: string; className?: string }) {
  const base = cn('h-4 w-4 shrink-0', className);
  if (category === 'done') return <CircleCheck className={cn(base, 'text-primary')} aria-hidden />;
  if (category === 'doing') return <CircleDot className={cn(base, 'text-amber-500')} aria-hidden />;
  if (name?.toLowerCase() === 'backlog') return <CircleDashed className={cn(base, 'text-muted-foreground')} aria-hidden />;
  return <Circle className={cn(base, 'text-muted-foreground')} aria-hidden />;
}

export function ColorDot({ color, className }: { color: string; className?: string }) {
  return <span className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-sm', COLOR_DOT[color] ?? 'bg-slate-500', className)} aria-hidden />;
}

export function LabelChip({ label }: { label: Label }) {
  return (
    <span className={cn('inline-flex h-5 items-center rounded px-1.5 text-[11px] font-medium', LABEL_CHIP[label.color] ?? LABEL_CHIP.slate)}>
      {label.name}
    </span>
  );
}

export function DueChip({ due, done, className }: { due: string | null; done?: boolean; className?: string }) {
  const info = dueLabel(due, done);
  if (!info) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-medium',
        info.tone === 'overdue' ? 'text-destructive' : info.tone === 'soon' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
        className,
      )}
    >
      <Calendar className="h-3 w-3" aria-hidden />
      {info.text}
    </span>
  );
}
