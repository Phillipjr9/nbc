create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  role_label text,
  account_kind text,
  status text default 'active',
  member_since text,
  branch_name text,
  advisor_name text,
  profile_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.update_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.update_profiles_updated_at();

-- Example row for a demo user:
-- insert into public.profiles (email, full_name, role_label, account_kind, member_since, branch_name, advisor_name, profile_data)
-- values (
--   'alex.tremblay@videotron.ca',
--   'Alex Tremblay',
--   'Personal Banking',
--   'personal',
--   '2018',
--   'Place Ville Marie — Montreal, QC',
--   'Sophie Gagnon, Financial Advisor',
--   '{}'::jsonb
-- )
-- on conflict (email) do update set
--   full_name = excluded.full_name,
--   role_label = excluded.role_label,
--   account_kind = excluded.account_kind,
--   status = excluded.status,
--   member_since = excluded.member_since,
--   branch_name = excluded.branch_name,
--   advisor_name = excluded.advisor_name,
--   profile_data = excluded.profile_data,
--   updated_at = now();
