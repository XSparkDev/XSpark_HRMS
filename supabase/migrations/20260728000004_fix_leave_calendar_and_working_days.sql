-- lib/services/leave-service.ts INSERTs into leave_calendar (one row per
-- working day of an approved-pending request) and calls calculate_working_days()
-- as a Postgres RPC. Neither existed: leave_calendar was built as a read-only
-- view (never used that way anywhere in the app - grep confirms leave-service.ts
-- is the only caller, and only for insert/delete), and calculate_working_days
-- was never created at all.

drop view if exists leave_calendar;

create table leave_calendar (
  id uuid primary key default gen_random_uuid(),
  leave_request_id uuid not null references leave_requests(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  leave_date date not null,
  is_half_day boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_leave_calendar_employee on leave_calendar(employee_id, leave_date);
alter table leave_calendar enable row level security;
create policy "leave_calendar_all" on leave_calendar for all using (true) with check (true);

-- Weekend-exclusion only (matches the JS fallback already coded in
-- calculateWorkingDays() for when this RPC is unavailable). Public-holiday
-- awareness would need a holidays table; not implemented.
create or replace function calculate_working_days(start_date date, end_date date, country text default 'ZA')
returns integer language plpgsql as $$
declare
  d date;
  total integer := 0;
begin
  d := start_date;
  while d <= end_date loop
    if extract(isodow from d) < 6 then
      total := total + 1;
    end if;
    d := d + 1;
  end loop;
  return total;
end;
$$;
