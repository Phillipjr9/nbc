import { describe, expect, it } from "vitest";
import {
  diffSupportDigest,
  parseSupportThreadRows,
  type SupportDigest,
} from "../lib/supportRemote";

/**
 * A conversation between a client and the desk has to move in about a second.
 *
 * Realtime is the fast path, but it is a websocket: a phone that slept or a
 * network that blocks the socket leaves the conversation waiting for the 30 s
 * safety-net poll. The digest below is what lets both sides ask "has anything
 * moved?" for a few hundred bytes, and only download the thread that did.
 */
describe("Support delivery digest", () => {
  const digest = (entries: Record<string, string>): SupportDigest => {
    const result: SupportDigest = {};
    for (const [email, updatedAt] of Object.entries(entries)) {
      result[email.toLowerCase()] = { email, updatedAt };
    }
    return result;
  };

  it("seeds quietly on the first read instead of reporting everything", () => {
    expect(diffSupportDigest(null, digest({ "client@example.com": "2026-11-15T10:00:00Z" }))).toEqual([]);
  });

  it("reports only the conversations that moved", () => {
    const before = digest({
      "client@example.com": "2026-11-15T10:00:00Z",
      "desk@example.com": "2026-11-15T09:00:00Z",
    });
    const after = digest({
      "client@example.com": "2026-11-15T10:00:05Z",
      "desk@example.com": "2026-11-15T09:00:00Z",
    });

    expect(diffSupportDigest(before, after)).toEqual(["client@example.com"]);
  });

  it("reports a client who just appeared, and nothing when nothing changed", () => {
    const before = digest({ "client@example.com": "2026-11-15T10:00:00Z" });
    const after = digest({
      "client@example.com": "2026-11-15T10:00:00Z",
      "new@example.com": "2026-11-15T10:01:00Z",
    });

    expect(diffSupportDigest(before, after)).toEqual(["new@example.com"]);
    expect(diffSupportDigest(after, after)).toEqual([]);
  });

  it("keeps the database spelling of the email for the follow-up read", () => {
    // Emails are matched case-insensitively in the database but `.in()` is
    // case-sensitive, so the digest has to hand back the stored value.
    const before = digest({ "Client@Example.com": "2026-11-15T10:00:00Z" });
    const after = digest({ "Client@Example.com": "2026-11-15T10:00:09Z" });
    expect(diffSupportDigest(before, after)).toEqual(["Client@Example.com"]);
  });
});

describe("Support conversation payloads", () => {
  const message = (id: string, body: string, side: "client" | "support" = "client") => ({
    id,
    side,
    body,
    createdAt: `2026-11-15T10:00:0${id.slice(-1)}Z`,
  });

  it("reads the projected select (`profile_data->supportThread`)", () => {
    const rows = parseSupportThreadRows([
      {
        email: "client@example.com",
        thread: [message("m1", "Where is my transfer?"), message("m2", "It is on the way", "support")],
        handoff: true,
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("client@example.com");
    expect(rows[0].handoff).toBe(true);
    expect(rows[0].thread.map((entry) => entry.body)).toEqual([
      "Where is my transfer?",
      "It is on the way",
    ]);
  });

  it("reads a whole row too, so a refused JSON projection cannot stop the desk", () => {
    const rows = parseSupportThreadRows([
      {
        email: "client@example.com",
        profile_data: { supportThread: [message("m1", "Hello")], supportHandoff: "true" },
      },
    ]);

    expect(rows[0].thread).toHaveLength(1);
    expect(rows[0].handoff).toBe(true);
  });

  it("drops rows and messages it cannot trust", () => {
    const rows = parseSupportThreadRows([
      { email: "", thread: [message("m1", "no email")] },
      { email: "client@example.com", thread: [message("m1", "kept"), { id: "m2" }, null, "nope"] },
      { email: "quiet@example.com", thread: null },
      null,
    ]);

    expect(rows.map((row) => row.email)).toEqual(["client@example.com", "quiet@example.com"]);
    expect(rows[0].thread.map((entry) => entry.id)).toEqual(["m1"]);
    expect(rows[1].thread).toEqual([]);
    expect(rows[1].handoff).toBe(false);
  });

  it("survives a payload that is not an array at all", () => {
    expect(parseSupportThreadRows(null)).toEqual([]);
    expect(parseSupportThreadRows({})).toEqual([]);
  });
});
