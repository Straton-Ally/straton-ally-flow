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
