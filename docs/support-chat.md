# One-to-one Support chat (customer ⇄ Support desk)

A WhatsApp-style private conversation between a signed-in client and the Support
desk, plus a back-office inbox with a new-message chime.

## Customer side — always branded “Support”

| File | Role |
| --- | --- |
| `src/components/SupportChat.tsx` | Floating launcher + conversation panel |
| `src/banking/supportChat.ts` | Thread model, append/read/merge helpers, formatting |
| `src/banking/bankingTypes.ts` → `SupportMessage` | Stored shape |

Behaviour:

- Floating **Support** button bottom-right on both the personal and business
  dashboards, with an unread badge for replies.
- Launcher opens a chat panel: header, day separators, bubbles, timestamps,
  read ticks (✓ sent, ✓✓ read), Enter to send, Shift+Enter for a new line,
  Escape to close, quick-start prompts for an empty thread.
- First message triggers an automated acknowledgement (“A member of our Support
  team will reply here shortly…”), shown to the client as a normal Support
  message.
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
  total unread count for the desk increases, together with a toast naming the
  client. The chime is a short two-note Web Audio tone (no binary asset, works
  offline), respects the mute preference stored in
  `localStorage["nbc_support_sound_v1"]`, and fails silently where Web Audio is
  unavailable. Sending a reply plays a quieter confirmation cue.

## Storage and sync

- The thread lives on the client profile (`supportThread`), so it travels with
  the existing `localStorage` mirror and the Supabase `profiles.profile_data`
  sync — no schema change is required.
- Both dashboards poll profiles every 15 s, so a reply appears on the other side
  within one poll.
- `mergeSupportThreads()` unions the server and local copies by message id, so a
  message written on a second device is never lost by last-write-wins.
- Demo data: the personal profile ships with one Support message and one client
  question, so the inbox shows an unread item immediately.

## Try it

1. Sign in as the personal client (`alex.tremblay@videotron.ca` / `National2025!` /
   PIN `7935`), press **Support** bottom-right and send a message.
2. Open the back office (`admin@nbc.ca` / `admin1234`) → **Support inbox**: the
   thread is flagged “Needs reply” and the tab badge shows the unread count.
   Reply, and the chime plays if sound is on.
3. Back in the client dashboard the reply arrives within ~15 s as **Support**.
