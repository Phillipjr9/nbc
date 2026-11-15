-- Live Support chat / cross-device profile sync (Supabase Realtime).
--
-- Run this once per Supabase project (SQL editor). Without it, the app still
-- works: `subscribeToProfileChanges()` reports the channel as offline and the
-- client falls back to the 15 s profile poll. With it, a Support message sent on
-- one device appears on the other in well under a second.
--
--   psql "$DATABASE_URL" -f supabase/realtime.sql
--   -- or paste this file into Supabase → SQL editor → Run

-- 1. Publish the profiles table so row changes are broadcast.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end
$$;

-- 2. Send the whole new row (not just the primary key) so a receiving client can
--    decide whether the change matters without a second round-trip.
alter table public.profiles replica identity full;

-- 3. Verify: `select * from pg_publication_tables where pubname = 'supabase_realtime';`
--    should list `public | profiles`.
--
-- NOTE: Realtime respects row-level security. While `public.profiles` has RLS
-- disabled (current state), any client holding the project key can subscribe to
-- every profile row. Fixing that is the RLS work in docs/security-hardening.md —
-- do not treat realtime as private until then.
