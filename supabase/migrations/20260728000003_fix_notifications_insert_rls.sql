-- The earlier notifications RLS fix only covered SELECT/UPDATE; INSERT (used by
-- e.g. app/api/verification/request/route.ts and the branded-email edge
-- function) was still blocked. Consolidate into one permissive FOR ALL policy.
drop policy if exists "notifications_select_all" on notifications;
drop policy if exists "notifications_update_all" on notifications;
drop policy if exists "notifications_insert_all" on notifications;
create policy "notifications_all" on notifications for all using (true) with check (true);
