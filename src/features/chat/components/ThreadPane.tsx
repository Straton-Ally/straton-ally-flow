import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useSendMessage, useThread } from '../api';
import type { DirectoryPerson } from '../types';
import { Composer } from './Composer';
import { MessageItem } from './MessageItem';
import { shouldGroup } from './MessageList';

interface ThreadPaneProps {
  parentId: string;
  channelTitle: string;
  byId: Map<string, DirectoryPerson>;
  people: DirectoryPerson[];
  canPost: boolean;
  canReact: boolean;
  onClose: () => void;
}

export function ThreadPane({ parentId, channelTitle, byId, people, canPost, canReact, onClose }: ThreadPaneProps) {
  const thread = useThread(parentId);
  const send = useSendMessage();
  const endRef = useRef<HTMLDivElement>(null);
  const replies = thread.data?.replies ?? [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [replies.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target instanceof HTMLTextAreaElement)) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const parent = thread.data?.parent;

  return (
    <aside
      aria-label="Thread"
      className="fixed inset-0 z-40 flex flex-col bg-background md:static md:z-auto md:w-[380px] md:shrink-0 md:border-l md:border-border"
    >
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold">Thread</h2>
          <p className="truncate text-[11px] text-muted-foreground">{channelTitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close thread"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {thread.isLoading ? (
          <p className="px-4 py-6 text-[13px] text-muted-foreground">Loading thread…</p>
        ) : !parent ? (
          <p className="px-4 py-6 text-[13px] text-muted-foreground">This thread isn't available.</p>
        ) : (
          <>
            <MessageItem message={parent} compact={false} byId={byId} people={people} canReact={canReact} />
            <div className="my-2 flex items-center gap-3 px-4">
              <span className="text-[11px] font-medium text-muted-foreground">
                {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            {replies.map((reply, index) => (
              <MessageItem
                key={reply.id}
                message={reply}
                compact={shouldGroup(replies[index - 1], reply)}
                byId={byId}
                people={people}
                canReact={canReact}
              />
            ))}
            <div ref={endRef} />
          </>
        )}
      </div>

      {parent && canPost ? (
        <div className="shrink-0 p-3 pt-0">
          <Composer
            key={parentId}
            people={people}
            placeholder="Reply…"
            onSubmit={({ body, mentions, files }) =>
              send.mutateAsync({ channelId: parent.channel_id, parentId, body, mentions, files })
            }
          />
        </div>
      ) : null}
    </aside>
  );
}
