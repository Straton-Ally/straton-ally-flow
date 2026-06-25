-- FlowMath ERP accounts module

CREATE TABLE IF NOT EXISTS public.flowmath_access_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  allowed boolean NOT NULL,
  reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id)
);

CREATE TABLE IF NOT EXISTS public.flowmath_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency text NOT NULL DEFAULT 'PKR',
  currency_symbol text NOT NULL DEFAULT 'Rs',
  timezone text NOT NULL DEFAULT 'Asia/Karachi',
  fiscal_year_start_month integer NOT NULL DEFAULT 1 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  tax_label text NOT NULL DEFAULT 'Tax',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flowmath_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  normal_balance text NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
  parent_id uuid REFERENCES public.flowmath_accounts(id) ON DELETE SET NULL,
  is_cash boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flowmath_counterparties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('vendor', 'customer')),
  name text NOT NULL,
  email text,
  phone text,
  address text,
  tax_number text,
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flowmath_journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_no text NOT NULL UNIQUE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  source_type text NOT NULL DEFAULT 'manual',
  source_id uuid,
  memo text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'void')),
  posted_at timestamptz,
  posted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  voided_at timestamptz,
  voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flowmath_journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES public.flowmath_journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.flowmath_accounts(id),
  description text,
  debit numeric(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  line_no integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);

CREATE TABLE IF NOT EXISTS public.flowmath_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL CHECK (document_type IN ('expense', 'invoice', 'bill', 'payment')),
  document_no text NOT NULL UNIQUE,
  counterparty_id uuid REFERENCES public.flowmath_counterparties(id) ON DELETE SET NULL,
  document_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  memo text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'paid', 'void')),
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  journal_entry_id uuid REFERENCES public.flowmath_journal_entries(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  posted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  posted_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flowmath_document_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.flowmath_documents(id) ON DELETE CASCADE,
  description text NOT NULL,
  debit_account_id uuid NOT NULL REFERENCES public.flowmath_accounts(id),
  credit_account_id uuid NOT NULL REFERENCES public.flowmath_accounts(id),
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_amount numeric(14,2) NOT NULL DEFAULT 0,
  amount numeric(14,2) GENERATED ALWAYS AS (round(quantity * unit_amount, 2)) STORED,
  line_no integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flowmath_payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_no text NOT NULL UNIQUE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'paid', 'void')),
  gross_amount numeric(14,2) NOT NULL DEFAULT 0,
  allowance_amount numeric(14,2) NOT NULL DEFAULT 0,
  deduction_amount numeric(14,2) NOT NULL DEFAULT 0,
  net_amount numeric(14,2) NOT NULL DEFAULT 0,
  journal_entry_id uuid REFERENCES public.flowmath_journal_entries(id) ON DELETE SET NULL,
  payment_journal_entry_id uuid REFERENCES public.flowmath_journal_entries(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  posted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  posted_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_start, period_end)
);

CREATE TABLE IF NOT EXISTS public.flowmath_payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES public.flowmath_payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  salary_id uuid REFERENCES public.salaries(id) ON DELETE SET NULL,
  base_salary numeric(14,2) NOT NULL DEFAULT 0,
  allowances numeric(14,2) NOT NULL DEFAULT 0,
  deductions numeric(14,2) NOT NULL DEFAULT 0,
  net_salary numeric(14,2) NOT NULL DEFAULT 0,
  present_days integer NOT NULL DEFAULT 0,
  absent_days integer NOT NULL DEFAULT 0,
  leave_days integer NOT NULL DEFAULT 0,
  total_work_minutes integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payroll_run_id, employee_id)
);

INSERT INTO public.flowmath_settings (base_currency, currency_symbol, timezone, fiscal_year_start_month, tax_label)
SELECT 'PKR', 'Rs', 'Asia/Karachi', 1, 'Tax'
WHERE NOT EXISTS (SELECT 1 FROM public.flowmath_settings);

INSERT INTO public.flowmath_accounts (code, name, account_type, normal_balance, is_cash, is_system, description)
VALUES
  ('1000', 'Cash and Bank', 'asset', 'debit', true, true, 'Primary cash and bank account'),
  ('1100', 'Accounts Receivable', 'asset', 'debit', false, true, 'Customer receivables'),
  ('1200', 'Tax Receivable', 'asset', 'debit', false, true, 'Recoverable tax'),
  ('2000', 'Accounts Payable', 'liability', 'credit', false, true, 'Vendor payables'),
  ('2100', 'Payroll Payable', 'liability', 'credit', false, true, 'Payroll liabilities'),
  ('2200', 'Tax Payable', 'liability', 'credit', false, true, 'Tax liabilities'),
  ('3000', 'Owner Equity', 'equity', 'credit', false, true, 'Equity'),
  ('4000', 'Sales Revenue', 'income', 'credit', false, true, 'Sales and service revenue'),
  ('5000', 'Operating Expenses', 'expense', 'debit', false, true, 'General expenses'),
  ('5100', 'Payroll Expense', 'expense', 'debit', false, true, 'Salary and wages expense')
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.flowmath_next_number(_prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN _prefix || '-' || to_char(now(), 'YYYYMMDDHH24MISSMS') || '-' || lpad(floor(random() * 1000)::text, 3, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_flowmath(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  employee_row record;
  override_allowed boolean;
BEGIN
  IF public.has_role(_user_id, 'admin') THEN
    RETURN true;
  END IF;

  SELECT e.id, d.name AS department_name
  INTO employee_row
  FROM public.employees e
  LEFT JOIN public.departments d ON d.id = e.department_id
  WHERE e.user_id = _user_id;

  IF employee_row.id IS NULL THEN
    RETURN false;
  END IF;

  SELECT allowed INTO override_allowed
  FROM public.flowmath_access_overrides
  WHERE employee_id = employee_row.id;

  IF override_allowed IS NOT NULL THEN
    RETURN override_allowed;
  END IF;

  RETURN lower(COALESCE(employee_row.department_name, '')) = 'finance';
END;
$$;

CREATE OR REPLACE FUNCTION public.can_post_flowmath(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_access_flowmath(_user_id)
$$;

CREATE OR REPLACE FUNCTION public.flowmath_assert_balanced(_journal_entry_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  debit_total numeric(14,2);
  credit_total numeric(14,2);
BEGIN
  SELECT COALESCE(sum(debit), 0), COALESCE(sum(credit), 0)
  INTO debit_total, credit_total
  FROM public.flowmath_journal_lines
  WHERE journal_entry_id = _journal_entry_id;

  IF debit_total <= 0 OR credit_total <= 0 OR debit_total <> credit_total THEN
    RAISE EXCEPTION 'Journal entry is not balanced. Debits: %, Credits: %', debit_total, credit_total;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_flowmath_journal_entry(_journal_entry_id uuid)
RETURNS public.flowmath_journal_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry_row public.flowmath_journal_entries;
BEGIN
  IF NOT public.can_post_flowmath(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed to post FlowMath journal entries';
  END IF;

  SELECT * INTO entry_row
  FROM public.flowmath_journal_entries
  WHERE id = _journal_entry_id
  FOR UPDATE;

  IF entry_row.id IS NULL THEN
    RAISE EXCEPTION 'Journal entry not found';
  END IF;

  IF entry_row.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft journal entries can be posted';
  END IF;

  PERFORM public.flowmath_assert_balanced(_journal_entry_id);

  UPDATE public.flowmath_journal_entries
  SET status = 'posted', posted_at = now(), posted_by = auth.uid(), updated_at = now()
  WHERE id = _journal_entry_id
  RETURNING * INTO entry_row;

  RETURN entry_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_flowmath_document(_document_id uuid)
RETURNS public.flowmath_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doc_row public.flowmath_documents;
  line_row record;
  journal_id uuid;
  line_no integer := 1;
  total numeric(14,2);
BEGIN
  IF NOT public.can_post_flowmath(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed to post FlowMath documents';
  END IF;

  SELECT * INTO doc_row
  FROM public.flowmath_documents
  WHERE id = _document_id
  FOR UPDATE;

  IF doc_row.id IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  IF doc_row.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft documents can be posted';
  END IF;

  SELECT COALESCE(sum(amount), 0)
  INTO total
  FROM public.flowmath_document_lines
  WHERE document_id = _document_id;

  IF total <= 0 THEN
    RAISE EXCEPTION 'Document must have at least one positive line';
  END IF;

  INSERT INTO public.flowmath_journal_entries (entry_no, entry_date, source_type, source_id, memo, created_by)
  VALUES (public.flowmath_next_number('JE'), doc_row.document_date, doc_row.document_type, doc_row.id, doc_row.memo, auth.uid())
  RETURNING id INTO journal_id;

  FOR line_row IN
    SELECT *
    FROM public.flowmath_document_lines
    WHERE document_id = _document_id
    ORDER BY line_no, created_at
  LOOP
    INSERT INTO public.flowmath_journal_lines (journal_entry_id, account_id, description, debit, credit, line_no)
    VALUES (journal_id, line_row.debit_account_id, line_row.description, line_row.amount, 0, line_no);
    line_no := line_no + 1;

    INSERT INTO public.flowmath_journal_lines (journal_entry_id, account_id, description, debit, credit, line_no)
    VALUES (journal_id, line_row.credit_account_id, line_row.description, 0, line_row.amount, line_no);
    line_no := line_no + 1;
  END LOOP;

  PERFORM public.post_flowmath_journal_entry(journal_id);

  UPDATE public.flowmath_documents
  SET status = 'posted',
      total_amount = total,
      journal_entry_id = journal_id,
      posted_by = auth.uid(),
      posted_at = now(),
      updated_at = now()
  WHERE id = _document_id
  RETURNING * INTO doc_row;

  RETURN doc_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_flowmath_payroll_run(_period_start date, _period_end date)
RETURNS public.flowmath_payroll_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  run_row public.flowmath_payroll_runs;
  emp_row record;
BEGIN
  IF NOT public.can_post_flowmath(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed to create payroll runs';
  END IF;

  INSERT INTO public.flowmath_payroll_runs (run_no, period_start, period_end, created_by)
  VALUES (public.flowmath_next_number('PR'), _period_start, _period_end, auth.uid())
  RETURNING * INTO run_row;

  FOR emp_row IN
    SELECT
      e.id AS employee_id,
      s.id AS salary_id,
      COALESCE(s.amount, 0) AS amount,
      COALESCE(count(a.id) FILTER (WHERE a.status = 'present'), 0)::integer AS present_days,
      COALESCE(count(a.id) FILTER (WHERE a.status = 'absent'), 0)::integer AS absent_days,
      COALESCE(count(a.id) FILTER (WHERE a.status = 'leave'), 0)::integer AS leave_days,
      COALESCE(sum(a.total_work_minutes), 0)::integer AS total_work_minutes
    FROM public.employees e
    LEFT JOIN public.salaries s ON s.employee_id = e.id AND s.is_current = true
    LEFT JOIN public.attendance a ON a.employee_id = e.id AND a.date BETWEEN _period_start AND _period_end
    GROUP BY e.id, s.id, s.amount
    HAVING COALESCE(s.amount, 0) > 0
  LOOP
    INSERT INTO public.flowmath_payroll_items (
      payroll_run_id,
      employee_id,
      salary_id,
      base_salary,
      net_salary,
      present_days,
      absent_days,
      leave_days,
      total_work_minutes
    )
    VALUES (
      run_row.id,
      emp_row.employee_id,
      emp_row.salary_id,
      emp_row.amount,
      emp_row.amount,
      emp_row.present_days,
      emp_row.absent_days,
      emp_row.leave_days,
      emp_row.total_work_minutes
    );
  END LOOP;

  UPDATE public.flowmath_payroll_runs r
  SET gross_amount = totals.gross_amount,
      allowance_amount = totals.allowance_amount,
      deduction_amount = totals.deduction_amount,
      net_amount = totals.net_amount,
      updated_at = now()
  FROM (
    SELECT
      payroll_run_id,
      COALESCE(sum(base_salary), 0) AS gross_amount,
      COALESCE(sum(allowances), 0) AS allowance_amount,
      COALESCE(sum(deductions), 0) AS deduction_amount,
      COALESCE(sum(net_salary), 0) AS net_amount
    FROM public.flowmath_payroll_items
    WHERE payroll_run_id = run_row.id
    GROUP BY payroll_run_id
  ) totals
  WHERE r.id = totals.payroll_run_id
  RETURNING r.* INTO run_row;

  RETURN run_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_flowmath_payroll_totals(_payroll_run_id uuid)
RETURNS public.flowmath_payroll_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  run_row public.flowmath_payroll_runs;
BEGIN
  UPDATE public.flowmath_payroll_items
  SET net_salary = base_salary + allowances - deductions,
      updated_at = now()
  WHERE payroll_run_id = _payroll_run_id;

  UPDATE public.flowmath_payroll_runs r
  SET gross_amount = COALESCE(t.gross_amount, 0),
      allowance_amount = COALESCE(t.allowance_amount, 0),
      deduction_amount = COALESCE(t.deduction_amount, 0),
      net_amount = COALESCE(t.net_amount, 0),
      updated_at = now()
  FROM (
    SELECT
      payroll_run_id,
      sum(base_salary) AS gross_amount,
      sum(allowances) AS allowance_amount,
      sum(deductions) AS deduction_amount,
      sum(net_salary) AS net_amount
    FROM public.flowmath_payroll_items
    WHERE payroll_run_id = _payroll_run_id
    GROUP BY payroll_run_id
  ) t
  WHERE r.id = t.payroll_run_id
  RETURNING r.* INTO run_row;

  RETURN run_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_flowmath_payroll_run(_payroll_run_id uuid)
RETURNS public.flowmath_payroll_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  run_row public.flowmath_payroll_runs;
  journal_id uuid;
  expense_account uuid;
  payable_account uuid;
BEGIN
  IF NOT public.can_post_flowmath(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed to post payroll runs';
  END IF;

  SELECT * INTO run_row
  FROM public.flowmath_payroll_runs
  WHERE id = _payroll_run_id
  FOR UPDATE;

  IF run_row.id IS NULL THEN
    RAISE EXCEPTION 'Payroll run not found';
  END IF;

  IF run_row.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft payroll runs can be posted';
  END IF;

  SELECT * INTO run_row FROM public.refresh_flowmath_payroll_totals(_payroll_run_id);

  IF run_row.net_amount <= 0 THEN
    RAISE EXCEPTION 'Payroll run must have a positive net amount';
  END IF;

  SELECT id INTO expense_account FROM public.flowmath_accounts WHERE code = '5100';
  SELECT id INTO payable_account FROM public.flowmath_accounts WHERE code = '2100';

  INSERT INTO public.flowmath_journal_entries (entry_no, entry_date, source_type, source_id, memo, created_by)
  VALUES (public.flowmath_next_number('JE'), run_row.period_end, 'payroll', run_row.id, 'Payroll ' || run_row.run_no, auth.uid())
  RETURNING id INTO journal_id;

  INSERT INTO public.flowmath_journal_lines (journal_entry_id, account_id, description, debit, credit, line_no)
  VALUES
    (journal_id, expense_account, 'Payroll expense', run_row.net_amount, 0, 1),
    (journal_id, payable_account, 'Payroll payable', 0, run_row.net_amount, 2);

  PERFORM public.post_flowmath_journal_entry(journal_id);

  UPDATE public.flowmath_payroll_runs
  SET status = 'posted',
      journal_entry_id = journal_id,
      posted_by = auth.uid(),
      posted_at = now(),
      updated_at = now()
  WHERE id = _payroll_run_id
  RETURNING * INTO run_row;

  RETURN run_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_flowmath_payroll_paid(_payroll_run_id uuid, _payment_date date DEFAULT CURRENT_DATE)
RETURNS public.flowmath_payroll_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  run_row public.flowmath_payroll_runs;
  journal_id uuid;
  bank_account uuid;
  payable_account uuid;
BEGIN
  IF NOT public.can_post_flowmath(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed to pay payroll runs';
  END IF;

  SELECT * INTO run_row
  FROM public.flowmath_payroll_runs
  WHERE id = _payroll_run_id
  FOR UPDATE;

  IF run_row.id IS NULL THEN
    RAISE EXCEPTION 'Payroll run not found';
  END IF;

  IF run_row.status <> 'posted' THEN
    RAISE EXCEPTION 'Only posted payroll runs can be marked paid';
  END IF;

  SELECT id INTO bank_account FROM public.flowmath_accounts WHERE code = '1000';
  SELECT id INTO payable_account FROM public.flowmath_accounts WHERE code = '2100';

  INSERT INTO public.flowmath_journal_entries (entry_no, entry_date, source_type, source_id, memo, created_by)
  VALUES (public.flowmath_next_number('JE'), _payment_date, 'payroll_payment', run_row.id, 'Payroll payment ' || run_row.run_no, auth.uid())
  RETURNING id INTO journal_id;

  INSERT INTO public.flowmath_journal_lines (journal_entry_id, account_id, description, debit, credit, line_no)
  VALUES
    (journal_id, payable_account, 'Payroll paid', run_row.net_amount, 0, 1),
    (journal_id, bank_account, 'Bank payment', 0, run_row.net_amount, 2);

  PERFORM public.post_flowmath_journal_entry(journal_id);

  UPDATE public.flowmath_payroll_runs
  SET status = 'paid',
      payment_journal_entry_id = journal_id,
      paid_by = auth.uid(),
      paid_at = now(),
      updated_at = now()
  WHERE id = _payroll_run_id
  RETURNING * INTO run_row;

  RETURN run_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.flowmath_block_posted_journal_line_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_status text;
BEGIN
  SELECT status INTO parent_status
  FROM public.flowmath_journal_entries
  WHERE id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);

  IF parent_status IN ('posted', 'void') THEN
    RAISE EXCEPTION 'Posted journal lines are immutable';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS block_posted_journal_line_changes ON public.flowmath_journal_lines;
CREATE TRIGGER block_posted_journal_line_changes
BEFORE UPDATE OR DELETE ON public.flowmath_journal_lines
FOR EACH ROW EXECUTE FUNCTION public.flowmath_block_posted_journal_line_changes();

CREATE OR REPLACE FUNCTION public.flowmath_block_posted_document_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IN ('posted', 'paid', 'void') AND TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Posted FlowMath documents cannot be deleted';
  END IF;

  IF OLD.status IN ('posted', 'paid', 'void') AND TG_OP = 'UPDATE' AND NEW.status = OLD.status THEN
    RAISE EXCEPTION 'Posted FlowMath documents are immutable except status transitions';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS block_posted_document_changes ON public.flowmath_documents;
CREATE TRIGGER block_posted_document_changes
BEFORE UPDATE OR DELETE ON public.flowmath_documents
FOR EACH ROW EXECUTE FUNCTION public.flowmath_block_posted_document_changes();

ALTER TABLE public.flowmath_access_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flowmath_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flowmath_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flowmath_counterparties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flowmath_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flowmath_journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flowmath_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flowmath_document_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flowmath_payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flowmath_payroll_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage FlowMath access overrides" ON public.flowmath_access_overrides
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "FlowMath users view settings" ON public.flowmath_settings
  FOR SELECT USING (public.can_access_flowmath(auth.uid()));
CREATE POLICY "FlowMath users update settings" ON public.flowmath_settings
  FOR UPDATE USING (public.can_post_flowmath(auth.uid()))
  WITH CHECK (public.can_post_flowmath(auth.uid()));

CREATE POLICY "FlowMath users view accounts" ON public.flowmath_accounts
  FOR SELECT USING (public.can_access_flowmath(auth.uid()));
CREATE POLICY "FlowMath users manage accounts" ON public.flowmath_accounts
  FOR ALL USING (public.can_post_flowmath(auth.uid()))
  WITH CHECK (public.can_post_flowmath(auth.uid()));

CREATE POLICY "FlowMath users view counterparties" ON public.flowmath_counterparties
  FOR SELECT USING (public.can_access_flowmath(auth.uid()));
CREATE POLICY "FlowMath users manage counterparties" ON public.flowmath_counterparties
  FOR ALL USING (public.can_post_flowmath(auth.uid()))
  WITH CHECK (public.can_post_flowmath(auth.uid()));

CREATE POLICY "FlowMath users view journal entries" ON public.flowmath_journal_entries
  FOR SELECT USING (public.can_access_flowmath(auth.uid()));
CREATE POLICY "FlowMath users manage journal entries" ON public.flowmath_journal_entries
  FOR ALL USING (public.can_post_flowmath(auth.uid()))
  WITH CHECK (public.can_post_flowmath(auth.uid()));

CREATE POLICY "FlowMath users view journal lines" ON public.flowmath_journal_lines
  FOR SELECT USING (public.can_access_flowmath(auth.uid()));
CREATE POLICY "FlowMath users manage journal lines" ON public.flowmath_journal_lines
  FOR ALL USING (public.can_post_flowmath(auth.uid()))
  WITH CHECK (public.can_post_flowmath(auth.uid()));

CREATE POLICY "FlowMath users view documents" ON public.flowmath_documents
  FOR SELECT USING (public.can_access_flowmath(auth.uid()));
CREATE POLICY "FlowMath users manage documents" ON public.flowmath_documents
  FOR ALL USING (public.can_post_flowmath(auth.uid()))
  WITH CHECK (public.can_post_flowmath(auth.uid()));

CREATE POLICY "FlowMath users view document lines" ON public.flowmath_document_lines
  FOR SELECT USING (public.can_access_flowmath(auth.uid()));
CREATE POLICY "FlowMath users manage document lines" ON public.flowmath_document_lines
  FOR ALL USING (public.can_post_flowmath(auth.uid()))
  WITH CHECK (public.can_post_flowmath(auth.uid()));

CREATE POLICY "FlowMath users view payroll runs" ON public.flowmath_payroll_runs
  FOR SELECT USING (public.can_access_flowmath(auth.uid()));
CREATE POLICY "FlowMath users manage payroll runs" ON public.flowmath_payroll_runs
  FOR ALL USING (public.can_post_flowmath(auth.uid()))
  WITH CHECK (public.can_post_flowmath(auth.uid()));

CREATE POLICY "FlowMath users view payroll items" ON public.flowmath_payroll_items
  FOR SELECT USING (public.can_access_flowmath(auth.uid()));
CREATE POLICY "FlowMath users manage payroll items" ON public.flowmath_payroll_items
  FOR ALL USING (public.can_post_flowmath(auth.uid()))
  WITH CHECK (public.can_post_flowmath(auth.uid()));

DROP TRIGGER IF EXISTS update_flowmath_access_overrides_updated_at ON public.flowmath_access_overrides;
CREATE TRIGGER update_flowmath_access_overrides_updated_at BEFORE UPDATE ON public.flowmath_access_overrides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_flowmath_settings_updated_at ON public.flowmath_settings;
CREATE TRIGGER update_flowmath_settings_updated_at BEFORE UPDATE ON public.flowmath_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_flowmath_accounts_updated_at ON public.flowmath_accounts;
CREATE TRIGGER update_flowmath_accounts_updated_at BEFORE UPDATE ON public.flowmath_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_flowmath_counterparties_updated_at ON public.flowmath_counterparties;
CREATE TRIGGER update_flowmath_counterparties_updated_at BEFORE UPDATE ON public.flowmath_counterparties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_flowmath_journal_entries_updated_at ON public.flowmath_journal_entries;
CREATE TRIGGER update_flowmath_journal_entries_updated_at BEFORE UPDATE ON public.flowmath_journal_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_flowmath_documents_updated_at ON public.flowmath_documents;
CREATE TRIGGER update_flowmath_documents_updated_at BEFORE UPDATE ON public.flowmath_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_flowmath_payroll_runs_updated_at ON public.flowmath_payroll_runs;
CREATE TRIGGER update_flowmath_payroll_runs_updated_at BEFORE UPDATE ON public.flowmath_payroll_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_flowmath_payroll_items_updated_at ON public.flowmath_payroll_items;
CREATE TRIGGER update_flowmath_payroll_items_updated_at BEFORE UPDATE ON public.flowmath_payroll_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS flowmath_accounts_type_idx ON public.flowmath_accounts(account_type);
CREATE INDEX IF NOT EXISTS flowmath_counterparties_type_idx ON public.flowmath_counterparties(type);
CREATE INDEX IF NOT EXISTS flowmath_journal_entries_status_date_idx ON public.flowmath_journal_entries(status, entry_date DESC);
CREATE INDEX IF NOT EXISTS flowmath_journal_lines_account_idx ON public.flowmath_journal_lines(account_id);
CREATE INDEX IF NOT EXISTS flowmath_documents_type_status_idx ON public.flowmath_documents(document_type, status);
CREATE INDEX IF NOT EXISTS flowmath_payroll_runs_period_idx ON public.flowmath_payroll_runs(period_start DESC, period_end DESC);
