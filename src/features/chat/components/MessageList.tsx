import { Fragment, useEffect, useMemo, useRef } from 'react';
import { Hash, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useChannelMessages } from '../api';
import { dayLabel } from '../format';
import type { ChatMessage, DirectoryPerson } from '../types';
import { MessageItem } from './MessageItem';

const GROUP_WINDOW_MS = 5 * 60_000;

export function shouldGroup(prev: ChatMessage | undefined, msg: ChatMessage) {
  if (!prev) return false;
  if (prev.user_id !== msg.user_id || prev.author_kind !== msg.author_kind) return false;
  if (prev.reply_count > 0 || prev.deleted_at) return false;
  if (new Date(prev.created_at).toDateString() !== new Date(msg.created_at).toDateString()) return false;
  return new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_WINDOW_MS;
}

interface MessageListProps {
  channelId: string;
  channelTitle: string;
  intro: string;
  byId: Map<string, DirectoryPerson>;
  people: DirectoryPerson[];
  canReact: boolean;
  /** Messages newer than this (from others) get a "New" divider. Captured on open. */
  lastReadAt: string | null;
  onOpenThread: (message: ChatMessage) => void;
  highlightId?: string;
}

export function MessageList({
  channelId,
  channelTitle,
  intro,
  byId,
  people,
  canReact,
  lastReadAt,
  onOpenThread,
  highlightId,
}: MessageListProps) {
  const { user } = useAuth();
  const query = useChannelMessages(channelId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // pages are newest -> oldest; render oldest -> newest
  const messages = useMemo(() => (query.data?.pages.flat() ?? []).slice().reverse(), [query.data]);

  const firstUnreadId = useMemo(() => {
    if (!lastReadAt) return undefined;
    return messages.find((m) => m.created_at > lastReadAt && m.user_id !== user?.id && !m.pending)?.id;
  }, [messages, lastReadAt, user?.id]);

  // Load older pages when the top sentinel scrolls into view.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    const el = topRef.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { root: scrollRef.current, rootMargin: '400px 0px 0px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Jump to a linked message once it is loaded.
  useEffect(() => {
    if (!highlightId) return;
    document.getElementById(`m-${highlightId}`)?.scrollIntoView({ block: 'center' });
  }, [highlightId, messages.length]);

  if (query.isLoading) {
    return (
      <div className="flex flex-1 flex-col justify-end gap-4 p-4" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-[13px] text-muted-foreground">
        Couldn't load messages. {query.error instanceof Error ? query.error.message : ''}
      </div>
    );
  }

  return (
    // column-reverse keeps the view pinned to the newest message and
    // preserves the scroll position when older pages are prepended.
    <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto" role="log" aria-live="polite" aria-label={`Messages in ${channelTitle}`}>
      <div className="pb-2">
        <div ref={topRef} />
        {hasNextPage ? (
          <div className="flex justify-center py-3 text-muted-foreground">
            {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Loading older messages" /> : null}
          </div>
        ) : (
          <div className="px-4 pb-4 pt-10">
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Hash className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="text-[18px] font-semibold">{channelTitle}</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">{intro}</p>
          </div>
        )}

        {messages.map((message, index) => {
          const prev = messages[index - 1];
          const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(message.created_at).toDateString();
          const isFirstUnread = message.id === firstUnreadId;
          return (
            <Fragment key={message.id}>
              {newDay ? (
                <div className="relative my-3 flex items-center px-4" role="separator">
                  <div className="h-px flex-1 bg-border" />
                  <span className="mx-3 rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {dayLabel(message.created_at)}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              ) : null}
              {isFirstUnread ? (
                <div className="my-1 flex items-center px-4" role="separator" aria-label="New messages">
                  <div className="h-px flex-1 bg-destructive/50" />
                  <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-destructive">New</span>
                </div>
              ) : null}
              <MessageItem
                message={message}
                compact={!newDay && !isFirstUnread && shouldGroup(prev, message)}
                byId={byId}
                people={people}
                canReact={canReact}
                onOpenThread={onOpenThread}
                highlighted={message.id === highlightId}
              />
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
