# Back-office console (administration)

The admin console is organised around **one file per client**. Nothing in it
shows two clients' transactions, accounts or cards in the same view, and every
client's support conversation is reachable from their own file.

Sign in at `#admin-login` (`admin@nbc.ca` / `admin1234`).

## Sign-in precedence (universal `#login` form)

A client and an administrator can share the same email/sign-in ID. The
universal sign-in form (`/#/login`) therefore resolves the **client route
first** and the administrator desk only as a fallback — a shared username can
never shadow the client's own account. The credential resolution lives in
`src/banking/signInResolution.ts` (`resolveSignIn`), covered by
`src/__tests__/signInResolution.test.ts`.

Passwords are verified against the password stored on the client's profile
record — the same record the desk edits (Client directory → Edit profile →
password). Supabase Auth is accepted only for accounts with no stored password
(legacy Auth-only users), because a desk reset never reaches Supabase Auth.
Consequences for the desk:

- After you reset a client's password, the old one stops working immediately —
  including on devices that have not synced yet, and even if Supabase Auth still
  accepts it.
- If a client ever gets locked out, set a fresh password in their client file;
  the record is authoritative, so no Supabase console access is needed.
- Built-in demo personas keep their documented passwords; only client records
  are desk-editable.


## Layout

- **Sidebar** (desktop) / **“Go to” picker** (phones) — grouped sections:
  - *Clients* — Overview · Clients · Support inbox · Approvals
  - *Operations* — Batch operations · Analytics · Search
  - *Administration* — Rates & banners · Access & security · Audit log
- Badges on the sidebar show live counts: clients, unread support messages,
  pending approvals.
- Under the sections, an **“Open client file”** shortcut keeps the client you are
  working on one click away from wherever you are.

Transactions, accounts and cards are **not** top-level sections any more. They
are pages inside a client's file, so an administrator can never post to, or read,
the wrong person's ledger.

## Clients section

Two panes:

| Pane | What it does |
| --- | --- |
| **Client rail** (left) | Search and switch between clients in one click. Each row shows name, segment, hold status, and a badge when that client has unread support messages (`n`) or is waiting for a reply (`!`). |
| **Client file** (right) | That client's own page, with their own tabs. |

**Client directory & new client** toggles the full directory table — create a
client, edit details, freeze, reset a password, export CSV, delete, open a
session as that client. Choosing a client there opens their file.

### Inside a client's file

The header carries the essentials — name, email, segment, branch, Active /
On hold, KYC, “Waiting for Support”, deposits, credit, accounts, ledger size —
plus **Support** (with the unread count), **Export** and **Sign in as this
client**.

Then five tabs, all scoped to that client:

| Tab | Contents |
| --- | --- |
| **Overview** | Identity, address & advisor, products, a support snapshot (last message, unread count, “Open conversation”), internal notes, recent transactions |
| **Transactions** | The full ledger tools: post a transaction (custom amount, date, status), generate history, search/filter, export statement, reverse an entry |
| **Accounts** | Balances, credit limits, credit/debit adjustments, close an account |
| **Cards** | Every card on file with limits, freeze/unfreeze, replace |
| **Support** | This client's conversation only — no inbox list, no other clients. Brand stays “National Bank Support”. |

Switching client from inside any of these pages (they each keep a client picker)
re-scopes the page in place instead of dropping the admin back to a global list.

## Support inbox

The global inbox still exists for triage across clients: sorted with
“asked for a specialist” first, then anyone waiting, then most recent activity.
Each conversation has **Open client file** to jump into that client's record.

## Tests

`src/__tests__/adminNavigation.test.tsx` pins the navigation contract down:

- no top-level Transactions / Accounts / Cards sections;
- every client-owned page appears as a tab inside a client file;
- one file renders one client's data at a time;
- a client's Support tab renders only that conversation and keeps the
  “National Bank Support” branding;
- the directory view is opt-in and separate from a client's file.
