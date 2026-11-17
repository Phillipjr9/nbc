import { describe, expect, it } from "vitest";
import { ADMIN_ACCOUNTS } from "../banking/adminOps";
import { INITIAL_PROFILES } from "../banking/bankingTypes";
import type { BankUserProfile } from "../banking/bankingTypes";
import {
  normalizeCredentialInput,
  profilePasswordMatches,
  resolveSignIn,
} from "../banking/signInResolution";

const ADMIN = ADMIN_ACCOUNTS[0];

function base(overrides: Partial<BankUserProfile> = {}): BankUserProfile {
  return {
    ...INITIAL_PROFILES.personal,
    email: "client@nbc.test",
    password: "Client-Pass-2026!",
    pin: "1234",
    ...overrides,
  } as BankUserProfile;
}

describe("normalizeCredentialInput", () => {
  it("strips non-breaking and zero-width characters smuggled into a credential", () => {
    expect(normalizeCredentialInput(" client@nbc.test​")).toBe("client@nbc.test");
    expect(normalizeCredentialInput("\u00A0pass\u200Bword\uFEFF")).toBe("password");
  });
});

describe("profilePasswordMatches", () => {
  it("trusts the stored record over a Supabase Auth acceptance (desk reset case)", () => {
    const profile = base({ password: "NewPass!2026" });
    // The desk resets only the profile record; Supabase Auth still holds the
    // old password, so Auth says "accepted" for the OLD password — and the
    // record must veto it.
    expect(profilePasswordMatches(profile, "OldPass!2025", true)).toBe(false);
    expect(profilePasswordMatches(profile, "NewPass!2026", false)).toBe(true);
  });

  it("accepts Supabase Auth only when the record stores no password (legacy Auth-only users)", () => {
    const legacy = base({ password: "" });
    expect(profilePasswordMatches(legacy, "whatever", true)).toBe(true);
    expect(profilePasswordMatches(legacy, "whatever", false)).toBe(false);
  });
});

describe("resolveSignIn — client/admin username collision", () => {
  const shared = ADMIN.email; // a client whose sign-in ID is the admin's ID

  it("lands the client on the client route when their password matches their record", () => {
    const local = base({ email: shared, password: "Client-Only-Pass!" });
    const decision = resolveSignIn({
      email: shared,
      password: "Client-Only-Pass!",
      localProfile: local,
    });
    expect(decision.type).toBe("customer-custom");
    expect(decision.type === "customer-custom" && decision.profile.email).toBe(shared);
  });

  it("lets the client record win even when the password equals the admin passcode", () => {
    const local = base({ email: shared, password: ADMIN.password });
    const decision = resolveSignIn({
      email: shared,
      password: ADMIN.password,
      localProfile: local,
    });
    expect(decision.type).toBe("customer-custom");
  });

  it("still reaches the admin desk when no client record claims the password", () => {
    const local = base({ email: shared, password: "Client-Only-Pass!" });
    const decision = resolveSignIn({
      email: shared,
      password: ADMIN.password,
      localProfile: local,
    });
    expect(decision.type).toBe("admin");
  });

  it("reaches the admin desk when no client account exists at all", () => {
    const decision = resolveSignIn({ email: ADMIN.email, password: ADMIN.password });
    expect(decision.type).toBe("admin");
  });

  it("rejects when neither the client record nor the desk accepts the password", () => {
    const decision = resolveSignIn({
      email: ADMIN.email,
      password: "Not-A-Thing!",
      localProfile: base({ email: ADMIN.email, password: "Client-Only-Pass!" }),
    });
    expect(decision.type).toBe("reject");
  });
});

describe("resolveSignIn — password reset must retire the old password", () => {
  it("rejects the old password even when Supabase Auth still accepts it", () => {
    const local = base({ password: "NewPass!2026" });
    const remote = base({ password: "NewPass!2026" });
    const decision = resolveSignIn({
      email: "client@nbc.test",
      password: "OldPass!2025",
      supabaseAccepted: true, // Auth never saw the desk reset
      localProfile: local,
      remoteProfile: remote,
    });
    expect(decision.type).toBe("reject");
  });

  it("accepts the new password the desk just set", () => {
    const decision = resolveSignIn({
      email: "client@nbc.test",
      password: "NewPass!2026",
      supabaseAccepted: false, // Auth doesn't know the new password either — the record does
      remoteProfile: base({ password: "NewPass!2026" }),
    });
    expect(decision.type).toBe("customer-custom");
  });

  it("lets the server record veto a stale device cache from before the reset", () => {
    const staleCache = base({ password: "OldPass!2025" });
    const freshRemote = base({ password: "NewPass!2026" });
    const decision = resolveSignIn({
      email: "client@nbc.test",
      password: "OldPass!2025",
      localProfile: staleCache,
      remoteProfile: freshRemote,
    });
    expect(decision.type).toBe("reject");
  });

  it("falls back to the device cache only when the server record is unreachable", () => {
    const staleCache = base({ password: "OldPass!2025" });
    const decision = resolveSignIn({
      email: "client@nbc.test",
      password: "OldPass!2025",
      localProfile: staleCache,
      remoteProfile: null,
    });
    expect(decision.type).toBe("customer-custom");
  });

  it("does not let a password-less server row demote a device cache that holds one", () => {
    const decision = resolveSignIn({
      email: "client@nbc.test",
      password: "Client-Pass-2026!",
      supabaseAccepted: false, // Auth doesn't know this SQL-created user at all
      localProfile: base({ password: "Client-Pass-2026!" }),
      remoteProfile: base({ password: "" }), // row exists, empty document
    });
    expect(decision.type).toBe("customer-custom");
  });

  it("signs a fresh device in with the new password from the plain record (no Auth user)", () => {
    const decision = resolveSignIn({
      email: "client@nbc.test",
      password: "NewPass!2026",
      supabaseAccepted: false,
      remoteProfile: base({ password: "NewPass!2026" }),
    });
    expect(decision.type).toBe("customer-custom");
    expect(decision.type === "customer-custom" && decision.profile.email).toBe("client@nbc.test");
  });
});

describe("resolveSignIn — personas and rejected input", () => {
  it("signs a built-in persona in with its documented password", () => {
    const decision = resolveSignIn({
      email: INITIAL_PROFILES.personal.email,
      password: "National2025!",
    });
    expect(decision).toEqual({ type: "customer-persona", persona: "personal" });
  });

  it("does not let a Supabase acceptance bypass the persona password", () => {
    const decision = resolveSignIn({
      email: INITIAL_PROFILES.personal.email,
      password: "WrongPass!",
      supabaseAccepted: true,
    });
    expect(decision.type).toBe("reject");
  });

  it("rejects empty credentials", () => {
    expect(resolveSignIn({ email: "", password: "x" }).type).toBe("reject");
    expect(resolveSignIn({ email: "client@nbc.test", password: "" }).type).toBe("reject");
  });
});
