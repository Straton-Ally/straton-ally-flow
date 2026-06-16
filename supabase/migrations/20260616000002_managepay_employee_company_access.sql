-- ManagePay employee company scoping.

CREATE TABLE IF NOT EXISTS public.managepay_employee_company_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.managepay_companies(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, company_id)
);

CREATE OR REPLACE FUNCTION public.managepay_user_can_use_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      JOIN public.managepay_access_overrides o ON o.employee_id = e.id AND o.allowed = true
      JOIN public.managepay_employee_company_access a ON a.employee_id = e.id
      WHERE e.user_id = _user_id
        AND a.company_id = _company_id
    );
$$;

CREATE OR REPLACE FUNCTION public.managepay_invoice_company_id(_metadata jsonb)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  company_text text;
BEGIN
  company_text := _metadata->'company'->>'id';
  IF company_text IS NULL OR company_text = '' THEN
    RETURN NULL;
  END IF;
  RETURN company_text::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

DROP FUNCTION IF EXISTS public.list_managepay_access_candidates();

CREATE FUNCTION public.list_managepay_access_candidates()
RETURNS TABLE (
  employee_id uuid,
  user_id uuid,
  employee_code text,
  full_name text,
  department_name text,
  override_allowed boolean,
  effective_access boolean,
  allowed_company_ids uuid[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id AS employee_id,
    e.user_id,
    e.employee_id AS employee_code,
    COALESCE(p.full_name, e.employee_id) AS full_name,
    d.name AS department_name,
    o.allowed AS override_allowed,
    COALESCE(o.allowed, false) AS effective_access,
    COALESCE(
      array_agg(a.company_id ORDER BY c.name) FILTER (WHERE a.company_id IS NOT NULL),
      ARRAY[]::uuid[]
    ) AS allowed_company_ids
  FROM public.employees e
  LEFT JOIN public.profiles p ON p.id = e.user_id
  LEFT JOIN public.departments d ON d.id = e.department_id
  LEFT JOIN public.managepay_access_overrides o ON o.employee_id = e.id
  LEFT JOIN public.managepay_employee_company_access a ON a.employee_id = e.id
  LEFT JOIN public.managepay_companies c ON c.id = a.company_id
  WHERE public.has_role(auth.uid(), 'admin')
  GROUP BY e.id, e.user_id, e.employee_id, p.full_name, d.name, o.allowed
  ORDER BY COALESCE(p.full_name, e.employee_id);
$$;

CREATE OR REPLACE FUNCTION public.set_managepay_employee_company_access(_employee_id uuid, _company_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can manage ManagePay company access';
  END IF;

  DELETE FROM public.managepay_employee_company_access
  WHERE employee_id = _employee_id;

  INSERT INTO public.managepay_employee_company_access (employee_id, company_id, created_by)
  SELECT _employee_id, company_id, auth.uid()
  FROM unnest(COALESCE(_company_ids, ARRAY[]::uuid[])) AS company_ids(company_id)
  JOIN public.managepay_companies c ON c.id = company_id
  ON CONFLICT (employee_id, company_id) DO NOTHING;
END;
$$;

ALTER TABLE public.managepay_employee_company_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage ManagePay employee company access" ON public.managepay_employee_company_access;
CREATE POLICY "Admins manage ManagePay employee company access" ON public.managepay_employee_company_access
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ManagePay users view assigned company access" ON public.managepay_employee_company_access;
CREATE POLICY "ManagePay users view assigned company access" ON public.managepay_employee_company_access
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = managepay_employee_company_access.employee_id
        AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ManagePay users view companies" ON public.managepay_companies;
CREATE POLICY "ManagePay users view companies" ON public.managepay_companies
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      public.can_access_managepay(auth.uid())
      AND public.managepay_user_can_use_company(auth.uid(), id)
    )
  );

DROP POLICY IF EXISTS "ManagePay users insert invoices" ON public.managepay_invoices;
CREATE POLICY "ManagePay users insert invoices" ON public.managepay_invoices
  FOR INSERT WITH CHECK (
    seller_id = auth.uid()
    AND public.can_access_managepay(auth.uid())
    AND public.managepay_user_can_use_company(auth.uid(), public.managepay_invoice_company_id(metadata))
  );

DROP POLICY IF EXISTS "ManagePay users update invoices" ON public.managepay_invoices;
CREATE POLICY "ManagePay users update invoices" ON public.managepay_invoices
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin')
    OR (public.can_access_managepay(auth.uid()) AND seller_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (
      public.can_access_managepay(auth.uid())
      AND seller_id = auth.uid()
      AND public.managepay_user_can_use_company(auth.uid(), public.managepay_invoice_company_id(metadata))
    )
  );

CREATE INDEX IF NOT EXISTS managepay_employee_company_access_employee_idx ON public.managepay_employee_company_access(employee_id);
CREATE INDEX IF NOT EXISTS managepay_employee_company_access_company_idx ON public.managepay_employee_company_access(company_id);

GRANT EXECUTE ON FUNCTION public.managepay_user_can_use_company(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.managepay_invoice_company_id(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_managepay_employee_company_access(uuid, uuid[]) TO authenticated;
