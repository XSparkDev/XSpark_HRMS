-- lib/services/maintenance-service.ts filters/sorts by `reported_at`, not `created_at`.
alter table maintenance_requests add column if not exists reported_at timestamptz default now();
update maintenance_requests set reported_at = created_at where reported_at is null;
