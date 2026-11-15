-- ============================================================================
--  Row-level security for public.profiles  —  DO NOT RUN YET
-- ============================================================================
--
-- Why this file is not applied automatically:
--
--   The app as shipped reads *every* row of `public.profiles` through one
--   browser-side key (the admin console lists all clients), and the admin
--   console writes profiles that belong to other people. Enabling RLS with the
--   policies below *before* the auth rework in docs/security-hardening.md is
--   done would make the admin console and the sign-in lookup return nothing.
--
-- Prerequisites (in order):
--
--   1. Rotate the leaked key and ship only the publishable/anon key
--      (docs/security-hardening.md, step 1). Until that is done, RLS on this
--      table protects nothing: the shipped key is a `service_role` JWT and
--      bypasses RLS by definition.
--   2. Make `public.profiles.id` the Supabase auth user id (`auth.users.id`),
--      or add `auth_user_id uuid references auth.users(id)`, so a policy can
--      map a row to a person.
--   3. Move back-office reads/writes (client list, posting transactions) behind
--      an Edge Function that holds the service-role key server-side.
--
-- Then run this file.
-- ============================================================================

alter table public.profiles enable row level security;

-- A client may read and update only their own row.
drop policy if exists "profiles: owner can read own row" on public.profiles;
create policy "profiles: owner can read own row"
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or auth_user_id = auth.uid()
  );

drop policy if exists "profiles: owner can update own row" on public.profiles;
create policy "profiles: owner can update own row"
  on public.profiles
  for update
  to authenticated
  using (
    id = auth.uid()
    or auth_user_id = auth.uid()
  )
  with check (
    id = auth.uid()
    or auth_user_id = auth.uid()
  );

-- Sign-up / first sign-in creates the row for the caller only.
drop policy if exists "profiles: owner can insert own row" on public.profiles;
create policy "profiles: owner can insert own row"
  on public.profiles
  for insert
  to authenticated
  with check (
    id = auth.uid()
    or auth_user_id = auth.uid()
  );

-- The admin console is served by an Edge Function with the service-role key, so
-- it needs no policy here. If staff are identified by a JWT claim instead, add:
--
--   create policy "profiles: staff can read all rows"
--     on public.profiles for select to authenticated
--     using ((auth.jwt() -> 'app_metadata' ->> 'nbc_role') in ('support', 'admin'));

-- Everyone else (anon) gets nothing: no policy, no rows, no writes.
revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

-- After applying, verify from the browser console (signed in as a client):
--   supabase.from('profiles').select('*')                                 -- one row
--   supabase.from('profiles').select('*').eq('email', 'someone-else@x')   -- []
