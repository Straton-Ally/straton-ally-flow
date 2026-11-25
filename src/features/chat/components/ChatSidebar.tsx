import { useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Compass, Hash, Lock, Plus, Search, SquarePen } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useDirectory, useMyChannels } from '../api';
import { channelLabel } from '../format';
import type { ChannelSummary } from '../types';
import { openChatDialog } from './dialogs';
import { PersonAvatar } from './PersonAvatar';

export default function ChatSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { data: channels = [], isLoading } = useMyChannels();
  const { byId } = useDirectory();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const { starred, rooms, dms } = useMemo(() => {
    const byName = (a: ChannelSummary, b: ChannelSummary) => (a.name ?? '').localeCompare(b.name ?? '');
    const byRecent = (a: ChannelSummary, b: ChannelSummary) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? '');
    return {
      starred: channels.filter((c) => c.starred).sort(byName),
      rooms: channels.filter((c) => !c.starred && c.kind !== 'dm').sort(byName),
      dms: channels.filter((c) => !c.starred && c.kind === 'dm').sort(byRecent),
    };
  }, [channels]);

  // The sidebar lives in the shell, outside the /chat/:channelId route.
  const activeId = pathname.split('/')[2];

  const section = (id: string, label: string, items: ChannelSummary[], action?: ReactNode) => (
    <div className="mt-3">
      <div className="group flex h-7 items-center px-2">
        <button
          type="button"
          onClick={() => setCollapsed((c) => ({ ...c, [id]: !c[id] }))}
          aria-expanded={!collapsed[id]}
          className="flex items-center gap-1 rounded text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={cn('h-3 w-3 transition-transform', collapsed[id] && '-rotate-90')} aria-hidden />
          {label}
        </button>
        <div className="ml-auto">{action}</div>
      </div>
      {!collapsed[id] ? (
        <ul>
          {items.map((channel) => (
            <li key={channel.id}>
              <ChannelRow channel={channel} active={channel.id === activeId} label={channelLabel(channel, byId, user?.id)} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );

  return (
    <nav aria-label="Channels" className="px-2 pb-4 pt-2">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => openChatDialog('search')}
          className="flex h-8 flex-1 items-center gap-2 rounded-md border border-sidebar-border bg-background px-2 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          Search messages
        </button>
        <button
          type="button"
          onClick={() => openChatDialog('new-dm')}
          aria-label="New message"
          title="New message"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-sidebar-border bg-background text-muted-foreground hover:text-foreground"
        >
          <SquarePen className="h-3.5 w-3.5" />
        </button>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-2 px-2" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-muted" style={{ width: `${60 + ((i * 13) % 35)}%` }} />
          ))}
        </div>
      ) : (
        <>
          {starred.length > 0 ? section('starred', 'Starred', starred) : null}
          {section(
            'channels',
            'Channels',
            rooms,
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Add channel"
                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => openChatDialog('new-channel')}>
                  <Plus className="mr-2 h-4 w-4" /> Create channel
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openChatDialog('browse')}>
                  <Compass className="mr-2 h-4 w-4" /> Browse channels
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>,
          )}
          {section(
            'dms',
            'Direct messages',
            dms,
            <button
              type="button"
              aria-label="New direct message"
              onClick={() => openChatDialog('new-dm')}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>,
          )}
          {dms.length === 0 && !collapsed.dms ? (
            <button
              type="button"
              onClick={() => openChatDialog('new-dm')}
              className="mt-0.5 h-8 w-full rounded-md px-2 text-left text-[13px] text-muted-foreground hover:bg-sidebar-accent/60"
            >
              Message a teammate…
            </button>
          ) : null}
        </>
      )}
    </nav>
  );
}

function ChannelRow({
  channel,
  active,
  label,
  onNavigate,
}: {
  channel: ChannelSummary;
  active: boolean;
  label: string;
  onNavigate?: () => void;
}) {
  const { user } = useAuth();
  const { byId } = useDirectory();
  const unread = channel.unread_count > 0 && !active;
  const otherIds = (channel.dm_user_ids ?? []).filter((id) => id !== user?.id);

  return (
    <Link
      to={`/chat/${channel.id}`}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-8 items-center gap-2 rounded-md px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'sidebar-item-active' : 'text-sidebar-foreground hover:bg-sidebar-accent/60',
        channel.muted && !active && 'opacity-60',
      )}
    >
      {channel.kind === 'dm' ? (
        otherIds.length === 1 ? (
          <PersonAvatar person={byId.get(otherIds[0])} className="h-5 w-5 rounded" />
        ) : (
          <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">
            {otherIds.length}
          </span>
        )
      ) : channel.kind === 'private' ? (
        <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      ) : (
        <Hash className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <span className={cn('min-w-0 flex-1 truncate', unread && 'font-semibold text-foreground')}>{label}</span>
      {channel.mention_count > 0 && !active ? (
        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {channel.mention_count > 9 ? '9+' : channel.mention_count}
        </span>
      ) : unread && channel.kind === 'dm' ? (
        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {channel.unread_count > 9 ? '9+' : channel.unread_count}
        </span>
      ) : null}
    </Link>
  );
}
