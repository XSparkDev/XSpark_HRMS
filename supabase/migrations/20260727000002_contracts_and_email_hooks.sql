-- Contracts (needed for expiry-reminder emails) + hooks that fire branded
-- transactional emails via the send-branded-email Edge Function:
--   - welcome email on new employee registration
--   - contract expiry reminders (30 / 14 / 7 days out), daily cron

create table contracts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  contract_type text,
  start_date date not null,
  end_date date,
  document_url text,
  status text not null default 'active' check (status in ('active','expired','terminated','renewed')),
  last_expiry_reminder_sent_at timestamptz,
  last_expiry_reminder_days integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_contracts_employee on contracts(employee_id);
create index idx_contracts_end_date on contracts(end_date) where status = 'active';
create trigger trg_contracts_updated_at before update on contracts
  for each row execute function set_updated_at();
alter table contracts enable row level security;

-- ---------------------------------------------------------------------------
-- Welcome email: fire on new employee row (i.e. registration/onboarding)
-- ---------------------------------------------------------------------------
create or replace function notify_new_employee_welcome_email()
returns trigger language plpgsql as $$
begin
  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-branded-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := jsonb_build_object(
      'template', 'welcome',
      'employeeId', new.id
    )
  );
  return new;
end;
$$;

create trigger trg_employees_welcome_email
  after insert on employees
  for each row execute function notify_new_employee_welcome_email();

-- ---------------------------------------------------------------------------
-- Contract expiry reminders: daily check, sends at 30/14/7 days out, once each.
-- ---------------------------------------------------------------------------
create or replace function check_contract_expiry_reminders()
returns void language plpgsql as $$
declare
  c record;
  days_out integer;
begin
  for c in
    select id, employee_id, end_date
    from contracts
    where status = 'active'
      and end_date is not null
      and end_date - current_date in (30, 14, 7)
  loop
    days_out := c.end_date - current_date;

    if (select last_expiry_reminder_days from contracts where id = c.id) is distinct from days_out then
      perform net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-branded-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
        ),
        body := jsonb_build_object(
          'template', 'contract_expiry',
          'employeeId', c.employee_id,
          'contractId', c.id,
          'daysRemaining', days_out
        )
      );

      update contracts
      set last_expiry_reminder_sent_at = now(),
          last_expiry_reminder_days = days_out
      where id = c.id;
    end if;
  end loop;
end;
$$;

select cron.schedule(
  'daily-contract-expiry-check',
  '0 6 * * *', -- daily at 06:00 UTC
  $$ select check_contract_expiry_reminders(); $$
);
