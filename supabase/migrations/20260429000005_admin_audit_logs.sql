CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'system',
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  actor_user_id UUID,
  actor_name TEXT,
  actor_email TEXT,
  target_table TEXT,
  target_id TEXT,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins and service role can write audit logs" ON public.audit_logs;
CREATE POLICY "Admins and service role can write audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_category_idx ON public.audit_logs(category);
CREATE INDEX IF NOT EXISTS audit_logs_event_type_idx ON public.audit_logs(event_type);
CREATE INDEX IF NOT EXISTS audit_logs_actor_user_id_idx ON public.audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS audit_logs_target_table_idx ON public.audit_logs(target_table);

CREATE OR REPLACE FUNCTION public.audit_table_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  record_id TEXT;
  request_headers JSONB;
  request_user_agent TEXT;
  actor_profile RECORD;
  event_message TEXT;
BEGIN
  IF TG_TABLE_SCHEMA <> 'public' OR TG_TABLE_NAME = 'audit_logs' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    record_id := OLD.id::TEXT;
  ELSE
    record_id := NEW.id::TEXT;
  END IF;

  BEGIN
    request_headers := current_setting('request.headers', true)::JSONB;
    request_user_agent := request_headers ->> 'user-agent';
  EXCEPTION
    WHEN OTHERS THEN
      request_user_agent := NULL;
  END;

  SELECT p.full_name, p.email
  INTO actor_profile
  FROM public.profiles p
  WHERE p.id = auth.uid();

  event_message := initcap(replace(TG_TABLE_NAME, '_', ' ')) || ' ' || lower(TG_OP);

  INSERT INTO public.audit_logs (
    event_type,
    category,
    severity,
    actor_user_id,
    actor_name,
    actor_email,
    target_table,
    target_id,
    message,
    metadata,
    ip_address,
    user_agent
  )
  VALUES (
    lower(TG_OP),
    'database',
    CASE WHEN TG_OP = 'DELETE' THEN 'warning' ELSE 'info' END,
    auth.uid(),
    actor_profile.full_name,
    actor_profile.email,
    TG_TABLE_NAME,
    record_id,
    event_message,
    jsonb_build_object(
      'old', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
      'new', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    ),
    public.request_ip_address(),
    request_user_agent
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'employees',
    'profiles',
    'attendance',
    'early_checkout_requests',
    'offices',
    'office_settings',
    'attendance_time_zones',
    'departments',
    'salaries',
    'work_tasks',
    'work_messages',
    'work_channels'
  ]
  LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS audit_%I_changes ON public.%I', table_name, table_name);
      EXECUTE format(
        'CREATE TRIGGER audit_%I_changes
         AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.audit_table_changes()',
        table_name,
        table_name
      );
    END IF;
  END LOOP;
END;
$$;
