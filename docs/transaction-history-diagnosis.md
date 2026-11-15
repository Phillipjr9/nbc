# Why transaction history disappears on some devices / in some countries

Investigation date: 2026-11-15 · Branch `arena/36b149b0-nbc` (base `ab583a2`)

Short version: **it is not one bug.** History is not stored in a transactions table —
it is a JSON array inside `profiles.profile_data`, mirrored into `localStorage` in each
browser. That design produces two independent failure classes: *device/session* failures
(different browser, cleared storage, private window, second phone) and *country/timezone*
failures (entries stamped with the UTC day instead of the local calendar day). A third
issue — the production Supabase key — is what allows a single bad client to overwrite a
client's ledger for everybody.

---

## 1. Device-class failures (history empty or page blank on another device)

### 1.1 History only exists in the browser that wrote it

| What | Where |
| --- | --- |
| Ledger read/write | `src/lib/profileSync.ts` → `profiles.profile_data` (JSON blob) |
| Local mirror | `src/App.tsx` → `nbc_profiles_v1`, `nbc_custom_profiles_v1` |
| Sync | `fetchProfiles()` every 15 s, last write wins |

A device that has never signed in holds no mirror at all. It shows whatever the row in
`profiles` contains — and that row is a whole-document blob, not a per-transaction record.

### 1.2 Sign-in on a fresh device opened an empty placeholder (and discarded it)

`src/components/AuthPages.tsx` (previous behaviour): when Supabase verified the password
but the profile was not already in memory, the flow fell through to a placeholder:

```ts
onSignInCustom({ id: "supabase-" + …, fullName: "Supabase User",
                 accounts: [], transactions: [], … });
```

`handleSignInCustom` in `src/App.tsx` only replaced an **existing** entry
(`prev.map(...)`), so on a new device the placeholder was thrown away, `activeProfile`
resolved to `null`, and the user was bounced back to the login form — "my history is gone
on my phone". Worse, had that placeholder ever been persisted, `useEffect([activeProfile])`
would have written `accounts: []` / `transactions: []` over the real row and erased the
ledger for every device. (The same block also referenced an undefined variable `result`,
which threw on that path.)

### 1.3 A partial row white-screened the whole dashboard

`Dashboard.tsx` reads `profile.transactions` during render
(`.slice(0, 6)`, `.length`, `.filter`, `balanceAvailability(...)`). If the array is absent —
older payload, a write that dropped `undefined` keys, a row created outside the app — the
render throws and React unmounts the tree: a blank page rather than an empty ledger. This
matches the earlier hot-fixes on the sibling branch ("guard transactions array in rows
useMemo to prevent crash", "prevent white page on reverse").

### 1.4 Merge was blind last-write-wins

`mergeRemoteProfiles` / `mergeRemoteProfilesIntoBuiltIn` took `rp.transactions ?? current.transactions`.
A row saved with an empty array therefore replaced a populated local ledger on every device
at the next 15-second poll — one bad write propagated as total data loss.

### 1.5 Silent storage failures

Every `localStorage.setItem` is wrapped in `catch {}`. In private windows, with storage
blocked, or past the ~5 MB quota (a generated multi-year series is up to 600 entries per
account, times several profiles), the mirror simply is not saved and nothing is reported.

---

## 2. Country-class failures (entries missing from date-filtered views)

All ledger dates are calendar dates (`YYYY-MM-DD`), but they were being produced from UTC.

### 2.1 "Today" was the UTC day

```ts
const todayIso = () => new Date().toISOString().slice(0, 10);   // 6 call sites
```

Verified with the real code under several `TZ` values (`2026-11-15T23:30Z`):

| Timezone | UTC date stamped | Real local date |
| --- | --- | --- |
| UTC | 2026-11-15 | 2026-11-15 |
| America/Toronto | 2026-11-15 | 2026-11-15 |
| Asia/Kolkata | 2026-11-15 | **2026-11-16** |
| Africa/Lagos | 2026-11-15 | **2026-11-16** |
| Pacific/Auckland | 2026-11-15 | **2026-11-16** |

So a transfer made at 00:30 in Lagos/Auckland/Sydney is stamped with *yesterday*, and a
card payment made at 20:00 in Vancouver/Toronto is stamped with *tomorrow*. Both fall
outside "Last 30 days / Year to date / a custom range", so the entry the customer just made
is missing from the filtered ledger. The same key drives `spentThisMonth` on cards
(`new Date().toISOString().slice(0, 7)`), so monthly limits mis-report across month ends.

### 2.2 Add-day arithmetic drifted in UTC+13

```ts
const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + days);
return d.toISOString().slice(0, 10);
```

Local noon in `Pacific/Auckland` (UTC+13, DST) is 23:00 UTC **the previous day**, so
`addDays`, `runDueSchedules` and the admin multi-year generator all emit dates one day
early there (`'2026-01-01T12:00'` → `2025-12-31`). A YTD statement then starts before the
period and schedule runs land on the wrong day.

### 2.3 Display showed the previous day in the Americas

`new Date("2026-05-14")` is UTC midnight; `toLocaleDateString("en-CA")` in Toronto/Honolulu
renders **May 13, 2026**. Entries appeared one day earlier than the statement period.

---

## 3. Root enabler: the production key is a service-role key

* `Vercel → project nbc → VITE_SUPABASE_ANON_KEY` (production + preview, id `t0nXnwZoGMohhAWT`)
  decrypts to a JWT whose payload is `{"role":"service_role", …}`.
* `.env` in the repository contains the same key and **was tracked in git** in a public repo.

Vite inlines `VITE_*` variables into the shipped bundle, so every visitor's browser holds a
key that bypasses Row Level Security. Anything running on the page — or anyone with
`view-source` — can read and rewrite every profile, including replacing
`profile_data.transactions`. This is what turns a single buggy client into "everyone's
history is gone", and it means the RLS policies cannot protect the ledger today.

---

## 4. What was changed in this branch

| File | Change |
| --- | --- |
| `src/lib/dates.ts` *(new)* | Local-calendar helpers: `toIsoDate`, `todayIso`, `parseIsoDate`, `addDaysIso`, `normalizeIsoDate`, `formatIsoDate`. |
| `src/lib/profileNormalize.ts` *(new)* | `ensureProfileShape()` guarantees every collection exists and repairs each transaction (date coerced to ISO, non-numeric amount repaired to 0 — rows are never dropped); `isPersistableProfile()` blocks placeholder writes; `sortTransactionsDesc()`. |
| `src/lib/profileSync.ts` | Rows are normalised on read; new `fetchProfileByEmail()`; RLS/read errors are logged instead of swallowed. |
| `src/components/AuthPages.tsx` | Sign-in loads the real profile from Supabase (and fixes the `result` reference error). No more empty placeholder. |
| `src/App.tsx` | Stored/remote profiles normalised; sign-in *upserts* the profile into state (previously discarded); write-back skipped for incomplete profiles; merges keep a populated ledger when the server copy is empty; dashboards wrapped in an error boundary. |
| `src/components/ErrorBoundary.tsx` *(new)* | A data problem can no longer blank the app. |
| `src/banking/bankingTypes.ts`, `adminOps.ts`, `Dashboard.tsx`, `BusinessDashboard.tsx`, admin screens | Local-date "today", drift-free `addDays`, guarded/`sorted` transaction reads, search also matches category & reference. |
| `.env` | Untracked (`git rm --cached`) — it was committed despite `.gitignore`. |

### Verification

`npm run build` passes; `tsc --noEmit` shows the same 8 pre-existing errors as the base
commit and no new ones.

Server-rendering the personal dashboard with a profile whose `transactions` is `undefined`:

| Build | Result |
| --- | --- |
| base commit `ab583a2` | `THROW — Cannot read properties of undefined (reading 'filter')` (blank page) |
| this branch | renders normally |

Date helpers checked under `TZ=UTC / America/Toronto / Asia/Kolkata / Africa/Lagos /
Pacific/Auckland`: `todayIso()` now matches the real local date in every zone and
`addDaysIso('2026-05-14', 30)` returns `2026-06-13` everywhere (it returned `2025-12-31`
for a generated series in Auckland before).

---

## 5. Still required outside the code (in order)

1. **Rotate the Supabase service-role key now** (Supabase → Settings → API) and purge it from
   git history; put only the public anon/publishable key in `VITE_SUPABASE_ANON_KEY` in Vercel.
2. **Enable RLS on `public.profiles`** with a policy that limits reads to the signed-in user
   and writes to `auth.uid()` / the admin role (`supabase/profiles.sql` currently defines no
   policies, so enabling RLS naively would make every read return 0 rows).
3. **Repair poisoned rows** — find profiles whose document lost its ledger and restore from a
   backup:
   ```sql
   select email, jsonb_array_length(coalesce(profile_data->'transactions','[]'::jsonb)) as tx_count
   from public.profiles order by tx_count asc;
   ```
4. **Stop using one JSON blob as the ledger.** Add a `transactions` table
   (`profile_email`, `account_id`, `posted_on date`, `amount numeric`, …) with per-row
   writes; a single row can then never erase a statement, and a device only needs to query
   the range it displays.
