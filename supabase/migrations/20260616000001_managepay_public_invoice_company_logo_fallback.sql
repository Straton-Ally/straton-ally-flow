-- Keep public invoice rendering robust for invoices created before logo metadata existed.

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
    CASE
      WHEN c.id IS NULL THEN i.metadata
      ELSE jsonb_set(
        i.metadata,
        '{company}',
        COALESCE(i.metadata->'company', '{}'::jsonb) || jsonb_build_object(
          'logoUrl', c.logo_url,
          'logo_url', c.logo_url,
          'logoHasDarkBg', c.logo_has_dark_bg,
          'logo_has_dark_bg', c.logo_has_dark_bg
        ),
        true
      )
    END AS metadata,
    i.created_at,
    i.updated_at
  FROM public.managepay_invoices i
  LEFT JOIN public.managepay_companies c ON c.id::text = i.metadata->'company'->>'id'
  WHERE i.id::text = _invoice_ref OR i.invoice_number = _invoice_ref
  ORDER BY i.created_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_managepay_public_invoice(text) TO anon, authenticated;
