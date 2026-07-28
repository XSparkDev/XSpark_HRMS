-- lib/services/storage-service.ts uploads via the anon Supabase client (same
-- root cause as the notifications/rooms RLS gap fixed earlier: this app never
-- propagates a real per-user JWT session client-side). Storage buckets are
-- created out-of-band via the Management API (see conversation), but writes
-- to storage.objects still need a permissive policy or every upload 403s.
create policy "storage_all_access" on storage.objects for all using (true) with check (true);
