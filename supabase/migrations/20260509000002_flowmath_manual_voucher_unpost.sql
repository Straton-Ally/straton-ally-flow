CREATE OR REPLACE FUNCTION public.unpost_flowmath_manual_journal_entry(_journal_entry_id uuid)
RETURNS public.flowmath_journal_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry_row public.flowmath_journal_entries;
BEGIN
  IF NOT public.can_post_flowmath(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed to manage FlowMath vouchers';
  END IF;

  SELECT *
  INTO entry_row
  FROM public.flowmath_journal_entries
  WHERE id = _journal_entry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal voucher not found';
  END IF;

  IF entry_row.source_type <> 'manual' THEN
    RAISE EXCEPTION 'Only manual vouchers can be edited from the journal screen';
  END IF;

  IF entry_row.status = 'void' THEN
    RAISE EXCEPTION 'Voided vouchers cannot be edited';
  END IF;

  IF entry_row.status = 'draft' THEN
    RETURN entry_row;
  END IF;

  IF entry_row.status <> 'posted' THEN
    RAISE EXCEPTION 'Only draft or posted vouchers can be edited';
  END IF;

  UPDATE public.flowmath_journal_entries
  SET status = 'draft',
      posted_at = NULL,
      posted_by = NULL,
      updated_at = now()
  WHERE id = _journal_entry_id
  RETURNING * INTO entry_row;

  RETURN entry_row;
END;
$$;
