-- Remove the legacy Discord-style work module.
-- The replacement module uses:
--   work_teams, work_team_members, work_projects, work_tasks_v2,
--   work_task_comments, work_chat_rooms, work_chat_messages.

DROP TRIGGER IF EXISTS on_work_message_created_notifications ON public.work_messages;
DROP TRIGGER IF EXISTS on_office_created ON public.offices;
DROP FUNCTION IF EXISTS public.handle_work_message_notifications();
DROP FUNCTION IF EXISTS public.handle_new_office_channels();

ALTER TABLE IF EXISTS public.work_notifications
  DROP CONSTRAINT IF EXISTS work_notifications_channel_id_fkey,
  DROP CONSTRAINT IF EXISTS work_notifications_message_id_fkey;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.work_messages;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.work_tasks;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.work_channels;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END $$;

DROP TABLE IF EXISTS public.work_messages CASCADE;
DROP TABLE IF EXISTS public.work_channel_members CASCADE;
DROP TABLE IF EXISTS public.work_channels CASCADE;
DROP TABLE IF EXISTS public.work_tasks CASCADE;

-- Let admins own workspace setup even when they are not already a member
-- of a specific team. Member-scoped policies still apply for employees.
DROP POLICY IF EXISTS "Admins can manage all work teams" ON public.work_teams;
CREATE POLICY "Admins can manage all work teams"
  ON public.work_teams FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage all work team members" ON public.work_team_members;
CREATE POLICY "Admins can manage all work team members"
  ON public.work_team_members FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage all work projects" ON public.work_projects;
CREATE POLICY "Admins can manage all work projects"
  ON public.work_projects FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage all work project members" ON public.work_project_members;
CREATE POLICY "Admins can manage all work project members"
  ON public.work_project_members FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage all work tasks v2" ON public.work_tasks_v2;
CREATE POLICY "Admins can manage all work tasks v2"
  ON public.work_tasks_v2 FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage all work task comments" ON public.work_task_comments;
CREATE POLICY "Admins can manage all work task comments"
  ON public.work_task_comments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage all work chat rooms" ON public.work_chat_rooms;
CREATE POLICY "Admins can manage all work chat rooms"
  ON public.work_chat_rooms FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage all work chat messages" ON public.work_chat_messages;
CREATE POLICY "Admins can manage all work chat messages"
  ON public.work_chat_messages FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
