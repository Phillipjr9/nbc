# Security hardening — leaked Supabase key, RLS, split of trust

Status: **the browser no longer holds a privileged key** (done, deployed and
verified). The leaked `service_role` JWT still works until the JWT secret is
rotated — that one step needs the Supabase dashboard, because the Management API
endpoint for it is not exposed to the Supabase connector.

---

## 1. What went wrong

`VITE_SUPABASE_ANON_KEY` — the key every visitor's browser received — was not an
anon key. Decoded, its JWT payload said:

```json
{ "role": "service_role", "ref": "vbsudrwjxasfkjmbxhyo" }
```

A `service_role` key bypasses row-level security completely: anyone who opened
the deployed site (or the repository history, where `.env` was committed) could
read and rewrite every profile, ledger, card and support thread — and delete
rows. `VITE_SUPABASE_SERVICE_ROLE_KEY` held the same value a second time, so the
privileged key was inlined into the public bundle twice.

`public.profiles` still has **RLS disabled and zero policies** (7 profiles,
~1.4 MB, plaintext passwords inside `profile_data`), which is what makes the leak
immediately exploitable instead of merely embarrassing.

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

## 3. What was done on 2026-11-15

| Step | Result |
| --- | --- |
| App switched from the `service_role` JWT to the **publishable** key `sb_publishable_VToLy…` | `VITE_SUPABASE_ANON_KEY` updated in Vercel (production + preview), local `.env` updated |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` removed from the Vercel project | build env no longer lists it |
| Production redeployed (`dpl_CEpsYu89rNBYBEtXWu6B9GfxngGF`, commit `0ab6956`) | READY, promoted, aliased to `nbcbank.vercel.app` |
| Bundle checked | **zero** JWT-shaped strings; the only key is `sb_publishable_…` |
| Publishable key exercised against the API | `GET /rest/v1/profiles` → **200** |
| Realtime enabled on `public.profiles` | in `supabase_realtime` publication, `replica identity full` |

### Still open — one dashboard step

Revoking the leaked key needs a JWT-secret rotation, which the Supabase
connector does not expose (legacy keys have non-UUID ids, so `delete_api_key`
rejects them; the auth-config tool has no `jwt_secret` field). Verified still
live after everything above:

```sql
-- inside the project, via extensions.pg_net
select net.http_get(
  'https://vbsudrwjxasfkjmbxhyo.supabase.co/rest/v1/profiles?select=email&limit=2',
  headers := jsonb_build_object('apikey', '<leaked service_role JWT>',
                                'Authorization', 'Bearer <leaked service_role JWT>')
);
-- → 200 with rows: the leaked key is still accepted
```

Two clicks fix it, and they invalidate **both** legacy JWTs at once (the app no
longer uses either, so nothing breaks):

1. Supabase → project → **Settings → API → JWT Settings → Generate a new JWT
   secret** (or, if shown, **Revoke legacy API keys**).
2. Nothing else — `VITE_SUPABASE_ANON_KEY` is already a publishable key, so no
   redeploy is needed.

After that, re-run the snippet above: it must return `401`.

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
