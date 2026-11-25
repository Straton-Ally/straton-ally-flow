import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Hash, Lock, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import {
  useAddMembers,
  useBrowseChannels,
  useCreateChannel,
  useDirectory,
  useJoinChannel,
  useMessageSearch,
  useOpenDm,
} from '../api';
import { RichText, dayLabel, timeLabel } from '../format';
import { PersonAvatar } from './PersonAvatar';

function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/duplicate|unique/i.test(message)) return 'A channel with that name already exists.';
  return message;
}

// ---------------------------------------------------------------- people picker

export function PeoplePicker({
  selected,
  onChange,
  exclude = [],
  max,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  exclude?: string[];
  max?: number;
}) {
  const { people, byId } = useDirectory();
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return people
      .filter((p) => !exclude.includes(p.user_id))
      .filter((p) => !needle || p.full_name.toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle))
      .slice(0, 50);
  }, [people, q, exclude]);

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((s) => s !== id));
    else if (!max || selected.length < max) onChange([...selected, id]);
  };

  return (
    <div className="space-y-2">
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selected.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className="rounded-md bg-primary/10 px-2 py-0.5 text-[12px] font-medium text-primary hover:bg-primary/15"
              aria-label={`Remove ${byId.get(id)?.full_name ?? 'person'}`}
            >
              {byId.get(id)?.full_name ?? 'Unknown'} ×
            </button>
          ))}
        </div>
      ) : null}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" className="h-9 pl-8" aria-label="Search people" />
      </div>
      <div className="max-h-64 overflow-y-auto rounded-md border border-border">
        {filtered.length === 0 ? (
          <p className="p-3 text-[13px] text-muted-foreground">No one matches.</p>
        ) : (
          filtered.map((person) => {
            const active = selected.includes(person.user_id);
            return (
              <button
                key={person.user_id}
                type="button"
                onClick={() => toggle(person.user_id)}
                aria-pressed={active}
                className="flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left hover:bg-muted/60"
              >
                <PersonAvatar person={person} className="h-6 w-6 rounded" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{person.full_name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{person.designation ?? person.email}</span>
                </span>
                {active ? <Check className="h-4 w-4 text-primary" aria-hidden /> : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- new channel

export function NewChannelDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const create = useCreateChannel();
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [members, setMembers] = useState<string[]>([]);

  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-_]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);

  const reset = () => {
    setName('');
    setTopic('');
    setIsPrivate(false);
    setMembers([]);
  };

  const submit = async () => {
    if (!slug) return;
    try {
      const id = await create.mutateAsync({ name: slug, topic: topic.trim(), kind: isPrivate ? 'private' : 'public', memberIds: members });
      onOpenChange(false);
      reset();
      navigate(`/chat/${id}`);
    } catch (error) {
      toast.error(errorText(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), !o && reset())}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Create a channel</DialogTitle>
          <DialogDescription>Channels are where a team talks about a topic. Keep names short and lowercase.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="channel-name">Name</Label>
            <div className="relative">
              {isPrivate ? (
                <Lock className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              ) : (
                <Hash className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              )}
              <Input id="channel-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. marketing" className="pl-8" />
            </div>
            {name && slug !== name ? <p className="text-[12px] text-muted-foreground">Will be created as #{slug}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="channel-topic">
              Topic <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id="channel-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What is this channel about?" />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label htmlFor="channel-private" className="text-[13px]">
                Make private
              </Label>
              <p className="text-[12px] text-muted-foreground">Only invited people can see or join it.</p>
            </div>
            <Switch id="channel-private" checked={isPrivate} onCheckedChange={setIsPrivate} />
          </div>
          {isPrivate ? (
            <div className="space-y-1.5">
              <Label>Add people</Label>
              <PeoplePicker selected={members} onChange={setMembers} exclude={user ? [user.id] : []} />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!slug || create.isPending}>
              {create.isPending ? 'Creating…' : 'Create channel'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- browse

export function BrowseChannelsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const { data = [], isLoading } = useBrowseChannels(open);
  const join = useJoinChannel();
  const [q, setQ] = useState('');
  const filtered = data.filter((c) => !q || c.name.includes(q.toLowerCase()) || c.topic?.toLowerCase().includes(q.toLowerCase()));

  const go = (id: string) => {
    onOpenChange(false);
    navigate(`/chat/${id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Browse channels</DialogTitle>
          <DialogDescription>Public channels anyone in the company can join.</DialogDescription>
        </DialogHeader>
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search channels" aria-label="Search channels" />
        <div className="max-h-[50vh] divide-y divide-border overflow-y-auto rounded-md border border-border">
          {isLoading ? (
            <p className="p-3 text-[13px] text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="p-3 text-[13px] text-muted-foreground">No channels found.</p>
          ) : (
            filtered.map((channel) => (
              <div key={channel.id} className="flex items-center gap-3 px-3 py-2.5">
                <button type="button" onClick={() => go(channel.id)} className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-1 text-[13px] font-medium">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    {channel.name}
                  </span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {channel.member_count} {channel.member_count === 1 ? 'member' : 'members'}
                    {channel.topic ? ` · ${channel.topic}` : ''}
                  </span>
                </button>
                {channel.is_member ? (
                  <span className="text-[12px] text-muted-foreground">Joined</span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    disabled={join.isPending}
                    onClick={async () => {
                      try {
                        await join.mutateAsync(channel.id);
                        go(channel.id);
                      } catch (error) {
                        toast.error(errorText(error));
                      }
                    }}
                  >
                    Join
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- new DM

export function NewDmDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const openDm = useOpenDm();
  const [selected, setSelected] = useState<string[]>([]);

  const submit = async () => {
    try {
      const id = await openDm.mutateAsync(selected);
      onOpenChange(false);
      setSelected([]);
      navigate(`/chat/${id}`);
    } catch (error) {
      toast.error(errorText(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), !o && setSelected([]))}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>Start a direct conversation with up to 8 people.</DialogDescription>
        </DialogHeader>
        <PeoplePicker selected={selected} onChange={setSelected} exclude={user ? [user.id] : []} max={8} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={selected.length === 0 || openDm.isPending} onClick={() => void submit()}>
            Open conversation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- add members

export function AddMembersDialog({
  channelId,
  existing,
  open,
  onOpenChange,
}: {
  channelId: string;
  existing: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const add = useAddMembers();
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), !o && setSelected([]))}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Add people</DialogTitle>
          <DialogDescription>They will see the channel's full history.</DialogDescription>
        </DialogHeader>
        <PeoplePicker selected={selected} onChange={setSelected} exclude={existing} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={selected.length === 0 || add.isPending}
            onClick={async () => {
              try {
                await add.mutateAsync({ channelId, userIds: selected });
                toast.success(selected.length === 1 ? 'Added 1 person' : `Added ${selected.length} people`);
                setSelected([]);
                onOpenChange(false);
              } catch (error) {
                toast.error(errorText(error));
              }
            }}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- search

export function SearchMessagesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { byId } = useDirectory();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const { data = [], isFetching } = useMessageSearch(debounced);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[15%] translate-y-0 gap-0 p-0 sm:max-w-[600px]">
        <DialogTitle className="sr-only">Search messages</DialogTitle>
        <DialogDescription className="sr-only">Search every channel and conversation you can read.</DialogDescription>
        <div className="relative border-b border-border">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search messages"
            aria-label="Search messages"
            className="h-12 w-full bg-transparent pl-10 pr-4 text-[14px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-1.5">
          {debounced.trim().length < 2 ? (
            <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">Type at least two characters.</p>
          ) : isFetching && data.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">Searching…</p>
          ) : data.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">No messages found.</p>
          ) : (
            data.map((hit) => {
              const author = hit.user_id ? byId.get(hit.user_id) : undefined;
              const where = hit.channel_kind === 'dm' ? 'Direct message' : `#${hit.channel_name}`;
              return (
                <button
                  key={hit.id}
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(
                      hit.parent_id ? `/chat/${hit.channel_id}?thread=${hit.parent_id}#m-${hit.id}` : `/chat/${hit.channel_id}#m-${hit.id}`,
                    );
                  }}
                  className={cn('flex w-full gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-muted/60')}
                >
                  <PersonAvatar person={author} className="h-7 w-7" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2 text-[12px]">
                      <span className="font-semibold">{author?.full_name ?? 'Someone'}</span>
                      <span className="text-muted-foreground">
                        {where} · {dayLabel(hit.created_at)} {timeLabel(hit.created_at)}
                      </span>
                    </span>
                    <span className="line-clamp-2 text-[13px] text-foreground/90">
                      <RichText body={hit.body} byId={byId} meId={user?.id} />
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


// ---------------------------------------------------------------- host

export type ChatDialog = 'new-channel' | 'browse' | 'new-dm' | 'search';
const EVENT = 'flow:chat-dialog';

/** Open a chat dialog from anywhere (sidebar lives outside the chat route). */
export function openChatDialog(dialog: ChatDialog) {
  window.dispatchEvent(new CustomEvent<ChatDialog>(EVENT, { detail: dialog }));
}

export function ChatDialogsHost() {
  const [open, setOpen] = useState<ChatDialog | null>(null);
  useEffect(() => {
    const onOpen = (e: Event) => setOpen((e as CustomEvent<ChatDialog>).detail);
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, []);
  const props = (d: ChatDialog) => ({ open: open === d, onOpenChange: (o: boolean) => setOpen(o ? d : null) });
  return (
    <>
      <NewChannelDialog {...props('new-channel')} />
      <BrowseChannelsDialog {...props('browse')} />
      <NewDmDialog {...props('new-dm')} />
      <SearchMessagesDialog {...props('search')} />
    </>
  );
}
