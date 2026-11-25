import { Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { DirectoryPerson } from '../types';

export function initialsOf(name: string | undefined | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

export function PersonAvatar({
  person,
  assistant,
  className,
}: {
  person?: DirectoryPerson;
  assistant?: boolean;
  className?: string;
}) {
  if (assistant) {
    return (
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary', className)}>
        <Sparkles className="h-4 w-4" aria-hidden />
      </span>
    );
  }
  return (
    <Avatar className={cn('h-8 w-8 shrink-0 rounded-md', className)}>
      {person?.avatar_url ? <AvatarImage src={person.avatar_url} alt="" className="object-cover" /> : null}
      <AvatarFallback className="rounded-md bg-muted text-[11px] font-medium text-muted-foreground">
        {initialsOf(person?.full_name)}
      </AvatarFallback>
    </Avatar>
  );
}
