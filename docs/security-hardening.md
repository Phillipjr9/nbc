# Security hardening — leaked Supabase key, RLS, split of trust

Status of the **code**: done (nothing in the browser bundle reads a
service-role key any more).
Status of the **project**: two dashboard steps remain, they need the Supabase
owner and cannot be performed from this repository.

---

## 1. What went wrong

`VITE_SUPABASE_ANON_KEY` — the key every visitor's browser receives — is not an
anon key. Decoded, its JWT payload says:

```json
{ "role": "service_role", "ref": "vbsudrwjxasfkjmbxhyo" }
```

A `service_role` key bypasses row-level security completely: anyone who opens the
deployed site (or the repository history, where `.env` was committed) can read
and rewrite every profile, ledger, card and support thread in the project — and
delete rows. `VITE_SUPABASE_SERVICE_ROLE_KEY` held the same value a second time,
so the privileged key was inlined into the public bundle twice.

`public.profiles` currently has **RLS disabled and zero policies**, which is what
made the leak instantly exploitable instead of merely embarrassing.

## 2. What this branch changed

- `src/lib/supabase.ts`: the `supabaseAdmin` client is gone. No
  `import.meta.env` lookup for `*SERVICE_ROLE*` remains, so Vite cannot inline a
  privileged key even if one is left in the environment.
- `src/lib/profileSync.ts`: writes go through the public client.
- `supabase/hardening/rls-profiles.sql`: policies for the per-user model,
  prepared but **not applied** (see the warnings in the file).
- `supabase/realtime.sql`: enables Realtime on `profiles` (see §5).
- `.github/workflows/ci.yml`: fails the build if a `service_role` key or a
  committed `.env` reappears.

Deleting the `VITE_SUPABASE_SERVICE_ROLE_KEY` environment variable from the
Vercel project is part of the rollout; it is no longer referenced by any code.

## 3. Step 1 — rotate the key (Supabase dashboard, ~2 minutes)

1. Supabase → project `vbsudrwjxasfkjmbxhyo` → **Settings → API**.
2. **Roll the JWT secret** ("JWT Settings → Generate a new JWT secret"). This
   invalidates the leaked `service_role` and `anon` JWTs at once.
3. Copy the **publishable** key (`sb_publishable_…`) if the project offers it,
   otherwise the regenerated **anon / public** key.
4. Vercel → project `nbc` → **Settings → Environment Variables**:
   - set `VITE_SUPABASE_ANON_KEY` to the new public key (Production + Preview);
   - make sure `VITE_SUPABASE_SERVICE_ROLE_KEY` does not exist;
   - keep the server-side secrets (`SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_*`,
     `SUPABASE_JWT_SECRET`) — they are not `VITE_` prefixed, so Vite never
     inlines them; they only reach server functions.
5. Redeploy `main`.
6. Purge `.env` from git history, e.g.
   `git filter-repo --path .env --invert-paths` (or BFG), force-push, and tell
   collaborators to re-clone. `.env` is already in `.gitignore`.

> After this step the leaked key is worthless. Do not skip it because "RLS will
> cover it" — that key bypasses RLS by design.

## 4. Step 2 — put profiles under RLS (requires the auth rework)

Today the browser reads every profile row (admin console) and writes rows that
belong to other users, with one key. No policy can express "this client may see
only their own row" *and* keep that design working, so the order matters:

1. Make a profile row point at its owner: `profiles.id = auth.users.id` (or add
   `auth_user_id`).
2. Client sign-in uses Supabase Auth (already implemented in
   `src/lib/supabaseAuth.ts`), so `auth.uid()` is available.
3. Move the back office behind a server boundary: an Edge Function
   (`supabase/functions/admin`) that verifies the admin session and then uses the
   **server-side** service-role key. The admin console calls that function
   instead of the table.
4. Then run `supabase/hardening/rls-profiles.sql` and verify:
   - signed in as a client: `select * from profiles` → exactly one row;
   - signed in as a client: `select * from profiles where email = '<other>'` → `[]`;
   - signed out (`anon`): every table read → `[]`.

Until step 3 exists, running the policy file breaks the admin console. That is
why it is not applied by this branch.

## 5. Realtime and privacy

`supabase/realtime.sql` publishes `public.profiles` so Support messages arrive
instantly (`src/lib/profileRealtime.ts`). Realtime honours RLS, so this only
becomes private once §4 is done. Until then, treat every profile as readable by
anyone holding the site's key — which is exactly the problem §3 removes.

## 6. Keeping it fixed — checklist

- [ ] `.env` is git-ignored and no key is committed again (CI greps for it).
- [ ] Only `VITE_*` variables are exposed to the build; anything privileged is
      server-side.
- [ ] No `createClient(url, serviceRoleKey)` call in `src/`.
- [ ] RLS enabled on every table in `public`.
- [ ] Re-read this file on any key exposure.
