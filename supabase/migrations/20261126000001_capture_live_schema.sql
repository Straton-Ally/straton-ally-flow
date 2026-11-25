-- Brings objects that only existed in the live database into the repo, so a fresh
-- database built from migrations matches production. Captured with
-- `supabase db dump --remote --schema public` on 2026-11-26. Everything here is
-- idempotent: on production it changes nothing except the security fixes at the end.
--
-- Tables: early_checkout_requests, employee_reporting_lines,
--         employee_team_memberships, employee_teams
-- Functions: get_hierarchy_admin_snapshot, get_managed_employee_ids,
--            get_my_manageable_attendance_employees,
--            handle_early_checkout_request_notifications, prevent_employee_reporting_cycle

CREATE TABLE IF NOT EXISTS "public"."early_checkout_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "reason" "text" NOT NULL,
    "requested_checkout_time" time without time zone NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "response_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "early_checkout_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'declined'::"text"])))
);

COMMENT ON TABLE "public"."early_checkout_requests" IS 'Employee requests to leave early; when approved, employee can check out at requested time.';

CREATE TABLE IF NOT EXISTS "public"."employee_reporting_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "manager_employee_id" "uuid" NOT NULL,
    "report_employee_id" "uuid" NOT NULL,
    "team_id" "uuid",
    "relationship_label" "text" DEFAULT 'manager'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "employee_reporting_lines_check" CHECK (("manager_employee_id" <> "report_employee_id")),
    CONSTRAINT "employee_reporting_lines_relationship_label_check" CHECK (("relationship_label" = ANY (ARRAY['manager'::"text", 'team_lead'::"text", 'supervisor'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."employee_team_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "role_label" "text" DEFAULT 'member'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "employee_team_memberships_role_label_check" CHECK (("role_label" = ANY (ARRAY['member'::"text", 'team_lead'::"text", 'supervisor'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."employee_teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "office_id" "uuid",
    "department_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE ONLY "public"."early_checkout_requests"
      ADD CONSTRAINT "early_checkout_requests_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY "public"."employee_reporting_lines"
      ADD CONSTRAINT "employee_reporting_lines_manager_employee_id_report_employe_key" UNIQUE ("manager_employee_id", "report_employee_id", "team_id");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY "public"."employee_reporting_lines"
      ADD CONSTRAINT "employee_reporting_lines_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY "public"."employee_team_memberships"
      ADD CONSTRAINT "employee_team_memberships_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY "public"."employee_team_memberships"
      ADD CONSTRAINT "employee_team_memberships_team_id_employee_id_key" UNIQUE ("team_id", "employee_id");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY "public"."employee_teams"
      ADD CONSTRAINT "employee_teams_name_key" UNIQUE ("name");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY "public"."employee_teams"
      ADD CONSTRAINT "employee_teams_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY "public"."early_checkout_requests"
      ADD CONSTRAINT "early_checkout_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY "public"."early_checkout_requests"
      ADD CONSTRAINT "early_checkout_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY "public"."employee_reporting_lines"
      ADD CONSTRAINT "employee_reporting_lines_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY "public"."employee_reporting_lines"
      ADD CONSTRAINT "employee_reporting_lines_manager_employee_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY "public"."employee_reporting_lines"
      ADD CONSTRAINT "employee_reporting_lines_report_employee_id_fkey" FOREIGN KEY ("report_employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY "public"."employee_reporting_lines"
      ADD CONSTRAINT "employee_reporting_lines_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."employee_teams"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY "public"."employee_team_memberships"
      ADD CONSTRAINT "employee_team_memberships_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY "public"."employee_team_memberships"
      ADD CONSTRAINT "employee_team_memberships_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY "public"."employee_team_memberships"
      ADD CONSTRAINT "employee_team_memberships_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."employee_teams"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY "public"."employee_teams"
      ADD CONSTRAINT "employee_teams_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY "public"."employee_teams"
      ADD CONSTRAINT "employee_teams_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ONLY "public"."employee_teams"
      ADD CONSTRAINT "employee_teams_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "employee_reporting_lines_manager_idx" ON "public"."employee_reporting_lines" USING "btree" ("manager_employee_id") WHERE ("is_active" = true);

CREATE INDEX IF NOT EXISTS "employee_reporting_lines_report_idx" ON "public"."employee_reporting_lines" USING "btree" ("report_employee_id") WHERE ("is_active" = true);

CREATE INDEX IF NOT EXISTS "employee_reporting_lines_team_idx" ON "public"."employee_reporting_lines" USING "btree" ("team_id") WHERE ("is_active" = true);

CREATE UNIQUE INDEX IF NOT EXISTS "employee_reporting_lines_unique_with_team_idx" ON "public"."employee_reporting_lines" USING "btree" ("manager_employee_id", "report_employee_id", "team_id") WHERE ("team_id" IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS "employee_reporting_lines_unique_without_team_idx" ON "public"."employee_reporting_lines" USING "btree" ("manager_employee_id", "report_employee_id") WHERE ("team_id" IS NULL);

CREATE INDEX IF NOT EXISTS "employee_team_memberships_employee_id_idx" ON "public"."employee_team_memberships" USING "btree" ("employee_id");

CREATE INDEX IF NOT EXISTS "employee_team_memberships_team_id_idx" ON "public"."employee_team_memberships" USING "btree" ("team_id");

CREATE INDEX IF NOT EXISTS "employee_teams_department_id_idx" ON "public"."employee_teams" USING "btree" ("department_id");

CREATE INDEX IF NOT EXISTS "employee_teams_office_id_idx" ON "public"."employee_teams" USING "btree" ("office_id");

CREATE INDEX IF NOT EXISTS "idx_early_checkout_requests_employee_date" ON "public"."early_checkout_requests" USING "btree" ("employee_id", "date");

CREATE INDEX IF NOT EXISTS "idx_early_checkout_requests_status" ON "public"."early_checkout_requests" USING "btree" ("status");

CREATE OR REPLACE FUNCTION "public"."get_hierarchy_admin_snapshot"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT CASE
    WHEN NOT public.has_role(auth.uid(), 'admin') THEN
      jsonb_build_object('employees', '[]'::jsonb, 'teams', '[]'::jsonb, 'memberships', '[]'::jsonb, 'reportingLines', '[]'::jsonb)
    ELSE
      jsonb_build_object(
        'employees',
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', e.id,
              'employee_id', e.employee_id,
              'user_id', e.user_id,
              'full_name', COALESCE(p.full_name, 'Unknown'),
              'email', COALESCE(p.email, ''),
              'designation', e.designation,
              'department_id', e.department_id,
              'department_name', d.name,
              'office_id', e.office_id,
              'office_name', o.name,
              'is_team_lead', e.is_team_lead,
              'status', p.status
            )
            ORDER BY p.full_name NULLS LAST, e.employee_id
          )
          FROM public.employees e
          LEFT JOIN public.profiles p ON p.id = e.user_id
          LEFT JOIN public.departments d ON d.id = e.department_id
          LEFT JOIN public.offices o ON o.id = e.office_id
        ), '[]'::jsonb),
        'teams',
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', t.id,
              'name', t.name,
              'description', t.description,
              'office_id', t.office_id,
              'office_name', o.name,
              'department_id', t.department_id,
              'department_name', d.name,
              'is_active', t.is_active,
              'created_at', t.created_at
            )
            ORDER BY t.name
          )
          FROM public.employee_teams t
          LEFT JOIN public.offices o ON o.id = t.office_id
          LEFT JOIN public.departments d ON d.id = t.department_id
        ), '[]'::jsonb),
        'memberships',
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', m.id,
              'team_id', m.team_id,
              'employee_id', m.employee_id,
              'role_label', m.role_label,
              'is_active', m.is_active
            )
            ORDER BY m.created_at
          )
          FROM public.employee_team_memberships m
        ), '[]'::jsonb),
        'reportingLines',
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', rl.id,
              'manager_employee_id', rl.manager_employee_id,
              'report_employee_id', rl.report_employee_id,
              'team_id', rl.team_id,
              'relationship_label', rl.relationship_label,
              'is_active', rl.is_active
            )
            ORDER BY rl.created_at
          )
          FROM public.employee_reporting_lines rl
        ), '[]'::jsonb)
      )
  END
$$;

CREATE OR REPLACE FUNCTION "public"."get_managed_employee_ids"("_manager_user_id" "uuid") RETURNS TABLE("employee_id" "uuid", "depth" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH RECURSIVE reports(employee_id, depth) AS (
    SELECT erl.report_employee_id, 1
    FROM public.employee_reporting_lines erl
    JOIN public.employees manager_employee ON manager_employee.id = erl.manager_employee_id
    WHERE manager_employee.user_id = _manager_user_id
      AND erl.is_active = true
    UNION
    SELECT erl.report_employee_id, reports.depth + 1
    FROM public.employee_reporting_lines erl
    JOIN reports ON reports.employee_id = erl.manager_employee_id
    WHERE erl.is_active = true
      AND reports.depth < 25
  )
  SELECT reports.employee_id, min(reports.depth)::integer AS depth
  FROM reports
  GROUP BY reports.employee_id
$$;

CREATE OR REPLACE FUNCTION "public"."get_my_manageable_attendance_employees"() RETURNS TABLE("id" "uuid", "employee_id" "text", "user_id" "uuid", "full_name" "text", "email" "text", "designation" "text", "department_id" "uuid", "department_name" "text", "office_id" "uuid", "office_name" "text", "depth" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    e.id,
    e.employee_id,
    e.user_id,
    COALESCE(p.full_name, 'Unknown') AS full_name,
    COALESCE(p.email, '') AS email,
    e.designation,
    e.department_id,
    d.name AS department_name,
    e.office_id,
    o.name AS office_name,
    managed.depth
  FROM public.get_managed_employee_ids(auth.uid()) managed
  JOIN public.employees e ON e.id = managed.employee_id
  LEFT JOIN public.profiles p ON p.id = e.user_id
  LEFT JOIN public.departments d ON d.id = e.department_id
  LEFT JOIN public.offices o ON o.id = e.office_id
  ORDER BY managed.depth, p.full_name NULLS LAST, e.employee_id
$$;

CREATE OR REPLACE FUNCTION "public"."handle_early_checkout_request_notifications"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  employee_row record;
  reviewer uuid;
BEGIN
  SELECT e.employee_id, e.user_id, p.full_name
  INTO employee_row
  FROM public.employees e
  LEFT JOIN public.profiles p ON p.id = e.user_id
  WHERE e.id = NEW.employee_id;

  FOR reviewer IN SELECT user_id FROM public.attendance_reviewer_user_ids(NEW.employee_id) LOOP
    IF reviewer IS NULL OR reviewer = employee_row.user_id THEN
      CONTINUE;
    END IF;
    INSERT INTO public.work_notifications (user_id, actor_id, type, title, body, action_url, metadata)
    VALUES (
      reviewer,
      employee_row.user_id,
      'early_checkout_request',
      'Early checkout request',
      COALESCE(employee_row.full_name, employee_row.employee_id, 'An employee') || ' requested early checkout approval.',
      CASE WHEN public.has_role(reviewer, 'admin') THEN '/admin/attendance' ELSE '/employee/team-attendance' END,
      jsonb_build_object('early_checkout_request_id', NEW.id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."prevent_employee_reporting_cycle"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.is_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.manager_employee_id = NEW.report_employee_id THEN
    RAISE EXCEPTION 'An employee cannot manage themselves';
  END IF;

  IF EXISTS (
    WITH RECURSIVE downstream(employee_id) AS (
      SELECT NEW.report_employee_id
      UNION
      SELECT erl.report_employee_id
      FROM public.employee_reporting_lines erl
      JOIN downstream d ON d.employee_id = erl.manager_employee_id
      WHERE erl.is_active = true
        AND erl.id IS DISTINCT FROM NEW.id
    )
    SELECT 1
    FROM downstream
    WHERE employee_id = NEW.manager_employee_id
  ) THEN
    RAISE EXCEPTION 'This reporting line would create a hierarchy cycle';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER "audit_early_checkout_requests_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."early_checkout_requests" FOR EACH ROW EXECUTE FUNCTION "public"."audit_table_changes"();

CREATE OR REPLACE TRIGGER "audit_employee_reporting_lines_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."employee_reporting_lines" FOR EACH ROW EXECUTE FUNCTION "public"."audit_table_changes"();

CREATE OR REPLACE TRIGGER "audit_employee_team_memberships_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."employee_team_memberships" FOR EACH ROW EXECUTE FUNCTION "public"."audit_table_changes"();

CREATE OR REPLACE TRIGGER "audit_employee_teams_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."employee_teams" FOR EACH ROW EXECUTE FUNCTION "public"."audit_table_changes"();

CREATE OR REPLACE TRIGGER "on_early_checkout_request_notifications" AFTER INSERT ON "public"."early_checkout_requests" FOR EACH ROW EXECUTE FUNCTION "public"."handle_early_checkout_request_notifications"();

CREATE OR REPLACE TRIGGER "on_early_checkout_response_notification" AFTER UPDATE OF "status" ON "public"."early_checkout_requests" FOR EACH ROW EXECUTE FUNCTION "public"."handle_early_checkout_response_notification"();

CREATE OR REPLACE TRIGGER "prevent_employee_reporting_cycle" BEFORE INSERT OR UPDATE OF "manager_employee_id", "report_employee_id", "is_active" ON "public"."employee_reporting_lines" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_employee_reporting_cycle"();

CREATE OR REPLACE TRIGGER "sync_manager_role_from_reporting_line" AFTER INSERT OR DELETE OR UPDATE ON "public"."employee_reporting_lines" FOR EACH ROW EXECUTE FUNCTION "public"."sync_manager_role_from_reporting_line"();

CREATE OR REPLACE TRIGGER "update_employee_reporting_lines_updated_at" BEFORE UPDATE ON "public"."employee_reporting_lines" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_employee_team_memberships_updated_at" BEFORE UPDATE ON "public"."employee_team_memberships" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_employee_teams_updated_at" BEFORE UPDATE ON "public"."employee_teams" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

ALTER TABLE "public"."employee_reporting_lines" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."employee_team_memberships" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."employee_teams" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage employee reporting lines" ON "public"."employee_reporting_lines";
CREATE POLICY "Admins can manage employee reporting lines" ON "public"."employee_reporting_lines" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));

DROP POLICY IF EXISTS "Admins can manage employee team memberships" ON "public"."employee_team_memberships";
CREATE POLICY "Admins can manage employee team memberships" ON "public"."employee_team_memberships" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));

DROP POLICY IF EXISTS "Admins can manage employee teams" ON "public"."employee_teams";
CREATE POLICY "Admins can manage employee teams" ON "public"."employee_teams" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));

DROP POLICY IF EXISTS "Managers can review managed early checkout requests" ON "public"."early_checkout_requests";
CREATE POLICY "Managers can review managed early checkout requests" ON "public"."early_checkout_requests" FOR UPDATE USING ("public"."can_manage_employee"("auth"."uid"(), "employee_id")) WITH CHECK ("public"."can_manage_employee"("auth"."uid"(), "employee_id"));

DROP POLICY IF EXISTS "Managers can view managed early checkout requests" ON "public"."early_checkout_requests";
CREATE POLICY "Managers can view managed early checkout requests" ON "public"."early_checkout_requests" FOR SELECT USING ("public"."can_manage_employee"("auth"."uid"(), "employee_id"));

DROP POLICY IF EXISTS "Team leads can manage office early checkout requests" ON "public"."early_checkout_requests";
CREATE POLICY "Team leads can manage office early checkout requests" ON "public"."early_checkout_requests" USING ("public"."is_team_lead_for_employee"("auth"."uid"(), "employee_id")) WITH CHECK ("public"."is_team_lead_for_employee"("auth"."uid"(), "employee_id"));

REVOKE ALL ON FUNCTION "public"."get_hierarchy_admin_snapshot"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_hierarchy_admin_snapshot"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_hierarchy_admin_snapshot"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_managed_employee_ids"("_manager_user_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_managed_employee_ids"("_manager_user_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_managed_employee_ids"("_manager_user_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_my_manageable_attendance_employees"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_my_manageable_attendance_employees"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_my_manageable_attendance_employees"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."handle_early_checkout_request_notifications"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."handle_early_checkout_request_notifications"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."handle_early_checkout_request_notifications"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."prevent_employee_reporting_cycle"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."prevent_employee_reporting_cycle"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."prevent_employee_reporting_cycle"() TO "service_role";

GRANT ALL ON TABLE "public"."early_checkout_requests" TO "authenticated";

GRANT ALL ON TABLE "public"."early_checkout_requests" TO "service_role";

GRANT ALL ON TABLE "public"."employee_reporting_lines" TO "authenticated";

GRANT ALL ON TABLE "public"."employee_reporting_lines" TO "service_role";

GRANT ALL ON TABLE "public"."employee_team_memberships" TO "authenticated";

GRANT ALL ON TABLE "public"."employee_team_memberships" TO "service_role";

GRANT ALL ON TABLE "public"."employee_teams" TO "authenticated";

GRANT ALL ON TABLE "public"."employee_teams" TO "service_role";

-- ---------------------------------------------------------------------------
-- Security fix: early_checkout_requests had row-level security OFF in production
-- with full grants to anon, so anyone holding the public anon key could read,
-- approve or delete every request. Turn RLS on and add the policies the app needs.
-- Existing policies already cover managers/team leads (select, update) and admins
-- (via can_manage_employee).
-- ---------------------------------------------------------------------------
ALTER TABLE public.early_checkout_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.early_checkout_requests FROM anon;
REVOKE ALL ON TABLE public.employee_reporting_lines FROM anon;
REVOKE ALL ON TABLE public.employee_team_memberships FROM anon;
REVOKE ALL ON TABLE public.employee_teams FROM anon;

DROP POLICY IF EXISTS "Employees can view own early checkout requests" ON public.early_checkout_requests;
CREATE POLICY "Employees can view own early checkout requests" ON public.early_checkout_requests
  FOR SELECT TO authenticated
  USING (employee_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = auth.uid()));

DROP POLICY IF EXISTS "Employees can request early checkout" ON public.early_checkout_requests;
CREATE POLICY "Employees can request early checkout" ON public.early_checkout_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    employee_id IN (SELECT e.id FROM public.employees e WHERE e.user_id = auth.uid())
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND response_notes IS NULL
  );
