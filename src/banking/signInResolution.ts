import {
  INITIAL_PROFILES,
  type BankUserProfile,
} from "./bankingTypes";
import { authenticateAdmin, type AdminIdentity } from "./adminOps";

export type PersonaId = "personal" | "business" | "wealth";

export const PERSONA_IDS: PersonaId[] = ["personal", "business", "wealth"];

/**
 * Built-in demo personas authenticate against these constants; their passwords
 * are not editable by the back office (unlike client records), so they are kept
 * next to the credential resolution rather than inside it.
 */
export const PERSONA_CREDENTIALS: Record<PersonaId, { password: string; pin: string }> = {
  personal: { password: "National2025!", pin: "7935" },
  business: { password: "Business2025!", pin: "2486" },
  wealth: { password: "Wealth2025!", pin: "6194" },
};

/** Strips the invisible characters that copy/paste can smuggle into a credential field. */
export const normalizeCredentialInput = (value: string | undefined | null): string =>
  String(value ?? "")
    .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, "")
    .trim();

/**
 * Verifies a password against one client profile record.
 *
 * The password stored on the profile record is the source of truth: the back
 * office resets it (Client directory → Edit profile → password) and that reset
 * is written to the `profiles` row — it never reaches Supabase Auth. A Supabase
 * "password accepted" result is therefore only trusted for accounts with no
 * stored password at all (legacy Auth-only users). Before this rule, the old
 * password kept authenticating after every desk reset.
 */
export function profilePasswordMatches(
  profile: Pick<BankUserProfile, "password"> | null | undefined,
  enteredPassword: string,
  supabaseAccepted: boolean
): boolean {
  const stored = normalizeCredentialInput(profile?.password);
  if (stored) return stored === enteredPassword;
  return supabaseAccepted;
}

export type SignInResolution =
  | { type: "customer-custom"; profile: BankUserProfile }
  | { type: "customer-persona"; persona: PersonaId }
  | { type: "admin"; identity: AdminIdentity }
  | { type: "reject" };

export type SignInCandidates = {
  email: string;
  password: string;
  /**
   * Supabase Auth accepted these credentials. A supporting signal only — see
   * {@link profilePasswordMatches}. Never sufficient on its own for an account
   * that has a stored password.
   */
  supabaseAccepted?: boolean;
  /** Profile cached on this device, if any. */
  localProfile?: BankUserProfile | null;
/**
 * Profile fetched from the server for this email, if any. The server record is
 * what the back office resets, so when it pins a password it outranks the
 * (possibly stale) copy cached on this device. A server row with no stored
 * password (e.g. created by hand with an empty document) does not outrank a
 * device cache that does hold one.
 */
  remoteProfile?: BankUserProfile | null;
};

/**
 * Decides where a pair of credentials lands.
 *
 * A client and an administrator can share the same email address. The client
 * route is always resolved first so a shared username can never shadow the
 * client's own account — the administrator desk is reached only when no client
 * credential matches. (Employees who want the desk directly keep using the
 * dedicated #/admin-login page.)
 */
export function resolveSignIn(candidates: SignInCandidates): SignInResolution {
  const email = normalizeCredentialInput(candidates.email).toLowerCase();
  const pass = normalizeCredentialInput(candidates.password);
  const supabaseAccepted = Boolean(candidates.supabaseAccepted);
  if (!email || !pass) return { type: "reject" };

  const matchesEmail = (profile: BankUserProfile | null | undefined): profile is BankUserProfile =>
    Boolean(profile) &&
    normalizeCredentialInput(profile?.email).toLowerCase() === email;

  // Client accounts. The server record wins when it pins a password — it is
  // what the back office resets. A password-less server row does not demote
  // this device's cached record.
  const remote = matchesEmail(candidates.remoteProfile) ? candidates.remoteProfile : null;
  const local = matchesEmail(candidates.localProfile) ? candidates.localProfile : null;
  const remotePinsPassword = Boolean(remote && normalizeCredentialInput(remote.password));
  const source = remotePinsPassword || !local ? remote : local;
  if (source && profilePasswordMatches(source, pass, supabaseAccepted)) {
    return { type: "customer-custom", profile: source };
  }

  // Built-in demo personas.
  for (const persona of PERSONA_IDS) {
    if (
      INITIAL_PROFILES[persona].email.toLowerCase() === email &&
      PERSONA_CREDENTIALS[persona].password === pass
    ) {
      return { type: "customer-persona", persona };
    }
  }

  // Administrator desk — fallback only; a shared username must not shadow the
  // client account.
  const admin = authenticateAdmin(email, pass);
  if (admin.ok) {
    return { type: "admin", identity: admin.identity };
  }

  return { type: "reject" };
}
