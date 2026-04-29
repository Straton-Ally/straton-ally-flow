import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.93.0';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  action_url: string | null;
};

type StoredPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys?: {
    auth?: string;
    p256dh?: string;
  };
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  subscription: StoredPushSubscription;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const internalSecret = Deno.env.get('EDGE_INTERNAL_SECRET');
  const vapidPublicKey = Deno.env.get('WEB_PUSH_VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('WEB_PUSH_VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('WEB_PUSH_SUBJECT') ?? 'mailto:no-reply@example.com';

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: 'Missing Supabase service configuration' }, { status: 500, headers: corsHeaders });
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    return Response.json({ skipped: true, reason: 'Missing VAPID configuration' }, { headers: corsHeaders });
  }

  if (internalSecret && req.headers.get('x-internal-secret') !== internalSecret) {
    return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
  }

  const body = await req.json().catch(() => ({}));
  const notificationId = typeof body.notification_id === 'string' ? body.notification_id : null;

  if (!notificationId) {
    return Response.json({ error: 'Missing notification_id' }, { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: notification, error: notificationError } = await supabase
    .from('work_notifications')
    .select('id,user_id,type,title,body,action_url')
    .eq('id', notificationId)
    .single();

  if (notificationError || !notification) {
    return Response.json({ error: notificationError?.message ?? 'Notification not found' }, { status: 404, headers: corsHeaders });
  }

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from('notification_push_subscriptions')
    .select('id,endpoint,subscription')
    .eq('user_id', notification.user_id);

  if (subscriptionsError) {
    return Response.json({ error: subscriptionsError.message }, { status: 500, headers: corsHeaders });
  }

  const rows = (subscriptions ?? []) as PushSubscriptionRow[];
  if (rows.length === 0) {
    return Response.json({ delivered: 0, skipped: true }, { headers: corsHeaders });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    tag: notification.id,
    url: notification.action_url ?? '/employee/notifications',
    type: notification.type,
  });

  let delivered = 0;
  let removed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      await webpush.sendNotification(row.subscription, payload);
      delivered += 1;
    } catch (error) {
      const statusCode = typeof error === 'object' && error && 'statusCode' in error ? Number((error as { statusCode?: unknown }).statusCode) : null;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('notification_push_subscriptions').delete().eq('id', row.id);
        removed += 1;
      } else {
        failed += 1;
      }
    }
  }

  return Response.json({ delivered, removed, failed }, { headers: corsHeaders });
});
