import type { SupportMessage } from "../banking/bankingTypes";
import type { SupportThreadPatch } from "../banking/supportChat";
import { isSupabaseConfigured, supabase } from "./supabase";

/**
 * Server-side Support thread operations.
 *
 * The thread lives inside `profiles.profile_data`, which is a JSON document.
 * Saving a message used to mean writing the *whole* document back — every
 * device sending one line rewrote ~70 kB and could silently roll back a message
 * the other side had just written (last writer wins on the whole blob). Two
 * people chatting therefore saw messages arrive late, or disappear and come
 * back.
 *
 * `support_thread_apply()` (see `supabase/support-thread.sql`) appends the new
 * messages inside the database, under a row lock, de-duplicating by message id.
 * One message costs one small request and can no longer overwrite another.
 */

export type SupportThreadState = {
  supportThread: SupportMessage[];
  supportHandoff: boolean;
};

type RpcPayload = {
  supportThread?: unknown;
  supportHandoff?: unknown;
};

/** Set once we know this project has no `support_thread_apply()` yet. */
let rpcMissing = false;

export function hasThreadRpc(): boolean {
  return !rpcMissing;
}

/** Only used by tests. */
export function resetThreadRpcAvailability() {
  rpcMissing = false;
}

/**
 * Applies a patch to the stored thread and returns the canonical result.
 *
 * Returns `null` when there is nothing to do, when Supabase is not configured,
 * or when the function is unavailable / the call fails — in which case the
 * caller falls back to saving the whole profile exactly as before.
 */
export async function applySupportThreadRemote(
  email: string,
  patch: SupportThreadPatch
): Promise<SupportThreadState | null> {
  if (!isSupabaseConfigured || !email) return null;
  if (rpcMissing) return null;
  if (patch.added.length === 0 && !patch.handoff && !patch.readFor) return null;

  try {
    const { data, error } = await supabase.rpc("support_thread_apply", {
      p_email: email,
      p_messages: patch.added,
      p_handoff: patch.handoff,
      p_read_for: patch.readFor,
    });

    if (error) {
      // 404 / PGRST202 = function not deployed yet. Stop trying for this
      // session so a chatty conversation does not log the same error twice a
      // second, and let the caller use the whole-profile fallback.
      const code = String((error as { code?: string }).code ?? "");
      if (code === "PGRST202" || code === "404") {
        rpcMissing = true;
        console.info("[support] support_thread_apply() is not deployed yet — falling back to profile saves.");
      } else {
        console.warn("[support] Could not append to the Support thread:", error.message);
      }
      return null;
    }

    const payload = (data ?? null) as RpcPayload | null;
    if (!payload || !Array.isArray(payload.supportThread)) {
      // Unknown profile (no row for this email): let the profile save create it.
      return null;
    }

    return {
      supportThread: payload.supportThread as SupportMessage[],
      supportHandoff: payload.supportHandoff === true,
    };
  } catch (error) {
    console.warn("[support] Support thread request failed:", error);
    return null;
  }
}

/* ------------------------------------------------------------------------- *
 * Change detection for the conversation
 *
 * Realtime is the fast path, but it is the only one: a phone that slept, a
 * socket that was silently dropped, or a network that blocks websockets all
 * leave a conversation waiting for the 30 s safety-net poll, which is why
 * replies could take half a minute to appear.
 *
 * These helpers give both sides a *cheap* fallback. The digest is one row per
 * profile (`email`, `updated_at`) — a few hundred bytes — so it can be asked
 * for every second. When an entry moves, only that conversation is downloaded,
 * and only its thread (`profile_data->supportThread`), not the whole document.
 * ------------------------------------------------------------------------- */

/** Lower-cased email → the row it came from. */
export type SupportDigest = Record<string, { email: string; updatedAt: string }>;

export type SupportThreadSnapshot = {
  email: string;
  thread: SupportMessage[];
  handoff: boolean;
};

const warn = (message: string, error: unknown) => {
  console.warn(`[support] ${message}`, error);
};

/** Reads `email, updated_at` for one profile, or for every profile (the desk). */
export async function fetchSupportDigest(emails?: string[]): Promise<SupportDigest | null> {
  if (!isSupabaseConfigured) return null;

  let query = supabase.from("profiles").select("email,updated_at");
  if (emails && emails.length > 0) query = query.in("email", emails);

  const { data, error } = await query;
  if (error) {
    warn("Could not read the Support digest:", error.message);
    return null;
  }

  const digest: SupportDigest = {};
  for (const row of (data ?? []) as { email?: unknown; updated_at?: unknown }[]) {
    const email = typeof row.email === "string" ? row.email : "";
    if (!email) continue;
    digest[email.toLowerCase()] = {
      email,
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : "",
    };
  }
  return digest;
}

/**
 * Which conversations moved since the previous digest.
 *
 * `previous === null` seeds the cache and reports nothing (the app has just
 * loaded every profile in full). A row that just appeared is reported so the
 * desk sees a brand-new client.
 */
export function diffSupportDigest(previous: SupportDigest | null, next: SupportDigest): string[] {
  if (!previous) return [];
  const changed: string[] = [];
  for (const [key, entry] of Object.entries(next)) {
    const before = previous[key];
    if (!before || before.updatedAt !== entry.updatedAt) changed.push(entry.email);
  }
  return changed;
}

/** Reads just the conversation of the given profiles. */
export async function fetchSupportThreads(emails: string[]): Promise<SupportThreadSnapshot[]> {
  if (!isSupabaseConfigured || emails.length === 0) return [];

  // PostgREST can project the JSON document down to the two keys we need
  // (~1 kB instead of the ~150 kB row). Older PostgREST builds reject the
  // projection, so fall back to the plain column and read the same keys.
  const projected = await supabase
    .from("profiles")
    .select("email,thread:profile_data->supportThread,handoff:profile_data->supportHandoff")
    .in("email", emails);

  if (!projected.error) {
    return parseSupportThreadRows(projected.data);
  }

  const plain = await supabase.from("profiles").select("email,profile_data").in("email", emails);
  if (plain.error) {
    warn("Could not read the Support conversation:", plain.error.message);
    return [];
  }
  return parseSupportThreadRows(plain.data);
}

/**
 * Normalises a `profiles` payload into conversations.
 *
 * Accepts both shapes on purpose: the projected select above and the full row,
 * so a PostgREST version that refuses the JSON projection cannot stop the desk
 * from receiving messages.
 */
export function parseSupportThreadRows(rows: unknown): SupportThreadSnapshot[] {
  if (!Array.isArray(rows)) return [];

  const snapshots: SupportThreadSnapshot[] = [];
  for (const raw of rows as Record<string, unknown>[]) {
    const email = typeof raw?.email === "string" ? raw.email : "";
    if (!email) continue;

    const document = (raw.profile_data ?? null) as Record<string, unknown> | null;
    // `thread` / `supportThread` are the projected keys (depending on how the
    // JSON path was aliased); `profile_data` is the unprojected row.
    const threadValue = Array.isArray(raw.thread)
      ? raw.thread
      : Array.isArray(raw.supportThread)
        ? raw.supportThread
        : document?.supportThread;
    const handoffValue = raw.handoff ?? raw.supportHandoff ?? document?.supportHandoff;

    const thread = (Array.isArray(threadValue) ? threadValue : []).filter(
      (message): message is SupportMessage =>
        Boolean(message) &&
        typeof message === "object" &&
        typeof (message as { body?: unknown }).body === "string"
    );

    snapshots.push({ email, thread, handoff: handoffValue === true || handoffValue === "true" });
  }
  return snapshots;
}
