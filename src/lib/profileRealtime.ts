import { isSupabaseConfigured, supabase } from "./supabase";

/**
 * Live profile sync over Supabase Realtime.
 *
 * The Support chat is stored on the client's profile (`profile_data.supportThread`),
 * so the desk and the client share one row. Subscribing to `public.profiles`
 * turns a same-row UPDATE into an immediate refresh on the other device.
 *
 * Two rules learned the hard way:
 *
 * 1. **Use the row that Realtime already sent.** The first version ignored the
 *    payload and re-downloaded the whole `profiles` table (~220 kB of JSON) for
 *    every change, so a single Support line took seconds to appear. The payload
 *    is the same row: apply it directly.
 * 2. **Never treat an echo as a local edit.** The caller must not write back a
 *    profile it received from here, or the two devices bounce the same row back
 *    and forth forever (7,912 row updates on 7 profiles before this was fixed).
 *
 * Realtime requires the table to be in the `supabase_realtime` publication:
 * run `supabase/realtime.sql` once per project. If it is missing, the channel
 * reports an error, we fall back to the poll, and nothing breaks.
 */

export type ProfileRealtimeStatus = "connecting" | "live" | "offline";

export type ProfileChange = {
  /** `INSERT` / `UPDATE` / `DELETE`, as reported by PostgREST. */
  eventType: string;
  /** The row Realtime sent, or `null` when it could not be used. */
  row: Record<string, unknown> | null;
};

type SubscribeOptions = {
  /**
   * Called with the changed rows (coalesced). `row: null` means "we could not
   * read this change — do a full refresh".
   */
  onChange: (changes: ProfileChange[]) => void;
  /** Reports whether the channel is actually live, so callers can poll slower. */
  onStatus?: (status: ProfileRealtimeStatus) => void;
  /** Burst coalescing window: several row changes in one write fire one refresh. */
  debounceMs?: number;
};

type RealtimePayload = {
  eventType?: string;
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
};

export function subscribeToProfileChanges({
  onChange,
  onStatus,
  debounceMs = 120,
}: SubscribeOptions): () => void {
  if (!isSupabaseConfigured) {
    onStatus?.("offline");
    return () => {};
  }

  let closed = false;
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let queue: ProfileChange[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;

  const flush = () => {
    timer = undefined;
    if (closed || queue.length === 0) return;
    const batch = queue;
    queue = [];
    onChange(batch);
  };

  const enqueue = (change: ProfileChange) => {
    queue.push(change);
    if (timer) return;
    timer = setTimeout(flush, debounceMs);
  };

  const teardown = () => {
    if (!channel) return;
    const stale = channel;
    channel = null;
    void supabase.removeChannel(stale);
  };

  const connect = () => {
    if (closed) return;
    onStatus?.("connecting");

    channel = supabase
      .channel(`profiles-live-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload: RealtimePayload) => {
          if (closed) return;
          const eventType = payload?.eventType ?? "UPDATE";
          const row = payload?.new && Object.keys(payload.new).length > 0 ? payload.new : null;

          // A DELETE (or a payload we cannot read) has no profile to apply, so
          // ask the caller for a full refresh instead.
          enqueue({ eventType, row: eventType === "DELETE" ? null : row });
        }
      )
      .subscribe((status: string) => {
        if (closed) return;
        if (status === "SUBSCRIBED") {
          attempt = 0;
          onStatus?.("live");
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          onStatus?.("offline");
          // Reconnect with a capped backoff. Without this a dropped socket
          // silently left the conversation dead until the next poll.
          teardown();
          if (retryTimer) clearTimeout(retryTimer);
          const delay = Math.min(15000, 1000 * 2 ** Math.min(attempt, 4));
          attempt += 1;
          retryTimer = setTimeout(connect, delay);
        }
      });
  };

  connect();

  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    if (retryTimer) clearTimeout(retryTimer);
    queue = [];
    teardown();
  };
}
