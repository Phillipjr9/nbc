# One-to-one Support chat (customer ⇄ Support desk)

A WhatsApp-style private conversation between a signed-in client and the Support
desk, plus a back-office inbox with a new-message chime.

## Customer side — always branded “Support”

| File | Role |
| --- | --- |
| `src/components/SupportChat.tsx` | The single floating launcher + conversation panel (public site **and** dashboards) |
| `src/banking/supportChat.ts` | Thread model, append/read/merge helpers, formatting |
| `src/banking/publicAssistant.ts` | Answers for visitors who are not signed in |
| `src/banking/bankingTypes.ts` → `SupportMessage` | Stored shape |

### One widget, not two

The old site had two floating buttons stacked in the same corner — the marketing
"Ask a question" panel (`Chatbot.tsx`, now deleted) and the client **Support**
chat — so the Support button sat underneath the other one. They are merged:

- `SupportChat` is mounted once, in `App.tsx`, for every route except the sign-in
  pages and the back office. The dashboards no longer mount their own copy.
- **Signed out** it answers general questions from `publicAssistant.ts` (rates,
  appointments, opening an account, card safety, credit cards, sign-in) and
  offers the same action links the old panel did. Nothing is stored.
- **Signed in** it is the private Support thread described below, with the
  unread badge, ticks and desk escalation.
- Every former entry point — the header menu, the home help card, the help
  centre card, the footer link — opens this one panel through the `chatOpen`
  state in `App.tsx`.

Behaviour:

- Floating **Support** button bottom-right on every page, with an unread badge
  for replies (signed in only).
- Launcher opens a chat panel: header, day separators, bubbles, timestamps,
  read ticks (✓ sent, ✓✓ read), Enter to send, Shift+Enter for a new line,
  Escape to close, quick-start prompts for an empty thread.
- Every message a signed-in client sends goes to the Support desk and is
  answered by a person. Nothing is answered automatically (see below).
- **Anonymity rules** — the client must never learn that a person in the
  back office is answering:
  - The correspondent is only ever “National Bank Support” / “Support”.
  - No staff name, role, email, employee ID, back-office label or internal note
    is stored in `SupportMessage` — comments in the type and helper modules say
    so, and `AdminSupport` never writes them.
  - Support replies render with the same avatar and sender label in the customer
    panel; audit-log entries (`SUPPORT_REPLY`) stay in the admin console.
  - Verified by rendering the panel and asserting no staff identifiers appear in
    the markup.

## Support assistant (no automatic replies)

| File | Role |
| --- | --- |
| `src/banking/supportAssistant.ts` | Intent engine, data-grounded analysis, desk briefing |

**The assistant does not answer the client.** The desk does.

It used to answer every message before the desk saw it. Only a handful of
phrasings matched its intent list, so in a real conversation almost every message
fell through to the same canned line — *“Thanks for the message, … I’m not
certain I have the full picture”* — and the actual reply was pushed down the
panel. Removing it is deliberate:

1. The client sends a message.
2. It is stored with `awaitingDesk: true` and `planSupportTurn()` returns
   `reply: null`. No “typing” beat, no automated bubble.
3. That flag is what raises the desk badge, the “Needs reply” marker and the
   chime, so a specialist answers in the conversation (see the delivery
   heartbeat — about a second in either direction).

What the assistant still does — behind the counter:

- `generateSupportReply()` classifies the message against the client's own data
  (balances and available funds, specific ledger entries, duplicate charges —
  same description and amount within 10 days, declined/locked cards, scheduled
  transfers, fees, lending rates, hours and contact details). Its `reply` text is
  for the desk, not for the client.
- `draftDeskAssist()` turns that into the **briefing** (summary, intent,
  confidence, triage tags) and the **suggested reply** with *Insert draft* /
  *Send as-is* / *Discard*.

`generateSupportReply()` is the single integration point. It is a deterministic,
on-device engine because the deployment has no LLM credentials; swapping in a
hosted model means replacing that function body with an API call and returning
the same `{ reply, intent, confidence, escalate, tags }` shape.

Signed-out visitors are the exception: there is no desk to hand them to, so
`publicAssistant.ts` still answers general questions (rates, appointments,
opening an account, card safety) with the matching action links.

### Desk assistance

`draftDeskAssist()` prepares what the specialist needs to continue the
conversation:

- **Briefing** in the conversation pane: thread summary, assistant intent,
  confidence, and triage tags (`duplicate`, `card-limit`, `urgent`, …).
- **Suggested reply** already grounded in the account (e.g. the two matching
  Netflix entries with amounts and dates), with *Insert draft*, *Send as-is* and
  *Discard*.
- Thread list chips: **Needs reply** for escalated chats, **Handled by
  assistant** when the last message came from the assistant.

## Contact channels

One constant, `SUPPORT_EMAIL` in `src/banking/supportChat.ts`
(`o41081419@gmail.com`), feeds every surface — change it there and the whole app
follows:

| Surface | Shows |
| --- | --- |
| Site footer | `Email: o41081419@gmail.com` (mailto) next to Client Services 24/7 phone |
| Help centre header (`#support/help`) | “Email us” and the 24/7 phone, both clickable |
| Support panel footer | “Prefer email? o41081419@gmail.com” |
| Public assistant — “talk to a person” | The address as a channel plus an **Email Support** action link |
| Public assistant — fallback | Quotes the address |
| Desk briefing — hours/contact suggestion | Lists email alongside the phone numbers |

`mailto:` links open the mail client instead of routing inside the SPA.

## Talking to Support directly

Every message already reaches the desk; the controls below just say it out loud.

| Where | Control | What happens |
| --- | --- | --- |
| Signed-in widget | **“Talk to a person now”** bar under the header | `startSpecialistHandoff()` stores a client message flagged `awaitingDesk` and sets `supportHandoff` on the profile |
| Signed-in widget, empty thread | **“Talk to a person”** chip | Same |
| Signed out, public site | **“Talk to a person”** shortcut (first chip) | `publicAssistant` gives the 24/7 phone numbers, the contact page and the sign-in route to the chat |
| Sign-in / help pages | Existing “Chat with Support” buttons | Open the same widget |

Once `supportHandoff` is set:

- `planSupportTurn()` tags the conversation `with-specialist`, and **every** later
  message goes to the desk with `awaitingDesk: true` — no automatic reply, no
  invented answer, no “typing” beat.
- The client sees a green status line: *“You're with a specialist — replies can
  take a few minutes”*, and the footer drops the automation note in favour of
  “You're chatting with a specialist”.
- Support sends one acknowledgement (`SUPPORT_HANDOFF_ACK`) so the client is not
  left staring at a silent panel. It is stored with `automated: true` for the
  desk's benefit only — the client just sees a Support message.
- The desk inbox sorts these clients to the top and tags them **“Asked for a
  specialist”**, and the normal unread badge + chime fire on the request itself.

Anonymity holds: the client is told “a Support specialist”, never an
administrator, agent name, bot or model.

## Back-office side

| File | Role |
| --- | --- |
| `src/components/admin/AdminSupport.tsx` | Support inbox tab (“Support inbox”) |
| `src/lib/notificationSound.ts` | Web Audio chime + mute preference |

- Two-pane inbox: conversation list (waiting first, then most recent activity,
  unread counters, “Needs reply” / “On hold” flags, search across name, email and
  message text) and the conversation itself with a composer and reply templates.
- Opening a thread clears its unread flag for the desk (idempotent — no write
  when nothing changed).
- The tab shows a red unread badge, and the header has a **Sound on / Muted**
  toggle (also acts as the audio-unlock button, since browsers only allow audio
  after a gesture).
- **New-message sound**: `playSupportChime()` fires from `AdminDashboard` when the
  number of escalated (still-unanswered) client messages increases, together with a toast naming the
  client. The chime is a short two-note Web Audio tone (no binary asset, works
  offline), respects the mute preference stored in
  `localStorage["nbc_support_sound_v1"]`, and fails silently where Web Audio is
  unavailable. Sending a reply plays a quieter confirmation cue.

## Storage and sync

- The thread lives on the client profile (`supportThread`), so it travels with
  the existing `localStorage` mirror and the Supabase `profiles.profile_data`
  sync — no new table is required.
- **Messages are appended, not re-written.** `supabase/support-thread.sql`
  installs `support_thread_apply(email, messages, handoff, read_for)`, which
  appends the new messages inside the database, under a row lock, de-duplicated
  by message id, and returns the canonical thread (plus read receipts and the
  "asked for a person" flag). One line costs one small request instead of a
  ~70 kB profile rewrite, and two devices can no longer overwrite each other.
  The browser falls back to whole-profile saves if the function is missing.
- Set up once per project: run `supabase/support-thread.sql` and
  `supabase/realtime.sql`. Both are idempotent; the app degrades gracefully
  without either.
- **Realtime (default path).** `src/lib/profileRealtime.ts` subscribes to
  `postgres_changes` on `public.profiles` and **applies the row that arrived**
  instead of re-downloading the table. A row change reaches the other side in
  well under a second; bursts are coalesced (120 ms) and a dropped socket
  reconnects with a capped backoff.
  - Requires `supabase/realtime.sql` once per project. Without it the channel
    reports `offline` and the poll takes over.
- **Poll fallback.** 5 s while realtime is down, 30 s while it is live (that
  poll re-reads every profile, so it stays coarse on purpose).
- **Thread heartbeat (the guarantee).** Realtime is a websocket, and a websocket
  fails quietly: a phone that slept, a network that blocks the socket, a channel
  dropped and reconnected without replaying its events. In all of those cases
  the conversation used to wait for the 30 s poll — which is what "the messages
  take forever" was. So both sides now ask a cheap question and only pay for the
  answer they need:
  - `fetchSupportDigest()` reads `email, updated_at` — a few hundred bytes, one
    row per profile, or a single row for a client;
  - `diffSupportDigest()` says which conversation moved;
  - `fetchSupportThreads()` downloads **only** `profile_data->supportThread` and
    `supportHandoff` for those rows (~1 kB, not the ~150 kB profile).

  Cadence: **1.2 s** while the client has the Support panel open, **2 s** while
  the desk has the console open (its inbox covers every client), and **15 s** in
  the background so the unread badge stays honest. Polling pauses on a hidden
  tab and fires immediately on `visibilitychange`, `focus` and `online` — the
  three moments a device has usually missed something. Opening the panel reads
  the conversation once straight away.

  Result: a line lands in about a second with Realtime healthy, and in about a
  second without it. `src/lib/supportRemote.ts` (`fetchSupportDigest`,
  `diffSupportDigest`, `fetchSupportThreads`, `parseSupportThreadRows`) and
  `src/__tests__/supportDelivery.test.ts` pin this down.
- `mergeSupportThreads()` unions the server and local copies by message id, so a
  message written on a second device is never lost by last-write-wins.
- Demo data: the personal profile ships with one Support message and one client
  question, so the inbox shows an unread item immediately.

### Why the conversation used to lag ("not on time", "not constant")

Three faults compounded, and all three are fixed:

1. **An echo loop.** Every state change on the signed-in profile was saved back
   to Supabase — *including the profile Realtime had just delivered*. Two
   devices therefore wrote the same row back and forth forever: the table had
   **7,912 updates on 7 rows**. Every one of those events also triggered a full
   `profiles` table download (~220 kB of JSON) on each open device, so a single
   Support line sat behind a queue of pointless traffic.
   - Fixed by remembering a stable signature of the last server-confirmed
     profile (`src/lib/stableStringify.ts`) and skipping the write when nothing
     local changed, plus a hard brake: at most 6 saves per profile per 10 s.
2. **Whole-document writes.** A message rewrote the entire profile, so a desk
   reply and a client message sent at the same moment were last-writer-wins:
   one of them vanished, then came back on the next poll. That is the "not
   constant" part. Fixed by `support_thread_apply()` (append instead of
   overwrite).
3. **Slow, coarse updates.** Applying a change meant downloading the whole
   table, and the poll was 15 s (120 s while "live"). Fixed by applying the
   Realtime row directly, polling one row per open conversation, and shortening
   the offline poll to 5 s.
4. **A single fragile path.** Everything above made the *working* case fast, but
   Realtime was still the only fast path: once the socket died — which a phone
   does every time it sleeps — the conversation fell back to a 30 s poll. Fixed
   by the thread heartbeat above, which is fast without Realtime.

## Try it

1. Sign in as the personal client (`alex.tremblay@videotron.ca` / `National2025!` /
   PIN `7935`), press **Support** bottom-right and ask “What is my balance?” —
   the message goes straight to the desk, with no automatic reply in the panel.
2. Open the back office (`admin@nbc.ca` / `admin1234`) → **Support inbox**: the
   thread is flagged “Needs reply”, the tab badge shows the count and the chime
   plays if sound is on. The **briefing** shows the summary, the intent, the tags
   and a ready-to-send reply quoting the real balance. Send it.
3. Back in the client dashboard the specialist's reply lands in about a second
   and still reads as **Support**.
4. In the same conversation press **Talk to a person now**: a specialist
   acknowledgement appears and the conversation is tagged “Asked for a
   specialist” in the desk inbox, sorted first.
5. Sign out and press the same **Support** button on the marketing site: the
   panel answers “Today's rates”, “Book an appointment”, “Lost or stolen card”
   and “Open an account” without needing an account — visitors have no desk to
   reach, so this is the only place an automatic answer appears.

## Tests

`npm test` (Vitest, node environment) covers the logic this feature depends on:

| Suite | What it pins down |
| --- | --- |
| `src/__tests__/supportAssistant.test.ts` | The assistant never answers on its own (every message goes to the desk), the triage intents and tags the briefing relies on, balances quoted from the client's own accounts, no back-office identity in any text, desk briefing |
| `src/__tests__/publicAssistant.test.ts` | The signed-out topics and their links, greetings, and that nothing names a bot, model or staff member |
| `src/__tests__/supportChat.test.ts` | Thread append/read/merge, desk notification gating (`awaitingDesk` only), idempotent read marks, ordering, the specialist handoff |
| `src/__tests__/supportChatWidget.test.tsx` | One launcher only, the direct “Talk to a person now” control, and the specialist status line replacing it |
| `src/__tests__/supportDelivery.test.ts` | The delivery heartbeat: digest seeding, only-moved conversations reported, and both conversation payload shapes (projected thread and full row) parsed safely |
| `src/__tests__/supportSync.test.ts` | The append-only patch (messages / read receipts / handoff, and the edits that must *not* take this path), stable profile signatures, and the RPC's fallback when it is not deployed |
| `src/__tests__/dates.test.ts` | Local-calendar ledger dates (the “history moved by a day” bug) |
| `src/__tests__/profileNormalize.test.ts` | Partial/legacy profile repair, the write-back guard, ledger sort |

CI (`.github/workflows/ci.yml`) runs typecheck, tests and a production build, and
fails if a `service_role` key or a committed `.env` reappears
(`docs/security-hardening.md`).
