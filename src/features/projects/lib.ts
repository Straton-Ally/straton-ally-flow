import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { Priority, ProjectRole } from './types';

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'none', label: 'No priority' },
];

export const PROJECT_COLORS = ['indigo', 'blue', 'sky', 'teal', 'green', 'amber', 'orange', 'rose', 'violet', 'slate'] as const;

/** Tailwind needs literal class names; keep the palette in one place. */
export const COLOR_DOT: Record<string, string> = {
  indigo: 'bg-indigo-500',
  blue: 'bg-blue-500',
  sky: 'bg-sky-500',
  teal: 'bg-teal-500',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  orange: 'bg-orange-500',
  rose: 'bg-rose-500',
  violet: 'bg-violet-500',
  slate: 'bg-slate-500',
};

export const LABEL_CHIP: Record<string, string> = {
  indigo: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  sky: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  teal: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
  green: 'bg-green-500/10 text-green-700 dark:text-green-300',
  amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  orange: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  rose: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  violet: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  slate: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
};

export const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

export const ROLE_LABEL: Record<ProjectRole, string> = { lead: 'Lead', member: 'Member', viewer: 'Viewer' };

/** Fractional index between two neighbours (either may be missing). */
export function positionBetween(before?: number, after?: number) {
  if (before === undefined && after === undefined) return 1024;
  if (before === undefined) return after! - 1024;
  if (after === undefined) return before + 1024;
  return (before + after) / 2;
}

/** True when two neighbouring positions are too close to bisect safely again. */
export function needsRebalance(before?: number, after?: number) {
  return before !== undefined && after !== undefined && Math.abs(after - before) < 1e-6;
}

export function suggestKey(name: string) {
  const words = name.toUpperCase().replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const key = words.length === 1 ? words[0].slice(0, 4) : words.map((w) => w[0]).join('').slice(0, 5);
  return /^[A-Z]/.test(key) ? key : `P${key}`.slice(0, 5);
}

export function dueLabel(due: string | null, done = false) {
  if (!due) return null;
  const date = parseISO(due);
  const days = differenceInCalendarDays(date, new Date());
  const text = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days === -1 ? 'Yesterday' : format(date, 'd MMM');
  const tone = done ? 'muted' : days < 0 ? 'overdue' : days <= 1 ? 'soon' : 'muted';
  return { text, tone } as const;
}
