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
