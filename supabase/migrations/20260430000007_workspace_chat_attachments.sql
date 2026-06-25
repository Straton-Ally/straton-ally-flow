-- Workspace chat attachments
-- Adds message attachment metadata and a storage bucket for uploaded chat files.

ALTER TABLE work_chat_messages
    ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('work-chat-attachments', 'work-chat-attachments', false, 10485760)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 10485760;

DROP POLICY IF EXISTS "Workspace chat attachments read" ON storage.objects;
CREATE POLICY "Workspace chat attachments read" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'work-chat-attachments');

DROP POLICY IF EXISTS "Workspace chat attachments upload" ON storage.objects;
CREATE POLICY "Workspace chat attachments upload" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'work-chat-attachments' AND owner = auth.uid());

DROP POLICY IF EXISTS "Workspace chat attachments update own" ON storage.objects;
CREATE POLICY "Workspace chat attachments update own" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'work-chat-attachments' AND owner = auth.uid())
    WITH CHECK (bucket_id = 'work-chat-attachments' AND owner = auth.uid());

DROP FUNCTION IF EXISTS public.get_work_chat_messages(UUID, INTEGER);
CREATE OR REPLACE FUNCTION public.get_work_chat_messages(room_uuid UUID, limit_count INTEGER DEFAULT 100)
RETURNS TABLE (
    id UUID,
    room_id UUID,
    parent_id UUID,
    user_id UUID,
    content TEXT,
    mentions TEXT[],
    attachments JSONB,
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
        COALESCE(m.attachments, '[]'::jsonb) AS attachments,
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
