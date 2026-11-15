import { useEffect, useState } from "react";
import { logoNbc, pictoInsuranceTheft, pictoOrdinateur } from "../assets/nbcAssets";
import {
  BankUserProfile,
  formatMoney,
  INITIAL_PROFILES,
  LoginPortal,
  PageRoute,
  PersonaId,
} from "../banking/bankingTypes";
import { ADMIN_ACCOUNTS, AdminIdentity, authenticateAdmin } from "../banking/adminOps";
import { ArrowRight, LockIcon } from "./icons";
import {
  signInWithEmail,
  signOut,
  resetPassword as supabaseResetPassword,
  getSupabaseSession,
  type AuthState,
} from "../lib/supabaseAuth";
import { isSupabaseConfigured } from "../lib/supabase";
import { fetchProfiles } from "../lib/profileSync";

type LoginPageProps = {
  portal?: LoginPortal;
  customProfiles: BankUserProfile[];
  onNavigate: (route: PageRoute) => void;
  onSelectPersona: (persona: "personal" | "business" | "wealth") => void;
  onSignInCustom: (profile: BankUserProfile) => void;
  /** Signs an administrator in and opens the back-office console. */
  onSignInAdmin: (identity: AdminIdentity) => void;
  onResetCustomPassword: (email: string, newPassword: string) => boolean;
};

export function LoginPage({
  portal = "personal",
  customProfiles,
  onNavigate,
  onSelectPersona,
  onSignInCustom,
  onSignInAdmin,
  onResetCustomPassword,
}: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [isPinChecking, setIsPinChecking] = useState(false);
  const [step, setStep] = useState<"credentials" | "pin">("credentials");
  const [pendingProfile, setPendingProfile] = useState<BankUserProfile | null>(null);
  const [pendingPersona, setPendingPersona] = useState<"personal" | "business" | "wealth" | null>(null);
  const normalizePin = (value: string) => value.replace(/\D/g, "").slice(0, 4);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetNewPwd, setResetNewPwd] = useState("");
  const [resetStatus, setResetStatus] = useState("");

  useEffect(() => {
    setEmail("");
    setPassword("");
    setPin("");
    setStep("credentials");
    setPendingProfile(null);
    setPendingPersona(null);
    setError("");
  }, [portal]);

  const clearPinConfirmation = () => {
    setPin("");
    setShowPin(false);
    setIsPinChecking(false);
    setStep("credentials");
    setPendingProfile(null);
    setPendingPersona(null);
    setError("");
  };

  const normalizeCredentialInput = (value: string) =>
    value.replace(/[\u00A0\u200B-\u200D\uFEFF]/g, "").trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const cleanEmail = normalizeCredentialInput(email).toLowerCase();
    const pass = normalizeCredentialInput(password);

    if (!cleanEmail || !pass) {
      setError("Please enter your email and password.");
      return;
    }

    // First, check for admin login (always available)
    const admin = authenticateAdmin(cleanEmail.toLowerCase(), pass);
    if (admin.ok) {
      onSignInAdmin(admin.identity);
      return;
    }

    // Try Supabase auth first if configured (more reliable across browsers)
    let supabaseResult: { ok: boolean; error?: string; user?: { email: string; id: string } } | null = null;
    if (isSupabaseConfigured) {
      try {
        supabaseResult = await signInWithEmail(cleanEmail, pass);
      } catch (err: unknown) {
        console.warn("Supabase signInWithPassword threw:", err);
        supabaseResult = { ok: false, error: "Supabase sign-in error" };
      }
      if (supabaseResult && supabaseResult.ok && supabaseResult.user) {
        // Supabase auth succeeded - now find the local profile
        // Check custom profiles first
        const matchedCustom = customProfiles.find(
          (p) => p.email.toLowerCase() === result.user.email.toLowerCase()
        );
        if (matchedCustom) {
          setPendingProfile(matchedCustom);
          setStep("pin");
          return;
        }

        // Check built-in profiles
        const builtIns: { persona: "personal" | "business" | "wealth"; password: string; pin: string }[] = [
          { persona: "personal", password: "National2025!", pin: "7935" },
          { persona: "business", password: "Business2025!", pin: "2486" },
          { persona: "wealth", password: "Wealth2025!", pin: "6194" },
        ];
        const builtIn = builtIns.find((b) => INITIAL_PROFILES[b.persona].email.toLowerCase() === supabaseResult!.user.email.toLowerCase());
        if (builtIn) {
          setPendingPersona(builtIn.persona);
          setStep("pin");
          return;
        }

        // No matching profile found - log in anyway for Supabase-synced profiles
        // The profile will be fetched from Supabase when the dashboard loads
        onSignInCustom({
          id: "supabase-" + supabaseResult!.user.id,
          accountKind: "personal",
          status: "active",
          fullName: "Supabase User",
          roleLabel: "Personal Banking",
          email: result.user.email,
          pin: "",
          memberSince: new Date().toISOString().slice(0, 4),
          branchName: "Online Banking",
          advisorName: "Digital Advisor",
          accounts: [],
          transactions: [],
          payees: [],
          recipients: [],
          cards: [],
          pendingCards: [],
          goals: [],
        });
        setError("");
        return;
      }

      // Supabase auth failed - don't show error yet, try local auth fallback first
      // (GoTrue rejects SQL-created users, so we fall through to local auth below)
      if (supabaseResult && supabaseResult.error && supabaseResult.error.includes("not configured")) {
        // Supabase not configured - fall through to local auth
      }
    }

    // Fall back to local authentication using profiles table data
    // This is needed because GoTrue rejects SQL-created users
    const matchedCustom = customProfiles.find((p) => normalizeCredentialInput(p.email).toLowerCase() === cleanEmail);
    if (matchedCustom) {
      const storedPassword = normalizeCredentialInput(matchedCustom.password ?? "");
      if (storedPassword === pass) {
        setPendingProfile(matchedCustom);
        setStep("pin");
        return;
      }
      setError("The password entered does not match our records.");
      return;
    }

    // If custom profiles are empty (first visit), try to fetch them from Supabase REST API
    if (customProfiles.length === 0 && isSupabaseConfigured) {
      try {
        const remoteProfiles = await fetchProfiles();
        if (remoteProfiles.length > 0) {
          const fetchedMatch = remoteProfiles.find((p) => normalizeCredentialInput(p.email).toLowerCase() === cleanEmail);
          if (fetchedMatch) {
            const storedPassword = normalizeCredentialInput(fetchedMatch.password ?? "");
            if (storedPassword === pass) {
              setPendingProfile(fetchedMatch);
              setStep("pin");
              return;
            }
            setError("The password entered does not match our records.");
            return;
          }
        }
      } catch (fetchError) {
        console.warn("Profile sync failed during login fallback:", fetchError);
      }
    }

    const builtIns: { persona: "personal" | "business" | "wealth"; password: string; pin: string }[] = [
      { persona: "personal", password: "National2025!", pin: "7935" },
      { persona: "business", password: "Business2025!", pin: "2486" },
      { persona: "wealth", password: "Wealth2025!", pin: "6194" },
    ];
    const builtIn = builtIns.find((b) => INITIAL_PROFILES[b.persona].email.toLowerCase() === cleanEmail.toLowerCase());
    if (builtIn) {
      if (builtIn.password !== pass) {
        setError("The password entered does not match our records.");
        return;
      }
      setPendingPersona(builtIn.persona);
      setStep("pin");
      return;
    }

    // If Supabase is configured and we get here, it means auth failed, but
    // local/custom profile records are still valid authentication sources for
    // data-backed staff/client accounts that have not been created as Supabase
    // Auth users yet.
    if (isSupabaseConfigured) {
      setError("Invalid email or password. Please try again.");
      return;
    }

    setError("We could not find an account with those credentials. Check your email and password.");
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const pinValue = normalizePin(pin);

    if (pinValue.length !== 4) {
      setError("Please enter your 4-digit security PIN.");
      return;
    }

    const proceedWithPin = () => {
      if (pendingProfile) {
        const expectedPin = pendingProfile.pin?.trim() || "";
        if (!expectedPin) {
          setError("This account does not have a saved security PIN configured.");
          setIsPinChecking(false);
          return;
        }
        if (pinValue !== expectedPin) {
          setError("Your security PIN is incorrect.");
          setIsPinChecking(false);
          return;
        }
        onSignInCustom({ ...pendingProfile, pin: expectedPin });
        clearPinConfirmation();
        return;
      }

      if (pendingPersona) {
        const expectedPin = {
          personal: "7935",
          business: "2486",
          wealth: "6194",
        }[pendingPersona];
        if (pinValue !== expectedPin) {
          setError("Your security PIN is incorrect.");
          setIsPinChecking(false);
          return;
        }
        onSelectPersona(pendingPersona);
        clearPinConfirmation();
        return;
      }

      setError("Your account could not be verified. Please try again.");
      setIsPinChecking(false);
    };

    setIsPinChecking(true);
    window.setTimeout(proceedWithPin, 900);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim() || resetNewPwd.trim().length < 4) {
      setResetStatus("Please enter your email and a new password (minimum 4 characters).");
      return;
    }

    // Try Supabase password reset first if configured
    if (isSupabaseConfigured) {
      const result = await supabaseResetPassword(resetEmail.trim());
      if (result.ok) {
        setResetStatus("Password reset link sent to your email. Check your inbox to reset your password.");
        window.setTimeout(() => {
          setResetMode(false);
          setResetStatus("");
        }, 3000);
        return;
      }
      // If Supabase reset fails, fall back to local reset
      setResetStatus("Email not found in local system. Try Supabase email reset.");
      return;
    }

    // Fall back to local password reset
    const updated = onResetCustomPassword(resetEmail.trim(), resetNewPwd.trim());
    setEmail(resetEmail.trim());
    setPassword(updated ? resetNewPwd.trim() : "");
    setResetStatus("Your password has been updated. Returning to sign in…");
    window.setTimeout(() => {
      setResetMode(false);
      setResetStatus("");
    }, 1000);
  };

  return (
    <div className="bg-[#f8f6f1] py-12 sm:py-16">
      <div className="nbc-container max-w-[1000px]">
        {/* Universal sign-in — the credential decides where you land */}
        <div className="mb-6 rounded-[6px] border border-[#e5e2da] bg-white px-4 py-3 text-[13px] leading-[19px] text-[#565656]">
          <strong className="font-semibold text-nbc-navy">One sign-in for every client.</strong> Enter your email and
          password to authenticate the account, then confirm the saved security PIN to complete the session.
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left: Authentic National Bank Sign-In Card */}
          <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] sm:p-8 lg:col-span-7">
            <img src={logoNbc} alt="National Bank" className="h-10 w-auto" />

            <h1 className="mt-5 text-[23px] font-bold leading-[29px] text-nbc-navy sm:text-[26px] sm:leading-[32px]">
              Sign in to your account
            </h1>
            <p className="mt-1.5 text-[14.5px] leading-[22px] text-[#565656]">
              Use your account email and password to authenticate the profile. Your security PIN is verified after that in a separate confirmation step.
            </p>

            {!resetMode ? (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-[13.5px] font-semibold text-[#121212]">
                    Email address
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.ca"
                    autoComplete="username"
                    required
                    className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3.5 py-2.5 text-[15px] text-[#121212] focus:border-nbc-navy"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="login-password" className="block text-[13.5px] font-semibold text-[#121212]">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="text-[13px] font-medium text-[#1572C5] underline decoration-1 underline-offset-2 hover:no-underline"
                    >
                      {showPwd ? "Hide" : "Show"}
                    </button>
                  </div>
                  <input
                    id="login-password"
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Your account password"
                    required
                    className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3.5 py-2.5 text-[15px] text-[#121212] focus:border-nbc-navy"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[13.5px]">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-[#333333]">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 accent-[#e41c23]"
                    />
                    Remember my email
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setResetMode(true);
                    }}
                    className="font-medium text-[#1572C5] underline decoration-1 underline-offset-2 hover:no-underline"
                  >
                    Forgot your password?
                  </button>
                </div>

                {error && (
                  <div className="rounded-[6px] border border-[#f5c2c7] bg-[#fff5f5] p-3.5 text-[13.5px] text-[#842029]">
                    {error}
                  </div>
                )}

                {step === "pin" && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0d10]/55 p-4 backdrop-blur-[1px]">
                    <div className="relative w-full max-w-[22rem] overflow-hidden rounded-[18px] border border-[#d7d0c5] bg-[#f9f7f3] shadow-[0_18px_45px_rgba(11,14,18,0.22)]">
                      <div className="h-1.5 w-full bg-[linear-gradient(90deg,#c51d23_0%,#d5343b_25%,#123b6d_100%)]" />

                      <div className="p-4 sm:p-5">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6f6a61]">
                              Secure confirmation
                            </p>
                            <h2 className="mt-1 text-[20px] font-bold text-nbc-navy sm:text-[22px]">Confirm your security PIN</h2>
                          </div>
                          <button
                            type="button"
                            onClick={clearPinConfirmation}
                            className="text-[12px] font-medium text-[#1572C5] underline decoration-1 underline-offset-2 hover:no-underline"
                          >
                            Cancel
                          </button>
                        </div>

                        <p className="mb-4 text-[13px] leading-[20px] text-[#565656] sm:text-[14px] sm:leading-[22px]">
                          Your account has been authenticated with your email and password. Please confirm the stored security PIN to continue.
                        </p>

                        <div className="space-y-4">
                          {isPinChecking ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                              <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#dfe8f2] border-t-[#103c6d]" />
                              <div>
                                <p className="text-[14px] font-semibold text-[#0b1a2b]">Verifying secure PIN</p>
                                <p className="mt-1 text-[12.5px] text-[#5d6773]">Authenticating your profile…</p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div>
                                <label htmlFor="login-pin" className="mb-1.5 block text-[13.5px] font-semibold text-[#121212]">
                                  Security PIN
                                </label>
                                <div className="flex min-h-[62px] w-full items-center justify-center rounded-[12px] border border-[#cfc7bc] bg-white px-3 py-2.5 shadow-[inset_0_1px_0_rgba(17,22,29,0.04)]">
                                  <input
                                    id="login-pin"
                                    type={showPin ? "text" : "password"}
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                    autoComplete="off"
                                    inputMode="numeric"
                                    maxLength={4}
                                    aria-label="Security PIN"
                                    className="sr-only"
                                  />
                                  <div className="flex items-center justify-center gap-2.5">
                                    {Array.from({ length: 4 }).map((_, index) => {
                                      const value = index < pin.length ? pin[index] : "";
                                      return (
                                        <div
                                          key={index}
                                          className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[10px] font-bold text-[#0e2036] ${
                                            value ? (showPin ? "border-[#0e2036] bg-[#eef4fa]" : "border-[#0e2036] bg-[#0e2036]") : "border-[#b9b1a8] bg-transparent"
                                          }`}
                                        >
                                          {showPin && value ? value : ""}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>

                              <div className="mx-auto grid max-w-[260px] grid-cols-3 gap-2.5 sm:max-w-[290px]">
                                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((key) => (
                                  <button
                                    key={key}
                                    type="button"
                                    disabled={isPinChecking}
                                    onClick={() => {
                                      if (key === "C") {
                                        setPin("");
                                        return;
                                      }
                                      if (key === "⌫") {
                                        setPin((current) => current.slice(0, -1));
                                        return;
                                      }
                                      setPin((current) => (current.length >= 4 ? current : `${current}${key}`));
                                    }}
                                    className="flex h-11 items-center justify-center rounded-[10px] border border-[#d7d1c8] bg-[#f5f2ee] text-[18px] font-semibold text-nbc-navy shadow-[0_1px_0_rgba(0,0,0,0.03)] transition hover:bg-[#efeae2] active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60 sm:h-12 sm:text-[20px]"
                                  >
                                    {key}
                                  </button>
                                ))}
                              </div>

                              <div className="flex items-center justify-between gap-3 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setShowPin((v) => !v)}
                                  className="text-[13px] font-medium text-[#1572C5] underline decoration-1 underline-offset-2 hover:no-underline"
                                >
                                  {showPin ? "Hide" : "Show"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handlePinSubmit({ preventDefault: () => undefined } as React.FormEvent)}
                                  className="nbc-btn nbc-btn-primary px-5 py-2.5"
                                >
                                  Continue
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button type="submit" className="nbc-btn nbc-btn-primary w-full justify-center py-3.5">
                    <LockIcon className="h-4 w-4" />
                    Sign in
                  </button>
                  <p className="mt-2 text-center text-[11.5px] leading-[16px] text-[#777]">
                    Your email and password authenticate the account. The saved security PIN is verified in a separate confirmation step.
                  </p>
                </div>
              </form>
            ) : (
              <form onSubmit={handlePasswordReset} className="mt-6 space-y-4 rounded-[6px] bg-[#f8f6f1] p-5">
                <h2 className="text-[18px] font-bold text-nbc-navy">Reset your password</h2>
                <div>
                  <label htmlFor="rst-email" className="block text-[13px] font-semibold text-[#121212]">
                    Email address
                  </label>
                  <input
                    id="rst-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    className="mt-1 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2 text-[14px] text-[#121212]"
                  />
                </div>
                <div>
                  <label htmlFor="rst-pwd" className="block text-[13px] font-semibold text-[#121212]">
                    New password
                  </label>
                  <input
                    id="rst-pwd"
                    type="password"
                    value={resetNewPwd}
                    onChange={(e) => setResetNewPwd(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    className="mt-1 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2 text-[14px] text-[#121212]"
                  />
                </div>
                {resetStatus && <p className="text-[13.5px] font-medium text-[#105797]">{resetStatus}</p>}
                <div className="flex gap-2">
                  <button type="submit" className="nbc-btn nbc-btn-primary">
                    Save password
                  </button>
                  <button type="button" onClick={() => setResetMode(false)} className="nbc-btn nbc-btn-ghost">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right: registration help & security */}
          <div className="space-y-5 lg:col-span-5">
            <div className="rounded-[6px] border border-[#e5e2da] bg-white p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <div className="flex items-start gap-4">
                <img src={pictoOrdinateur} alt="" aria-hidden className="h-12 w-12 flex-none object-contain" />
                <div>
                  <h2 className="text-[19px] font-bold text-nbc-navy">Not enrolled yet?</h2>
                  <p className="mt-1.5 text-[14px] leading-[21px] text-[#565656]">
                    Open a personal or business account online in minutes and set up your digital banking access.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({
                        kind: "signup",
                        segment: portal === "business" ? "business" : "personal",
                      })
                    }
                    className="mt-3.5 inline-flex items-center gap-1.5 text-[14.5px] font-medium text-[#1572C5] underline decoration-1 underline-offset-2 hover:text-[#105797] hover:no-underline"
                  >
                    Become a client
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <div className="flex items-start gap-3.5">
                <img src={pictoInsuranceTheft} alt="" aria-hidden className="h-11 w-11 flex-none object-contain" />
                <div className="text-[13px] leading-[20px] text-[#565656]">
                  <p className="font-bold text-nbc-navy">Protect yourself against fraud</p>
                  <p className="mt-1">
                    National Bank will never ask you to disclose your password or one-time security code.{" "}
                    <button
                      type="button"
                      onClick={() => onNavigate({ kind: "support", section: "security" })}
                      className="font-medium text-[#1572C5] underline decoration-1 underline-offset-2 hover:no-underline"
                    >
                      Learn more
                    </button>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* SEPARATE EMPLOYEE / ADMINISTRATION SIGN-IN PAGE (#/admin-login) */
export function AdminLoginPage({
  onNavigate,
  onAuthenticated,
}: {
  onNavigate: (route: PageRoute) => void;
  onAuthenticated: (identity: AdminIdentity) => void;
}) {
  const [empId, setEmpId] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = authenticateAdmin(empId, passcode);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onAuthenticated(result.identity);
  };

  return (
    <div className="bg-[#f8f6f1] py-14 sm:py-20">
      <div className="nbc-container max-w-[500px]">
        <div className="rounded-[6px] border border-[#e5e2da] bg-white p-7 shadow-[0_1px_4px_rgba(0,0,0,0.05)] sm:p-8">
          <img src={logoNbc} alt="National Bank" className="h-10 w-auto" />
          <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#565656]">
            Internal Operations
          </p>
          <h1 className="mt-1 text-[25px] font-bold text-nbc-navy">
            Administration Sign-In
          </h1>
          <p className="mt-1.5 text-[14px] text-[#565656]">
            Authorized access for client administration, account adjustments, card issuance, and site rates.
            Sign in with your administrator credentials to access the back-office console.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="adm-id" className="block text-[13.5px] font-semibold text-[#121212]">
                Administrator email
              </label>
              <input
                id="adm-id"
                type="email"
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                required
                className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3.5 py-2.5 text-[14.5px] text-[#121212]"
              />
            </div>
            <div>
              <label htmlFor="adm-pw" className="block text-[13.5px] font-semibold text-[#121212]">
                Passcode
              </label>
              <input
                id="adm-pw"
                type="password"
                placeholder="At least 8 characters"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                required
                className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3.5 py-2.5 text-[14.5px] text-[#121212]"
              />
            </div>
            {error && <p className="text-[13px] text-nbc-red">{error}</p>}

            <button type="submit" className="nbc-btn nbc-btn-primary w-full justify-center py-3.5">
              <LockIcon className="h-4 w-4" />
              Sign in to Administration
            </button>
          </form>

          {/* Provisioned administrator account */}
          <div className="mt-5 rounded-[6px] border border-[#e5e2da] bg-[#fcfbf8] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#565656]">
              Provisioned administrator account
            </p>
            <ul className="mt-2 divide-y divide-[#ececec] text-[12.5px]">
              {ADMIN_ACCOUNTS.map((a) => (
                <li key={a.email} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-[#121212]">{a.name}</span>
                    <span className="block truncate font-mono text-[11.5px] text-[#777]">{a.email}</span>
                  </span>
                  <span className="flex flex-none items-center gap-2">
                    <code className="rounded bg-white px-2 py-0.5 font-mono text-[11.5px] text-[#121212] ring-1 ring-[#e0dcd2]">
                      {a.password}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        setEmpId(a.email);
                        setPasscode(a.password);
                        setError("");
                      }}
                      className="rounded-full border border-[#c9c3b6] px-2.5 py-1 text-[11px] font-semibold text-nbc-navy transition hover:border-nbc-navy"
                    >
                      Use
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] leading-[16px] text-[#777]">
              Choose an account to fill the form, then sign in. You have full administrative access.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#efefef] pt-4 text-[13px]">
            <button
              type="button"
              onClick={() => onNavigate({ kind: "home" })}
              className="font-medium text-[#1572C5] underline decoration-1 underline-offset-2 hover:no-underline"
            >
              ← Return to nbc.ca
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ kind: "login", portal: "personal" })}
              className="font-medium text-[#1572C5] underline decoration-1 underline-offset-2 hover:no-underline"
            >
              Client sign-in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type SignupPageProps = {
  initialSegment?: "personal" | "business";
  onNavigate: (route: PageRoute) => void;
  onCreateProfile: (profile: BankUserProfile) => void;
};

const SIGNUP_PACKAGES = {
  personal: [
    {
      id: "total-3pct",
      title: "Total Chequing + 3.00% Cash Advantage",
      fee: "$15.95/mo ($0 with $4,500 min. balance)",
      desc: "Unlimited electronic transactions, free Interac e-Transfer® & 3.00% promotional savings.",
      cardLabel: "Allure® Mastercard®",
      creditLimit: 12000,
    },
    {
      id: "connected-student",
      title: "Newcomer & Young Professional Package",
      fee: "$0 fixed monthly fee",
      desc: "Designed for students, young professionals & newcomers to Canada.",
      cardLabel: "Cashback Mastercard®",
      creditLimit: 7500,
    },
    {
      id: "wealth-premier",
      title: "Premier All-In-One + World Elite® Suite",
      fee: "$0 with qualifying investments",
      desc: "Integrated cash management, TFSA investment account & World Elite® travel rewards.",
      cardLabel: "World Elite® Mastercard®",
      creditLimit: 25000,
    },
  ],
  business: [
    {
      id: "biz-digital",
      title: "Digital Business Operating + 1.70% Investment",
      fee: "$20/mo · Entrepreneur Offer eligible",
      desc: "Unlimited electronic transactions, corporate EFT & liquid treasury reserve.",
      cardLabel: "Business Platinum Mastercard®",
      creditLimit: 35000,
    },
    {
      id: "biz-crossborder",
      title: "CAD + USD Cross-Border Commercial Suite",
      fee: "$35/mo",
      desc: "Dual-currency operating accounts for North American suppliers and international growth.",
      cardLabel: "Business Platinum Mastercard®",
      creditLimit: 50000,
    },
  ],
};

export function SignupPage({ initialSegment = "personal", onNavigate, onCreateProfile }: SignupPageProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [segment, setSegment] = useState<"personal" | "business">(initialSegment);
  const [pkgId, setPkgId] = useState(SIGNUP_PACKAGES[initialSegment][0].id);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [branchCity, setBranchCity] = useState("Place Ville Marie, Montreal, QC");

  const [initialDeposit, setInitialDeposit] = useState(6000);
  const [includeCard, setIncludeCard] = useState(true);
  const [goalTitle, setGoalTitle] = useState("Home & Renovation Project");
  const [goalTarget, setGoalTarget] = useState(15000);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setSegment(initialSegment);
    setPkgId(SIGNUP_PACKAGES[initialSegment][0].id);
  }, [initialSegment]);

  const currentPkg =
    SIGNUP_PACKAGES[segment].find((p) => p.id === pkgId) ?? SIGNUP_PACKAGES[segment][0];

  const handleNextStep = () => {
    setFormError("");
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!fullName.trim() || !email.trim()) {
        setFormError("Please enter your full name and email address.");
        return;
      }
      if (password.length < 8) {
        setFormError("Please create a password of at least 8 characters.");
        return;
      }
      if (password !== confirmPwd) {
        setFormError("Passwords do not match.");
        return;
      }
      if (!/^\d{4}$/.test(pin)) {
        setFormError("Please create a 4-digit security PIN.");
        return;
      }
      if (pin !== confirmPin) {
        setFormError("Security PINs do not match.");
        return;
      }
      setStep(3);
    }
  };

  const handleFinishSignup = (e: React.FormEvent) => {
    e.preventDefault();
    const isBiz = segment === "business";
    const today = new Date().toISOString().slice(0, 10);
    const chkAmt = Math.round(initialDeposit * 0.45 * 100) / 100;
    const savAmt = Math.round((initialDeposit - chkAmt) * 100) / 100;
    const suffix = Math.floor(10000 + Math.random() * 89999);

    const accounts: BankUserProfile["accounts"] = [
      {
        id: `chk-${suffix}`,
        name: isBiz ? "CDN Business Operating Account" : "Total Chequing Account",
        number: `0006-${suffix}-10`,
        category: "chequing",
        balance: chkAmt,
        currency: "CAD",
        subtitle: currentPkg.title,
      },
      {
        id: `sav-${suffix}`,
        name: isBiz ? "Business Investment Account" : "Cash Advantage Solution",
        number: `0006-${suffix}-25`,
        category: "savings",
        balance: savAmt,
        currency: "CAD",
        rate: isBiz ? "1.70% rate" : "3.00% promo",
        subtitle: isBiz ? "Corporate liquid reserve" : "Promotional 3% high-interest savings",
      },
    ];

    const cards: BankUserProfile["cards"] = [];
    if (includeCard) {
      const last4 = String(Math.floor(1000 + Math.random() * 8999));
      accounts.push({
        id: `crd-${suffix}`,
        name: currentPkg.cardLabel,
        number: `5412 •••• •••• ${last4}`,
        category: "credit",
        balance: 0,
        limit: currentPkg.creditLimit,
        currency: "CAD",
        rate: isBiz ? "14.99%" : "20.99%",
        subtitle: `Available credit: ${formatMoney(currentPkg.creditLimit)}`,
      });
      cards.push({
        id: `card-${suffix}`,
        label: currentPkg.cardLabel,
        network: "Mastercard",
        last4,
        expiry: "05/30",
        linkedAccountId: `crd-${suffix}`,
        locked: false,
        contactless: true,
        international: true,
        onlinePurchases: true,
        rewardsPoints: 5000,
        cashbackRate: "5,000 welcome bonus points",
        accent: isBiz ? "business" : currentPkg.cardLabel.includes("World Elite") ? "world-elite" : "allure",
      });
    }

    const profile: BankUserProfile = {
      id: "custom" as PersonaId,
      accountKind: isBiz ? "business" : "personal",
      status: "active",
      fullName: fullName.trim(),
      roleLabel: isBiz ? "Business (SME) Banking" : "Personal Banking",
      businessNumber: isBiz ? `BN ${suffix}-4102 RC0001` : undefined,
      email: email.trim(),
      password,
      pin,
      memberSince: "2026",
      branchName: branchCity,
      advisorName: isBiz ? "David Chen, Senior Commercial Advisor" : "Sophie Gagnon, Financial Advisor",
      accounts,
      transactions: [
        {
          id: `tx-open-1-${Date.now()}`,
          accountId: `chk-${suffix}`,
          date: today,
          description: "Opening deposit — Chequing",
          category: "Income",
          amount: chkAmt,
          status: "Posted",
        },
        {
          id: `tx-open-2-${Date.now()}`,
          accountId: `sav-${suffix}`,
          date: today,
          description: "Opening deposit — Savings",
          category: "Transfer",
          amount: savAmt,
          status: "Posted",
        },
      ],
      payees: [
        { id: `pay-1-${suffix}`, name: "Hydro-Québec", accountRef: `HQ-${suffix}`, category: "Utilities" },
        { id: `pay-2-${suffix}`, name: "Bell Canada", accountRef: `BC-${suffix}`, category: "Telecom" },
        { id: `pay-3-${suffix}`, name: "Canada Revenue Agency", accountRef: `CRA-${suffix}`, category: "Government" },
      ],
      recipients: [
        { id: `rec-1-${suffix}`, name: "Alex Tremblay", email: "alex.tremblay@example.ca", bank: "Interac e-Transfer®" },
      ],
      cards,
      pendingCards: [],
      goals: [
        {
          id: `goal-1-${suffix}`,
          title: goalTitle.trim() || "Primary Savings Goal",
          target: Math.max(goalTarget, 1000),
          current: savAmt,
          deadline: "Dec 2026",
          linkedAccountId: `sav-${suffix}`,
        },
      ],
    };

    onCreateProfile(profile);
  };

  return (
    <div className="bg-[#f8f6f1] py-12 sm:py-16">
      <div className="nbc-container max-w-[860px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[30px] font-bold text-nbc-navy sm:text-[36px]">Become a client</h1>
          <p className="text-[14px] text-[#565656]">
            Already a client?{" "}
            <button
              type="button"
              onClick={() => onNavigate({ kind: "login", portal: segment })}
              className="font-medium text-[#1572C5] underline decoration-1 underline-offset-2 hover:no-underline"
            >
              Sign in
            </button>
          </p>
        </div>

        <div className="overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          {/* Clean Stepper */}
          <div className="grid grid-cols-3 border-b border-[#e5e2da] bg-[#fcfbf8] text-[11.5px] sm:text-[13.5px]">
            {[
              [1, "1. Banking package"],
              [2, "2. Profile & credentials"],
              [3, "3. Opening deposit"],
            ].map(([num, label]) => (
              <div
                key={num}
                className={`border-b-[3px] px-2 py-3 text-center leading-[16px] sm:px-4 sm:py-3.5 sm:leading-normal ${
                  step === num
                    ? "border-nbc-red font-bold text-nbc-navy"
                    : step > (num as number)
                    ? "border-nbc-navy/40 font-medium text-nbc-navy"
                    : "border-transparent text-[#777]"
                }`}
              >
                {label}
              </div>
            ))}
          </div>

          <div className="p-6 sm:p-8">
            {step === 1 && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {(["personal", "business"] as const).map((seg) => (
                    <button
                      key={seg}
                      type="button"
                      onClick={() => {
                        setSegment(seg);
                        setPkgId(SIGNUP_PACKAGES[seg][0].id);
                      }}
                      className={`rounded-[6px] border p-4 text-left transition ${
                        segment === seg
                          ? "border-nbc-red bg-[#fffafa]"
                          : "border-[#dcd8ce] bg-white hover:border-nbc-navy"
                      }`}
                    >
                      <p className="text-[17px] font-bold text-nbc-navy">
                        {seg === "personal" ? "Personal banking" : "Business banking"}
                      </p>
                      <p className="mt-1 text-[13.5px] text-[#565656]">
                        {seg === "personal"
                          ? "Everyday chequing, 3% promotional savings & Mastercard®"
                          : "Operating accounts, treasury savings & commercial cash management"}
                      </p>
                    </button>
                  ))}
                </div>

                <div>
                  <h2 className="mb-3 text-[18px] font-bold text-nbc-navy">Select your banking solution</h2>
                  <div className="space-y-3">
                    {SIGNUP_PACKAGES[segment].map((pkg) => (
                      <label
                        key={pkg.id}
                        className={`flex cursor-pointer items-start gap-3.5 rounded-[6px] border p-4 transition ${
                          pkgId === pkg.id
                            ? "border-nbc-navy bg-[#faf8f3]"
                            : "border-[#e5e2da] bg-white hover:bg-[#fcfbf8]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="signup-pkg"
                          checked={pkgId === pkg.id}
                          onChange={() => setPkgId(pkg.id)}
                          className="mt-1 h-4 w-4 accent-[#e41c23]"
                        />
                        <div className="flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-[15.5px] font-bold text-[#121212]">{pkg.title}</span>
                            <span className="text-[13px] font-medium text-nbc-navy">{pkg.fee}</span>
                          </div>
                          <p className="mt-1 text-[13.5px] text-[#565656]">{pkg.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button type="button" onClick={handleNextStep} className="nbc-btn nbc-btn-primary">
                    Continue
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <h2 className="text-[20px] font-bold text-nbc-navy">Your profile and sign-in details</h2>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="su-name" className="block text-[13.5px] font-semibold text-[#121212]">
                      {segment === "business" ? "Legal business name" : "Full name"}
                    </label>
                    <input
                      id="su-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={segment === "business" ? "e.g., Nordik Studio Inc." : "e.g., Jordan Martin"}
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3.5 py-2.5 text-[14.5px] text-[#121212]"
                    />
                  </div>
                  <div>
                    <label htmlFor="su-email" className="block text-[13.5px] font-semibold text-[#121212]">
                      Email address
                    </label>
                    <input
                      id="su-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.ca"
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3.5 py-2.5 text-[14.5px] text-[#121212]"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="su-pwd" className="block text-[13.5px] font-semibold text-[#121212]">
                      Password
                    </label>
                    <input
                      id="su-pwd"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3.5 py-2.5 text-[14.5px] text-[#121212]"
                    />
                  </div>
                  <div>
                    <label htmlFor="su-cpwd" className="block text-[13.5px] font-semibold text-[#121212]">
                      Confirm password
                    </label>
                    <input
                      id="su-cpwd"
                      type="password"
                      value={confirmPwd}
                      onChange={(e) => setConfirmPwd(e.target.value)}
                      placeholder="Re-enter password"
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3.5 py-2.5 text-[14.5px] text-[#121212]"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="su-pin" className="block text-[13.5px] font-semibold text-[#121212]">
                      Security PIN
                    </label>
                    <input
                      id="su-pin"
                      type="password"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="4 digits"
                      inputMode="numeric"
                      maxLength={4}
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3.5 py-2.5 text-[14.5px] text-[#121212]"
                    />
                  </div>
                  <div>
                    <label htmlFor="su-cpin" className="block text-[13.5px] font-semibold text-[#121212]">
                      Confirm PIN
                    </label>
                    <input
                      id="su-cpin"
                      type="password"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="Repeat PIN"
                      inputMode="numeric"
                      maxLength={4}
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3.5 py-2.5 text-[14.5px] text-[#121212]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="su-branch" className="block text-[13.5px] font-semibold text-[#121212]">
                    Home branch
                  </label>
                  <select
                    id="su-branch"
                    value={branchCity}
                    onChange={(e) => setBranchCity(e.target.value)}
                    className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3.5 py-2.5 text-[14.5px] text-nbc-navy"
                  >
                    <option>Place Ville Marie, Montreal, QC</option>
                    <option>King Street West, Toronto, ON</option>
                    <option>Laurier Boulevard, Quebec City, QC</option>
                    <option>Sparks Street, Ottawa, ON</option>
                    <option>Burrard Street, Vancouver, BC</option>
                    <option>Stephen Avenue, Calgary, AB</option>
                  </select>
                </div>

                {formError && (
                  <div className="rounded-[6px] border border-[#f5c2c7] bg-[#fff5f5] p-3 text-[13.5px] text-[#842029]">
                    {formError}
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <button type="button" onClick={() => setStep(1)} className="nbc-btn nbc-btn-ghost">
                    Back
                  </button>
                  <button type="button" onClick={handleNextStep} className="nbc-btn nbc-btn-primary">
                    Continue
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <form onSubmit={handleFinishSignup} className="space-y-6">
                <h2 className="text-[20px] font-bold text-nbc-navy">Opening deposit and preferences</h2>

                <div className="rounded-[6px] bg-[#f8f6f1] p-5">
                  <div className="flex items-center justify-between text-[14px] font-semibold text-[#121212]">
                    <label htmlFor="su-dep">Initial transfer amount</label>
                    <span className="text-[20px] font-bold tabular-nums text-nbc-navy">
                      {formatMoney(initialDeposit)}
                    </span>
                  </div>
                  <input
                    id="su-dep"
                    type="range"
                    min={500}
                    max={50000}
                    step={500}
                    value={initialDeposit}
                    onChange={(e) => setInitialDeposit(Number(e.target.value))}
                    className="mt-3 w-full accent-[#e41c23]"
                  />
                  <p className="mt-1.5 text-[13px] text-[#565656]">
                    Allocated as {formatMoney(initialDeposit * 0.45)} in Chequing and{" "}
                    {formatMoney(initialDeposit * 0.55)} in Savings.
                  </p>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-[6px] border border-[#e5e2da] p-4">
                  <input
                    type="checkbox"
                    checked={includeCard}
                    onChange={(e) => setIncludeCard(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-[#e41c23]"
                  />
                  <div>
                    <p className="text-[14.5px] font-semibold text-[#121212]">
                      Add {currentPkg.cardLabel} (authorized limit {formatMoney(currentPkg.creditLimit)})
                    </p>
                    <p className="text-[13px] text-[#565656]">
                      Includes 5,000 welcome rewards points upon activation.
                    </p>
                  </div>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="su-gtitle" className="block text-[13.5px] font-semibold text-[#121212]">
                      Savings goal name
                    </label>
                    <input
                      id="su-gtitle"
                      type="text"
                      value={goalTitle}
                      onChange={(e) => setGoalTitle(e.target.value)}
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3.5 py-2.5 text-[14px] text-[#121212]"
                    />
                  </div>
                  <div>
                    <label htmlFor="su-gtarget" className="block text-[13.5px] font-semibold text-[#121212]">
                      Target amount ($)
                    </label>
                    <input
                      id="su-gtarget"
                      type="number"
                      min={1000}
                      step={500}
                      value={goalTarget}
                      onChange={(e) => setGoalTarget(Number(e.target.value))}
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3.5 py-2.5 text-[14px] font-semibold tabular-nums text-[#121212]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#efefef] pt-4">
                  <button type="button" onClick={() => setStep(2)} className="nbc-btn nbc-btn-ghost">
                    Back
                  </button>
                  <button type="submit" className="nbc-btn nbc-btn-primary">
                    Open account and sign in
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
