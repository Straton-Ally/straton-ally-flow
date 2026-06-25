CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.runtime_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION private.update_runtime_config_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_runtime_config_updated_at ON private.runtime_config;
CREATE TRIGGER update_runtime_config_updated_at
BEFORE UPDATE ON private.runtime_config
FOR EACH ROW
EXECUTE FUNCTION private.update_runtime_config_updated_at();

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.notification_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  subscription jsonb NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_push_subscriptions_user_id_idx
  ON public.notification_push_subscriptions (user_id, updated_at DESC);

ALTER TABLE public.notification_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.notification_push_subscriptions;
CREATE POLICY "Users can view own push subscriptions" ON public.notification_push_subscriptions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.notification_push_subscriptions;
CREATE POLICY "Users can insert own push subscriptions" ON public.notification_push_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.notification_push_subscriptions;
CREATE POLICY "Users can update own push subscriptions" ON public.notification_push_subscriptions
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.notification_push_subscriptions;
CREATE POLICY "Users can delete own push subscriptions" ON public.notification_push_subscriptions
  FOR DELETE USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_notification_push_subscriptions_updated_at ON public.notification_push_subscriptions;
CREATE TRIGGER update_notification_push_subscriptions_updated_at
BEFORE UPDATE ON public.notification_push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION private.get_runtime_config(_key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private
AS $$
  SELECT value
  FROM private.runtime_config
  WHERE key = _key
$$;

CREATE OR REPLACE FUNCTION public.invoke_internal_edge_function(_function_name text, _payload jsonb DEFAULT '{}'::jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
  project_url text;
  anon_key text;
  internal_secret text;
  request_id bigint;
BEGIN
  project_url := private.get_runtime_config('supabase_project_url');
  anon_key := private.get_runtime_config('supabase_anon_key');
  internal_secret := private.get_runtime_config('edge_internal_secret');

  IF project_url IS NULL OR anon_key IS NULL OR internal_secret IS NULL THEN
    RAISE EXCEPTION 'Missing runtime config for internal edge invocation';
  END IF;

  SELECT net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/' || _function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key,
      'apikey', anon_key,
      'x-internal-secret', internal_secret
    ),
    body := COALESCE(_payload, '{}'::jsonb)
  )
  INTO request_id;

  RETURN request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_push_dispatch_for_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type IN (
    'attendance_checkout_reminder',
    'attendance_auto_checkout',
    'overtime_request',
    'overtime_approved',
    'overtime_declined',
    'early_checkout_response'
  ) THEN
    PERFORM public.invoke_internal_edge_function(
      'dispatch-notification-push',
      jsonb_build_object('notification_id', NEW.id)
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS queue_push_dispatch_for_notification ON public.work_notifications;
CREATE TRIGGER queue_push_dispatch_for_notification
AFTER INSERT ON public.work_notifications
FOR EACH ROW
EXECUTE FUNCTION public.queue_push_dispatch_for_notification();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron')
    AND EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'net'
        AND p.proname = 'http_post'
    )
  THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-outbox') THEN
      PERFORM cron.schedule(
        'process-email-outbox',
        '* * * * *',
        $cron$select public.invoke_internal_edge_function('process-email-outbox', jsonb_build_object('source', 'pg_cron'));$cron$
      );
    END IF;
  END IF;
EXCEPTION
  WHEN undefined_function OR undefined_table THEN NULL;
END $$;
