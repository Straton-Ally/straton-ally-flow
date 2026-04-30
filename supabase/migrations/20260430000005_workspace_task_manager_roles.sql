-- Workspace task manager roles
-- Adds Team Lead and Project Manager team roles with task create/update/assign permissions.

ALTER TABLE work_team_members DROP CONSTRAINT IF EXISTS work_team_members_role_check;
ALTER TABLE work_team_members ADD CONSTRAINT work_team_members_role_check
    CHECK (role IN ('owner', 'admin', 'team_lead', 'project_manager', 'member', 'guest'));

CREATE OR REPLACE FUNCTION public.work_can_manage_tasks(_team_id UUID, _user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.has_role(_user_id, 'admin')
        OR EXISTS (
            SELECT 1
            FROM public.work_team_members
            WHERE team_id = _team_id
              AND user_id = _user_id
              AND role IN ('owner', 'admin', 'team_lead', 'project_manager')
        );
$$;

DROP POLICY IF EXISTS "work_tasks_v2_insert" ON work_tasks_v2;
CREATE POLICY "work_tasks_v2_insert" ON work_tasks_v2 FOR INSERT
    WITH CHECK (
        public.has_role(auth.uid(), 'admin')
        OR public.work_can_manage_tasks(public.work_project_team_id(project_id))
    );

DROP POLICY IF EXISTS "work_tasks_v2_update" ON work_tasks_v2;
CREATE POLICY "work_tasks_v2_update" ON work_tasks_v2 FOR UPDATE
    USING (
        public.work_can_manage_tasks(public.work_project_team_id(project_id))
        OR assignee_id = auth.uid()
        OR reporter_id = auth.uid()
    );

DROP POLICY IF EXISTS "work_tasks_v2_delete" ON work_tasks_v2;
CREATE POLICY "work_tasks_v2_delete" ON work_tasks_v2 FOR DELETE
    USING (public.work_can_manage_tasks(public.work_project_team_id(project_id)));
