import { describe, expect, it } from "vitest";
import { INITIAL_PROFILES } from "../banking/bankingTypes";
import type { BankUserProfile, Transaction } from "../banking/bankingTypes";
import { ensureProfileShape, isPersistableProfile, sortTransactionsDesc } from "../lib/profileNormalize";

function base(overrides: Partial<BankUserProfile> = {}): BankUserProfile {
  return {
    ...INITIAL_PROFILES.personal,
    email: "client@nbc.test",
    ...overrides,
  } as BankUserProfile;
}

describe("ensureProfileShape", () => {
  it("restores missing collections so a dashboard render cannot crash", () => {
    const broken = {
      ...base(),
      transactions: undefined,
      accounts: undefined,
      cards: undefined,
      payees: undefined,
      scheduled: undefined,
      supportThread: undefined,
    } as unknown as BankUserProfile;

    const repaired = ensureProfileShape(broken);

    expect(repaired.transactions).toEqual([]);
    expect(repaired.accounts).toEqual([]);
    expect(repaired.cards).toEqual([]);
    expect(repaired.payees).toEqual([]);
    expect(repaired.scheduled).toEqual([]);
    expect(repaired.supportThread).toEqual([]);
  });

  it("repairs partial transactions instead of dropping them from the statement", () => {
    const partial = [
      { description: "Metro Grocery", amount: "-84.25", date: "May 2, 2026" },
      { date: "2026-05-03", amount: 3200 },
      null,
      "not a transaction",
    ] as unknown as Transaction[];

    const repaired = ensureProfileShape(base({ transactions: partial }));

    expect(repaired.transactions).toHaveLength(2);
    expect(repaired.transactions[0].amount).toBe(-84.25);
    expect(repaired.transactions[0].date).toBe("2026-05-02");
    expect(repaired.transactions[0].category).toBe("Shopping");
    expect(repaired.transactions[0].id).toBeTruthy();
    expect(repaired.transactions[1].description).toBe("Transaction");
  });

  it("flags a non-numeric amount as 0 rather than losing the row", () => {
    const repaired = ensureProfileShape(
      base({
        transactions: [
          {
            id: "x",
            accountId: "acc-1",
            date: "2026-05-02",
            description: "Odd",
            category: "Shopping",
            amount: "NaN" as unknown as number,
          },
        ],
      })
    );
    expect(repaired.transactions).toHaveLength(1);
    expect(repaired.transactions[0].amount).toBe(0);
  });

  it("keeps the card list free of duplicate ids", () => {
    const profile = base({
      cards: [
        { ...(INITIAL_PROFILES.personal.cards[0] ?? ({} as never)) },
        { ...(INITIAL_PROFILES.personal.cards[0] ?? ({} as never)) },
      ],
    });
    const repaired = ensureProfileShape(profile);
    const ids = repaired.cards.map((card) => card.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is a no-op for an already valid profile", () => {
    const profile = base();
    expect(ensureProfileShape(profile).transactions).toHaveLength(profile.transactions.length);
  });
});

describe("isPersistableProfile", () => {
  it("refuses to write back placeholders that would erase a ledger", () => {
    expect(isPersistableProfile(null)).toBe(false);
    expect(isPersistableProfile(undefined)).toBe(false);
    expect(isPersistableProfile(base({ email: "" }))).toBe(false);
    expect(isPersistableProfile(base({ accounts: [] }))).toBe(false);
    expect(isPersistableProfile(base({ id: "supabase-123" as unknown as BankUserProfile["id"] }))).toBe(
      false
    );
  });

  it("accepts a fully loaded client profile", () => {
    expect(isPersistableProfile(base())).toBe(true);
  });
});

describe("sortTransactionsDesc", () => {
  it("sorts newest first without mutating the input", () => {
    const input: Transaction[] = [
      { id: "a", accountId: "1", date: "2026-01-02", description: "Older", category: "Income", amount: 1 },
      { id: "b", accountId: "1", date: "2026-03-04", description: "Newer", category: "Income", amount: 2 },
      { id: "c", accountId: "1", date: "2026-02-03", description: "Middle", category: "Income", amount: 3 },
    ];

    expect(sortTransactionsDesc(input).map((tx) => tx.id)).toEqual(["b", "c", "a"]);
    expect(input.map((tx) => tx.id)).toEqual(["a", "b", "c"]);
  });

  it("tolerates a missing list", () => {
    expect(sortTransactionsDesc(undefined)).toEqual([]);
  });
});
