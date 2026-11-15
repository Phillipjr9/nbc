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

function normaliseProfileRow(row: SupabaseProfileRow): BankUserProfile | null {
  if (!row?.email) return null;

  const payload = row.profile_data ?? {};
  const safeFullName = row.full_name ?? payload.fullName ?? "";

  // `profile_data` is a JSON blob written by whichever client saved last, so it
  // can be partial (older release, a write that dropped undefined keys, a row
  // created by hand). Repair the shape *before* it reaches any dashboard,
  // otherwise a missing `transactions` array empties the ledger or crashes it.
  return ensureProfileShape({
    ...(payload as BankUserProfile),
    email: row.email,
    fullName: safeFullName || payload.fullName || "",
    roleLabel: row.role_label ?? payload.roleLabel ?? "Personal Banking",
    accountKind: row.account_kind ?? payload.accountKind ?? payload.id ?? "personal",
    status: row.status ?? payload.status ?? "active",
    memberSince: row.member_since ?? payload.memberSince ?? "",
    branchName: row.branch_name ?? payload.branchName ?? "",
    advisorName: row.advisor_name ?? payload.advisorName ?? "",
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
    .map((row) => normaliseProfileRow(row as SupabaseProfileRow))
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

  return data ? normaliseProfileRow(data as SupabaseProfileRow) : null;
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
  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "email" })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return { ok: true, data };
}
