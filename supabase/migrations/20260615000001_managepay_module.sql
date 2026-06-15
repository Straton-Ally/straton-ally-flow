-- ManagePay module: invoice/payment terminal access, companies, clients, invoices, and services.

CREATE TABLE IF NOT EXISTS public.managepay_access_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  allowed boolean NOT NULL,
  reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id)
);

CREATE TABLE IF NOT EXISTS public.managepay_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  address text,
  phone text,
  website text,
  logo_url text,
  logo_has_dark_bg boolean NOT NULL DEFAULT false,
  payment_base_url text,
  tax_id text,
  stripe_account_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.managepay_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  company_name text,
  phone text,
  address text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.managepay_invoice_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  default_rate integer NOT NULL DEFAULT 0 CHECK (default_rate >= 0),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.managepay_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.managepay_clients(id) ON DELETE SET NULL,
  client_email text NOT NULL,
  amount_in_cents integer NOT NULL CHECK (amount_in_cents >= 0),
  currency text NOT NULL DEFAULT 'gbp',
  description text,
  due_date timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'canceled')),
  stripe_payment_intent_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.managepay_terminal_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_in_cents integer NOT NULL CHECK (amount_in_cents > 0),
  fee_in_cents integer NOT NULL DEFAULT 0 CHECK (fee_in_cents >= 0),
  total_in_cents integer NOT NULL CHECK (total_in_cents > 0),
  currency text NOT NULL DEFAULT 'gbp',
  description text,
  customer_email text,
  customer_name text,
  customer_phone text,
  payment_method text NOT NULL CHECK (payment_method IN ('card', 'mobile', 'qr', 'payment_link')),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'canceled')),
  provider_reference text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.managepay_invoice_services (name, description, default_rate)
VALUES
  ('Consulting', 'Professional advisory and implementation work', 0),
  ('Development', 'Software development and technical delivery', 0),
  ('Design', 'Product, brand, and interface design services', 0),
  ('Support', 'Operational support and maintenance', 0)
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.can_access_managepay(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  employee_uuid uuid;
  override_allowed boolean;
BEGIN
  IF public.has_role(_user_id, 'admin') THEN
    RETURN true;
  END IF;

  SELECT id INTO employee_uuid
  FROM public.employees
  WHERE user_id = _user_id;

  IF employee_uuid IS NULL THEN
    RETURN false;
  END IF;

  SELECT allowed INTO override_allowed
  FROM public.managepay_access_overrides
  WHERE employee_id = employee_uuid;

  RETURN COALESCE(override_allowed, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_managepay_access_candidates()
RETURNS TABLE (
  employee_id uuid,
  user_id uuid,
  employee_code text,
  full_name text,
  department_name text,
  override_allowed boolean,
  effective_access boolean
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
    COALESCE(o.allowed, false) AS effective_access
  FROM public.employees e
  LEFT JOIN public.profiles p ON p.id = e.user_id
  LEFT JOIN public.departments d ON d.id = e.department_id
  LEFT JOIN public.managepay_access_overrides o ON o.employee_id = e.id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY COALESCE(p.full_name, e.employee_id);
$$;

CREATE OR REPLACE FUNCTION public.get_managepay_public_invoice(_invoice_ref text)
RETURNS TABLE (
  id uuid,
  invoice_number text,
  client_email text,
  amount_in_cents integer,
  currency text,
  description text,
  due_date timestamptz,
  status text,
  metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.invoice_number,
    i.client_email,
    i.amount_in_cents,
    i.currency,
    i.description,
    i.due_date,
    i.status,
    i.metadata,
    i.created_at,
    i.updated_at
  FROM public.managepay_invoices i
  WHERE i.id::text = _invoice_ref OR i.invoice_number = _invoice_ref
  ORDER BY i.created_at DESC
  LIMIT 1;
END;
$$;

ALTER TABLE public.managepay_access_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managepay_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managepay_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managepay_invoice_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managepay_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managepay_terminal_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage ManagePay access" ON public.managepay_access_overrides;
CREATE POLICY "Admins manage ManagePay access" ON public.managepay_access_overrides
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ManagePay users view companies" ON public.managepay_companies;
CREATE POLICY "ManagePay users view companies" ON public.managepay_companies
  FOR SELECT USING (public.can_access_managepay(auth.uid()));
DROP POLICY IF EXISTS "Admins manage ManagePay companies" ON public.managepay_companies;
CREATE POLICY "Admins manage ManagePay companies" ON public.managepay_companies
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ManagePay users view services" ON public.managepay_invoice_services;
CREATE POLICY "ManagePay users view services" ON public.managepay_invoice_services
  FOR SELECT USING (public.can_access_managepay(auth.uid()));
DROP POLICY IF EXISTS "Admins manage ManagePay services" ON public.managepay_invoice_services;
CREATE POLICY "Admins manage ManagePay services" ON public.managepay_invoice_services
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ManagePay users view clients" ON public.managepay_clients;
CREATE POLICY "ManagePay users view clients" ON public.managepay_clients
  FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR (public.can_access_managepay(auth.uid()) AND user_id = auth.uid()));
DROP POLICY IF EXISTS "ManagePay users insert clients" ON public.managepay_clients;
CREATE POLICY "ManagePay users insert clients" ON public.managepay_clients
  FOR INSERT WITH CHECK (public.can_access_managepay(auth.uid()) AND user_id = auth.uid());
DROP POLICY IF EXISTS "ManagePay users update clients" ON public.managepay_clients;
CREATE POLICY "ManagePay users update clients" ON public.managepay_clients
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR (public.can_access_managepay(auth.uid()) AND user_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR (public.can_access_managepay(auth.uid()) AND user_id = auth.uid()));
DROP POLICY IF EXISTS "ManagePay users delete clients" ON public.managepay_clients;
CREATE POLICY "ManagePay users delete clients" ON public.managepay_clients
  FOR DELETE USING (public.has_role(auth.uid(), 'admin') OR (public.can_access_managepay(auth.uid()) AND user_id = auth.uid()));

DROP POLICY IF EXISTS "ManagePay users view invoices" ON public.managepay_invoices;
CREATE POLICY "ManagePay users view invoices" ON public.managepay_invoices
  FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR (public.can_access_managepay(auth.uid()) AND seller_id = auth.uid()));
DROP POLICY IF EXISTS "ManagePay users insert invoices" ON public.managepay_invoices;
CREATE POLICY "ManagePay users insert invoices" ON public.managepay_invoices
  FOR INSERT WITH CHECK (public.can_access_managepay(auth.uid()) AND seller_id = auth.uid());
DROP POLICY IF EXISTS "ManagePay users update invoices" ON public.managepay_invoices;
CREATE POLICY "ManagePay users update invoices" ON public.managepay_invoices
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR (public.can_access_managepay(auth.uid()) AND seller_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR (public.can_access_managepay(auth.uid()) AND seller_id = auth.uid()));
DROP POLICY IF EXISTS "ManagePay users delete invoices" ON public.managepay_invoices;
CREATE POLICY "ManagePay users delete invoices" ON public.managepay_invoices
  FOR DELETE USING (public.has_role(auth.uid(), 'admin') OR (public.can_access_managepay(auth.uid()) AND seller_id = auth.uid()));

DROP POLICY IF EXISTS "ManagePay users view terminal transactions" ON public.managepay_terminal_transactions;
CREATE POLICY "ManagePay users view terminal transactions" ON public.managepay_terminal_transactions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR (public.can_access_managepay(auth.uid()) AND user_id = auth.uid()));
DROP POLICY IF EXISTS "ManagePay users insert terminal transactions" ON public.managepay_terminal_transactions;
CREATE POLICY "ManagePay users insert terminal transactions" ON public.managepay_terminal_transactions
  FOR INSERT WITH CHECK (public.can_access_managepay(auth.uid()) AND user_id = auth.uid());

DROP TRIGGER IF EXISTS update_managepay_access_overrides_updated_at ON public.managepay_access_overrides;
CREATE TRIGGER update_managepay_access_overrides_updated_at BEFORE UPDATE ON public.managepay_access_overrides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_managepay_companies_updated_at ON public.managepay_companies;
CREATE TRIGGER update_managepay_companies_updated_at BEFORE UPDATE ON public.managepay_companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_managepay_clients_updated_at ON public.managepay_clients;
CREATE TRIGGER update_managepay_clients_updated_at BEFORE UPDATE ON public.managepay_clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_managepay_invoice_services_updated_at ON public.managepay_invoice_services;
CREATE TRIGGER update_managepay_invoice_services_updated_at BEFORE UPDATE ON public.managepay_invoice_services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_managepay_invoices_updated_at ON public.managepay_invoices;
CREATE TRIGGER update_managepay_invoices_updated_at BEFORE UPDATE ON public.managepay_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS managepay_clients_user_id_idx ON public.managepay_clients(user_id);
CREATE INDEX IF NOT EXISTS managepay_clients_email_idx ON public.managepay_clients(email);
CREATE INDEX IF NOT EXISTS managepay_companies_active_idx ON public.managepay_companies(is_active);
CREATE INDEX IF NOT EXISTS managepay_invoices_seller_id_idx ON public.managepay_invoices(seller_id);
CREATE INDEX IF NOT EXISTS managepay_invoices_client_id_idx ON public.managepay_invoices(client_id);
CREATE INDEX IF NOT EXISTS managepay_invoices_status_idx ON public.managepay_invoices(status);
CREATE INDEX IF NOT EXISTS managepay_invoices_number_idx ON public.managepay_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS managepay_invoices_stripe_pi_idx ON public.managepay_invoices(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS managepay_terminal_user_id_idx ON public.managepay_terminal_transactions(user_id);

GRANT EXECUTE ON FUNCTION public.can_access_managepay(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_managepay_access_candidates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_managepay_public_invoice(text) TO anon, authenticated;
