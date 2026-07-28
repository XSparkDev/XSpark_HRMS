-- app/api/documents/route.ts calls supabase.rpc("set_config", ...) to set a
-- session variable for audit triggers. pg_catalog.set_config exists but isn't
-- exposed over PostgREST RPC; wrap it in a public-schema function.
create or replace function set_config(setting text, value text, is_local boolean default true)
returns void language plpgsql as $$
begin
  perform pg_catalog.set_config(setting, value, is_local);
end;
$$;
