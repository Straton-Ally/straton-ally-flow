# Attendance Notification Operations

This project now has three delivery layers for attendance/overtime events:

1. Database workflow in `attendance_process_due_events()`
2. Email queue processing via `process-email-outbox`
3. Web Push delivery via `dispatch-notification-push`

## Required Supabase secrets

Set these Edge Function secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `ATTENDANCE_EMAIL_FROM`
- `EDGE_INTERNAL_SECRET`
- `WEB_PUSH_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT`

Set this frontend env var:

- `VITE_WEB_PUSH_PUBLIC_KEY`

## Required private runtime config

After running migrations, insert runtime config values used by Postgres to call internal Edge Functions:

```sql
insert into private.runtime_config (key, value) values
  ('supabase_project_url', 'https://YOUR_PROJECT_ID.supabase.co'),
  ('supabase_anon_key', 'YOUR_SUPABASE_ANON_KEY'),
  ('edge_internal_secret', 'YOUR_EDGE_INTERNAL_SECRET')
on conflict (key) do update
set value = excluded.value,
    updated_at = now();
```

## Deploy commands

```bash
supabase functions deploy process-email-outbox
supabase functions deploy dispatch-notification-push
```

## Web Push VAPID keys

Generate once and store securely. Example with Node:

```bash
npx web-push generate-vapid-keys
```

Use the public key for:

- Edge secret `WEB_PUSH_VAPID_PUBLIC_KEY`
- frontend env `VITE_WEB_PUSH_PUBLIC_KEY`

Use the private key only for:

- Edge secret `WEB_PUSH_VAPID_PRIVATE_KEY`

## What runs automatically

- `attendance-due-events` cron job runs inside Postgres each minute
- `process-email-outbox` is invoked each minute by Postgres cron through `pg_net`
- attendance/overtime notifications trigger `dispatch-notification-push` automatically after insert

## QA checklist

- Check in as employee with expected checkout time
- Verify reminder notification appears about 15 minutes before scheduled checkout
- Click `I am working overtime`
- Verify admin receives OT request notification and can review it from attendance
- Approve OT and confirm employee remains checked in
- Decline OT after grace period and confirm auto-checkout is applied
- Verify employee receives auto-checkout in-app notification
- Verify employee receives auto-checkout email
- Enable push on one device and verify attendance reminder arrives while app is backgrounded
