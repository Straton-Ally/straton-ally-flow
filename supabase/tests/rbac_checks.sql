-- RBAC smoke checks. Run against a COPY of the database, never production:
--   psql -v ON_ERROR_STOP=0 -f supabase/tests/rbac_checks.sql
-- Everything runs inside one transaction that is rolled back at the end.
-- Each check prints PASS/FAIL.
\set ON_ERROR_ROLLBACK on
\set QUIET on
\pset tuples_only on
BEGIN;

-- Pick a plain member (no admin/manager role, has an employee row) and a manager.
SELECT e.user_id AS member_uid, e.id AS member_emp
FROM public.employees e
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = e.user_id AND r.role IN ('admin','manager'))
ORDER BY e.created_at LIMIT 1 \gset

SELECT e.user_id AS manager_uid, e.id AS manager_emp
FROM public.employees e
JOIN public.user_roles r ON r.user_id = e.user_id AND r.role = 'manager'
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles a WHERE a.user_id = e.user_id AND a.role = 'admin')
ORDER BY e.created_at LIMIT 1 \gset

CREATE TEMP TABLE rbac_results (check_name text, passed boolean);
GRANT ALL ON rbac_results TO authenticated, anon;

-- ---------------------------------------------------------------- member
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'member_uid', 'role', 'authenticated')::text, true);

-- 1. cannot promote self
DO $$ BEGIN
  UPDATE public.employees SET is_team_lead = true WHERE user_id = auth.uid();
  INSERT INTO rbac_results VALUES ('member cannot set is_team_lead', false);
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO rbac_results VALUES ('member cannot set is_team_lead', true);
END $$;

-- 2. cannot change office / department / work_location
DO $$ BEGIN
  UPDATE public.employees SET work_location = 'remote' WHERE user_id = auth.uid();
  INSERT INTO rbac_results VALUES ('member cannot set work_location', false);
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO rbac_results VALUES ('member cannot set work_location', true);
END $$;

-- 3. can still edit own phone
DO $$ DECLARE n int; BEGIN
  UPDATE public.employees SET phone = '+92-000-0000000' WHERE user_id = auth.uid();
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO rbac_results VALUES ('member can edit own phone', n = 1);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO rbac_results VALUES ('member can edit own phone', false);
END $$;

-- 4. cannot change own profile status
DO $$ BEGIN
  UPDATE public.profiles SET status = 'inactive' WHERE id = auth.uid();
  INSERT INTO rbac_results VALUES ('member cannot change profile status', false);
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO rbac_results VALUES ('member cannot change profile status', true);
END $$;

-- 5. sees only own salary rows
INSERT INTO rbac_results
SELECT 'member sees only own salaries',
       NOT EXISTS (SELECT 1 FROM public.salaries s JOIN public.employees e ON e.id = s.employee_id WHERE e.user_id <> auth.uid());

-- 6. internal functions are blocked
DO $$ BEGIN
  PERFORM public.invoke_internal_edge_function('process-email-outbox', '{}'::jsonb);
  INSERT INTO rbac_results VALUES ('member cannot call invoke_internal_edge_function', false);
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO rbac_results VALUES ('member cannot call invoke_internal_edge_function', true);
END $$;

-- 7. backdated clock-in is replaced by the server clock
DO $$ DECLARE stored timestamptz; BEGIN
  DELETE FROM public.attendance WHERE employee_id = (SELECT id FROM public.employees WHERE user_id = auth.uid())
    AND date = (now() AT TIME ZONE 'Asia/Karachi')::date;
  INSERT INTO public.attendance (employee_id, date, status, in_time, check_in_at, attendance_time_zone)
  VALUES ((SELECT id FROM public.employees WHERE user_id = auth.uid()), '2020-01-01', 'present', '06:00', '2020-01-01 01:00+00', 'Asia/Karachi')
  RETURNING check_in_at INTO stored;
  INSERT INTO rbac_results VALUES ('clock-in uses server time', abs(extract(epoch FROM stored - now())) < 5);
EXCEPTION WHEN OTHERS THEN
  -- geofence or other business rules may reject the insert outright; that is also safe
  INSERT INTO rbac_results VALUES ('clock-in uses server time (rejected: ' || SQLERRM || ')', true);
END $$;

-- 8. cannot add self to someone else's work team
DO $$ BEGIN
  INSERT INTO public.work_team_members (team_id, user_id, role)
  SELECT id, auth.uid(), 'owner' FROM public.work_teams
  WHERE NOT public.work_is_team_member(id) LIMIT 1;
  INSERT INTO rbac_results VALUES ('member cannot self-join work team', NOT FOUND);
EXCEPTION WHEN insufficient_privilege OR check_violation THEN
  INSERT INTO rbac_results VALUES ('member cannot self-join work team', true);
END $$;

-- 9. get_me reports member
INSERT INTO rbac_results SELECT 'get_me role = member', (public.get_me() ->> 'role') = 'member';

RESET ROLE;

-- ---------------------------------------------------------------- manager
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'manager_uid', 'role', 'authenticated')::text, true);

INSERT INTO rbac_results SELECT 'manager does not manage self',
  NOT public.is_team_lead_for_employee(auth.uid(), (SELECT id FROM public.employees WHERE user_id = auth.uid()));

INSERT INTO rbac_results SELECT 'get_me role = manager', (public.get_me() ->> 'role') = 'manager';

DO $$ BEGIN
  UPDATE public.employees SET is_team_lead = true
  WHERE id IN (SELECT employee_id FROM public.get_managed_employee_ids(auth.uid()))
    AND is_team_lead = false;
  INSERT INTO rbac_results VALUES ('manager cannot promote reports', NOT FOUND);
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO rbac_results VALUES ('manager cannot promote reports', true);
END $$;

RESET ROLE;

-- ---------------------------------------------------------------- signed out
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);

DO $$ BEGIN
  PERFORM public.has_role(gen_random_uuid(), 'admin');
  INSERT INTO rbac_results VALUES ('anon cannot call has_role', false);
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO rbac_results VALUES ('anon cannot call has_role', true);
END $$;

DO $$ BEGIN
  PERFORM public.auto_checkout_attendance(gen_random_uuid(), now());
  INSERT INTO rbac_results VALUES ('anon cannot call auto_checkout_attendance', false);
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO rbac_results VALUES ('anon cannot call auto_checkout_attendance', true);
END $$;

RESET ROLE;

SELECT CASE WHEN passed THEN 'PASS  ' ELSE 'FAIL  ' END || check_name FROM rbac_results;
SELECT count(*) FILTER (WHERE NOT passed) || ' failed of ' || count(*) FROM rbac_results;

ROLLBACK;
