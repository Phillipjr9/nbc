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
- First message is answered by the support assistant (see below) and appears to
  the client as a normal Support reply.
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

## AI support (assistant answers first)

| File | Role |
| --- | --- |
| `src/banking/supportAssistant.ts` | Intent engine, data-grounded replies, escalation, desk briefing |

Every client message is answered by the support assistant **before** it reaches
the live desk:

1. The client sends a message; the assistant is run synchronously against that
   client's own profile and the conversation history.
2. The message is stored with `awaitingDesk: result.escalate`. A short “Support
   is typing…” beat is shown, then the assistant reply is appended as a Support
   message flagged `automated: true`.
3. If the assistant escalated, the client's message keeps `awaitingDesk: true`,
   which is what raises the desk badge, the “Needs reply” flag and the chime.
   Conversations the assistant resolved do **not** interrupt the desk.

What the assistant can answer from real data: balances and available funds,
specific ledger entries (it matches merchant words against the client's
transactions), duplicate-charge detection (same description + amount within 10
days), declined/locked cards (it checks the card state), scheduled transfers,
fees, lending rates, opening hours and contact details.

It always hands over to a specialist for: fraud or unauthorised activity, lost or
stolen cards, declined cards needing an unlock or limit change, duplicate/refund
disputes, explicit “talk to a person”, and anything it cannot classify
(confidence below 0.6) — so it never guesses on a banking question.

`supportAssistant.generateSupportReply()` is the single integration point. It is a
deterministic, on-device engine because the deployment has no LLM credentials;
swapping in a hosted model means replacing that function body with an API call
and returning the same `{ reply, intent, confidence, escalate, tags }` shape.

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
  sync — no schema change is required.
- **Realtime (default path).** `src/lib/profileRealtime.ts` subscribes to
  `postgres_changes` on `public.profiles`, so a client message or a desk reply
  reaches the other side in well under a second. Row changes are coalesced
  (350 ms) so one write does not trigger several renders.
  - Requires `supabase/realtime.sql` once per project. Without it the channel
    reports `offline` and the app behaves exactly as before.
- **Poll fallback.** Profiles are polled every 15 s while realtime is
  unavailable and every 120 s once the channel is live (safety net only).
- `mergeSupportThreads()` unions the server and local copies by message id, so a
  message written on a second device is never lost by last-write-wins.
- Demo data: the personal profile ships with one Support message and one client
  question, so the inbox shows an unread item immediately.

## Try it

1. Sign in as the personal client (`alex.tremblay@videotron.ca` / `National2025!` /
   PIN `7935`), press **Support** bottom-right and ask “What is my balance?” —
   the assistant answers instantly and **nothing** is escalated to the desk.
2. Ask “My card was declined” or “Can I talk to a person?” — the assistant
   answers and escalates.
3. Open the back office (`admin@nbc.ca` / `admin1234`) → **Support inbox**: the
   thread is flagged “Needs reply”, the tab badge shows the count and the chime
   plays if sound is on. The **Assistant briefing** shows the summary, tags and a
   ready-to-send reply. Send it.
4. Back in the client dashboard the specialist's reply lands immediately (one
   realtime broadcast, ~1 s) and still reads as **Support**.
5. Sign out and press the same **Support** button on the marketing site: the
   panel answers “Today's rates”, “Book an appointment”, “Lost or stolen card”
   and “Open an account” without needing an account.

## Tests

`npm test` (Vitest, node environment) covers the logic this feature depends on:

| Suite | What it pins down |
| --- | --- |
| `src/__tests__/supportAssistant.test.ts` | Every escalation rule, the no-escalation answers, balances quoted from the client's own accounts, no back-office identity in any reply, desk briefing |
| `src/__tests__/publicAssistant.test.ts` | The signed-out topics and their links, greetings, and that nothing names a bot, model or staff member |
| `src/__tests__/supportChat.test.ts` | Thread append/read/merge, desk notification gating (`awaitingDesk` only), idempotent read marks, ordering |
| `src/__tests__/dates.test.ts` | Local-calendar ledger dates (the “history moved by a day” bug) |
| `src/__tests__/profileNormalize.test.ts` | Partial/legacy profile repair, the write-back guard, ledger sort |

CI (`.github/workflows/ci.yml`) runs typecheck, tests and a production build, and
fails if a `service_role` key or a committed `.env` reappears
(`docs/security-hardening.md`).
