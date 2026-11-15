import { isSupabaseConfigured, supabase } from "./supabase";

/**
 * Live profile sync over Supabase Realtime.
 *
 * The Support chat is stored on the client's profile (`profile_data.supportThread`),
 * so the desk and the client share one row. Without this, each side only saw new
 * messages on the next 15 s poll — which is not "like WhatsApp". Subscribing to
 * `public.profiles` turns a same-row UPDATE into an immediate refresh on the
 * other device, and the poll stays as a safety net (see `App.tsx`).
 *
 * Realtime requires the table to be in the `supabase_realtime` publication:
 * run `supabase/realtime.sql` once per project. If it is missing, the channel
 * reports an error, we fall back to the poll, and nothing breaks.
 */

export type ProfileRealtimeStatus = "connecting" | "live" | "offline";

type SubscribeOptions = {
  /** Called (coalesced) after the server reports a change on any profile row. */
  onChange: () => void;
  /** Reports whether the channel is actually live, so callers can poll slower. */
  onStatus?: (status: ProfileRealtimeStatus) => void;
  /** Burst coalescing window: several row changes in one write fire one refresh. */
  debounceMs?: number;
};

export function subscribeToProfileChanges({
  onChange,
  onStatus,
  debounceMs = 350,
}: SubscribeOptions): () => void {
  if (!isSupabaseConfigured) {
    onStatus?.("offline");
    return () => {};
  }

  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = () => {
    if (closed || timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (!closed) onChange();
    }, debounceMs);
  };

  onStatus?.("connecting");

  const channel = supabase
    .channel("profiles-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, schedule)
    .subscribe((status) => {
      if (closed) return;
      if (status === "SUBSCRIBED") {
        onStatus?.("live");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        onStatus?.("offline");
      }
    });

  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    void supabase.removeChannel(channel);
  };
}
