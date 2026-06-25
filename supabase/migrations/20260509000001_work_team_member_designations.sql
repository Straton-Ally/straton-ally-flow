CREATE OR REPLACE FUNCTION public.get_work_team_member_designations(_team_id uuid)
RETURNS TABLE (
  user_id uuid,
  designation text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT e.user_id, e.designation
  FROM public.work_team_members wtm
  JOIN public.employees e ON e.user_id = wtm.user_id
  WHERE wtm.team_id = _team_id
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.work_is_team_member(_team_id, auth.uid())
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_work_team_member_designations(uuid) TO authenticated;
