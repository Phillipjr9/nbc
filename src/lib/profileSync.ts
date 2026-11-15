import type { BankUserProfile } from "../banking/bankingTypes";
import { isSupabaseConfigured, supabase } from "./supabase";
import { ensureProfileShape } from "./profileNormalize";

type SupabaseProfileRow = {
  email: string;
  full_name?: string | null;
  role_label?: string | null;
  account_kind?: string | null;
  status?: string | null;
  member_since?: string | null;
  branch_name?: string | null;
  advisor_name?: string | null;
  profile_data?: Partial<BankUserProfile> | null;
};

/**
 * Turns one `profiles` row into a usable profile.
 *
 * Exported because Realtime hands us rows: applying the row that arrived is
 * what keeps a Support reply instant, and it avoids re-downloading the whole
 * table for every message.
 */
export function profileFromRow(row: SupabaseProfileRow | Record<string, unknown> | null | undefined): BankUserProfile | null {
  const source = (row ?? null) as SupabaseProfileRow | null;
  if (!source?.email) return null;

  const payload = (source.profile_data ?? {}) as Partial<BankUserProfile>;
  const safeFullName = source.full_name ?? payload.fullName ?? "";

  // `profile_data` is a JSON blob written by whichever client saved last, so it
  // can be partial (older release, a write that dropped undefined keys, a row
  // created by hand). Repair the shape *before* it reaches any dashboard,
  // otherwise a missing `transactions` array empties the ledger or crashes it.
  return ensureProfileShape({
    ...(payload as BankUserProfile),
    email: source.email,
    fullName: safeFullName || payload.fullName || "",
    roleLabel: source.role_label ?? payload.roleLabel ?? "Personal Banking",
    accountKind: source.account_kind ?? payload.accountKind ?? payload.id ?? "personal",
    status: source.status ?? payload.status ?? "active",
    memberSince: source.member_since ?? payload.memberSince ?? "",
    branchName: source.branch_name ?? payload.branchName ?? "",
    advisorName: source.advisor_name ?? payload.advisorName ?? "",
    pin: payload.pin ?? "",
  } as BankUserProfile);
}

export async function fetchProfiles(): Promise<BankUserProfile[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase.from("profiles").select("*").order("updated_at", { ascending: false });

  if (error) {
    // Previously silent, which made "history is empty on my other device"
    // impossible to diagnose. Keep the app running, but make the cause visible.
    console.warn(
      "[profiles] Could not read the profiles table via Supabase:",
      error.message,
      "— check the table's RLS policies and the VITE_SUPABASE_ANON_KEY of this deployment."
    );
    return [];
  }

  return (data ?? [])
    .map((row) => profileFromRow(row as SupabaseProfileRow))
    .filter((profile): profile is BankUserProfile => Boolean(profile && profile.email));
}

/**
 * Reads a single profile by email. Used by the sign-in flow so a device that has
 * never seen this user (new phone, private window, different country) loads the
 * real profile and ledger instead of falling back to an empty placeholder.
 */
export async function fetchProfileByEmail(email: string): Promise<BankUserProfile | null> {
  const target = email.trim();
  if (!isSupabaseConfigured || !target) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .ilike("email", target)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(
      "[profiles] Could not read a single profile via Supabase:",
      error.message,
      "— falling back to local data for",
      target
    );
    return null;
  }

  return data ? profileFromRow(data as SupabaseProfileRow) : null;
}

export async function upsertProfile(profile: BankUserProfile) {
  if (!isSupabaseConfigured) {
    return { ok: false, reason: "Supabase is not configured" };
  }

  const payload = {
    email: profile.email,
    full_name: profile.fullName,
    role_label: profile.roleLabel,
    account_kind: profile.accountKind ?? profile.id,
    status: profile.status ?? "active",
    member_since: profile.memberSince,
    branch_name: profile.branchName,
    advisor_name: profile.advisorName,
    profile_data: ensureProfileShape(profile),
    updated_at: new Date().toISOString(),
  };

  // The public client only: a service-role key can never ship to a browser.
  //
  // No `.select()` on purpose: echoing the row back meant every save also
  // downloaded the full `profile_data` blob (~70 kB), which is pure latency for
  // a caller that only needs "did it work".
  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "email" });

  if (error) {
    throw error;
  }

  return { ok: true };
}
