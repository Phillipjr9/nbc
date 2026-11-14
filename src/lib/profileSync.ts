import type { BankUserProfile } from "../banking/bankingTypes";
import { isSupabaseConfigured, supabase } from "./supabase";

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

  return {
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
  } as BankUserProfile;
}

export async function fetchProfiles(): Promise<BankUserProfile[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase.from("profiles").select("*").order("updated_at", { ascending: false });

  if (error) {
    console.warn("Failed to load profiles from Supabase:", error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => normaliseProfileRow(row as SupabaseProfileRow))
    .filter((profile): profile is BankUserProfile => Boolean(profile && profile.email));
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
    profile_data: profile,
    updated_at: new Date().toISOString(),
  };

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
