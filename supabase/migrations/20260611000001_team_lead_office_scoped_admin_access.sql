-- Grant Team Leads admin-style HR access only within their assigned office.
-- Admins retain global access through the existing app_role policies.

CREATE OR REPLACE FUNCTION public.is_team_lead(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees
    WHERE user_id = _user_id
      AND is_team_lead = true
      AND office_id IS NOT NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.is_team_lead_for_office(_user_id uuid, _office_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _office_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.employees
      WHERE user_id = _user_id
        AND is_team_lead = true
        AND office_id = _office_id
    )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_team_lead_for_employee(_user_id uuid, _employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
    OR public.is_team_lead_for_employee(_user_id, _employee_id)
$$;

DROP POLICY IF EXISTS "Everyone can view offices" ON public.offices;
DROP POLICY IF EXISTS "Users can view assigned office" ON public.offices;
CREATE POLICY "Users can view assigned office" ON public.offices
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_team_lead_for_office(auth.uid(), offices.id)
    OR EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.user_id = auth.uid()
        AND employees.office_id = offices.id
    )
  );

DROP POLICY IF EXISTS "Everyone can view office settings" ON public.office_settings;
DROP POLICY IF EXISTS "Users can view assigned office settings" ON public.office_settings;
CREATE POLICY "Users can view assigned office settings" ON public.office_settings
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_team_lead_for_office(auth.uid(), office_settings.office_id)
    OR EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.user_id = auth.uid()
        AND employees.office_id = office_settings.office_id
    )
  );

DROP POLICY IF EXISTS "Team leads can manage assigned office settings" ON public.office_settings;
CREATE POLICY "Team leads can manage assigned office settings" ON public.office_settings
  FOR ALL USING (public.is_team_lead_for_office(auth.uid(), office_settings.office_id))
  WITH CHECK (public.is_team_lead_for_office(auth.uid(), office_settings.office_id));

DROP POLICY IF EXISTS "Everyone can view office departments" ON public.office_departments;
DROP POLICY IF EXISTS "Users can view assigned office departments" ON public.office_departments;
CREATE POLICY "Users can view assigned office departments" ON public.office_departments
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_team_lead_for_office(auth.uid(), office_departments.office_id)
    OR EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.user_id = auth.uid()
        AND employees.office_id = office_departments.office_id
    )
  );

DROP POLICY IF EXISTS "Team leads can manage assigned office departments" ON public.office_departments;
CREATE POLICY "Team leads can manage assigned office departments" ON public.office_departments
  FOR ALL USING (public.is_team_lead_for_office(auth.uid(), office_departments.office_id))
  WITH CHECK (public.is_team_lead_for_office(auth.uid(), office_departments.office_id));

DROP POLICY IF EXISTS "Team leads can view office employees" ON public.employees;
CREATE POLICY "Team leads can view office employees" ON public.employees
  FOR SELECT USING (public.is_team_lead_for_office(auth.uid(), employees.office_id));

DROP POLICY IF EXISTS "Team leads can update office employees" ON public.employees;
CREATE POLICY "Team leads can update office employees" ON public.employees
  FOR UPDATE USING (public.is_team_lead_for_office(auth.uid(), employees.office_id))
  WITH CHECK (public.is_team_lead_for_office(auth.uid(), employees.office_id));

DROP POLICY IF EXISTS "Team leads can insert office employees" ON public.employees;
CREATE POLICY "Team leads can insert office employees" ON public.employees
  FOR INSERT WITH CHECK (public.is_team_lead_for_office(auth.uid(), employees.office_id));

DROP POLICY IF EXISTS "Team leads can delete office employees" ON public.employees;
CREATE POLICY "Team leads can delete office employees" ON public.employees
  FOR DELETE USING (public.is_team_lead_for_office(auth.uid(), employees.office_id));

DROP POLICY IF EXISTS "Team leads can update office profiles" ON public.profiles;
CREATE POLICY "Team leads can update office profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.user_id = profiles.id
        AND public.is_team_lead_for_office(auth.uid(), employees.office_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.user_id = profiles.id
        AND public.is_team_lead_for_office(auth.uid(), employees.office_id)
    )
  );

DROP POLICY IF EXISTS "Team leads can manage office salaries" ON public.salaries;
CREATE POLICY "Team leads can manage office salaries" ON public.salaries
  FOR ALL USING (public.is_team_lead_for_employee(auth.uid(), salaries.employee_id))
  WITH CHECK (public.is_team_lead_for_employee(auth.uid(), salaries.employee_id));

DROP POLICY IF EXISTS "Team leads can manage office attendance" ON public.attendance;
CREATE POLICY "Team leads can manage office attendance" ON public.attendance
  FOR ALL USING (public.is_team_lead_for_employee(auth.uid(), attendance.employee_id))
  WITH CHECK (public.is_team_lead_for_employee(auth.uid(), attendance.employee_id));

DROP POLICY IF EXISTS "Team leads can manage office access control" ON public.access_control;
CREATE POLICY "Team leads can manage office access control" ON public.access_control
  FOR ALL USING (
    public.is_team_lead_for_office(auth.uid(), access_control.office_id)
    AND public.is_team_lead_for_employee(auth.uid(), access_control.employee_id)
  )
  WITH CHECK (
    public.is_team_lead_for_office(auth.uid(), access_control.office_id)
    AND public.is_team_lead_for_employee(auth.uid(), access_control.employee_id)
  );

DROP POLICY IF EXISTS "Team leads can manage office duty schedules" ON public.duty_schedules;
CREATE POLICY "Team leads can manage office duty schedules" ON public.duty_schedules
  FOR ALL USING (
    public.is_team_lead_for_office(auth.uid(), duty_schedules.office_id)
    AND public.is_team_lead_for_employee(auth.uid(), duty_schedules.employee_id)
  )
  WITH CHECK (
    public.is_team_lead_for_office(auth.uid(), duty_schedules.office_id)
    AND public.is_team_lead_for_employee(auth.uid(), duty_schedules.employee_id)
  );

DROP POLICY IF EXISTS "Team leads can view office access logs" ON public.access_logs;
CREATE POLICY "Team leads can view office access logs" ON public.access_logs
  FOR SELECT USING (
    public.is_team_lead_for_office(auth.uid(), access_logs.office_id)
    AND (
      access_logs.employee_id IS NULL
      OR public.is_team_lead_for_employee(auth.uid(), access_logs.employee_id)
    )
  );

DROP POLICY IF EXISTS "Team leads can manage office work notifications" ON public.work_notifications;
CREATE POLICY "Team leads can manage office work notifications" ON public.work_notifications
  FOR ALL USING (public.is_team_lead_for_office(auth.uid(), work_notifications.office_id))
  WITH CHECK (public.is_team_lead_for_office(auth.uid(), work_notifications.office_id));

DO $$
BEGIN
  IF to_regclass('public.early_checkout_requests') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Team leads can manage office early checkout requests" ON public.early_checkout_requests';
    EXECUTE 'CREATE POLICY "Team leads can manage office early checkout requests" ON public.early_checkout_requests
      FOR ALL USING (public.is_team_lead_for_employee(auth.uid(), employee_id))
      WITH CHECK (public.is_team_lead_for_employee(auth.uid(), employee_id))';
  END IF;
END
$$;
