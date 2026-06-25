-- Workspace chat realtime
-- Publishes chat message changes so active rooms update without refresh.

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.work_chat_messages;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;

DROP POLICY IF EXISTS "Workspace chat attachments read" ON storage.objects;
CREATE POLICY "Workspace chat attachments read" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'work-chat-attachments');

DROP POLICY IF EXISTS "Workspace chat attachments upload" ON storage.objects;
CREATE POLICY "Workspace chat attachments upload" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'work-chat-attachments' AND owner = auth.uid());
