-- Work task attachments and employee participation
-- Adds downloadable task attachments and allows workspace members to participate
-- in task progress updates/comments.

CREATE TABLE IF NOT EXISTS public.work_task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.work_tasks_v2(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'application/octet-stream',
  size bigint NOT NULL DEFAULT 0,
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_task_attachments_task_id
  ON public.work_task_attachments(task_id, created_at DESC);

ALTER TABLE public.work_task_attachments ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('work-task-attachments', 'work-task-attachments', false, 10485760)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 10485760;

DROP POLICY IF EXISTS "Workspace task attachments read storage" ON storage.objects;
CREATE POLICY "Workspace task attachments read storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'work-task-attachments');

DROP POLICY IF EXISTS "Workspace task attachments upload storage" ON storage.objects;
CREATE POLICY "Workspace task attachments upload storage" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'work-task-attachments' AND owner = auth.uid());

DROP POLICY IF EXISTS "Workspace task attachments update own storage" ON storage.objects;
CREATE POLICY "Workspace task attachments update own storage" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'work-task-attachments' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'work-task-attachments' AND owner = auth.uid());

DROP POLICY IF EXISTS "work_task_attachments_select" ON public.work_task_attachments;
CREATE POLICY "work_task_attachments_select" ON public.work_task_attachments
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.work_is_team_member(public.work_task_team_id(task_id))
  );

DROP POLICY IF EXISTS "work_task_attachments_insert" ON public.work_task_attachments;
CREATE POLICY "work_task_attachments_insert" ON public.work_task_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.work_is_team_member(public.work_task_team_id(task_id))
    )
  );

DROP POLICY IF EXISTS "work_task_attachments_delete_own" ON public.work_task_attachments;
CREATE POLICY "work_task_attachments_delete_own" ON public.work_task_attachments
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.work_can_manage_tasks(public.work_task_team_id(task_id))
  );

-- Let workspace members participate in task progress. The app still controls which
-- fields it updates from employee UI; this policy removes RLS blocks for members.
DROP POLICY IF EXISTS "work_tasks_v2_update" ON public.work_tasks_v2;
CREATE POLICY "work_tasks_v2_update" ON public.work_tasks_v2
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.work_is_team_member(public.work_project_team_id(project_id))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.work_is_team_member(public.work_project_team_id(project_id))
  );

DROP POLICY IF EXISTS "work_task_comments_insert" ON public.work_task_comments;
CREATE POLICY "work_task_comments_insert" ON public.work_task_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.work_is_team_member(public.work_task_team_id(task_id))
    )
  );
