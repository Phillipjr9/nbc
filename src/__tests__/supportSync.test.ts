import { beforeEach, describe, expect, it, vi } from "vitest";
import { INITIAL_PROFILES } from "../banking/bankingTypes";
import type { BankUserProfile, SupportMessage } from "../banking/bankingTypes";
import {
  diffSupportThreadPatch,
  isActionablePatch,
  startSpecialistHandoff,
  markSupportThreadRead,
} from "../banking/supportChat";
import { ensureProfileShape } from "../lib/profileNormalize";
import { stableStringify } from "../lib/stableStringify";

const rpcMock = vi.fn();

vi.mock("../lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

// Imported after the mock so the module picks up the fake client.
const { applySupportThreadRemote, resetThreadRpcAvailability } = await import("../lib/supportRemote");

function fixture(overrides: Partial<BankUserProfile> = {}): BankUserProfile {
  return ensureProfileShape({
    ...INITIAL_PROFILES.personal,
    email: "client@nbc.test",
    supportThread: [],
    ...overrides,
  } as BankUserProfile);
}

function message(id: string, side: SupportMessage["side"], body: string, createdAt: string): SupportMessage {
  return { id, side, body, createdAt, readByClient: side === "client", readBySupport: side === "support" };
}

beforeEach(() => {
  rpcMock.mockReset();
  resetThreadRpcAvailability();
});

describe("stableStringify", () => {
  it("ignores key order, so a merged profile can be compared with a saved one", () => {
    const a = { email: "a@b.c", profile: { name: "x", age: 2 }, list: [1, 2] };
    const b = { list: [1, 2], profile: { age: 2, name: "x" }, email: "a@b.c" };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it("still notices a real difference", () => {
    expect(stableStringify({ a: 1 })).not.toBe(stableStringify({ a: 2 }));
    expect(stableStringify({ a: [1, 2] })).not.toBe(stableStringify({ a: [2, 1] }));
  });

  it("drops undefined keys, the way JSON does", () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe(stableStringify({ a: 1 }));
  });

  it("keeps non-finite numbers distinguishable from null", () => {
    expect(stableStringify({ a: Number.NaN })).not.toBe(stableStringify({ a: null }));
  });
});

describe("diffSupportThreadPatch", () => {
  it("describes a new client message as an append, not a profile save", () => {
    const before = fixture();
    const after = { ...before, supportThread: [message("m1", "client", "Hello", "2026-11-15T10:00:00.000Z")] };
    const patch = diffSupportThreadPatch(before, after);

    expect(patch).not.toBeNull();
    expect(patch?.added.map((entry) => entry.id)).toEqual(["m1"]);
    expect(patch?.handoff).toBe(false);
    expect(patch?.readFor).toBeNull();
    expect(isActionablePatch(patch!)).toBe(true);
  });

  it("carries the handoff flag when the client asks for a person", () => {
    const before = fixture();
    const after = startSpecialistHandoff(before);
    const patch = diffSupportThreadPatch(before, after);

    expect(patch?.handoff).toBe(true);
    expect(patch?.added).toHaveLength(2); // the request plus the acknowledgement
  });

  it("describes read receipts without re-sending the messages", () => {
    const before = fixture({
      supportThread: [message("m1", "support", "We are on it", "2026-11-15T10:00:00.000Z")],
    });
    const after = markSupportThreadRead(before, "client").profile;
    const patch = diffSupportThreadPatch(before, after);

    expect(patch?.added).toHaveLength(0);
    expect(patch?.readFor).toBe("client");
  });

  it("returns a do-nothing patch when the thread did not change", () => {
    const before = fixture();
    const patch = diffSupportThreadPatch(before, before);

    expect(patch).not.toBeNull();
    expect(isActionablePatch(patch!)).toBe(false);
  });

  it("refuses to handle edits that are not Support-only", () => {
    const before = fixture();
    const after = { ...before, fullName: "Someone Else" };
    expect(diffSupportThreadPatch(before, after)).toBeNull();
  });

  it("sends a balance change down the normal profile-save path", () => {
    const before = fixture();
    const after = {
      ...before,
      supportThread: [message("m1", "client", "hello", "2026-11-15T10:00:00.000Z")],
      accounts: before.accounts.map((account, index) =>
        index === 0 ? { ...account, balance: account.balance + 100 } : account
      ),
    };
    expect(diffSupportThreadPatch(before, after)).toBeNull();
  });
});

describe("applySupportThreadRemote", () => {
  it("returns the thread the database now holds", async () => {
    const thread = [message("m1", "client", "hello", "2026-11-15T10:00:00.000Z")];
    rpcMock.mockResolvedValue({ data: { supportThread: thread, supportHandoff: false }, error: null });

    const result = await applySupportThreadRemote("client@nbc.test", {
      added: thread,
      handoff: false,
      readFor: null,
    });

    expect(rpcMock).toHaveBeenCalledWith("support_thread_apply", {
      p_email: "client@nbc.test",
      p_messages: thread,
      p_handoff: false,
      p_read_for: null,
    });
    expect(result?.supportThread).toHaveLength(1);
    expect(result?.supportHandoff).toBe(false);
  });

  it("does nothing when the patch is empty", async () => {
    const result = await applySupportThreadRemote("client@nbc.test", {
      added: [],
      handoff: false,
      readFor: null,
    });

    expect(result).toBeNull();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("falls back quietly when the function is not deployed", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "no such function" } });

    const first = await applySupportThreadRemote("client@nbc.test", {
      added: [message("m1", "client", "hi", "2026-11-15T10:00:00.000Z")],
      handoff: false,
      readFor: null,
    });
    const second = await applySupportThreadRemote("client@nbc.test", {
      added: [message("m2", "client", "hi again", "2026-11-15T10:01:00.000Z")],
      handoff: false,
      readFor: null,
    });

    expect(first).toBeNull();
    expect(second).toBeNull();
    // Only asked once: a chatty conversation must not log the same 404 forever.
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it("returns null for a network failure so the caller can save the profile", async () => {
    rpcMock.mockRejectedValue(new Error("offline"));

    const result = await applySupportThreadRemote("client@nbc.test", {
      added: [message("m1", "client", "hi", "2026-11-15T10:00:00.000Z")],
      handoff: false,
      readFor: null,
    });

    expect(result).toBeNull();
  });
});
