ALTER TABLE public.work_notifications
DROP CONSTRAINT IF EXISTS work_notifications_type_check;

ALTER TABLE public.work_notifications
ADD CONSTRAINT work_notifications_type_check
CHECK (
  type IN (
    'mention',
    'message',
    'attendance_checkout_reminder',
    'attendance_auto_checkout',
    'overtime_request',
    'overtime_approved',
    'overtime_declined',
    'early_checkout_request',
    'early_checkout_response'
  )
);

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
    'early_checkout_request',
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
