import { toast } from 'sonner';
import { useMemo } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { ChannelSummary, ChatMessage, DirectoryPerson, SearchHit } from './types';

// The generated types don't know the chat tables until they are regenerated
// after the migration is pushed; keep a narrow untyped handle here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const PAGE_SIZE = 50;

export const MESSAGE_COLUMNS =
  'id, channel_id, user_id, author_kind, parent_id, body, mentions, metadata, reply_count, last_reply_at, reactions, edited_at, deleted_at, created_at, ' +
  'message_attachments(id, file_name, mime_type, size_bytes, storage_path)';

export const chatKeys = {
  all: ['chat'] as const,
  channels: () => ['chat', 'channels'] as const,
  browse: () => ['chat', 'browse'] as const,
  directory: () => ['chat', 'directory'] as const,
  messages: (channelId: string) => ['chat', 'messages', channelId] as const,
  thread: (parentId: string) => ['chat', 'thread', parentId] as const,
  search: (q: string) => ['chat', 'search', q] as const,
  file: (path: string) => ['chat', 'file', path] as const,
};

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

// ------------------------------------------------------------------ queries

export function useDirectory() {
  const query = useQuery({
    queryKey: chatKeys.directory(),
    staleTime: 5 * 60_000,
    queryFn: async () => unwrap<DirectoryPerson[]>(await db.rpc('get_directory')) ?? [],
  });
  const byId = useMemo(() => {
    const map = new Map<string, DirectoryPerson>();
    for (const person of query.data ?? []) map.set(person.user_id, person);
    return map;
  }, [query.data]);
  return { ...query, people: query.data ?? [], byId };
}

export function useMyChannels() {
  return useQuery({
    queryKey: chatKeys.channels(),
    staleTime: 15_000,
    queryFn: async () => unwrap<ChannelSummary[]>(await db.rpc('get_my_channels')) ?? [],
  });
}

export function useBrowseChannels(enabled: boolean) {
  return useQuery({
    queryKey: chatKeys.browse(),
    enabled,
    queryFn: async () =>
      unwrap<{ id: string; name: string; topic: string | null; member_count: number; is_member: boolean }[]>(
        await db.rpc('browse_channels'),
      ) ?? [],
  });
}

export function useChannel(channelId: string | undefined) {
  return useQuery({
    queryKey: ['chat', 'channel', channelId],
    enabled: Boolean(channelId),
    queryFn: async () =>
      unwrap<{ id: string; kind: string; name: string | null; topic: string | null; posting_policy: string; is_default: boolean }>(
        await db.from('channels').select('id, kind, name, topic, posting_policy, is_default').eq('id', channelId).maybeSingle(),
      ),
  });
}

export function useChannelMembers(channelId: string | undefined) {
  return useQuery({
    queryKey: ['chat', 'members', channelId],
    enabled: Boolean(channelId),
    queryFn: async () =>
      unwrap<{ user_id: string; role: string; last_read_at: string | null }[]>(
        await db.from('channel_members').select('user_id, role, last_read_at').eq('channel_id', channelId),
      ) ?? [],
  });
}

/** Top-level messages, newest page first. Pages are stored newest -> oldest. */
export function useChannelMessages(channelId: string) {
  return useInfiniteQuery({
    queryKey: chatKeys.messages(channelId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      let query = db
        .from('messages')
        .select(MESSAGE_COLUMNS)
        .eq('channel_id', channelId)
        .is('parent_id', null)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (pageParam) query = query.lt('created_at', pageParam);
      return unwrap<ChatMessage[]>(await query) ?? [];
    },
    getNextPageParam: (lastPage) => (lastPage.length === PAGE_SIZE ? lastPage[lastPage.length - 1].created_at : null),
  });
}

export function useThread(parentId: string | undefined) {
  return useQuery({
    queryKey: chatKeys.thread(parentId ?? ''),
    enabled: Boolean(parentId),
    queryFn: async () => {
      const [parent, replies] = await Promise.all([
        db.from('messages').select(MESSAGE_COLUMNS).eq('id', parentId).maybeSingle(),
        db.from('messages').select(MESSAGE_COLUMNS).eq('parent_id', parentId).order('created_at', { ascending: true }).limit(500),
      ]);
      return { parent: unwrap<ChatMessage | null>(parent), replies: unwrap<ChatMessage[]>(replies) ?? [] };
    },
  });
}

export function useMessageSearch(q: string) {
  return useQuery({
    queryKey: chatKeys.search(q),
    enabled: q.trim().length >= 2,
    queryFn: async () => unwrap<SearchHit[]>(await db.rpc('search_messages', { _query: q.trim(), _limit: 40 })) ?? [],
  });
}

export function useSignedFileUrl(path: string) {
  return useQuery({
    queryKey: chatKeys.file(path),
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('chat-files').createSignedUrl(path, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

// ------------------------------------------------------------------ cache helpers

type MessagePages = InfiniteData<ChatMessage[], string | null>;

export function upsertMessageInCache(queryClient: QueryClient, message: ChatMessage) {
  if (message.parent_id) {
    queryClient.setQueryData<{ parent: ChatMessage | null; replies: ChatMessage[] }>(
      chatKeys.thread(message.parent_id),
      (old) => {
        if (!old) return old;
        const exists = old.replies.some((r) => r.id === message.id);
        return {
          ...old,
          replies: exists
            ? old.replies.map((r) => (r.id === message.id ? { ...r, ...message } : r))
            : [...old.replies.filter((r) => !(r.pending && r.body === message.body && r.user_id === message.user_id)), message],
        };
      },
    );
    return;
  }

  queryClient.setQueryData<MessagePages>(chatKeys.messages(message.channel_id), (old) => {
    if (!old) return old;
    const exists = old.pages.some((page) => page.some((m) => m.id === message.id));
    if (exists) {
      return { ...old, pages: old.pages.map((page) => page.map((m) => (m.id === message.id ? { ...m, ...message } : m))) };
    }
    const [first = [], ...rest] = old.pages;
    const withoutEcho = first.filter((m) => !(m.pending && m.body === message.body && m.user_id === message.user_id));
    return { ...old, pages: [[message, ...withoutEcho], ...rest] };
  });
}

export function patchMessageInCache(
  queryClient: QueryClient,
  channelId: string,
  messageId: string,
  patch: (m: ChatMessage) => ChatMessage,
) {
  queryClient.setQueryData<MessagePages>(chatKeys.messages(channelId), (old) =>
    old ? { ...old, pages: old.pages.map((page) => page.map((m) => (m.id === messageId ? patch(m) : m))) } : old,
  );
  queryClient.setQueriesData<{ parent: ChatMessage | null; replies: ChatMessage[] }>(
    { queryKey: ['chat', 'thread'] },
    (old) =>
      old
        ? {
            parent: old.parent && old.parent.id === messageId ? patch(old.parent) : old.parent,
            replies: old.replies.map((r) => (r.id === messageId ? patch(r) : r)),
          }
        : old,
  );
}

// ------------------------------------------------------------------ mutations

export interface SendInput {
  channelId: string;
  body: string;
  mentions: string[];
  parentId?: string | null;
  files?: File[];
}

export const ASSISTANT_MENTION = /(^|\s)@assistant\b/i;

/** Asks the assistant edge function to reply to a message. The reply arrives over realtime. */
async function askAssistant(messageId: string) {
  const pending = toast.loading('Assistant is thinking…');
  const { error } = await supabase.functions.invoke('assistant', { body: { message_id: messageId } });
  toast.dismiss(pending);
  if (error) {
    let detail = 'The assistant could not reply.';
    try {
      const body = await (error as { context?: Response }).context?.json();
      if (body?.error) detail = body.error;
    } catch {
      /* keep the generic message */
    }
    toast.error(detail);
  }
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ channelId, body, mentions, parentId, files = [] }: SendInput) => {
      const inserted = unwrap<ChatMessage>(
        await db
          .from('messages')
          .insert({
            channel_id: channelId,
            user_id: user!.id,
            body,
            mentions,
            parent_id: parentId ?? null,
            metadata: files.length > 0 ? { attachment_count: files.length } : {},
          })
          .select(MESSAGE_COLUMNS)
          .single(),
      );

      if (files.length > 0) {
        const rows = [];
        for (const file of files) {
          const path = `${channelId}/${crypto.randomUUID()}/${file.name}`;
          const { error } = await supabase.storage.from('chat-files').upload(path, file, { contentType: file.type || undefined });
          if (error) throw error;
          rows.push({
            message_id: inserted.id,
            channel_id: channelId,
            uploader_id: user!.id,
            storage_path: path,
            file_name: file.name,
            mime_type: file.type || null,
            size_bytes: file.size,
          });
        }
        const attachments = unwrap<ChatMessage['message_attachments']>(
          await db.from('message_attachments').insert(rows).select('id, file_name, mime_type, size_bytes, storage_path'),
        );
        inserted.message_attachments = attachments ?? [];
      }
      return inserted;
    },
    onMutate: ({ channelId, body, mentions, parentId }) => {
      if (!user) return;
      const optimistic: ChatMessage = {
        id: `pending-${crypto.randomUUID()}`,
        channel_id: channelId,
        user_id: user.id,
        author_kind: 'user',
        parent_id: parentId ?? null,
        body,
        mentions,
        metadata: {},
        reply_count: 0,
        last_reply_at: null,
        edited_at: null,
        deleted_at: null,
        created_at: new Date().toISOString(),
        reactions: [],
        message_attachments: [],
        pending: true,
      };
      upsertMessageInCache(queryClient, optimistic);
    },
    onSuccess: async (message) => {
      upsertMessageInCache(queryClient, message);
      if (ASSISTANT_MENTION.test(message.body)) void askAssistant(message.id);
      if (message.parent_id) {
        // Read the server's reply count (realtime may also deliver it; this is idempotent).
        const { data } = await db
          .from('messages')
          .select('reply_count, last_reply_at')
          .eq('id', message.parent_id)
          .maybeSingle();
        if (data) patchMessageInCache(queryClient, message.channel_id, message.parent_id, (m) => ({ ...m, ...data }));
      }
    },
    onError: (_error, { channelId, parentId }) => {
      // Drop the optimistic copy; the composer keeps the text so it can be retried.
      void queryClient.invalidateQueries({ queryKey: parentId ? chatKeys.thread(parentId) : chatKeys.messages(channelId) });
    },
  });
}

export function useEditMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ message, body, mentions }: { message: ChatMessage; body: string; mentions: string[] }) => {
      unwrap(await db.from('messages').update({ body, mentions }).eq('id', message.id));
    },
    onMutate: ({ message, body, mentions }) =>
      patchMessageInCache(queryClient, message.channel_id, message.id, (m) => ({
        ...m,
        body,
        mentions,
        edited_at: new Date().toISOString(),
      })),
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (message: ChatMessage) => {
      unwrap(await db.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', message.id));
    },
    onMutate: (message) =>
      patchMessageInCache(queryClient, message.channel_id, message.id, (m) => ({
        ...m,
        body: '',
        deleted_at: new Date().toISOString(),
        message_attachments: [],
      })),
  });
}

export function useToggleReaction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ message, emoji, active }: { message: ChatMessage; emoji: string; active: boolean }) => {
      if (active) {
        unwrap(
          await db.from('message_reactions').delete().eq('message_id', message.id).eq('user_id', user!.id).eq('emoji', emoji),
        );
      } else {
        unwrap(
          await db
            .from('message_reactions')
            .upsert({ message_id: message.id, user_id: user!.id, emoji, channel_id: message.channel_id }, { ignoreDuplicates: true }),
        );
      }
    },
    onMutate: ({ message, emoji, active }) =>
      patchMessageInCache(queryClient, message.channel_id, message.id, (m) => ({
        ...m,
        reactions: active
          ? m.reactions.filter((r) => !(r.emoji === emoji && r.user_id === user!.id))
          : [...m.reactions, { emoji, user_id: user!.id }],
      })),
    onError: (_e, { message }) => void queryClient.invalidateQueries({ queryKey: chatKeys.messages(message.channel_id) }),
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (channelId: string) => unwrap(await db.rpc('mark_channel_read', { _channel_id: channelId })),
    onSuccess: (_data, channelId) => {
      queryClient.setQueryData<ChannelSummary[]>(chatKeys.channels(), (old) =>
        old?.map((c) => (c.id === channelId ? { ...c, unread_count: 0, mention_count: 0 } : c)),
      );
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
    },
  });
}

export function useCreateChannel() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string; topic: string; kind: 'public' | 'private'; memberIds: string[] }) => {
      const channel = unwrap<{ id: string }>(
        await db
          .from('channels')
          .insert({ name: input.name, topic: input.topic || null, kind: input.kind, created_by: user!.id })
          .select('id')
          .single(),
      );
      const others = input.memberIds.filter((id) => id !== user!.id);
      if (others.length > 0) {
        unwrap(await db.from('channel_members').insert(others.map((id) => ({ channel_id: channel.id, user_id: id }))));
      }
      return channel.id;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: chatKeys.channels() }),
  });
}

export function useJoinChannel() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (channelId: string) =>
      unwrap(await db.from('channel_members').insert({ channel_id: channelId, user_id: user!.id })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.channels() });
      void queryClient.invalidateQueries({ queryKey: chatKeys.browse() });
    },
  });
}

export function useLeaveChannel() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (channelId: string) =>
      unwrap(await db.from('channel_members').delete().eq('channel_id', channelId).eq('user_id', user!.id)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: chatKeys.channels() }),
  });
}

export function useUpdateMembership() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ channelId, patch }: { channelId: string; patch: { starred?: boolean; muted?: boolean } }) =>
      unwrap(await db.from('channel_members').update(patch).eq('channel_id', channelId).eq('user_id', user!.id)),
    onMutate: ({ channelId, patch }) =>
      queryClient.setQueryData<ChannelSummary[]>(chatKeys.channels(), (old) =>
        old?.map((c) => (c.id === channelId ? { ...c, ...patch } : c)),
      ),
  });
}

export function useOpenDm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userIds: string[]) => unwrap<string>(await db.rpc('get_or_create_dm', { _user_ids: userIds })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: chatKeys.channels() }),
  });
}

export function useAddMembers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ channelId, userIds }: { channelId: string; userIds: string[] }) =>
      unwrap(await db.from('channel_members').insert(userIds.map((id) => ({ channel_id: channelId, user_id: id })))),
    onSuccess: (_d, { channelId }) => void queryClient.invalidateQueries({ queryKey: ['chat', 'members', channelId] }),
  });
}
