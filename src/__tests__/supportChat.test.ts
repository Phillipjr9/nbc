import { describe, expect, it } from "vitest";
import { INITIAL_PROFILES } from "../banking/bankingTypes";
import type { BankUserProfile, SupportMessage } from "../banking/bankingTypes";
import {
  appendSupportMessage,
  markSupportThreadRead,
  mergeSupportThreads,
  needsSupportReply,
  supportThreadOf,
  unreadSupportCount,
} from "../banking/supportChat";
import { ensureProfileShape } from "../lib/profileNormalize";

function fixture(overrides: Partial<BankUserProfile> = {}): BankUserProfile {
  return ensureProfileShape({
    ...INITIAL_PROFILES.personal,
    email: "client@nbc.test",
    supportThread: [],
    ...overrides,
  } as BankUserProfile);
}

function message(id: string, side: SupportMessage["side"], body: string, createdAt: string): SupportMessage {
  return { id, side, body, createdAt };
}

describe("appendSupportMessage", () => {
  it("adds a client message that only the client has read", () => {
    const profile = appendSupportMessage(fixture(), "client", "  Hello Support  ");
    const [entry] = supportThreadOf(profile);

    expect(supportThreadOf(profile)).toHaveLength(1);
    expect(entry.body).toBe("Hello Support");
    expect(entry.side).toBe("client");
    expect(entry.readByClient).toBe(true);
    expect(entry.readBySupport).toBe(false);
  });

  it("ignores blank messages", () => {
    const profile = fixture();
    expect(appendSupportMessage(profile, "client", "   ")).toBe(profile);
  });

  it("only flags a client message as awaiting the desk when asked", () => {
    const answered = appendSupportMessage(fixture(), "client", "What is my balance?");
    expect(supportThreadOf(answered)[0].awaitingDesk).toBeUndefined();

    const escalated = appendSupportMessage(fixture(), "client", "There is fraud on my card", {
      awaitingDesk: true,
    });
    expect(supportThreadOf(escalated)[0].awaitingDesk).toBe(true);
  });

  it("never marks an assistant reply as awaiting the desk", () => {
    const profile = appendSupportMessage(fixture(), "support", "Here is your balance", {
      automated: true,
      awaitingDesk: true,
    });
    const [entry] = supportThreadOf(profile);
    expect(entry.automated).toBe(true);
    expect(entry.awaitingDesk).toBeUndefined();
  });

  it("returns the thread ordered by creation time", () => {
    const profile = fixture({
      supportThread: [
        message("b", "client", "second", "2026-10-02T10:00:00.000Z"),
        message("a", "client", "first", "2026-10-01T10:00:00.000Z"),
      ],
    });
    expect(supportThreadOf(profile).map((entry) => entry.body)).toEqual(["first", "second"]);
  });
});

describe("desk notification gating", () => {
  it("does not count a chat the assistant resolved", () => {
    let profile = fixture();
    profile = appendSupportMessage(profile, "client", "What is my balance?");
    profile = appendSupportMessage(profile, "support", "Your balance is $1,000.", { automated: true });

    expect(unreadSupportCount(profile, "support")).toBe(0);
    expect(needsSupportReply(profile)).toBe(false);
    expect(unreadSupportCount(profile, "client")).toBe(1);
  });

  it("counts an escalated message once, until a human replies", () => {
    let profile = fixture();
    profile = appendSupportMessage(profile, "client", "There is fraud on my account", { awaitingDesk: true });
    profile = appendSupportMessage(profile, "support", "I am bringing in a specialist.", { automated: true });

    expect(unreadSupportCount(profile, "support")).toBe(1);
    expect(needsSupportReply(profile)).toBe(true);

    profile = appendSupportMessage(profile, "support", "Hi Alex, I can see the charge — I have opened a dispute.");
    expect(needsSupportReply(profile)).toBe(false);

    // The desk must still see it as unread until it is explicitly marked read.
    expect(unreadSupportCount(profile, "support")).toBe(1);
    const read = markSupportThreadRead(profile, "support");
    expect(read.changed).toBe(true);
    expect(unreadSupportCount(read.profile, "support")).toBe(0);
  });

  it("counts every escalated client message as unread", () => {
    let profile = fixture();
    profile = appendSupportMessage(profile, "client", "First escalation", { awaitingDesk: true });
    profile = appendSupportMessage(profile, "client", "Second escalation", { awaitingDesk: true });
    expect(needsSupportReply(profile)).toBe(true);
    expect(unreadSupportCount(profile, "support")).toBe(2);
  });
});

describe("markSupportThreadRead", () => {
  it("is idempotent for both sides", () => {
    let profile = fixture();
    profile = appendSupportMessage(profile, "client", "Hello");
    profile = appendSupportMessage(profile, "support", "Hi, how can I help?");

    const clientRead = markSupportThreadRead(profile, "client");
    expect(clientRead.changed).toBe(true);
    const clientReadAgain = markSupportThreadRead(clientRead.profile, "client");
    expect(clientReadAgain.changed).toBe(false);
    expect(clientReadAgain.profile).toBe(clientRead.profile);

    const supportRead = markSupportThreadRead(profile, "support");
    expect(supportRead.changed).toBe(true);
    const supportReadAgain = markSupportThreadRead(supportRead.profile, "support");
    expect(supportReadAgain.changed).toBe(false);
  });
});

describe("mergeSupportThreads", () => {
  it("unions two devices' copies without losing a message", () => {
    const local = [message("1", "client", "from phone", "2026-10-01T10:00:00.000Z")];
    const remote = [
      message("1", "client", "from phone", "2026-10-01T10:00:00.000Z"),
      message("2", "support", "from desk", "2026-10-01T10:01:00.000Z"),
    ];

    const merged = mergeSupportThreads(remote, local);
    expect(merged.map((entry) => entry.id)).toEqual(["1", "2"]);
  });

  it("keeps the remote copy's read flags when both sides carry the message", () => {
    const local = [message("1", "client", "hello", "2026-10-01T10:00:00.000Z")];
    const remote = [
      { ...message("1", "client", "hello", "2026-10-01T10:00:00.000Z"), readBySupport: true },
    ];

    expect(mergeSupportThreads(remote, local)[0].readBySupport).toBe(true);
  });

  it("survives missing or malformed threads", () => {
    expect(mergeSupportThreads(undefined, undefined)).toEqual([]);
    expect(
      mergeSupportThreads([{ id: "x", side: "client" } as unknown as SupportMessage], undefined)
    ).toEqual([]);
    expect(supportThreadOf({ supportThread: "nope" } as unknown as BankUserProfile)).toEqual([]);
  });
});
