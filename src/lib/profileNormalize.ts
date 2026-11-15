import type { BankUserProfile, Transaction } from "../banking/bankingTypes";
import { normalizeBankCardList } from "../banking/bankingTypes";
import { normalizeIsoDate } from "./dates";

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/**
 * Repair a transaction so filters, totals and sorting can rely on the shape.
 * History that came from an older release (or from a partially written
 * `profiles.profile_data` row in Supabase) can be missing the id, the date, or
 * the numeric amount — each of those used to either crash the ledger or make the
 * row silently disappear from every filtered view.
 */
function normalizeTransaction(tx: Partial<Transaction> | null | undefined): Transaction | null {
  if (!tx || typeof tx !== "object") return null;
  const amount = Number(tx.amount);
  if (!Number.isFinite(amount)) {
    // Never silently drop an entry from someone's statement: keep the row and
    // flag it, so the ledger stays complete and the bad value is traceable.
    console.warn("[profiles] Transaction with a non-numeric amount repaired to 0:", tx.id ?? tx.date);
  }
  const date = normalizeIsoDate(tx.date) || String(tx.date ?? "");
  return {
    ...(tx as Transaction),
    id: tx.id || `tx-${date || "undated"}-${Math.random().toString(36).slice(2, 9)}`,
    accountId: tx.accountId ?? "",
    date,
    description: tx.description ?? "Transaction",
    category: tx.category ?? "Shopping",
    amount: Number.isFinite(amount) ? amount : 0,
  };
}

/**
 * Guarantees every collection a dashboard reads exists.
 *
 * A profile loaded from `localStorage` or from Supabase can be missing
 * `transactions`, `accounts`, `cards`, … (partial row, older payload, a write
 * that dropped `undefined` keys). The dashboards call `.filter/.map/.slice/.sort`
 * on those arrays during render, so a missing array used to white-screen the
 * whole online bank — which the user experiences as "my transaction history has
 * disappeared on this device".
 */
export function ensureProfileShape(profile: BankUserProfile): BankUserProfile {
  if (!profile || typeof profile !== "object") return profile;

  const transactions = asArray<Partial<Transaction>>(profile.transactions)
    .map(normalizeTransaction)
    .filter((tx): tx is Transaction => Boolean(tx));

  return {
    ...profile,
    accounts: asArray(profile.accounts),
    transactions,
    payees: asArray(profile.payees),
    recipients: asArray(profile.recipients),
    cards: normalizeBankCardList(asArray(profile.cards)),
    pendingCards: asArray(profile.pendingCards),
    goals: asArray(profile.goals),
    notifications: asArray(profile.notifications),
    documents: asArray(profile.documents),
    messages: asArray(profile.messages),
    scheduled: asArray(profile.scheduled),
    ...(profile.payrollRoster ? { payrollRoster: asArray(profile.payrollRoster) } : {}),
    ...(profile.invoices ? { invoices: asArray(profile.invoices) } : {}),
  };
}

/**
 * Whether a profile carries enough real data to be written back over the
 * server copy. Used to stop a placeholder / partially loaded session from
 * overwriting a client's real history in Supabase.
 */
export function isPersistableProfile(profile: BankUserProfile | null | undefined): boolean {
  if (!profile) return false;
  if (!profile.email || !profile.email.trim()) return false;
  if (profile.id?.startsWith("supabase-")) return false;
  if (asArray(profile.accounts).length === 0) return false;
  return true;
}

/** Transactions sorted newest-first, without mutating the source array. */
export function sortTransactionsDesc(transactions: Transaction[] | undefined): Transaction[] {
  return [...asArray<Transaction>(transactions)].sort((a, b) => {
    if (a.date === b.date) return 0;
    return a.date < b.date ? 1 : -1;
  });
}
