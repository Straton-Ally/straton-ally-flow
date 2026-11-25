-- RLS checks for early_checkout_requests (migration 20261126000001).
-- Run against a disposable copy of the database; everything rolls back.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/early_checkout_checks.sql
BEGIN;

CREATE TEMP TABLE results (name text, ok boolean) ON COMMIT DROP;
GRANT ALL ON results TO PUBLIC;

-- Two employees with no manager or admin role, plus one admin.
CREATE TEMP TABLE ids AS
SELECT
  (SELECT e.user_id FROM public.employees e
    WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = e.user_id AND r.role IN ('admin', 'manager'))
    ORDER BY e.id LIMIT 1) AS member_user,
  (SELECT e.id FROM public.employees e
    WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = e.user_id AND r.role IN ('admin', 'manager'))
    ORDER BY e.id LIMIT 1) AS member_emp,
  (SELECT e.id FROM public.employees e
    WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = e.user_id AND r.role IN ('admin', 'manager'))
    ORDER BY e.id OFFSET 1 LIMIT 1) AS other_emp,
  (SELECT r.user_id FROM public.user_roles r WHERE r.role = 'admin' LIMIT 1) AS admin_user;
GRANT SELECT ON ids TO PUBLIC;

INSERT INTO public.early_checkout_requests (employee_id, date, reason, requested_checkout_time)
SELECT other_emp, current_date, 'someone else', '15:00' FROM ids;

-- anon: nothing
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
DO $$ BEGIN
  PERFORM 1 FROM public.early_checkout_requests;
  INSERT INTO results VALUES ('anon cannot read', false);
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('anon cannot read', true);
END $$;
RESET ROLE;

-- member
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT member_user FROM ids), 'role', 'authenticated')::text, true);

INSERT INTO results
SELECT 'member cannot see other requests',
       NOT EXISTS (SELECT 1 FROM public.early_checkout_requests r WHERE r.employee_id = (SELECT other_emp FROM ids));

DO $$ BEGIN
  INSERT INTO public.early_checkout_requests (employee_id, date, reason, requested_checkout_time)
  SELECT member_emp, current_date, 'dentist', '16:00' FROM ids;
  INSERT INTO results VALUES ('member can request for self', true);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO results VALUES ('member can request for self', false);
END $$;

INSERT INTO results
SELECT 'member sees own request',
       EXISTS (SELECT 1 FROM public.early_checkout_requests r WHERE r.employee_id = (SELECT member_emp FROM ids));

DO $$ BEGIN
  INSERT INTO public.early_checkout_requests (employee_id, date, reason, requested_checkout_time)
  SELECT other_emp, current_date, 'not me', '16:00' FROM ids;
  INSERT INTO results VALUES ('member cannot request for others', false);
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('member cannot request for others', true);
END $$;

DO $$ BEGIN
  INSERT INTO public.early_checkout_requests (employee_id, date, reason, requested_checkout_time, status)
  SELECT member_emp, current_date, 'pre-approved', '16:00', 'approved' FROM ids;
  INSERT INTO results VALUES ('member cannot self-approve on insert', false);
EXCEPTION WHEN insufficient_privilege THEN
  INSERT INTO results VALUES ('member cannot self-approve on insert', true);
END $$;

WITH upd AS (
  UPDATE public.early_checkout_requests SET status = 'approved'
   WHERE employee_id = (SELECT member_emp FROM ids) RETURNING 1
)
INSERT INTO results SELECT 'member cannot approve own request', count(*) = 0 FROM upd;

WITH del AS (DELETE FROM public.early_checkout_requests RETURNING 1)
INSERT INTO results SELECT 'member cannot delete requests', count(*) = 0 FROM del;
RESET ROLE;

-- admin
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT admin_user FROM ids), 'role', 'authenticated')::text, true);
INSERT INTO results
SELECT 'admin sees all requests', (SELECT count(*) FROM public.early_checkout_requests r
  WHERE r.employee_id IN ((SELECT member_emp FROM ids), (SELECT other_emp FROM ids))) = 2;
WITH upd AS (
  UPDATE public.early_checkout_requests SET status = 'approved'
   WHERE employee_id = (SELECT member_emp FROM ids) RETURNING 1
)
INSERT INTO results SELECT 'admin can approve', count(*) = 1 FROM upd;
RESET ROLE;

SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, name FROM results;
SELECT count(*) FILTER (WHERE NOT ok) AS failures, count(*) AS total FROM results;
ROLLBACK;
