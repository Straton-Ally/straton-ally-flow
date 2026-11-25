import { forwardRef, memo, useState, type ComponentProps } from 'react';
import { Check, FileText, Link2, Plus, MessageSquareText, MoreHorizontal, Pencil, SmilePlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { useCreateTask } from '@/features/projects/api';
import { useDeleteMessage, useEditMessage, useSignedFileUrl, useToggleReaction } from '../api';
import { formatBytes, QUICK_EMOJI, RichText, timeLabel, tokensToNames } from '../format';
import type { Attachment, ChatMessage, DirectoryPerson } from '../types';
import { Composer } from './Composer';
import { PersonAvatar } from './PersonAvatar';

interface MessageItemProps {
  message: ChatMessage;
  compact: boolean;
  byId: Map<string, DirectoryPerson>;
  people: DirectoryPerson[];
  canReact: boolean;
  onOpenThread?: (message: ChatMessage) => void;
  highlighted?: boolean;
}

export const MessageItem = memo(function MessageItem({
  message,
  compact,
  byId,
  people,
  canReact,
  onOpenThread,
  highlighted,
}: MessageItemProps) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const editMessage = useEditMessage();
  const deleteMessage = useDeleteMessage();
  const toggleReaction = useToggleReaction();

  const author = message.user_id ? byId.get(message.user_id) : undefined;
  const isAssistant = message.author_kind === 'assistant';
  const authorName = isAssistant ? 'Assistant' : author?.full_name ?? 'Former member';
  const mine = message.user_id === user?.id;
  const isAdmin = user?.accessRole === 'admin';
  const deleted = Boolean(message.deleted_at);

  const reactionGroups = groupReactions(message.reactions, user?.id);

  const react = (emoji: string) => {
    if (!canReact || message.pending) return;
    const active = message.reactions.some((r) => r.emoji === emoji && r.user_id === user?.id);
    toggleReaction.mutate({ message, emoji, active });
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/chat/${message.channel_id}${message.parent_id ? `?thread=${message.parent_id}` : ''}#m-${message.id}`;
    await navigator.clipboard.writeText(url);
    toast.success('Link copied');
  };

  return (
    <div
      id={`m-${message.id}`}
      className={cn(
        'group relative flex gap-3 px-4 transition-colors hover:bg-muted/40',
        compact ? 'py-0.5' : 'pb-0.5 pt-2',
        (menuOpen || editing) && 'bg-muted/40',
        highlighted && 'bg-primary/5',
        message.pending && 'opacity-60',
      )}
    >
      <div className="w-8 shrink-0">
        {compact ? (
          <span className="invisible block pt-1 text-right text-[10px] leading-5 text-muted-foreground group-hover:visible">
            {timeLabel(message.created_at).replace(/ [AP]M$/, '')}
          </span>
        ) : (
          <PersonAvatar person={author} assistant={isAssistant} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {!compact ? (
          <div className="flex items-baseline gap-2">
            <span className="text-[14px] font-semibold leading-5">{authorName}</span>
            {isAssistant ? (
              <span className="rounded bg-primary/10 px-1 text-[10px] font-medium uppercase tracking-wide text-primary">AI</span>
            ) : null}
            <time className="text-[11px] text-muted-foreground" dateTime={message.created_at}>
              {timeLabel(message.created_at)}
            </time>
          </div>
        ) : null}

        {editing ? (
          <div className="py-1">
            <Composer
              compact
              people={people}
              allowFiles={false}
              placeholder="Edit message"
              submitLabel="Save"
              initialText={tokensToNames(message.body, byId)}
              initialPicked={message.mentions.map((id) => byId.get(id)).filter((p): p is DirectoryPerson => Boolean(p))}
              onCancel={() => setEditing(false)}
              onSubmit={async ({ body, mentions }) => {
                setEditing(false);
                if (body !== message.body) await editMessage.mutateAsync({ message, body, mentions });
              }}
            />
          </div>
        ) : deleted ? (
          <p className="text-[14px] italic leading-relaxed text-muted-foreground">This message was deleted.</p>
        ) : (
          <div className="break-words text-[14px] leading-relaxed text-foreground/90">
            <RichText body={message.body} byId={byId} meId={user?.id} />
            {message.edited_at ? <span className="ml-1 text-[11px] text-muted-foreground">(edited)</span> : null}
          </div>
        )}

        {isAssistant && !deleted ? <ProposedTasks message={message} canCreate={message.metadata?.requested_by === user?.id} /> : null}

        {!deleted && message.message_attachments.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-2">
            {message.message_attachments.map((file) => (
              <AttachmentView key={file.id} file={file} />
            ))}
          </div>
        ) : null}

        {reactionGroups.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {reactionGroups.map((group) => (
              <Tooltip key={group.emoji}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => react(group.emoji)}
                    disabled={!canReact}
                    aria-pressed={group.mine}
                    className={cn(
                      'flex h-6 items-center gap-1 rounded-full border px-2 text-[12px] transition-colors',
                      group.mine ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-background hover:border-foreground/20',
                    )}
                  >
                    <span>{group.emoji}</span>
                    <span className="font-medium tabular-nums">{group.userIds.length}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px] text-[12px]">
                  {group.userIds.map((id) => (id === user?.id ? 'You' : byId.get(id)?.full_name ?? 'Someone')).join(', ')}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        ) : null}

        {onOpenThread && message.reply_count > 0 ? (
          <button
            type="button"
            onClick={() => onOpenThread(message)}
            className="mt-1 flex items-center gap-1.5 rounded-md py-0.5 pr-2 text-[12px] font-medium text-primary hover:underline"
          >
            <MessageSquareText className="h-3.5 w-3.5" aria-hidden />
            {message.reply_count} {message.reply_count === 1 ? 'reply' : 'replies'}
            {message.last_reply_at ? (
              <span className="font-normal text-muted-foreground">Last reply {timeLabel(message.last_reply_at)}</span>
            ) : null}
          </button>
        ) : null}
      </div>

      {!editing && !deleted && !message.pending ? (
        <div
          className={cn(
            'absolute -top-3 right-4 z-10 hidden items-center rounded-md border border-border bg-popover p-0.5 shadow-sm group-hover:flex',
            menuOpen && 'flex',
          )}
        >
          {canReact ? (
            <Popover>
              <PopoverTrigger asChild>
                <ActionButton label="Add reaction">
                  <SmilePlus className="h-4 w-4" />
                </ActionButton>
              </PopoverTrigger>
              <PopoverContent side="top" align="end" className="w-auto p-1.5">
                <div className="grid grid-cols-6 gap-0.5">
                  {QUICK_EMOJI.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => react(emoji)}
                      className="flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-muted"
                      aria-label={`React with ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
          {onOpenThread && !message.parent_id ? (
            <ActionButton label="Reply in thread" onClick={() => onOpenThread(message)}>
              <MessageSquareText className="h-4 w-4" />
            </ActionButton>
          ) : null}
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <ActionButton label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </ActionButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => void copyLink()}>
                <Link2 className="mr-2 h-4 w-4" /> Copy link
              </DropdownMenuItem>
              {mine ? (
                <DropdownMenuItem onSelect={() => setEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit message
                </DropdownMenuItem>
              ) : null}
              {mine || isAdmin ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => {
                      if (window.confirm('Delete this message? This cannot be undone.')) deleteMessage.mutate(message);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete message
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </div>
  );
});


const ActionButton = forwardRef<HTMLButtonElement, { label: string } & ComponentProps<'button'>>(
  ({ label, children, ...props }, ref) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={ref}
          type="button"
          aria-label={label}
          className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          {...props}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[12px]">
        {label}
      </TooltipContent>
    </Tooltip>
  ),
);
ActionButton.displayName = 'ActionButton';

function AttachmentView({ file }: { file: Attachment }) {
  const { data: url } = useSignedFileUrl(file.storage_path);
  const isImage = file.mime_type?.startsWith('image/');
  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noreferrer noopener" className="block overflow-hidden rounded-md border border-border bg-muted">
        {url ? (
          <img src={url} alt={file.file_name} loading="lazy" className="max-h-64 max-w-[360px] object-contain" />
        ) : (
          <div className="h-32 w-48 animate-pulse" />
        )}
      </a>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      download={file.file_name}
      className="flex w-64 items-center gap-2.5 rounded-md border border-border bg-card px-3 py-2 hover:bg-muted/50"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
        <FileText className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium">{file.file_name}</span>
        <span className="block text-[11px] text-muted-foreground">{formatBytes(file.size_bytes)}</span>
      </span>
    </a>
  );
}

function groupReactions(reactions: ChatMessage['reactions'], meId?: string) {
  const map = new Map<string, string[]>();
  for (const r of reactions) map.set(r.emoji, [...(map.get(r.emoji) ?? []), r.user_id]);
  return [...map.entries()].map(([emoji, userIds]) => ({ emoji, userIds, mine: meId ? userIds.includes(meId) : false }));
}

interface ProposedTask {
  project_id: string;
  project_key: string;
  project_name: string;
  title: string;
  assignee_id: string | null;
  assignee_name: string | null;
  due_date: string | null;
  priority: 'urgent' | 'high' | 'medium' | 'low' | 'none';
}

/** Tasks the assistant suggested. Only the person who asked can create them, and it goes through RLS as them. */
function ProposedTasks({ message, canCreate }: { message: ChatMessage; canCreate: boolean }) {
  const proposals = (message.metadata?.proposed_tasks as ProposedTask[] | undefined) ?? [];
  const storageKey = `flow.assistant.created.${message.id}`;
  const [created, setCreated] = useState<Record<number, { id: string; label: string }>>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    } catch {
      return {};
    }
  });
  const createTask = useCreateTask();
  if (proposals.length === 0) return null;

  const create = async (task: ProposedTask, index: number) => {
    try {
      const row = await createTask.mutateAsync({
        projectId: task.project_id,
        title: task.title,
        assigneeId: task.assignee_id,
        dueDate: task.due_date,
        priority: task.priority,
      });
      const next = { ...created, [index]: { id: row.id, label: `${task.project_key}-${row.number}` } };
      setCreated(next);
      localStorage.setItem(storageKey, JSON.stringify(next));
      toast.success(`Created ${task.project_key}-${row.number}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create the task');
    }
  };

  return (
    <div className="mt-1.5 flex max-w-lg flex-col gap-1.5">
      {proposals.map((task, index) => {
        const done = created[index];
        return (
          <div key={index} className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{task.title}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {task.project_name}
                {task.assignee_name ? ` · ${task.assignee_name}` : ''}
                {task.due_date ? ` · due ${task.due_date}` : ''}
                {task.priority !== 'none' ? ` · ${task.priority}` : ''}
              </p>
            </div>
            {done ? (
              <Link
                to={`/projects/${task.project_id}?task=${done.id}`}
                className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-primary hover:underline"
              >
                <Check className="h-3.5 w-3.5" /> {done.label}
              </Link>
            ) : canCreate ? (
              <button
                type="button"
                disabled={createTask.isPending}
                onClick={() => void create(task, index)}
                className="flex h-7 shrink-0 items-center gap-1 rounded-md bg-primary px-2.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                <Plus className="h-3.5 w-3.5" /> Create task
              </button>
            ) : (
              <span className="shrink-0 text-[11px] text-muted-foreground">Suggested</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
