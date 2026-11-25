export type ChannelKind = 'public' | 'private' | 'dm';

export interface ChannelSummary {
  id: string;
  kind: ChannelKind;
  name: string | null;
  topic: string | null;
  posting_policy: 'everyone' | 'managers';
  is_default: boolean;
  last_message_at: string | null;
  starred: boolean;
  muted: boolean;
  role: 'owner' | 'member';
  unread_count: number;
  mention_count: number;
  dm_user_ids: string[] | null;
}

export interface DirectoryPerson {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  designation: string | null;
  email: string;
}

export interface Reaction {
  emoji: string;
  user_id: string;
}

export interface Attachment {
  id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  user_id: string | null;
  author_kind: 'user' | 'assistant' | 'system';
  parent_id: string | null;
  body: string;
  mentions: string[];
  metadata: Record<string, unknown>;
  reply_count: number;
  last_reply_at: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  reactions: Reaction[];
  message_attachments: Attachment[];
  /** Client-only: optimistic message not yet confirmed by the server. */
  pending?: boolean;
}

export interface SearchHit {
  id: string;
  channel_id: string;
  channel_name: string | null;
  channel_kind: ChannelKind;
  parent_id: string | null;
  user_id: string | null;
  body: string;
  created_at: string;
}
