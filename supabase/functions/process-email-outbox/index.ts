import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.93.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('ATTENDANCE_EMAIL_FROM') ?? 'Flow <no-reply@example.com>';
  const internalSecret = Deno.env.get('EDGE_INTERNAL_SECRET');

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: 'Missing Supabase service configuration' }, { status: 500, headers: corsHeaders });
  }

  if (internalSecret && req.headers.get('x-internal-secret') !== internalSecret) {
    return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
  }

  if (!resendApiKey) {
    return Response.json({ error: 'Missing RESEND_API_KEY' }, { status: 500, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  await supabase.rpc('attendance_process_due_events');

  const { data: rows, error } = await supabase
    .from('email_outbox')
    .select('id, recipient_email, subject, body, attempts')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(25);

  if (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }

  let sent = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    await supabase
      .from('email_outbox')
      .update({ status: 'processing', attempts: (row.attempts ?? 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', 'pending');

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [row.recipient_email],
          subject: row.subject,
          text: row.body,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Resend returned ${response.status}`);
      }

      await supabase
        .from('email_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      sent += 1;
    } catch (err) {
      await supabase
        .from('email_outbox')
        .update({
          status: 'failed',
          last_error: err instanceof Error ? err.message : 'Unknown email error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      failed += 1;
    }
  }

  return Response.json({ processed: rows?.length ?? 0, sent, failed }, { headers: corsHeaders });
});
