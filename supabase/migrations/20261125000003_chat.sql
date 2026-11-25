-- =====================================================================
-- Chat: channels, DMs, threads, mentions, reactions, attachments.
-- Replaces Slack. The old work_chat_* tables are left untouched.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('public', 'private', 'dm')),
  name text,
  topic text,
  posting_policy text NOT NULL DEFAULT 'everyone' CHECK (posting_policy IN ('everyone', 'managers')),
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_message_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT channels_name_required CHECK (kind = 'dm' OR (name IS NOT NULL AND length(trim(name)) BETWEEN 1 AND 80))
);

CREATE UNIQUE INDEX IF NOT EXISTS channels_name_unique
  ON public.channels (lower(name)) WHERE kind <> 'dm' AND archived_at IS NULL;

CREATE TABLE IF NOT EXISTS public.channel_members (
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  muted boolean NOT NULL DEFAULT false,
  starred boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);
CREATE INDEX IF NOT EXISTS channel_members_user_idx ON public.channel_members (user_id);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_kind text NOT NULL DEFAULT 'user' CHECK (author_kind IN ('user', 'assistant', 'system')),
  parent_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '' CHECK (length(body) <= 8000),
  mentions uuid[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  reply_count integer NOT NULL DEFAULT 0,
  last_reply_at timestamptz,
  -- denormalised [{emoji, user_id}] kept in sync by trigger, so reaction
  -- changes reach clients as RLS-checked UPDATEs on messages
  reactions jsonb NOT NULL DEFAULT '[]'::jsonb,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  search tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(body, ''))) STORED
);
CREATE INDEX IF NOT EXISTS messages_channel_created_idx ON public.messages (channel_id, created_at DESC) WHERE parent_id IS NULL;
CREATE INDEX IF NOT EXISTS messages_thread_idx ON public.messages (parent_id, created_at) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS messages_search_idx ON public.messages USING gin (search);
CREATE INDEX IF NOT EXISTS messages_mentions_idx ON public.messages USING gin (mentions);

CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (length(emoji) BETWEEN 1 AND 32),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS message_reactions_channel_idx ON public.message_reactions (channel_id);

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  uploader_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS message_attachments_message_idx ON public.message_attachments (message_id);

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

-- Chat is for signed-in people only.
REVOKE ALL ON public.channels, public.channel_members, public.messages,
  public.message_reactions, public.message_attachments FROM anon;

-- ---------------------------------------------------------------------
-- Access helpers (security definer: no recursive RLS)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_channel_member(_channel_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.channel_members WHERE channel_id = _channel_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_channel_owner(_channel_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE channel_id = _channel_id AND user_id = _user_id AND role = 'owner'
  )
$$;

-- Public channels are readable by every signed-in person; private channels
-- and DMs only by their members. Admins do NOT get to read DMs.
CREATE OR REPLACE FUNCTION public.can_read_channel(_channel_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = _channel_id
      AND (c.kind = 'public' OR public.is_channel_member(c.id, _user_id))
  )
$$;

CREATE OR REPLACE FUNCTION public.can_post_in_channel(_channel_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = _channel_id
      AND c.archived_at IS NULL
      AND public.is_channel_member(c.id, _user_id)
      AND (
        c.posting_policy = 'everyone'
        OR public.has_role(_user_id, 'admin')
        OR public.has_role(_user_id, 'manager')
      )
  )
$$;

-- ---------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------
-- channels
DROP POLICY IF EXISTS channels_select ON public.channels;
CREATE POLICY channels_select ON public.channels FOR SELECT TO authenticated
  USING (kind = 'public' OR created_by = auth.uid() OR public.is_channel_member(id));

DROP POLICY IF EXISTS channels_insert ON public.channels;
CREATE POLICY channels_insert ON public.channels FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND kind IN ('public', 'private')
    AND is_default = false
    AND (posting_policy = 'everyone' OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

DROP POLICY IF EXISTS channels_update ON public.channels;
CREATE POLICY channels_update ON public.channels FOR UPDATE TO authenticated
  USING (kind <> 'dm' AND (public.is_channel_owner(id) OR public.has_role(auth.uid(), 'admin')))
  WITH CHECK (kind <> 'dm');

-- channel_members
DROP POLICY IF EXISTS channel_members_select ON public.channel_members;
CREATE POLICY channel_members_select ON public.channel_members FOR SELECT TO authenticated
  USING (public.can_read_channel(channel_id));

DROP POLICY IF EXISTS channel_members_insert ON public.channel_members;
CREATE POLICY channel_members_insert ON public.channel_members FOR INSERT TO authenticated
  WITH CHECK (
    role = 'member'
    AND EXISTS (SELECT 1 FROM public.channels c WHERE c.id = channel_id AND c.kind <> 'dm' AND c.archived_at IS NULL)
    AND (
      -- join a public channel yourself
      (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.channels c WHERE c.id = channel_id AND c.kind = 'public'))
      -- or be added by the channel owner / an admin
      OR public.is_channel_owner(channel_id)
      OR public.has_role(auth.uid(), 'admin')
    )
  );

DROP POLICY IF EXISTS channel_members_update ON public.channel_members;
CREATE POLICY channel_members_update ON public.channel_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS channel_members_delete ON public.channel_members;
CREATE POLICY channel_members_delete ON public.channel_members FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.channels c WHERE c.id = channel_id AND c.kind <> 'dm' AND c.is_default = false)
    AND (user_id = auth.uid() OR public.is_channel_owner(channel_id) OR public.has_role(auth.uid(), 'admin'))
  );

-- Members may only change their own read state, mute and star.
CREATE OR REPLACE FUNCTION public.guard_channel_member_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.channel_id <> OLD.channel_id OR NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_channel_member_update ON public.channel_members;
CREATE TRIGGER guard_channel_member_update BEFORE UPDATE ON public.channel_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_channel_member_update();

-- messages
DROP POLICY IF EXISTS messages_select ON public.messages;
CREATE POLICY messages_select ON public.messages FOR SELECT TO authenticated
  USING (public.can_read_channel(channel_id));

DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND author_kind = 'user'
    AND public.can_post_in_channel(channel_id)
    AND (parent_id IS NULL OR EXISTS (
      SELECT 1 FROM public.messages p WHERE p.id = messages.parent_id AND p.channel_id = messages.channel_id AND p.parent_id IS NULL
    ))
  );

DROP POLICY IF EXISTS messages_update ON public.messages;
CREATE POLICY messages_update ON public.messages FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (true);  -- column changes are policed by guard_message_update

-- Authors may edit or soft-delete their own text; nothing else changes.
CREATE OR REPLACE FUNCTION public.guard_message_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- service role, or nested updates from our own triggers (reply counts, reactions)
  IF auth.uid() IS NULL OR pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  NEW.channel_id := OLD.channel_id;
  NEW.user_id := OLD.user_id;
  NEW.author_kind := OLD.author_kind;
  NEW.parent_id := OLD.parent_id;
  NEW.created_at := OLD.created_at;
  NEW.reply_count := OLD.reply_count;
  NEW.last_reply_at := OLD.last_reply_at;
  NEW.reactions := OLD.reactions;
  IF OLD.user_id IS DISTINCT FROM auth.uid() THEN
    -- admins may only moderate (soft delete)
    NEW.body := OLD.body;
    NEW.mentions := OLD.mentions;
    NEW.metadata := OLD.metadata;
  END IF;
  IF NEW.body IS DISTINCT FROM OLD.body THEN
    NEW.edited_at := now();
  END IF;
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    NEW.deleted_at := now();
    NEW.body := '';
    NEW.mentions := '{}';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_message_update ON public.messages;
CREATE TRIGGER guard_message_update BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_message_update();

-- reactions
DROP POLICY IF EXISTS message_reactions_select ON public.message_reactions;
CREATE POLICY message_reactions_select ON public.message_reactions FOR SELECT TO authenticated
  USING (public.can_read_channel(channel_id));

DROP POLICY IF EXISTS message_reactions_insert ON public.message_reactions;
CREATE POLICY message_reactions_insert ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_channel_member(channel_id)
    AND EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND m.channel_id = message_reactions.channel_id)
  );

DROP POLICY IF EXISTS message_reactions_delete ON public.message_reactions;
CREATE POLICY message_reactions_delete ON public.message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.sync_message_reactions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE mid uuid := coalesce(NEW.message_id, OLD.message_id);
BEGIN
  UPDATE public.messages m
     SET reactions = coalesce((
       SELECT jsonb_agg(jsonb_build_object('emoji', r.emoji, 'user_id', r.user_id) ORDER BY r.created_at)
       FROM public.message_reactions r WHERE r.message_id = mid), '[]'::jsonb)
   WHERE m.id = mid;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS sync_message_reactions ON public.message_reactions;
CREATE TRIGGER sync_message_reactions AFTER INSERT OR DELETE ON public.message_reactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_message_reactions();

-- attachments
DROP POLICY IF EXISTS message_attachments_select ON public.message_attachments;
CREATE POLICY message_attachments_select ON public.message_attachments FOR SELECT TO authenticated
  USING (public.can_read_channel(channel_id));

DROP POLICY IF EXISTS message_attachments_insert ON public.message_attachments;
CREATE POLICY message_attachments_insert ON public.message_attachments FOR INSERT TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND public.can_post_in_channel(channel_id)
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND m.channel_id = message_attachments.channel_id AND m.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- Triggers: membership, threads, unread, notifications
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_channel_creator_as_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kind <> 'dm' AND NEW.created_by IS NOT NULL THEN
    INSERT INTO public.channel_members (channel_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT (channel_id, user_id) DO UPDATE SET role = 'owner';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS add_channel_creator_as_owner ON public.channels;
CREATE TRIGGER add_channel_creator_as_owner AFTER INSERT ON public.channels
  FOR EACH ROW EXECUTE FUNCTION public.add_channel_creator_as_owner();

CREATE OR REPLACE FUNCTION public.touch_channels_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS touch_channels_updated_at ON public.channels;
CREATE TRIGGER touch_channels_updated_at BEFORE UPDATE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION public.touch_channels_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ch record;
  author_name text;
  preview text;
  target uuid;
  link text;
BEGIN
  SELECT id, kind, name INTO ch FROM public.channels WHERE id = NEW.channel_id;

  IF NEW.parent_id IS NOT NULL THEN
    UPDATE public.messages
       SET reply_count = reply_count + 1, last_reply_at = NEW.created_at
     WHERE id = NEW.parent_id;
  END IF;

  UPDATE public.channels SET last_message_at = NEW.created_at WHERE id = NEW.channel_id;

  -- posting in the channel means the author has caught up (thread replies do not)
  IF NEW.user_id IS NOT NULL AND NEW.parent_id IS NULL THEN
    UPDATE public.channel_members SET last_read_at = NEW.created_at
     WHERE channel_id = NEW.channel_id AND user_id = NEW.user_id;
  END IF;

  IF NEW.author_kind <> 'user' THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO author_name FROM public.profiles WHERE id = NEW.user_id;
  preview := NEW.body;
  -- mentions are stored as <@user-id>; show names in notification previews
  FOREACH target IN ARRAY NEW.mentions LOOP
    preview := replace(preview, '<@' || target || '>',
      '@' || coalesce((SELECT full_name FROM public.profiles WHERE id = target), 'someone'));
  END LOOP;
  preview := left(regexp_replace(preview, '\s+', ' ', 'g'), 140);
  link := '/chat/' || NEW.channel_id
          || CASE WHEN NEW.parent_id IS NOT NULL THEN '?thread=' || NEW.parent_id ELSE '' END;

  -- @mentions (only people who can read the channel)
  FOREACH target IN ARRAY NEW.mentions LOOP
    IF target <> NEW.user_id AND public.can_read_channel(NEW.channel_id, target) THEN
      INSERT INTO public.work_notifications (user_id, actor_id, message_id, type, title, body, action_url, metadata)
      VALUES (
        target, NEW.user_id, NEW.id, 'mention',
        coalesce(author_name, 'Someone') || CASE WHEN ch.kind = 'dm' THEN ' mentioned you' ELSE ' mentioned you in #' || ch.name END,
        preview, link,
        jsonb_build_object('chat_channel_id', NEW.channel_id, 'chat_message_id', NEW.id)
      );
    END IF;
  END LOOP;

  -- direct messages notify every other member who has not muted the DM
  IF ch.kind = 'dm' THEN
    INSERT INTO public.work_notifications (user_id, actor_id, message_id, type, title, body, action_url, metadata)
    SELECT cm.user_id, NEW.user_id, NEW.id, 'message',
           'New message from ' || coalesce(author_name, 'someone'),
           preview, link,
           jsonb_build_object('chat_channel_id', NEW.channel_id, 'chat_message_id', NEW.id)
    FROM public.channel_members cm
    WHERE cm.channel_id = NEW.channel_id
      AND cm.user_id <> NEW.user_id
      AND cm.muted = false
      AND NOT (cm.user_id = ANY (NEW.mentions));
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS handle_new_message ON public.messages;
CREATE TRIGGER handle_new_message AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_message();

-- New employees join the default channels automatically.
CREATE OR REPLACE FUNCTION public.join_default_channels()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.channel_members (channel_id, user_id)
    SELECT c.id, NEW.user_id FROM public.channels c
    WHERE c.is_default AND c.archived_at IS NULL
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS join_default_channels ON public.employees;
CREATE TRIGGER join_default_channels AFTER INSERT ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.join_default_channels();

-- ---------------------------------------------------------------------
-- RPCs used by the chat UI
-- ---------------------------------------------------------------------

-- Company directory for chat (names and photos only, active people).
CREATE OR REPLACE FUNCTION public.get_directory()
RETURNS TABLE (user_id uuid, full_name text, avatar_url text, designation text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.avatar_url, e.designation, p.email
  FROM public.profiles p
  LEFT JOIN public.employees e ON e.user_id = p.id
  WHERE auth.uid() IS NOT NULL AND p.status = 'active'
  ORDER BY p.full_name
$$;

-- Sidebar in one call: my channels + DMs with unread and mention counts.
CREATE OR REPLACE FUNCTION public.get_my_channels()
RETURNS TABLE (
  id uuid, kind text, name text, topic text, posting_policy text, is_default boolean,
  last_message_at timestamptz, starred boolean, muted boolean, role text,
  unread_count integer, mention_count integer, dm_user_ids uuid[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.kind, c.name, c.topic, c.posting_policy, c.is_default,
         c.last_message_at, me.starred, me.muted, me.role,
         (SELECT count(*)::int FROM public.messages m
           WHERE m.channel_id = c.id AND m.parent_id IS NULL AND m.deleted_at IS NULL
             AND m.created_at > me.last_read_at AND m.user_id IS DISTINCT FROM auth.uid()),
         (SELECT count(*)::int FROM public.messages m
           WHERE m.channel_id = c.id AND m.deleted_at IS NULL
             AND m.created_at > me.last_read_at AND auth.uid() = ANY (m.mentions)),
         CASE WHEN c.kind = 'dm' THEN
           ARRAY(SELECT o.user_id FROM public.channel_members o WHERE o.channel_id = c.id AND o.user_id <> auth.uid())
         END
  FROM public.channel_members me
  JOIN public.channels c ON c.id = me.channel_id
  WHERE me.user_id = auth.uid() AND c.archived_at IS NULL
  ORDER BY c.kind = 'dm', lower(coalesce(c.name, ''))
$$;

-- Public channels I can browse and join.
CREATE OR REPLACE FUNCTION public.browse_channels()
RETURNS TABLE (id uuid, name text, topic text, member_count integer, is_member boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.topic,
         (SELECT count(*)::int FROM public.channel_members cm WHERE cm.channel_id = c.id),
         public.is_channel_member(c.id)
  FROM public.channels c
  WHERE auth.uid() IS NOT NULL AND c.kind = 'public' AND c.archived_at IS NULL
  ORDER BY lower(c.name)
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_dm(_user_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  members uuid[];
  existing uuid;
  new_id uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501'; END IF;

  SELECT array_agg(DISTINCT u ORDER BY u) INTO members
  FROM unnest(array_append(coalesce(_user_ids, '{}'), me)) AS u;

  IF array_length(members, 1) < 2 OR array_length(members, 1) > 9 THEN
    RAISE EXCEPTION 'A conversation needs 2 to 9 people';
  END IF;

  IF EXISTS (SELECT 1 FROM unnest(members) u WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u AND p.status = 'active')) THEN
    RAISE EXCEPTION 'Unknown or inactive person';
  END IF;

  SELECT c.id INTO existing
  FROM public.channels c
  WHERE c.kind = 'dm'
    AND (SELECT array_agg(cm.user_id ORDER BY cm.user_id) FROM public.channel_members cm WHERE cm.channel_id = c.id) = members
  LIMIT 1;

  IF existing IS NOT NULL THEN RETURN existing; END IF;

  INSERT INTO public.channels (kind, created_by) VALUES ('dm', me) RETURNING id INTO new_id;
  INSERT INTO public.channel_members (channel_id, user_id) SELECT new_id, u FROM unnest(members) u;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_channel_read(_channel_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.channel_members SET last_read_at = now()
  WHERE channel_id = _channel_id AND user_id = auth.uid();
  UPDATE public.work_notifications SET is_read = true, read_at = now()
  WHERE user_id = auth.uid() AND is_read = false
    AND metadata ->> 'chat_channel_id' = _channel_id::text;
$$;

CREATE OR REPLACE FUNCTION public.search_messages(_query text, _limit integer DEFAULT 30)
RETURNS TABLE (id uuid, channel_id uuid, channel_name text, channel_kind text, parent_id uuid,
               user_id uuid, body text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.channel_id, c.name, c.kind, m.parent_id, m.user_id, m.body, m.created_at
  FROM public.messages m
  JOIN public.channels c ON c.id = m.channel_id
  WHERE m.deleted_at IS NULL
    AND public.can_read_channel(m.channel_id)
    AND m.search @@ websearch_to_tsquery('simple', _query)
  ORDER BY m.created_at DESC
  LIMIT least(greatest(coalesce(_limit, 30), 1), 100)
$$;

-- ---------------------------------------------------------------------
-- Storage: private chat-files bucket, readable by channel readers.
-- Object path: <channel_id>/<random>/<file name>
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-files', 'chat-files', false, 26214400)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.chat_path_channel(_name text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN split_part(_name, '/', 1)::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

DROP POLICY IF EXISTS chat_files_read ON storage.objects;
CREATE POLICY chat_files_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-files' AND public.can_read_channel(public.chat_path_channel(name)));

DROP POLICY IF EXISTS chat_files_upload ON storage.objects;
CREATE POLICY chat_files_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-files' AND public.can_post_in_channel(public.chat_path_channel(name)));

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- Seed: #general and #announcements with every current employee
-- ---------------------------------------------------------------------
INSERT INTO public.channels (kind, name, topic, posting_policy, is_default)
SELECT 'public', 'general', 'Company-wide conversation', 'everyone', true
WHERE NOT EXISTS (SELECT 1 FROM public.channels WHERE kind <> 'dm' AND lower(name) = 'general');

INSERT INTO public.channels (kind, name, topic, posting_policy, is_default)
SELECT 'public', 'announcements', 'Company news from admins and managers', 'managers', true
WHERE NOT EXISTS (SELECT 1 FROM public.channels WHERE kind <> 'dm' AND lower(name) = 'announcements');

INSERT INTO public.channel_members (channel_id, user_id)
SELECT c.id, e.user_id
FROM public.channels c
CROSS JOIN public.employees e
JOIN public.profiles p ON p.id = e.user_id AND p.status = 'active'
WHERE c.is_default
ON CONFLICT DO NOTHING;
