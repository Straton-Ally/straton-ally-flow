-- Chat access smoke checks. Run against a COPY of the database, never production.
-- Everything is rolled back at the end. Prints PASS/FAIL per check.
\set ON_ERROR_ROLLBACK on
\set QUIET on
\pset tuples_only on
BEGIN;

-- Three plain members (a, b, c), one manager and one admin.
SELECT array_agg(user_id ORDER BY created_at) AS members
FROM (
  SELECT e.user_id, e.created_at FROM public.employees e
  JOIN public.profiles p ON p.id = e.user_id AND p.status = 'active'
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = e.user_id AND r.role IN ('admin','manager'))
  ORDER BY e.created_at LIMIT 3
) s \gset
SELECT (:'members'::uuid[])[1] AS a, (:'members'::uuid[])[2] AS b, (:'members'::uuid[])[3] AS c \gset
SELECT user_id AS mgr FROM public.user_roles WHERE role = 'manager'
  AND user_id NOT IN (SELECT user_id FROM public.user_roles WHERE role = 'admin') LIMIT 1 \gset
SELECT user_id AS adm FROM public.user_roles WHERE role = 'admin' LIMIT 1 \gset
SELECT id AS general FROM public.channels WHERE name = 'general' \gset
SELECT id AS announcements FROM public.channels WHERE name = 'announcements' \gset

CREATE TEMP TABLE r (check_name text, passed boolean);
CREATE TEMP TABLE ids (k text PRIMARY KEY, v uuid);
GRANT ALL ON r, ids TO authenticated, anon;

-- ---------------------------------------------------------------- member a
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'a')::text, true);

DO $$ DECLARE mid uuid; BEGIN
  INSERT INTO public.messages (channel_id, user_id, body, mentions)
  VALUES ((SELECT id FROM public.channels WHERE name = 'general'), auth.uid(), 'hello team', '{}')
  RETURNING id INTO mid;
  INSERT INTO ids VALUES ('a_general_msg', mid);
  INSERT INTO r VALUES ('member can post in #general', true);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('member can post in #general: ' || SQLERRM, false);
END $$;

DO $$ BEGIN
  INSERT INTO public.messages (channel_id, user_id, body)
  VALUES ((SELECT id FROM public.channels WHERE name = 'announcements'), auth.uid(), 'not allowed');
  INSERT INTO r VALUES ('member cannot post in #announcements', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r VALUES ('member cannot post in #announcements', true);
END $$;

DO $$ BEGIN
  INSERT INTO public.messages (channel_id, user_id, body)
  VALUES ((SELECT id FROM public.channels WHERE name = 'general'), (SELECT v FROM ids LIMIT 0), 'spoof');
  INSERT INTO r VALUES ('member cannot post as someone else', false);
EXCEPTION WHEN insufficient_privilege OR not_null_violation THEN INSERT INTO r VALUES ('member cannot post as someone else', true);
END $$;

DO $$ DECLARE cid uuid; BEGIN
  INSERT INTO public.channels (kind, name, created_by) VALUES ('private', 'secret-plans', auth.uid()) RETURNING id INTO cid;
  INSERT INTO ids VALUES ('private', cid);
  INSERT INTO public.messages (channel_id, user_id, body) VALUES (cid, auth.uid(), 'top secret');
  INSERT INTO r VALUES ('member can create private channel and post', true);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('member can create private channel: ' || SQLERRM, false);
END $$;

DO $$ BEGIN
  UPDATE public.channel_members SET role = 'owner'
  WHERE channel_id = (SELECT id FROM public.channels WHERE name = 'general') AND user_id = auth.uid();
  INSERT INTO r VALUES ('member cannot make self owner of #general', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r VALUES ('member cannot make self owner of #general', true);
END $$;

SELECT set_config('my.b', :'b', true);
DO $$ DECLARE dm uuid; BEGIN
  dm := public.get_or_create_dm(ARRAY[current_setting('my.b')::uuid]);
  INSERT INTO ids VALUES ('dm', dm);
  INSERT INTO public.messages (channel_id, user_id, body, mentions)
  VALUES (dm, auth.uid(), 'private hello', ARRAY[current_setting('my.b')::uuid]);
  INSERT INTO r VALUES ('get_or_create_dm is idempotent', public.get_or_create_dm(ARRAY[current_setting('my.b')::uuid]) = dm);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('DM create/send: ' || SQLERRM, false);
END $$;
RESET ROLE;

-- ---------------------------------------------------------------- member b
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'b')::text, true);

INSERT INTO r SELECT 'DM recipient can read the DM',
  EXISTS (SELECT 1 FROM public.messages WHERE channel_id = (SELECT v FROM ids WHERE k = 'dm'));
INSERT INTO r SELECT 'DM recipient got exactly one notification',
  (SELECT count(*) FROM public.work_notifications WHERE user_id = auth.uid()
     AND metadata ->> 'chat_channel_id' = (SELECT v FROM ids WHERE k = 'dm')::text) = 1;
INSERT INTO r SELECT 'non-member cannot see private channel',
  NOT EXISTS (SELECT 1 FROM public.channels WHERE id = (SELECT v FROM ids WHERE k = 'private'));
INSERT INTO r SELECT 'non-member cannot read private messages',
  NOT EXISTS (SELECT 1 FROM public.messages WHERE channel_id = (SELECT v FROM ids WHERE k = 'private'));

DO $$ BEGIN
  INSERT INTO public.channel_members (channel_id, user_id) VALUES ((SELECT v FROM ids WHERE k = 'private'), auth.uid());
  INSERT INTO r VALUES ('non-member cannot join private channel', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r VALUES ('non-member cannot join private channel', true);
END $$;

DO $$ BEGIN
  UPDATE public.messages SET body = 'hacked' WHERE id = (SELECT v FROM ids WHERE k = 'a_general_msg');
  INSERT INTO r SELECT 'cannot edit someone else''s message',
    (SELECT body FROM public.messages WHERE id = (SELECT v FROM ids WHERE k = 'a_general_msg')) = 'hello team';
END $$;

DO $$ DECLARE parent uuid := (SELECT v FROM ids WHERE k = 'a_general_msg'); BEGIN
  INSERT INTO public.messages (channel_id, user_id, body, parent_id)
  VALUES ((SELECT id FROM public.channels WHERE name = 'general'), auth.uid(), 'thread reply', parent);
  INSERT INTO public.message_reactions (message_id, user_id, emoji, channel_id)
  VALUES (parent, auth.uid(), '👍', (SELECT id FROM public.channels WHERE name = 'general'));
  INSERT INTO r SELECT 'thread reply bumps reply_count', reply_count = 1 FROM public.messages WHERE id = parent;
  INSERT INTO r SELECT 'reaction is mirrored onto the message', jsonb_array_length(reactions) = 1 FROM public.messages WHERE id = parent;
  DELETE FROM public.message_reactions WHERE message_id = parent AND user_id = auth.uid();
  INSERT INTO r SELECT 'removing a reaction clears it', reactions = '[]'::jsonb FROM public.messages WHERE id = parent;
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('thread/reaction: ' || SQLERRM, false);
END $$;

INSERT INTO r SELECT 'unread count shows the new #general message',
  (SELECT unread_count FROM public.get_my_channels() WHERE name = 'general') >= 1;
RESET ROLE;

-- ---------------------------------------------------------------- member c / admin
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'c')::text, true);
INSERT INTO r SELECT 'third person cannot read the DM',
  NOT EXISTS (SELECT 1 FROM public.messages WHERE channel_id = (SELECT v FROM ids WHERE k = 'dm'));
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'adm')::text, true);
INSERT INTO r SELECT 'admin cannot read other people''s DMs',
  NOT EXISTS (SELECT 1 FROM public.messages WHERE channel_id = (SELECT v FROM ids WHERE k = 'dm'));
RESET ROLE;

-- ---------------------------------------------------------------- manager
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'mgr')::text, true);
DO $$ BEGIN
  INSERT INTO public.messages (channel_id, user_id, body)
  VALUES ((SELECT id FROM public.channels WHERE name = 'announcements'), auth.uid(), 'Office closed Friday');
  INSERT INTO r VALUES ('manager can post in #announcements', true);
EXCEPTION WHEN OTHERS THEN INSERT INTO r VALUES ('manager can post in #announcements: ' || SQLERRM, false);
END $$;
RESET ROLE;

-- ---------------------------------------------------------------- signed out
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
DO $$ BEGIN
  PERFORM 1 FROM public.messages LIMIT 1;
  INSERT INTO r VALUES ('anon cannot read messages', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO r VALUES ('anon cannot read messages', true);
END $$;
RESET ROLE;

SELECT CASE WHEN passed THEN 'PASS  ' ELSE 'FAIL  ' END || check_name FROM r;
SELECT count(*) FILTER (WHERE NOT passed) || ' failed of ' || count(*) FROM r;
ROLLBACK;
