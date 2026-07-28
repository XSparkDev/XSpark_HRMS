-- HRMS initial schema
-- Built from live application code (app/api/**, lib/services/**, supabase/functions/leave-accruals)
-- not from the stale database-schema.md doc. See conversation decisions:
--   - leave model: live Edge Function shape (leave_types/leave_balances/leave_accrual_history)
--   - bookings: single merged table (rooms + generic resources), room_bookings retired
--   - notes: notes2 only
--   - hr_tickets / contact_messages: new, persisted (previously in-memory/localStorage)

create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- 1. IDENTITY
-- ============================================================================

create table roles (
  id uuid primary key default gen_random_uuid(),
  role_name text unique not null check (role_name in ('employee','supervisor','junior_hr','hr_manager','admin','super_admin')),
  can_view_sensitive_data boolean not null default false,
  can_edit_employee_data boolean not null default false,
  can_approve_leave boolean not null default false,
  can_manage_users boolean not null default false,
  can_access_audit_logs boolean not null default false,
  can_manage_system_config boolean not null default false,
  created_at timestamptz not null default now()
);

create table job_titles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  department text,
  hourly_rate numeric(10,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_job_titles_updated_at before update on job_titles
  for each row execute function set_updated_at();

create table employees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  employee_id text unique not null, -- human-readable XSP<YY/MM>/<NNN>
  role_id uuid references roles(id),
  job_title_id uuid references job_titles(id),
  first_name text not null,
  last_name text not null,
  email text unique not null,
  phone text,
  id_number text,
  passport_number text,
  is_foreign_national boolean not null default false,
  date_hired date not null,
  employment_status text not null default 'active'
    check (employment_status in ('active','suspended','terminated','probation','absconded','archived')),
  is_active boolean not null default true,
  id_verified boolean not null default false,
  bank_verified boolean not null default false,
  work_permit_verified boolean not null default false,
  profile_picture_url text,
  passport_document_url text,
  work_permit_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_employees_role on employees(role_id);
create index idx_employees_status on employees(employment_status);
create index idx_employees_auth_user on employees(auth_user_id);
create trigger trg_employees_updated_at before update on employees
  for each row execute function set_updated_at();

create view active_employees as
  select * from employees where is_active = true and employment_status = 'active';

create table next_of_kin (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  full_name text not null,
  relationship text,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_next_of_kin_employee on next_of_kin(employee_id);
create trigger trg_next_of_kin_updated_at before update on next_of_kin
  for each row execute function set_updated_at();

create table income (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid unique not null references employees(id) on delete cascade,
  basic_salary numeric(12,2) not null default 0,
  allowances numeric(12,2) not null default 0,
  gross_income numeric(12,2) generated always as (basic_salary + allowances) stored,
  total_deductions numeric(12,2) not null default 0,
  net_income numeric(12,2) generated always as (basic_salary + allowances - total_deductions) stored,
  effective_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_income_updated_at before update on income
  for each row execute function set_updated_at();

create table payslips (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  document_url text,
  gross_pay numeric(12,2),
  net_pay numeric(12,2),
  created_at timestamptz not null default now()
);
create index idx_payslips_employee on payslips(employee_id);

-- ============================================================================
-- 2. LEAVE MANAGEMENT (matches live leave-accruals Edge Function / leave-service.ts)
-- ============================================================================

create table leave_types (
  id uuid primary key default gen_random_uuid(),
  key text unique not null, -- 'annual' | 'sick' | 'family_responsibility' | ...
  name text not null,
  cycle_months integer not null default 12,
  requires_document boolean not null default false,
  created_at timestamptz not null default now()
);

create table leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  leave_type_id uuid not null references leave_types(id),
  cycle_start_date date,
  cycle_end_date date,
  total_accrued numeric(6,2) not null default 0,
  total_used numeric(6,2) not null default 0,
  total_pending numeric(6,2) not null default 0,
  carried_over numeric(6,2) not null default 0,
  available_balance numeric(6,2) generated always as
    (total_accrued + carried_over - total_used - total_pending) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_leave_balances_employee on leave_balances(employee_id);
create index idx_leave_balances_type on leave_balances(leave_type_id);
create trigger trg_leave_balances_updated_at before update on leave_balances
  for each row execute function set_updated_at();

create table leave_accrual_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  leave_type_id uuid not null references leave_types(id),
  balance_id uuid references leave_balances(id) on delete set null,
  accrual_date date not null,
  amount numeric(6,2) not null,
  accrual_reason text not null check (accrual_reason in ('monthly','instant','special')),
  notes text,
  created_at timestamptz not null default now()
);
create index idx_accrual_history_employee on leave_accrual_history(employee_id);
create index idx_accrual_history_lookup on leave_accrual_history(employee_id, leave_type_id, accrual_reason, accrual_date);

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  leave_type_id uuid not null references leave_types(id),
  start_date date not null,
  end_date date not null,
  total_days numeric(5,2) not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  submitted_at timestamptz not null default now(),
  submitted_by uuid references employees(id),
  reviewed_at timestamptz,
  reviewed_by uuid references employees(id),
  review_notes text,
  document_url text,
  document_required boolean not null default false,
  early_return_requested_at timestamptz,
  early_return_date date,
  early_return_status text check (early_return_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_leave_requests_employee on leave_requests(employee_id);
create index idx_leave_requests_status on leave_requests(status);
create trigger trg_leave_requests_updated_at before update on leave_requests
  for each row execute function set_updated_at();

create view leave_calendar as
  select lr.id, lr.employee_id, e.first_name, e.last_name, lt.key as leave_type,
         lr.start_date, lr.end_date, lr.status
  from leave_requests lr
  join employees e on e.id = lr.employee_id
  join leave_types lt on lt.id = lr.leave_type_id
  where lr.status = 'approved';

create view pending_leave_requests as
  select * from leave_requests where status = 'pending';

create view employee_leave_summary as
  select employee_id, leave_type_id, available_balance, total_accrued, total_used, total_pending
  from leave_balances;

-- ============================================================================
-- 3. ASSETS / DEVICES / BOOKINGS
-- ============================================================================

create table devices (
  id uuid primary key default gen_random_uuid(),
  device_id text unique not null,
  asset_tag text,
  serial_number text,
  device_type text,
  brand text,
  model text,
  specs jsonb,
  status text not null default 'available'
    check (status in ('available','assigned','borrowed','maintenance','retired','lost','pending_borrow')),
  condition text,
  location text,
  assigned_to uuid references employees(id) on delete set null,
  notes text,
  purchase_date date,
  warranty_expiry date,
  qr_code text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_devices_status on devices(status);
create index idx_devices_assigned_to on devices(assigned_to);
create trigger trg_devices_updated_at before update on devices
  for each row execute function set_updated_at();

create table rooms (
  id uuid primary key default gen_random_uuid(),
  room_name text not null,
  room_code text unique,
  location text,
  floor text,
  capacity integer,
  features text[],
  description text,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_rooms_updated_at before update on rooms
  for each row execute function set_updated_at();

create table resources (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null check (resource_type in ('room','device','generic')),
  room_id uuid references rooms(id) on delete cascade,
  device_id uuid references devices(id) on delete cascade,
  name text not null,
  description text,
  is_available boolean not null default true,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_resources_updated_at before update on resources
  for each row execute function set_updated_at();

-- merged bookings table (rooms + generic resources); room_bookings retired per decision
create table bookings (
  booking_id text primary key default ('BK-' || substr(gen_random_uuid()::text, 1, 8)),
  room_id uuid references rooms(id),
  resource_id uuid references resources(id),
  booked_by uuid not null references employees(id),
  booking_reason text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'confirmed'
    check (status in ('confirmed','cancelled','completed','no_show')),
  checked_in_at timestamptz,
  check_in_status text,
  check_in_time timestamptz,
  is_postponed boolean not null default false,
  postponed_from timestamptz,
  postponed_to timestamptz,
  approved_by uuid references employees(id),
  approved_at timestamptz,
  rejection_reason text,
  meeting_category text,
  meeting_agenda text,
  purpose text,
  is_recurring boolean not null default false,
  recurrence_pattern text,
  recurrence_end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_bookings_room on bookings(room_id);
create index idx_bookings_booked_by on bookings(booked_by);
create index idx_bookings_time_range on bookings(start_time, end_time);
create trigger trg_bookings_updated_at before update on bookings
  for each row execute function set_updated_at();

create table assigned_devices (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  assigned_by uuid references employees(id),
  approved_by uuid references employees(id),
  assignment_type text not null check (assignment_type in ('permanent','temporary','loan','repair','other')),
  status text not null default 'pending'
    check (status in ('pending','approved','active','borrowed','awaiting_return','returned','overdue','cancelled','rejected')),
  assigned_date date,
  expected_return_date date,
  actual_return_date date,
  assigned_condition text check (assigned_condition in ('excellent','good','fair','poor','damaged','unusable')),
  returned_condition text check (returned_condition in ('excellent','good','fair','poor','damaged','unusable')),
  purpose text,
  assignment_notes text,
  return_notes text,
  approval_required boolean not null default false,
  approval_requested_at timestamptz,
  approval_status text,
  approved_at timestamptz,
  rejection_reason text,
  return_requested_at timestamptz,
  return_verified_by uuid references employees(id),
  return_verified_at timestamptz,
  has_issues boolean not null default false,
  issue_description text,
  reported_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_assigned_devices_device on assigned_devices(device_id);
create index idx_assigned_devices_employee on assigned_devices(employee_id);
create index idx_assigned_devices_status on assigned_devices(status);
create trigger trg_assigned_devices_updated_at before update on assigned_devices
  for each row execute function set_updated_at();

create table borrows (
  borrow_id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices(id) on delete cascade,
  borrowed_by uuid not null references employees(id),
  borrow_date date not null default current_date,
  return_date date,
  is_borrowed boolean not null default false,
  approval_status text default 'pending' check (approval_status in ('pending','approved','rejected')),
  status text,
  returned_at timestamptz,
  notes text,
  qr_code_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_borrows_device on borrows(device_id);
create index idx_borrows_borrower on borrows(borrowed_by);
create trigger trg_borrows_updated_at before update on borrows
  for each row execute function set_updated_at();

create table returns (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  device_id uuid not null references devices(id),
  return_date date not null default current_date,
  device_condition text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_returns_updated_at before update on returns
  for each row execute function set_updated_at();

create table incidents (
  incident_id uuid primary key default gen_random_uuid(),
  device_id uuid references devices(id) on delete set null,
  reported_by uuid not null references employees(id),
  incident_type text not null check (incident_type in ('Damage','Malfunction','Lost','Other')),
  description text,
  severity text not null default 'Low' check (severity in ('Low','Medium','High','Critical')),
  status text not null default 'Open' check (status in ('Open','In Progress','Resolved','Closed')),
  resolved_by uuid references employees(id),
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_incidents_updated_at before update on incidents
  for each row execute function set_updated_at();

create table maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null check (asset_type in ('device','resource','room')),
  asset_id uuid not null,
  device_id uuid references devices(id) on delete set null,
  room_id uuid references rooms(id) on delete set null,
  reported_by uuid not null references employees(id),
  assigned_to uuid references employees(id),
  issue_title text not null,
  issue_description text,
  issue_category text,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'submitted' check (status in ('submitted','in_progress','completed','resolved')),
  asset_usability text check (asset_usability in ('usable','not_usable','partially_usable')),
  attachments jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_maintenance_asset on maintenance_requests(asset_type, asset_id);
create trigger trg_maintenance_updated_at before update on maintenance_requests
  for each row execute function set_updated_at();

-- ============================================================================
-- 4. NOTES / NOTIFICATIONS / CHAT
-- ============================================================================

create table notes2 (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references employees(id),
  target_employee_id uuid references employees(id),
  title text,
  content text not null,
  alert_level text check (alert_level in ('high','medium','low')),
  is_confidential boolean not null default false,
  visibility text not null default 'private' check (visibility in ('private','public')),
  pinned boolean not null default false,
  tags text[],
  reminder_enabled boolean not null default false,
  reminder_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_notes2_target on notes2(target_employee_id);
create index idx_notes2_reminder on notes2(reminder_at) where reminder_enabled = true;
create trigger trg_notes2_updated_at before update on notes2
  for each row execute function set_updated_at();

create table notifications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  title text not null,
  message text not null,
  notification_type text,
  is_confidential boolean not null default false,
  published_by uuid references employees(id),
  is_read boolean not null default false,
  read_at timestamptz,
  email_sent boolean not null default false,
  email_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notifications_employee on notifications(employee_id, is_read);
alter publication supabase_realtime add table notifications;

create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_chat_sessions_employee on chat_sessions(employee_id);
create trigger trg_chat_sessions_updated_at before update on chat_sessions
  for each row execute function set_updated_at();

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  sender text not null check (sender in ('user','assistant')),
  text text not null,
  created_at timestamptz not null default now()
);
create index idx_chat_messages_session on chat_messages(session_id);

-- ============================================================================
-- 5. DOCUMENTS
-- ============================================================================

create table documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  document_type text,
  file_name text not null,
  file_url text not null,
  bucket text,
  uploaded_by uuid references employees(id),
  is_confidential boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_documents_employee on documents(employee_id);
create trigger trg_documents_updated_at before update on documents
  for each row execute function set_updated_at();

create table document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  version_number integer not null,
  file_url text not null,
  uploaded_by uuid references employees(id),
  created_at timestamptz not null default now()
);
create index idx_document_versions_document on document_versions(document_id);

create table document_access_log (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  accessed_by uuid references employees(id),
  action text not null check (action in ('view','download','signed_url')),
  accessed_at timestamptz not null default now()
);
create index idx_document_access_log_document on document_access_log(document_id);

-- ============================================================================
-- 6. HR TICKETS / CONTACT MESSAGES (new — previously in-memory / localStorage)
-- ============================================================================

create table hr_tickets (
  id text primary key, -- e.g. case-2026-000123
  employee_id uuid references employees(id) on delete set null,
  name text,
  department text,
  category text,
  subcategory text,
  subject text not null,
  description text,
  attachments jsonb,
  contact_method text,
  confidential boolean not null default false,
  status text not null default 'open',
  priority text check (priority in ('urgent','high','normal','low')),
  estimated_sla text,
  assigned_to uuid references employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index idx_hr_tickets_status on hr_tickets(status);
create trigger trg_hr_tickets_updated_at before update on hr_tickets
  for each row execute function set_updated_at();

create table contact_messages (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('feedback','query')),
  user_id uuid references employees(id) on delete set null,
  message text not null,
  recipient text,
  created_at timestamptz not null default now()
);
create index idx_contact_messages_user on contact_messages(user_id);

-- ============================================================================
-- 7. AUDIT
-- ============================================================================

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete set null,
  action text not null,
  action_type text,
  severity text default 'info',
  target_table text,
  target_record_id text,
  previous_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text,
  published_by uuid references employees(id),
  published_by_system boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_audit_logs_target on audit_logs(target_table, target_record_id);
create index idx_audit_logs_employee on audit_logs(employee_id);

-- ============================================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================================
-- The app talks to Supabase almost entirely through Next.js API routes using
-- the service_role key (which bypasses RLS by design). RLS below is deny-by-
-- default for the anon/authenticated roles, with real per-user policies only
-- on the two tables queried directly from the browser client:
-- chat_sessions / chat_messages (components/ai-chat-widget.tsx).

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'roles','job_titles','employees','next_of_kin','income','payslips',
      'leave_types','leave_balances','leave_accrual_history','leave_requests',
      'devices','rooms','resources','bookings','assigned_devices','borrows','returns',
      'incidents','maintenance_requests','notes2','notifications',
      'chat_sessions','chat_messages','documents','document_versions','document_access_log',
      'hr_tickets','contact_messages','audit_logs'
    ])
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

create policy "chat_sessions_owner" on chat_sessions
  for all using (employee_id in (select id from employees where auth_user_id = auth.uid()))
  with check (employee_id in (select id from employees where auth_user_id = auth.uid()));

create policy "chat_messages_owner" on chat_messages
  for all using (
    session_id in (
      select id from chat_sessions where employee_id in (
        select id from employees where auth_user_id = auth.uid()
      )
    )
  )
  with check (
    session_id in (
      select id from chat_sessions where employee_id in (
        select id from employees where auth_user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- 9. SEED leave_types (required by the leave-accruals Edge Function)
-- ============================================================================

insert into leave_types (key, name, cycle_months, requires_document) values
  ('annual', 'Annual Leave', 12, false),
  ('sick', 'Sick Leave', 36, true),
  ('family_responsibility', 'Family Responsibility Leave', 12, false)
on conflict (key) do nothing;

insert into roles (role_name, can_view_sensitive_data, can_edit_employee_data, can_approve_leave, can_manage_users, can_access_audit_logs, can_manage_system_config) values
  ('employee', false, false, false, false, false, false),
  ('supervisor', false, false, true, false, false, false),
  ('junior_hr', true, true, true, false, false, false),
  ('hr_manager', true, true, true, true, true, false),
  ('admin', true, true, true, true, true, true),
  ('super_admin', true, true, true, true, true, true)
on conflict (role_name) do nothing;
