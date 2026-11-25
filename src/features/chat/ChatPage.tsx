import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Bell, BellOff, Hash, Link2, Lock, LogOut, Megaphone, MoreHorizontal, Search, Star, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  useChannel,
  useChannelMembers,
  useDirectory,
  useJoinChannel,
  useLeaveChannel,
  useMarkRead,
  useMyChannels,
  useSendMessage,
  useUpdateMembership,
  chatKeys,
} from './api';
import { channelLabel } from './format';
import type { ChannelSummary, ChatMessage } from './types';
import { useChatRealtime } from './useChatRealtime';
import { Composer } from './components/Composer';
import { AddMembersDialog, ChatDialogsHost, openChatDialog } from './components/dialogs';
import { MessageList } from './components/MessageList';
import { PersonAvatar } from './components/PersonAvatar';
import { ThreadPane } from './components/ThreadPane';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export default function ChatPage() {
  useChatRealtime();
  const { channelId } = useParams();
  const { data: channels, isLoading } = useMyChannels();
  const joiningDefaults = useEnsureDefaultChannels(channels);

  if (!channelId) {
    if (isLoading || joiningDefaults) return <div className="h-full" />;
    const fallback = channels?.find((c) => c.is_default && c.name === 'general') ?? channels?.[0];
    if (fallback) return <Navigate to={`/chat/${fallback.id}`} replace />;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <ChatDialogsHost />
        <p className="text-[14px] font-medium">You're not in any channels yet</p>
        <Button size="sm" onClick={() => openChatDialog('browse')}>
          Browse channels
        </Button>
      </div>
    );
  }

  return (
    <>
      <ChatDialogsHost />
      <ChannelView key={channelId} channelId={channelId} />
    </>
  );
}

/**
 * Everyone belongs in the company-wide default channels. New employees are
 * added by a database trigger; this covers accounts without an employee
 * record (e.g. admins) by self-joining the public defaults once.
 */
function useEnsureDefaultChannels(channels: ChannelSummary[] | undefined) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<'idle' | 'running' | 'done'>('idle');
  useEffect(() => {
    if (!channels || state !== 'idle') return;
    setState('running');
    void (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const { data } = await db.from('channels').select('id').eq('is_default', true).eq('kind', 'public');
        const joined = new Set(channels.map((c) => c.id));
        const missing = ((data ?? []) as { id: string }[]).filter((c) => !joined.has(c.id));
        if (missing.length > 0 && auth.user) {
          await db.from('channel_members').insert(missing.map((c) => ({ channel_id: c.id, user_id: auth.user!.id })));
          await queryClient.invalidateQueries({ queryKey: chatKeys.channels() });
        }
      } finally {
        setState('done');
      }
    })();
  }, [channels, state, queryClient]);
  return state === 'running';
}

function ChannelView({ channelId }: { channelId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const threadId = searchParams.get('thread') ?? undefined;
  const highlightId = location.hash.startsWith('#m-') ? location.hash.slice(3) : undefined;

  const { data: channels } = useMyChannels();
  const summary = channels?.find((c) => c.id === channelId);
  const channelQuery = useChannel(summary ? undefined : channelId); // only for channels you haven't joined
  const membersQuery = useChannelMembers(channelId);
  const { people, byId } = useDirectory();
  const send = useSendMessage();
  const markRead = useMarkRead();
  const join = useJoinChannel();
  const leave = useLeaveChannel();
  const updateMembership = useUpdateMembership();
  const [addOpen, setAddOpen] = useState(false);

  const meta = summary ?? channelQuery.data;
  const isMember = Boolean(summary);
  const isPrivileged = user?.accessRole === 'admin' || user?.accessRole === 'manager';
  const canPost = isMember && (meta?.posting_policy !== 'managers' || isPrivileged);
  const isOwner = summary?.role === 'owner' || user?.accessRole === 'admin';

  const memberIds = useMemo(() => (membersQuery.data ?? []).map((m) => m.user_id), [membersQuery.data]);

  // Capture where the user left off once, so the "New" divider doesn't jump while reading.
  const [lastReadAt, setLastReadAt] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (lastReadAt !== undefined || !membersQuery.data) return;
    setLastReadAt(membersQuery.data.find((m) => m.user_id === user?.id)?.last_read_at ?? null);
  }, [membersQuery.data, lastReadAt, user?.id]);

  // Mark read on open and whenever new messages land while the tab is visible.
  const markTimer = useRef<ReturnType<typeof setTimeout>>();
  const { mutate: markChannelRead } = markRead;
  const scheduleMarkRead = useCallback(() => {
    if (!isMember) return;
    clearTimeout(markTimer.current);
    markTimer.current = setTimeout(() => {
      if (document.visibilityState === 'visible') markChannelRead(channelId);
    }, 800);
  }, [channelId, isMember, markChannelRead]);

  useEffect(() => {
    scheduleMarkRead();
    return () => clearTimeout(markTimer.current);
  }, [scheduleMarkRead, summary?.last_message_at]);

  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && scheduleMarkRead();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [scheduleMarkRead]);

  const openThread = useCallback(
    (message: ChatMessage) => setSearchParams((p) => (p.set('thread', message.id), p)),
    [setSearchParams],
  );
  const closeThread = useCallback(() => setSearchParams((p) => (p.delete('thread'), p)), [setSearchParams]);

  if (!meta) {
    if (channelQuery.isLoading || !channels) return <div className="h-full" />;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-[14px] font-medium">This conversation isn't available</p>
        <p className="text-[13px] text-muted-foreground">It may be private, or it no longer exists.</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate('/chat')}>
          Back to chat
        </Button>
      </div>
    );
  }

  const title = channelLabel({ kind: meta.kind as 'public' | 'private' | 'dm', name: meta.name, dm_user_ids: summary?.dm_user_ids ?? memberIds }, byId, user?.id);
  const isDm = meta.kind === 'dm';
  const prefix = isDm ? '' : '#';
  const dmOthers = (summary?.dm_user_ids ?? memberIds).filter((id) => id !== user?.id);
  const intro = isDm
    ? `This is the beginning of your conversation with ${title}.`
    : meta.topic
      ? `This is the start of #${meta.name}. ${meta.topic}`
      : `This is the start of #${meta.name}.`;

  return (
    <div className="flex h-full min-h-0">
      <section className="flex min-w-0 flex-1 flex-col" aria-label={title}>
        {/* channel header */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          {isDm ? (
            dmOthers.length === 1 ? (
              <PersonAvatar person={byId.get(dmOthers[0])} className="h-6 w-6 rounded" />
            ) : (
              <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
            )
          ) : meta.kind === 'private' ? (
            <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
          ) : meta.posting_policy === 'managers' ? (
            <Megaphone className="h-4 w-4 text-muted-foreground" aria-hidden />
          ) : (
            <Hash className="h-4 w-4 text-muted-foreground" aria-hidden />
          )}
          <h2 className="truncate text-[14px] font-semibold">{title}</h2>
          {meta.topic ? (
            <>
              <span className="hidden h-4 w-px bg-border sm:block" />
              <p className="hidden truncate text-[13px] text-muted-foreground sm:block">{meta.topic}</p>
            </>
          ) : null}

          <div className="ml-auto flex items-center gap-0.5">
            {!isDm ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`${memberIds.length} members`}
                  >
                    <Users className="h-4 w-4" />
                    <span className="tabular-nums">{memberIds.length}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-0">
                  <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <span className="text-[13px] font-semibold">Members</span>
                    {isOwner && isMember && !meta.is_default ? (
                      <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-[12px]" onClick={() => setAddOpen(true)}>
                        <UserPlus className="h-3.5 w-3.5" /> Add people
                      </Button>
                    ) : null}
                  </div>
                  <ul className="max-h-72 overflow-y-auto p-1">
                    {(membersQuery.data ?? []).map((m) => {
                      const person = byId.get(m.user_id);
                      return (
                        <li key={m.user_id} className="flex items-center gap-2 rounded px-2 py-1.5">
                          <PersonAvatar person={person} className="h-6 w-6 rounded" />
                          <span className="min-w-0 flex-1 truncate text-[13px]">{person?.full_name ?? 'Former member'}</span>
                          {m.role === 'owner' ? <span className="text-[11px] text-muted-foreground">Owner</span> : null}
                        </li>
                      );
                    })}
                  </ul>
                </PopoverContent>
              </Popover>
            ) : null}
            {isMember ? (
              <HeaderButton
                label={summary?.starred ? 'Unstar' : 'Star'}
                onClick={() => updateMembership.mutate({ channelId, patch: { starred: !summary?.starred } })}
              >
                <Star className={cn('h-4 w-4', summary?.starred && 'fill-amber-400 text-amber-400')} />
              </HeaderButton>
            ) : null}
            <HeaderButton label="Search messages" onClick={() => openChatDialog('search')}>
              <Search className="h-4 w-4" />
            </HeaderButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Channel options"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {isMember ? (
                  <DropdownMenuItem onSelect={() => updateMembership.mutate({ channelId, patch: { muted: !summary?.muted } })}>
                    {summary?.muted ? <Bell className="mr-2 h-4 w-4" /> : <BellOff className="mr-2 h-4 w-4" />}
                    {summary?.muted ? 'Unmute' : 'Mute'}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  onSelect={() => {
                    void navigator.clipboard.writeText(`${window.location.origin}/chat/${channelId}`);
                    toast.success('Link copied');
                  }}
                >
                  <Link2 className="mr-2 h-4 w-4" /> Copy link
                </DropdownMenuItem>
                {isMember && !isDm && !meta.is_default ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={async () => {
                        if (meta.kind === 'private' && !window.confirm('Leave this private channel? You will need an invite to rejoin.')) return;
                        await leave.mutateAsync(channelId);
                        navigate('/chat');
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" /> Leave channel
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <MessageList
          channelId={channelId}
          channelTitle={`${prefix}${title}`}
          intro={intro}
          byId={byId}
          people={people}
          canReact={isMember}
          lastReadAt={lastReadAt ?? null}
          onOpenThread={openThread}
          highlightId={highlightId}
        />

        <div className="shrink-0 px-4 pb-4 pt-1">
          {canPost ? (
            <Composer
              key={channelId}
              people={people}
              placeholder={`Message ${prefix}${title}`}
              onSubmit={({ body, mentions, files }) => send.mutateAsync({ channelId, body, mentions, files })}
            />
          ) : !isMember ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
              <p className="text-[13px] text-muted-foreground">
                You're viewing <span className="font-medium text-foreground">#{meta.name}</span>
              </p>
              <Button
                size="sm"
                disabled={join.isPending}
                onClick={() => join.mutate(channelId, { onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not join') })}
              >
                Join channel
              </Button>
            </div>
          ) : (
            <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-[13px] text-muted-foreground">
              Only admins and managers can post in #{meta.name}. You can still react and read along.
            </p>
          )}
        </div>
      </section>

      {threadId ? (
        <ThreadPane
          parentId={threadId}
          channelTitle={`${prefix}${title}`}
          byId={byId}
          people={people}
          canPost={canPost}
          canReact={isMember}
          onClose={closeThread}
        />
      ) : null}

      {isOwner && !isDm ? (
        <AddMembersDialog channelId={channelId} existing={memberIds} open={addOpen} onOpenChange={setAddOpen} />
      ) : null}
    </div>
  );
}

function HeaderButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}
