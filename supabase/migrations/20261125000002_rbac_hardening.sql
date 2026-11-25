-- =====================================================================
-- RBAC hardening (Admin / Manager / Member)
-- Closes privilege-escalation paths found in the Nov 2026 audit.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Manager role
--    A manager covers (a) everyone below them in employee_reporting_lines
--    and (b) their whole office if they are flagged as office lead
--    (employees.is_team_lead). Never themselves. Both sources require the
--    'manager' role, which admins grant; flag and reporting lines keep it
--    in sync automatically.
-- ---------------------------------------------------------------------
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT e.user_id, 'manager'::public.app_role
FROM public.employees e
WHERE e.user_id IS NOT NULL
  AND (
    e.is_team_lead = true
    OR EXISTS (
      SELECT 1 FROM public.employee_reporting_lines erl
      WHERE erl.manager_employee_id = e.id AND erl.is_active
    )
  )
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'manager')
$$;

-- Existing policies call these helpers (office-lead policies and the
-- reporting-line policies), so redefining them moves every manager policy
-- onto the manager role in one place.
CREATE OR REPLACE FUNCTION public.is_team_lead(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'manager')
$$;

-- Office-wide scope: manager role AND flagged office lead of that office.
CREATE OR REPLACE FUNCTION public.is_team_lead_for_office(_user_id uuid, _office_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _office_id IS NOT NULL
    AND public.has_role(_user_id, 'manager')
    AND EXISTS (
      SELECT 1 FROM public.employees
      WHERE user_id = _user_id AND is_team_lead = true AND office_id = _office_id
    )
$$;

-- Reports (any depth) plus office if office lead. Never themselves.
CREATE OR REPLACE FUNCTION public.is_team_lead_for_employee(_user_id uuid, _employee_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'manager')
    AND EXISTS (
      SELECT 1 FROM public.employees target_employee
      WHERE target_employee.id = _employee_id
        AND target_employee.user_id <> _user_id
        AND (
          EXISTS (
            SELECT 1 FROM public.get_managed_employee_ids(_user_id) managed
            WHERE managed.employee_id = _employee_id
          )
          OR public.is_team_lead_for_office(_user_id, target_employee.office_id)
        )
    )
$$;

-- Used by the live "Managers can view managed employee records" policies.
CREATE OR REPLACE FUNCTION public.can_manage_employee(_manager_user_id uuid, _target_employee_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_manager_user_id, 'admin')
    OR public.is_team_lead_for_employee(_manager_user_id, _target_employee_id)
$$;

CREATE OR REPLACE FUNCTION public.manages_employee(_employee_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_manage_employee(_user_id, _employee_id)
$$;

-- Primary role for the current client (admin > employee). Manager is an
-- additional role row and is read separately via get_me().
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id AND role <> 'manager'
  ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END
  LIMIT 1
$$;

-- Recompute the manager role for one employee from flag + reporting lines.
CREATE OR REPLACE FUNCTION public.refresh_manager_role(_employee_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  emp record;
BEGIN
  SELECT id, user_id, is_team_lead INTO emp FROM public.employees WHERE id = _employee_id;
  IF emp.user_id IS NULL THEN RETURN; END IF;

  IF emp.is_team_lead OR EXISTS (
    SELECT 1 FROM public.employee_reporting_lines
    WHERE manager_employee_id = emp.id AND is_active
  ) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (emp.user_id, 'manager')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = emp.user_id AND role = 'manager';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_manager_role_from_employee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.refresh_manager_role(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_manager_role_from_flag ON public.employees;
DROP TRIGGER IF EXISTS sync_manager_role_from_employee ON public.employees;
CREATE TRIGGER sync_manager_role_from_employee
  AFTER INSERT OR UPDATE OF is_team_lead ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.sync_manager_role_from_employee();

CREATE OR REPLACE FUNCTION public.sync_manager_role_from_reporting_line()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.refresh_manager_role(OLD.manager_employee_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.refresh_manager_role(NEW.manager_employee_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_manager_role_from_reporting_line ON public.employee_reporting_lines;
CREATE TRIGGER sync_manager_role_from_reporting_line
  AFTER INSERT OR UPDATE OR DELETE ON public.employee_reporting_lines
  FOR EACH ROW EXECUTE FUNCTION public.sync_manager_role_from_reporting_line();

-- One call for the client: who am I and what can I do.
CREATE OR REPLACE FUNCTION public.get_me()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'user_id', p.id,
    'email', p.email,
    'full_name', p.full_name,
    'avatar_url', p.avatar_url,
    'status', p.status,
    'role', CASE
      WHEN public.has_role(p.id, 'admin') THEN 'admin'
      WHEN public.has_role(p.id, 'manager') THEN 'manager'
      ELSE 'member' END,
    'employee', (
      SELECT jsonb_build_object(
        'id', e.id, 'employee_id', e.employee_id, 'office_id', e.office_id,
        'department_id', e.department_id, 'designation', e.designation,
        'work_location', e.work_location)
      FROM public.employees e WHERE e.user_id = p.id
    ),
    'can_access_flowmath', COALESCE(public.can_access_flowmath(p.id), false),
    'can_access_flowpay', COALESCE(public.can_access_managepay(p.id), false)
  )
  FROM public.profiles p
  WHERE p.id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- 2. Column guards: members may only edit their own contact details
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_employee_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  self_cols text[] := ARRAY['phone','address','emergency_contact','gender','updated_at'];
  lead_blocked text[] := ARRAY['is_team_lead','office_id','user_id','work_location'];
  col text;
BEGIN
  -- service role, cron and SQL editor have no auth.uid()
  IF uid IS NULL OR public.has_role(uid, 'admin') THEN
    RETURN NEW;
  END IF;

  IF public.is_team_lead_for_employee(uid, OLD.id) THEN
    FOREACH col IN ARRAY lead_blocked LOOP
      IF (to_jsonb(NEW) -> col) IS DISTINCT FROM (to_jsonb(OLD) -> col) THEN
        RAISE EXCEPTION 'Only admins can change %', col USING ERRCODE = '42501';
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  IF OLD.user_id = uid THEN
    IF (to_jsonb(NEW) - self_cols) IS DISTINCT FROM (to_jsonb(OLD) - self_cols) THEN
      RAISE EXCEPTION 'You can only change your phone, address, emergency contact and gender'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not allowed to update this employee' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS aa_guard_employee_update ON public.employees;
CREATE TRIGGER aa_guard_employee_update
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.guard_employee_update();

CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  self_cols text[] := ARRAY['full_name','avatar_url','updated_at'];
BEGIN
  IF uid IS NULL OR public.has_role(uid, 'admin') THEN
    RETURN NEW;
  END IF;

  -- Managers may also change status for people in their office (not email).
  IF EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.user_id = OLD.id AND public.is_team_lead_for_employee(uid, e.id)
  ) THEN
    IF (to_jsonb(NEW) - (self_cols || ARRAY['status'])) IS DISTINCT FROM (to_jsonb(OLD) - (self_cols || ARRAY['status'])) THEN
      RAISE EXCEPTION 'Managers can only change name, photo and status' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.id = uid THEN
    IF (to_jsonb(NEW) - self_cols) IS DISTINCT FROM (to_jsonb(OLD) - self_cols) THEN
      RAISE EXCEPTION 'You can only change your name and photo' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not allowed to update this profile' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS aa_guard_profile_update ON public.profiles;
CREATE TRIGGER aa_guard_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

-- ---------------------------------------------------------------------
-- 3. Attendance: the server clock is the source of truth for self clock-ins
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attendance_server_clock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  tz text := COALESCE(NULLIF(NEW.attendance_time_zone, ''), 'Asia/Karachi');
  local_now timestamp;
BEGIN
  -- Admins, managers of this employee, cron and service role keep full control.
  IF uid IS NULL OR public.manages_employee(NEW.employee_id, uid) THEN
    RETURN NEW;
  END IF;

  local_now := now() AT TIME ZONE tz;

  IF TG_OP = 'INSERT' THEN
    NEW.date := local_now::date;
    IF NEW.check_in_at IS NOT NULL THEN
      NEW.check_in_at := now();
      NEW.in_time := local_now::time(0);
    END IF;
    IF NEW.check_out_at IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot check out before checking in' USING ERRCODE = '42501';
    END IF;
    IF NEW.status IS NOT NULL AND NEW.status <> 'present' THEN
      NEW.status := 'present';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE by the employee themselves
  NEW.employee_id := OLD.employee_id;
  NEW.date := OLD.date;
  NEW.check_in_at := OLD.check_in_at;
  NEW.in_time := OLD.in_time;
  NEW.status := CASE WHEN NEW.status = 'present' OR NEW.status IS NOT DISTINCT FROM OLD.status
                     THEN NEW.status ELSE OLD.status END;

  IF OLD.check_out_at IS NOT NULL THEN
    NEW.check_out_at := OLD.check_out_at;
    NEW.out_time := OLD.out_time;
  ELSIF NEW.check_out_at IS NOT NULL THEN
    NEW.check_out_at := now();
    NEW.out_time := local_now::time(0);
  END IF;

  IF NEW.break_start_at IS NOT NULL AND NEW.break_start_at IS DISTINCT FROM OLD.break_start_at THEN
    NEW.break_start_at := now();
  END IF;

  IF NEW.last_verified_at IS NOT NULL AND NEW.last_verified_at IS DISTINCT FROM OLD.last_verified_at THEN
    NEW.last_verified_at := now();
  END IF;

  RETURN NEW;
END;
$$;

-- "aa_" prefix: BEFORE triggers fire alphabetically, so this runs ahead of
-- the geofence, expected-checkout and auto-evaluate triggers.
DROP TRIGGER IF EXISTS aa_attendance_server_clock ON public.attendance;
CREATE TRIGGER aa_attendance_server_clock
  BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.attendance_server_clock();

-- ---------------------------------------------------------------------
-- 4. Work module: no self-join into teams or projects
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "work_team_members_insert" ON public.work_team_members;
CREATE POLICY "work_team_members_insert" ON public.work_team_members FOR INSERT
  WITH CHECK (public.work_can_manage_team(team_id));

DROP POLICY IF EXISTS "work_project_members_insert" ON public.work_project_members;
CREATE POLICY "work_project_members_insert" ON public.work_project_members FOR INSERT
  WITH CHECK (public.work_can_manage_team(public.work_project_team_id(project_id)));

ALTER VIEW IF EXISTS public.work_task_subtasks SET (security_invoker = true);

CREATE OR REPLACE FUNCTION public.get_user_teams(user_uuid uuid)
RETURNS TABLE (team_id uuid, name text, description text, avatar_url text, role text, member_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF user_uuid IS DISTINCT FROM auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT wt.id, wt.name, wt.description, wt.avatar_url, wtm.role, COUNT(wtm2.user_id)::bigint
  FROM public.work_teams wt
  JOIN public.work_team_members wtm ON wt.id = wtm.team_id
  LEFT JOIN public.work_team_members wtm2 ON wt.id = wtm2.team_id
  WHERE wtm.user_id = user_uuid
  GROUP BY wt.id, wt.name, wt.description, wt.avatar_url, wtm.role;
END;
$$;

-- Old work-module files: only the uploader or an admin can read them.
DROP POLICY IF EXISTS "work_attachments_owner_or_admin_read" ON storage.objects;
CREATE POLICY "work_attachments_owner_or_admin_read" ON storage.objects
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    bucket_id NOT IN ('work-chat-attachments', 'work-task-attachments')
    OR owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- ---------------------------------------------------------------------
-- 5. Function execute privileges
-- ---------------------------------------------------------------------
-- Signed-out visitors get nothing by default...
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;

-- ...except the public invoice page.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_managepay_public_invoice'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', f.sig);
  END LOOP;
END $$;

-- Internal-only functions: callable by cron/triggers/service role, never by users.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'invoke_internal_edge_function',
        'auto_checkout_attendance',
        'attendance_process_due_events',
        'get_project_tasks'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', f.sig);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 6. Missing indexes on hot paths
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_employees_office_id_user ON public.employees(office_id, user_id);
CREATE INDEX IF NOT EXISTS idx_work_projects_team_id ON public.work_projects(team_id);
CREATE INDEX IF NOT EXISTS idx_work_tasks_v2_project_id ON public.work_tasks_v2(project_id);
CREATE INDEX IF NOT EXISTS idx_work_tasks_v2_assignee_id ON public.work_tasks_v2(assignee_id);
CREATE INDEX IF NOT EXISTS idx_work_task_comments_task_id ON public.work_task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_flowmath_journal_lines_entry ON public.flowmath_journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_flowmath_document_lines_document ON public.flowmath_document_lines(document_id);
CREATE INDEX IF NOT EXISTS idx_flowmath_payroll_items_employee ON public.flowmath_payroll_items(employee_id);
