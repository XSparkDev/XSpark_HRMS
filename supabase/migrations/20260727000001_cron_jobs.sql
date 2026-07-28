-- Scheduled jobs
-- pg_cron + pg_net call the deployed leave-accruals Edge Function monthly.
-- project_url/service_role_key are read from Vault secrets set once via:
--   select vault.create_secret('https://oircopopzvlhowiugewy.supabase.co', 'project_url');
--   select vault.create_secret('<service_role_key>', 'service_role_key');

create extension if not exists pg_net;

select cron.schedule(
  'monthly-leave-accruals',
  '0 0 1 * *', -- 1st of every month at midnight UTC
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/leave-accruals',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{"accrualType":"all"}'::jsonb
  );
  $$
);

-- Mark assigned_devices past their expected_return_date as overdue.
create or replace function mark_overdue_device_assignments()
returns void language sql as $$
  update assigned_devices
  set status = 'overdue'
  where status in ('active','borrowed','awaiting_return')
    and expected_return_date is not null
    and expected_return_date < current_date;
$$;

select cron.schedule(
  'daily-overdue-device-check',
  '0 1 * * *', -- daily at 01:00 UTC
  $$ select mark_overdue_device_assignments(); $$
);
