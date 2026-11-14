import type { DemoUserProfile } from "../banking/bankingTypes";
import { isSupabaseConfigured, supabase } from "./supabase";

export async function upsertProfile(profile: DemoUserProfile) {
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
