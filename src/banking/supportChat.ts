import type { BankUserProfile, SupportMessage } from "./bankingTypes";
import { toIsoDate } from "../lib/dates";

/**
 * Support conversation helpers.
 *
 * A thread is stored on the client's own profile (`supportThread`) so it travels
 * with the existing localStorage + Supabase profile sync. The customer sees a
 * single "Support" correspondent; the back office sees the same messages from
 * the client's side of the desk.
 */

export const SUPPORT_BRAND = "National Bank Support";
export const SUPPORT_SHORT_NAME = "Support";
export const SUPPORT_PRESENCE = "Online · typically replies in a few minutes";

/** The automated first acknowledgement sent when a client opens a conversation. */
export const SUPPORT_AUTO_ACK =
  "Thanks for reaching out. A member of our Support team will reply here shortly. For anything urgent, call us 24/7 at 1-888-835-6281.";

const newId = () => `msg-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

const sortThread = (thread: SupportMessage[]): SupportMessage[] =>
  [...thread].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));

/** Thread in chronological order. Always an array, even for legacy profiles. */
export function supportThreadOf(profile: BankUserProfile | null | undefined): SupportMessage[] {
  const thread = profile?.supportThread;
  if (!Array.isArray(thread)) return [];
  return sortThread(
    thread.filter(
      (message): message is SupportMessage =>
        Boolean(message && typeof message === "object" && typeof message.body === "string")
    )
  );
}

export function appendSupportMessage(
  profile: BankUserProfile,
  side: SupportMessage["side"],
  body: string,
  options: { automated?: boolean } = {}
): BankUserProfile {
  const text = body.trim();
  if (!text) return profile;

  const message: SupportMessage = {
    id: newId(),
    side,
    body: text.slice(0, 4000),
    createdAt: new Date().toISOString(),
    // The sender has obviously read it; the other side has not.
    readByClient: side === "client",
    readBySupport: side === "support",
    ...(options.automated ? { automated: true } : {}),
  };

  return { ...profile, supportThread: sortThread([...supportThreadOf(profile), message]) };
}

/**
 * Marks one side's messages as read.
 * Returns the original profile when nothing changed, so React state does not
 * churn (and does not trigger a pointless Supabase write) on every render.
 */
export function markSupportThreadRead(
  profile: BankUserProfile,
  reader: SupportMessage["side"]
): { profile: BankUserProfile; changed: boolean } {
  const thread = supportThreadOf(profile);
  const flag = reader === "client" ? "readByClient" : "readBySupport";
  const otherSide = reader === "client" ? "support" : "client";

  let changed = false;
  const next = thread.map((message) => {
    if (message.side !== otherSide || message[flag]) return message;
    changed = true;
    return { ...message, [flag]: true };
  });

  return changed ? { profile: { ...profile, supportThread: next }, changed } : { profile, changed };
}

/** Unread messages waiting for one side of the conversation. */
export function unreadSupportCount(
  profile: BankUserProfile | null | undefined,
  reader: SupportMessage["side"]
): number {
  const otherSide = reader === "client" ? "support" : "client";
  const flag = reader === "client" ? "readByClient" : "readBySupport";
  return supportThreadOf(profile).filter((message) => message.side === otherSide && !message[flag]).length;
}

export type SupportThreadSummary = {
  lastMessage: SupportMessage | null;
  lastActivity: string;
  unread: number;
  messageCount: number;
};

export function supportThreadSummary(
  profile: BankUserProfile | null | undefined,
  reader: SupportMessage["side"],
  messageCount = 0
): SupportThreadSummary {
  const thread = supportThreadOf(profile);
  const lastMessage = thread.length > 0 ? thread[thread.length - 1] : null;
  return {
    lastMessage,
    lastActivity: lastMessage?.createdAt ?? "",
    unread: unreadSupportCount(profile, reader),
    messageCount,
  };
}

/**
 * Union of two copies of a thread, newest write wins per id.
 *
 * Two devices can each append a message between sync polls; without a union one
 * of them silently disappears when the server copy lands.
 */
export function mergeSupportThreads(
  remote: SupportMessage[] | undefined,
  local: SupportMessage[] | undefined
): SupportMessage[] {
  const byId = new Map<string, SupportMessage>();
  for (const message of [...(local ?? []), ...(remote ?? [])]) {
    if (!message || typeof message.body !== "string") continue;
    byId.set(message.id, message);
  }
  return sortThread([...byId.values()]);
}

/* ------------------------------------------------------------------ *
 * Display helpers — always rendered in the reader's own timezone.
 * ------------------------------------------------------------------ */

export function formatSupportTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", hour12: true });
}

/** "Today" / "Yesterday" / "Monday, November 10". */
export function formatSupportDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const today = toIsoDate(new Date());
  const day = toIsoDate(date);
  if (day === today) return "Today";

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === toIsoDate(yesterday)) return "Yesterday";

  return date.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" });
}

/** Compact age used in the back-office inbox: "now", "4 min", "3 h", "Mon", "12 Nov". */
export function formatSupportAge(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString("en-CA", { weekday: "short" });
  return date.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

/** True when a conversation still needs a reply from the Support desk. */
export function needsSupportReply(profile: BankUserProfile | null | undefined): boolean {
  const thread = supportThreadOf(profile);
  if (thread.length === 0) return false;
  const last = thread[thread.length - 1];
  return last.side === "client" || Boolean(unreadSupportCount(profile, "support"));
}
