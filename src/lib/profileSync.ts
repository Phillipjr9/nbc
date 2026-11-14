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

/** Catherine White's complete profile data for Supabase seeding */
export const CATHERINE_WHITE_PROFILE: BankUserProfile = {
  id: "catherine-white",
  accountKind: "personal",
  status: "active",
  fullName: "Catherine White",
  roleLabel: "Personal Banking",
  email: "catherine.white@swiftdevice.ca",
  password: "Swiftdevice2025!",
  pin: "4521",
  memberSince: "2024",
  branchName: "Place Ville Marie, Montreal, QC",
  advisorName: "Sophie Gagnon, Financial Advisor",
  phone: "514-555-0198",
  address: "1200 Rue Sainte-Catherine",
  city: "Montréal",
  province: "QC",
  postalCode: "H3G 1P2",
  dateOfBirth: "1990-03-15",
  accounts: [
    {
      id: "cwh-chk-1",
      name: "Total Chequing Account",
      number: "0006-77411-20",
      category: "chequing",
      balance: 12450.75,
      currency: "CAD",
      subtitle: "Unlimited electronic transactions",
    },
    {
      id: "cwh-sav-1",
      name: "Cash Advantage Solution",
      number: "0006-77411-45",
      category: "savings",
      balance: 18500.0,
      currency: "CAD",
      rate: "3.00% promo",
      subtitle: "Promotional interest rate active",
    },
    {
      id: "cwh-crd-1",
      name: "Allure® Mastercard®",
      number: "5412 •••• •••• 8834",
      category: "credit",
      balance: 2340.50,
      limit: 15000,
      currency: "CAD",
      rate: "20.99%",
      subtitle: "Available credit: $12,659.50",
    },
  ],
  transactions: [
    {
      id: "cwh-tx-001",
      accountId: "cwh-chk-1",
      date: "2026-05-14",
      description: "Payroll Deposit — SwiftDevice Inc.",
      category: "Income",
      amount: 4250.0,
      status: "Posted",
    },
    {
      id: "cwh-tx-002",
      accountId: "cwh-chk-1",
      date: "2026-05-13",
      description: "Hydro-Québec — Bill Payment",
      category: "Utilities",
      amount: -145.25,
      status: "Posted",
    },
    {
      id: "cwh-tx-003",
      accountId: "cwh-crd-1",
      date: "2026-05-12",
      description: "IGA Extra — Weekly groceries",
      category: "Groceries",
      amount: -167.42,
      status: "Posted",
    },
    {
      id: "cwh-tx-004",
      accountId: "cwh-sav-1",
      date: "2026-05-10",
      description: "Automated Savings Transfer",
      category: "Transfer",
      amount: 500.0,
      status: "Posted",
    },
    {
      id: "cwh-tx-005",
      accountId: "cwh-crd-1",
      date: "2026-05-09",
      description: "Café Olimpico Montréal",
      category: "Dining",
      amount: -8.75,
      status: "Posted",
    },
    {
      id: "cwh-tx-006",
      accountId: "cwh-crd-1",
      date: "2026-05-08",
      description: "Simons — Sainte-Catherine",
      category: "Shopping",
      amount: -234.50,
      status: "Posted",
    },
    {
      id: "cwh-tx-007",
      accountId: "cwh-chk-1",
      date: "2026-05-07",
      description: "Bell Fibe — Internet",
      category: "Utilities",
      amount: -89.99,
      status: "Posted",
    },
    {
      id: "cwh-tx-008",
      accountId: "cwh-crd-1",
      date: "2026-05-06",
      description: "Netflix Canada",
      category: "Shopping",
      amount: -17.99,
      status: "Posted",
    },
    {
      id: "cwh-tx-009",
      accountId: "cwh-chk-1",
      date: "2026-05-05",
      description: "Metro Plus — Stock-up",
      category: "Groceries",
      amount: -125.30,
      status: "Posted",
    },
    {
      id: "cwh-tx-010",
      accountId: "cwh-sav-1",
      date: "2026-05-01",
      description: "Promotional 3.00% Monthly Interest",
      category: "Income",
      amount: 46.25,
      status: "Posted",
    },
  ],
  payees: [
    { id: "cwh-pay-1", name: "Hydro-Québec", accountRef: "HQ-7741120", category: "Utilities", lastPaid: "$145.25 on May 13" },
    { id: "cwh-pay-2", name: "Bell Canada", accountRef: "BC-5519023", category: "Telecom", lastPaid: "$89.99 on May 07" },
    { id: "cwh-pay-3", name: "Canada Revenue Agency", accountRef: "CRA-INST-2026", category: "Government" },
  ],
  recipients: [
    { id: "cwh-rec-1", name: "Marc Tremblay", email: "marc.tremblay@example.ca", bank: "Interac e-Transfer®" },
    { id: "cwh-rec-2", name: "Sophie Racine", email: "sophie.racine@example.ca", bank: "Interac e-Transfer®" },
  ],
  cards: [
    {
      id: "cwh-card-1",
      label: "Allure® Mastercard®",
      network: "Mastercard",
      last4: 8834,
      expiry: "08/28",
      linkedAccountId: "cwh-crd-1",
      locked: false,
      contactless: true,
      international: true,
      onlinePurchases: true,
      rewardsPoints: 8500,
      cashbackRate: "5,000 welcome bonus points",
      accent: "allure",
    },
  ],
  pendingCards: [],
  goals: [
    {
      id: "cwh-goal-1",
      title: "Home Renovation Project",
      target: 25000,
      current: 8500,
      deadline: "Dec 2026",
      linkedAccountId: "cwh-sav-1",
    },
  ],
};

/**
 * Seed or update Catherine White's profile in Supabase with complete data.
 * This ensures her profile has all accounts, transactions, cards, etc.
 */
export async function seedCatherineWhiteProfile(): Promise<void> {
  if (!isSupabaseConfigured) {
    console.warn("Supabase not configured, skipping Catherine White profile seed");
    return;
  }

  try {
    // Check if profile already exists
    const { data: existing, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", CATHERINE_WHITE_PROFILE.email)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 means no rows found, which is expected
      console.warn("Error checking existing profile:", fetchError.message);
    }

    // Upsert with complete profile data
    const result = await upsertProfile(CATHERINE_WHITE_PROFILE);
    if (result.ok) {
      console.info("Catherine White profile seeded/updated in Supabase:", result.data?.email);
    }
  } catch (error) {
    console.warn("Failed to seed Catherine White profile:", error);
  }
}
