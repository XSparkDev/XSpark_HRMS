-- Supervisor dashboard (app/ams-supervisor) fixes:
-- - employees needs a `name` column (first_name + last_name) - lib/services/
--   supervisor-dashboard-service.ts embeds employees:...(name, employee_id)
--   in several joins, which is the only caller expecting a flat `name` field
-- - maintenance_requests needs `issue_type` and `description` aliases matching
--   what this service selects (issue_category/issue_description elsewhere)
-- - room_bookings: this service queries a table literally named room_bookings
--   directly (separate from the /api/room-bookings route, which already goes
--   through bookingsService -> the `bookings` table). Expose it as a view.
-- - RLS: borrows/devices/returns are queried via the anon client from this
--   client-side service (supabaseAdmin cannot run in the browser bundle),
--   same root cause as every other anon-client RLS gap fixed earlier.

alter table employees add column if not exists name text
  generated always as (trim(first_name || ' ' || last_name)) stored;

alter table maintenance_requests add column if not exists issue_type text;
update maintenance_requests set issue_type = issue_category where issue_type is null;

alter table maintenance_requests add column if not exists description text;
update maintenance_requests set description = issue_description where description is null;

create or replace view room_bookings as
select
  booking_id as id,
  room_id,
  booked_by,
  (start_time at time zone 'UTC')::date as date,
  start_time,
  end_time,
  meeting_category,
  meeting_agenda,
  status,
  checked_in_at,
  created_at
from bookings
where room_id is not null;

create policy "borrows_select_all" on borrows for select using (true);
create policy "devices_select_all" on devices for select using (true);
create policy "returns_select_all" on returns for select using (true);
