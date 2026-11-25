import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { chatKeys, MESSAGE_COLUMNS, upsertMessageInCache } from './api';
import type { ChatMessage } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/**
 * One subscription for the whole chat area. Postgres changes on `messages`
 * are RLS-checked by Supabase Realtime, so each user only receives rows of
 * channels they can read. Reactions arrive as UPDATEs (the `reactions`
 * column is kept in sync by a trigger).
 */
export function useChatRealtime() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let channelsTimer: ReturnType<typeof setTimeout> | undefined;
    const refreshChannels = () => {
      clearTimeout(channelsTimer);
      channelsTimer = setTimeout(() => void queryClient.invalidateQueries({ queryKey: chatKeys.channels() }), 400);
    };

    const merge = (row: ChatMessage) => {
      // Keep attachments we already have; realtime rows don't carry joins.
      const known = findCached(row);
      upsertMessageInCache(queryClient, {
        ...row,
        reactions: row.reactions ?? [],
        message_attachments: known?.message_attachments ?? [],
      });
    };

    const findCached = (row: ChatMessage): ChatMessage | undefined => {
      const pages = queryClient.getQueryData<{ pages: ChatMessage[][] }>(chatKeys.messages(row.channel_id));
      const top = pages?.pages.flat().find((m) => m.id === row.id);
      if (top) return top;
      if (row.parent_id) {
        const thread = queryClient.getQueryData<{ replies: ChatMessage[] }>(chatKeys.thread(row.parent_id));
        return thread?.replies.find((m) => m.id === row.id);
      }
      return undefined;
    };

    const fetchFull = async (id: string, attempt = 0) => {
      const { data } = await db.from('messages').select(MESSAGE_COLUMNS).eq('id', id).maybeSingle();
      if (!data) return;
      const full = data as ChatMessage;
      const expected = Number((full.metadata as { attachment_count?: number }).attachment_count ?? 0);
      upsertMessageInCache(queryClient, full);
      // The sender uploads files right after inserting the message.
      if (full.message_attachments.length < expected && attempt < 4) {
        setTimeout(() => void fetchFull(id, attempt + 1), 800 * (attempt + 1));
      }
    };

    const channel = supabase
      .channel(`chat:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const row = payload.new as ChatMessage;
        refreshChannels();
        if (row.user_id === user.id && findCached(row)) return; // our own echo, already in cache
        if ((row.metadata as { attachment_count?: number })?.attachment_count) {
          void fetchFull(row.id);
        } else {
          merge(row);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        merge(payload.new as ChatMessage);
      })
      .subscribe();

    return () => {
      clearTimeout(channelsTimer);
      void supabase.removeChannel(channel);
    };
  }, [queryClient, user]);
}
