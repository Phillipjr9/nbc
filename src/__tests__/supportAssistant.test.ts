import { describe, expect, it } from "vitest";
import { INITIAL_PROFILES } from "../banking/bankingTypes";
import type { BankUserProfile, SupportMessage, Transaction } from "../banking/bankingTypes";
import { draftDeskAssist, generateSupportReply } from "../banking/supportAssistant";
import { appendSupportMessage } from "../banking/supportChat";
import { ensureProfileShape } from "../lib/profileNormalize";

/** A clean ledger: no same-description/same-amount pair, so duplicate detection
 *  does not fire on unrelated questions. */
const CLEAN_LEDGER: Transaction[] = [
  { id: "t1", accountId: "acc-1", date: "2026-10-02", description: "Metro Grocery", category: "Groceries", amount: -84.25 },
  { id: "t2", accountId: "acc-1", date: "2026-10-05", description: "Salary Deposit", category: "Income", amount: 3200 },
  { id: "t3", accountId: "acc-1", date: "2026-10-09", description: "Hydro Quebec", category: "Utilities", amount: -112.4 },
];

function fixture(overrides: Partial<BankUserProfile> = {}): BankUserProfile {
  return ensureProfileShape({
    ...INITIAL_PROFILES.personal,
    email: "client@nbc.test",
    supportThread: [],
    transactions: CLEAN_LEDGER,
    ...overrides,
  } as BankUserProfile);
}

function thread(profile: BankUserProfile, texts: Array<{ side: SupportMessage["side"]; body: string }>) {
  return texts.reduce((acc, entry) => appendSupportMessage(acc, entry.side, entry.body), profile);
}

describe("generateSupportReply", () => {
  it("answers a balance question without waking the desk", () => {
    const result = generateSupportReply(fixture(), "What is my balance?", []);

    expect(result.intent).toBe("balance");
    expect(result.escalate).toBe(false);
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    // Quoted from the client's own accounts, not a generic answer.
    expect(result.reply).toMatch(/\$/);
    expect(result.reply).toMatch(/Chequing Account/);
  });

  it("answers a ledger question without escalating", () => {
    const result = generateSupportReply(fixture(), "Where can I see my recent transactions?", []);
    expect(result.escalate).toBe(false);
    expect(result.reply.length).toBeGreaterThan(20);
  });

  it("answers opening hours on its own", () => {
    const result = generateSupportReply(fixture(), "What are your opening hours?", []);
    expect(result.intent).toBe("hours");
    expect(result.escalate).toBe(false);
  });

  it("escalates an explicit request for a person", () => {
    const result = generateSupportReply(fixture(), "I need to speak to a person please", []);
    expect(result.escalate).toBe(true);
    expect(result.intent).toBe("human");
    expect(result.tags).toContain("asked-for-person");
  });

  it("escalates fraud reports immediately", () => {
    const result = generateSupportReply(fixture(), "I think there is fraud on my account", []);
    expect(result.escalate).toBe(true);
    expect(result.intent).toBe("fraud");
    expect(result.tags).toContain("urgent");
  });

  it("escalates a lost card", () => {
    const result = generateSupportReply(fixture(), "I lost my card yesterday", []);
    expect(result.escalate).toBe(true);
    expect(result.intent).toBe("card_lost");
  });

  it("escalates a suspected duplicate charge and quotes the matching rows", () => {
    const duplicated = fixture({
      transactions: [
        ...CLEAN_LEDGER,
        { id: "d1", accountId: "acc-1", date: "2026-10-11", description: "Uber Trip", category: "Shopping", amount: -23.5 },
        { id: "d2", accountId: "acc-1", date: "2026-10-12", description: "Uber Trip", category: "Shopping", amount: -23.5 },
      ],
    });

    const result = generateSupportReply(duplicated, "I was charged twice for the same thing", []);
    expect(result.escalate).toBe(true);
    expect(result.intent).toBe("duplicate");
    expect(result.tags).toContain("dispute");
    expect(result.reply).toMatch(/Uber Trip/);
  });

  it("escalates a declined card", () => {
    const result = generateSupportReply(fixture(), "My card was declined at the store", []);
    expect(result.escalate).toBe(true);
    expect(result.intent).toBe("card_declined");
  });

  it("escalates a low-confidence message instead of guessing", () => {
    const result = generateSupportReply(fixture(), "asdkj qwe zxcv bnm", []);
    expect(result.escalate).toBe(true);
    expect(result.confidence).toBeLessThan(0.6);
  });

  it("never leaks back-office identity to the client", () => {
    const messages = [
      "hello",
      "What is my balance?",
      "I need to speak to a person",
      "There is fraud on my account",
      "I lost my card",
      "My card was declined",
      "What are your hours?",
      "asdkj qwe zxcv",
      "I was charged twice",
    ];

    for (const message of messages) {
      const { reply } = generateSupportReply(fixture(), message, []);
      expect(reply).not.toMatch(/\b(administrator|admin team|back ?office|staff|operator)\b/i);
      expect(reply).not.toMatch(/\bbot\b/i);
      expect(reply).not.toMatch(/\bA\.?I\.?\b/);
      expect(reply.trim().length).toBeGreaterThan(0);
    }
  });

  it("uses the client's first name and stays consistent with history", () => {
    const profile = fixture({ fullName: "Alex Tremblay" });
    const withHistory = thread(profile, [
      { side: "client", body: "Hi there" },
      { side: "support", body: "Hello Alex, how can I help?" },
    ]);

    const result = generateSupportReply(withHistory, "I need to talk to someone");
    expect(result.reply).toMatch(/Alex/);
  });
});

describe("draftDeskAssist", () => {
  it("briefs the specialist on an escalated conversation", () => {
    const profile = thread(fixture({ fullName: "Alex Tremblay" }), [
      { side: "client", body: "I was charged twice for my Uber trip" },
      { side: "support", body: "Thanks — a specialist will review that with you." },
    ]);

    const assist = draftDeskAssist(profile);

    expect(assist.intent).toBe("duplicate");
    expect(assist.summary).toContain("intent:");
    expect(assist.summary).toContain("client");
    expect(assist.tags).toContain("escalated");
    expect(assist.confidence).toBeGreaterThan(0);
    expect(assist.suggestedReply.length).toBeGreaterThan(20);
  });

  it("handles an empty thread without throwing", () => {
    const assist = draftDeskAssist(fixture());
    expect(assist.summary).toMatch(/No client messages/);
    expect(assist.suggestedReply.length).toBeGreaterThan(0);
  });
});
