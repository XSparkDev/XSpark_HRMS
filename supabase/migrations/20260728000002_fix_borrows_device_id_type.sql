-- lib/services/borrow-service.ts treats borrows.device_id as the human-readable
-- device identifier (e.g. "DEV-001", matching devices.device_id), not the
-- internal devices.id uuid. (Contrast with assigned_devices.device_id, which
-- app/api/assigned-devices/route.ts validates as a uuid — that one was correct.)
alter table borrows drop constraint if exists borrows_device_id_fkey;
alter table borrows alter column device_id type text using device_id::text;
alter table borrows add constraint borrows_device_id_fkey
  foreign key (device_id) references devices(device_id) on delete cascade;
