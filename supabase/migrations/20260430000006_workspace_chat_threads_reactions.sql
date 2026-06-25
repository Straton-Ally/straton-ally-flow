-- Workspace chat polish: sender profiles, replies, and reactions.

ALTER TABLE work_chat_messages
    ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES work_chat_messages(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS reactions JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_work_chat_messages_parent_id ON work_chat_messages(parent_id);
CREATE INDEX IF NOT EXISTS idx_work_chat_messages_room_created ON work_chat_messages(room_id, created_at DESC);

DROP POLICY IF EXISTS "work_chat_messages_select" ON work_chat_messages;
CREATE POLICY "work_chat_messages_select" ON work_chat_messages FOR SELECT
    USING (
        public.has_role(auth.uid(), 'admin')
        OR public.work_is_team_member(public.work_room_team_id(room_id))
    );

DROP POLICY IF EXISTS "work_chat_messages_insert" ON work_chat_messages;
CREATE POLICY "work_chat_messages_insert" ON work_chat_messages FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND (
            public.has_role(auth.uid(), 'admin')
            OR public.work_is_team_member(public.work_room_team_id(room_id))
        )
        AND (
            parent_id IS NULL
            OR EXISTS (
                SELECT 1
                FROM public.work_chat_messages parent
                WHERE parent.id = work_chat_messages.parent_id
                  AND parent.room_id = work_chat_messages.room_id
            )
        )
    );

DROP POLICY IF EXISTS "work_chat_messages_update" ON work_chat_messages;
CREATE POLICY "work_chat_messages_update" ON work_chat_messages FOR UPDATE
    USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_work_chat_messages(room_uuid UUID, limit_count INTEGER DEFAULT 100)
RETURNS TABLE (
    id UUID,
    room_id UUID,
    parent_id UUID,
    user_id UUID,
    content TEXT,
    mentions TEXT[],
    reactions JSONB,
    is_edited BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    user_full_name TEXT,
    user_avatar_url TEXT,
    parent_content TEXT,
    parent_user_full_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        m.id,
        m.room_id,
        m.parent_id,
        m.user_id,
        m.content,
        m.mentions,
        COALESCE(m.reactions, '{}'::jsonb) AS reactions,
        m.is_edited,
        m.created_at,
        m.updated_at,
        COALESCE(p.full_name, e.employee_id, 'Unknown user') AS user_full_name,
        p.avatar_url AS user_avatar_url,
        parent.content AS parent_content,
        COALESCE(parent_profile.full_name, parent_employee.employee_id, 'Unknown user') AS parent_user_full_name
    FROM public.work_chat_messages m
    JOIN public.work_chat_rooms r ON r.id = m.room_id
    LEFT JOIN public.profiles p ON p.id = m.user_id
    LEFT JOIN public.employees e ON e.user_id = m.user_id
    LEFT JOIN public.work_chat_messages parent ON parent.id = m.parent_id
    LEFT JOIN public.profiles parent_profile ON parent_profile.id = parent.user_id
    LEFT JOIN public.employees parent_employee ON parent_employee.user_id = parent.user_id
    WHERE m.room_id = room_uuid
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.work_is_team_member(r.team_id)
      )
    ORDER BY m.created_at DESC
    LIMIT GREATEST(1, LEAST(limit_count, 200));
$$;

GRANT EXECUTE ON FUNCTION public.get_work_chat_messages(UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_work_chat_message_reactions(message_uuid UUID, next_reactions JSONB)
RETURNS public.work_chat_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    message_row public.work_chat_messages;
    message_team_id UUID;
BEGIN
    SELECT m.*
    INTO message_row
    FROM public.work_chat_messages m
    WHERE m.id = message_uuid;

    IF message_row.id IS NULL THEN
        RAISE EXCEPTION 'Message not found';
    END IF;

    SELECT r.team_id
    INTO message_team_id
    FROM public.work_chat_rooms r
    WHERE r.id = message_row.room_id;

    IF NOT (
        public.has_role(auth.uid(), 'admin')
        OR public.work_is_team_member(message_team_id)
    ) THEN
        RAISE EXCEPTION 'Not allowed to react to this message';
    END IF;

    UPDATE public.work_chat_messages
    SET reactions = COALESCE(next_reactions, '{}'::jsonb),
        updated_at = NOW()
    WHERE id = message_uuid
    RETURNING * INTO message_row;

    RETURN message_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_work_chat_message_reactions(UUID, JSONB) TO authenticated;
