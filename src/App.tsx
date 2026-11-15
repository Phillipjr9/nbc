import { useEffect, useMemo, useRef, useState } from "react";
import {
  AuditLogEntry,
  BankUserProfile,
  GlobalBankConfig,
  INITIAL_BANK_CONFIG,
  INITIAL_PROFILES,
  PageRoute,
  normalizeBankCardList,
} from "./banking/bankingTypes";
import {
  AdminIdentity,
  AdminOps,
  ApprovalRequest,
  ManagedUserEntry,
  applyCardApprovalDecision,
  CardApprovalPayload,
} from "./banking/adminOps";
import { hashToRoute, routeToHash } from "./banking/routeMapper";
import { runDueSchedules } from "./banking/bankingTypes";
import AdminDashboard from "./components/AdminDashboard";
import { AdminLoginPage, LoginPage, SignupPage } from "./components/AuthPages";
import BusinessDashboard from "./components/BusinessDashboard";
import SupportChat from "./components/SupportChat";
import Dashboard from "./components/Dashboard";
import ErrorBoundary from "./components/ErrorBoundary";
import Footer from "./components/Footer";
import Header from "./components/Header";
import ProductPages from "./components/ProductPages";
import SearchDialog from "./components/SearchDialog";
import { AdviceSection, HelpSection, Hero, PromoSection, ServicesSection } from "./components/Sections";
import SupportPages from "./components/SupportPages";
import { fetchProfiles, upsertProfile } from "./lib/profileSync";
import { subscribeToProfileChanges } from "./lib/profileRealtime";
import { ensureProfileShape, isPersistableProfile } from "./lib/profileNormalize";
import { mergeSupportThreads } from "./banking/supportChat";
import { isSupabaseConfigured } from "./lib/supabase";

const STORAGE_PROFILES_KEY = "nbc_profiles_v1";
const STORAGE_CUSTOM_KEY = "nbc_custom_profiles_v1";
const STORAGE_SESSION_KEY = "nbc_active_session_v1";
const STORAGE_COOKIE_CONSENT_KEY = "nbc_cookie_consent_v1";
const STORAGE_SESSION_COOKIE_KEY = "nbc_active_session_cookie_v1";
const STORAGE_ADMIN_AUTH_KEY = "nbc_admin_session_v1";
const STORAGE_CONFIG_KEY = "nbc_bank_config_v1";
const STORAGE_AUDIT_KEY = "nbc_audit_logs_v1";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number) {
  const expiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expiry}; path=/; SameSite=Lax`;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function isBusinessProfile(profile: BankUserProfile): boolean {
  return (
    profile.id === "business" ||
    profile.accountKind === "business" ||
    profile.roleLabel.toLowerCase().includes("business")
  );
}

const INITIAL_AUDIT: AuditLogEntry[] = [
  {
    id: "aud-init-1",
    timestamp: "System Boot",
    actor: "Core Engine",
    action: "SYSTEM_READY",
    detail: "Core banking administration ready.",
    severity: "info",
  },
];

const normalizeCredentialString = (value: string | undefined | null): string =>
  String(value ?? "")
    .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, "")
    .trim();

/**
 * Chooses the ledger to keep when a device merges the server copy with its own.
 *
 * `profiles.profile_data` is a single JSON blob, so the last writer wins. When a
 * row comes back with an empty (or missing) `transactions` array — a partial
 * write, a placeholder session, a row created outside the app — blindly
 * accepting it wipes the history on every other device, which is exactly the
 * "my transactions vanished on this phone" report. Keep the populated ledger in
 * that one case and warn, so the real fix (repair the row) is visible.
 */
const preferTransactionHistory = (
  remote: BankUserProfile["transactions"] | undefined,
  local: BankUserProfile["transactions"] | undefined
): BankUserProfile["transactions"] => {
  const remoteList = Array.isArray(remote) ? remote : [];
  const localList = Array.isArray(local) ? local : [];
  if (remoteList.length === 0 && localList.length > 0) {
    console.warn(
      "[profiles] Server copy has no transactions but this device has",
      localList.length,
      "— keeping local history. The stored row may be incomplete."
    );
    return localList;
  }
  return remoteList.length > 0 ? remoteList : localList;
};

const sanitizeCustomProfiles = (profiles: BankUserProfile[] = []): BankUserProfile[] =>
  (Array.isArray(profiles) ? profiles : [])
    .filter((profile) => Boolean(normalizeCredentialString(profile?.email)))
    .map((profile) =>
      ensureProfileShape({
        ...profile,
        email: normalizeCredentialString(profile.email),
        password: normalizeCredentialString(profile.password),
        pin: normalizeCredentialString(profile.pin),
        cards: normalizeBankCardList(profile.cards),
      })
    );

/** Merge remote profiles into the built-in profiles Record (personal/business/wealth).
 * Built-in profiles are identified by their `id` matching the key ("personal", "business", "wealth").
 * Local changes take priority; new remote entries (e.g. reversals) are merged in. */
const mergeRemoteProfilesIntoBuiltIn = (
  local: Record<"personal" | "business" | "wealth", BankUserProfile>,
  remote: BankUserProfile[]
): Record<"personal" | "business" | "wealth", BankUserProfile> => {
  const result = { ...local };
  for (const rp of remote) {
    // Only merge demo profiles (empty email) into built-ins.
    // User profiles (with email) belong in customProfiles, keyed by email —
    // they must not overwrite the shared built-in personal/business/wealth slots.
    if (!normalizeCredentialString(rp.email)) {
      const key = rp.id === "personal" || rp.id === "business" || rp.id === "wealth"
        ? (rp.id as "personal" | "business" | "wealth")
        : null;
      if (!key || !result[key]) continue;
      const current = result[key];
      // Remote is the source of truth: start with local to preserve shape,
      // then overlay remote values so admin changes propagate to the user's view.
      result[key] = {
        ...current,
        ...rp,
        email: normalizeCredentialString(rp.email) || normalizeCredentialString(current.email) || "",
        fullName: rp.fullName || current.fullName || "",
        roleLabel: rp.roleLabel || current.roleLabel || "Personal Banking",
        accountKind: rp.accountKind || current.accountKind || (rp.id === "custom" ? undefined : rp.id) || "personal",
        status: rp.status || current.status || "active",
        memberSince: rp.memberSince || current.memberSince || "",
        branchName: rp.branchName || current.branchName || "",
        advisorName: rp.advisorName || current.advisorName || "",
        password: normalizeCredentialString(rp.password) || normalizeCredentialString(current.password) || "",
        pin: normalizeCredentialString(rp.pin) || normalizeCredentialString(current.pin) || "1988",
        address: rp.address || current.address || "",
        city: rp.city || current.city || "",
        province: rp.province || current.province || "",
        postalCode: rp.postalCode || current.postalCode || "",
        dateOfBirth: rp.dateOfBirth || current.dateOfBirth || "",
        sin: rp.sin || current.sin || "",
        businessNumber: rp.businessNumber || current.businessNumber || "",
        notes: rp.notes || current.notes || "",
        // Remote arrays are the source of truth — admin deletions/modifications propagate.
        goals: rp.goals ?? current.goals,
        payees: rp.payees ?? current.payees,
        recipients: rp.recipients ?? current.recipients,
        cards: rp.cards ? normalizeBankCardList(rp.cards) : current.cards,
        transactions: preferTransactionHistory(rp.transactions, current.transactions),
        accounts: rp.accounts && rp.accounts.length > 0 ? rp.accounts : current.accounts,
        // Two devices can both write between polls; union by message id so a
        // support reply is never lost by the merge.
        supportThread: mergeSupportThreads(rp.supportThread, current.supportThread),
      };
    }
  }
  return result;
};

const mergeRemoteProfiles = (existing: BankUserProfile[], remote: BankUserProfile[]): BankUserProfile[] => {
  const merged = sanitizeCustomProfiles(existing);

  for (const profile of sanitizeCustomProfiles(remote)) {
    const index = merged.findIndex((entry) => entry.email.toLowerCase() === profile.email.toLowerCase());
    if (index >= 0) {
      // Remote is the source of truth: admin changes propagate to the user's view.
      // Start with local to preserve shape, then overlay remote values.
      const local = merged[index];
      merged[index] = {
        ...local,
        ...profile,
        email: normalizeCredentialString(profile.email) || normalizeCredentialString(local.email) || "",
        fullName: profile.fullName || local.fullName || "",
        roleLabel: profile.roleLabel || local.roleLabel || "Personal Banking",
        accountKind: profile.accountKind || local.accountKind || (profile.id === "custom" ? undefined : profile.id) || "personal",
        status: profile.status || local.status || "active",
        memberSince: profile.memberSince || local.memberSince || "",
        branchName: profile.branchName || local.branchName || "",
        advisorName: profile.advisorName || local.advisorName || "",
        password: normalizeCredentialString(profile.password) || normalizeCredentialString(local.password) || "",
        pin: normalizeCredentialString(profile.pin) || normalizeCredentialString(local.pin) || "1988",
        address: profile.address || local.address || "",
        city: profile.city || local.city || "",
        province: profile.province || local.province || "",
        postalCode: profile.postalCode || local.postalCode || "",
        dateOfBirth: profile.dateOfBirth || local.dateOfBirth || "",
        sin: profile.sin || local.sin || "",
        businessNumber: profile.businessNumber || local.businessNumber || "",
        notes: profile.notes || local.notes || "",
        // Remote arrays are the source of truth — admin deletions/modifications propagate.
        goals: profile.goals ?? local.goals,
        payees: profile.payees ?? local.payees,
        recipients: profile.recipients ?? local.recipients,
        cards: profile.cards ? normalizeBankCardList(profile.cards) : local.cards,
        transactions: preferTransactionHistory(profile.transactions, local.transactions),
        accounts: profile.accounts && profile.accounts.length > 0 ? profile.accounts : local.accounts,
        supportThread: mergeSupportThreads(profile.supportThread, local.supportThread),
      };
    } else {
      merged.push({
        ...profile,
        cards: normalizeBankCardList(profile.cards),
      });
    }
  }

  return merged.filter(
    (profile, index, list) =>
      list.findIndex((entry) => entry.email.toLowerCase() === profile.email.toLowerCase()) === index
  );
};

export default function App() {
  const [route, setRoute] = useState<PageRoute>(() => hashToRoute(window.location.hash));
  const [searchOpen, setSearchOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const [profiles, setProfiles] = useState<Record<"personal" | "business" | "wealth", BankUserProfile>>(() => {
    const stored = loadStored<Record<"personal" | "business" | "wealth", BankUserProfile>>(STORAGE_PROFILES_KEY, INITIAL_PROFILES);
    return {
      personal: ensureProfileShape({ ...INITIAL_PROFILES.personal, ...stored.personal, cards: normalizeBankCardList(stored.personal?.cards) }),
      business: ensureProfileShape({ ...INITIAL_PROFILES.business, ...stored.business, cards: normalizeBankCardList(stored.business?.cards) }),
      wealth: ensureProfileShape({ ...INITIAL_PROFILES.wealth, ...stored.wealth, cards: normalizeBankCardList(stored.wealth?.cards) }),
    };
  });
  const [customProfiles, setCustomProfiles] = useState<BankUserProfile[]>(() => {
    const stored = loadStored<BankUserProfile[]>(STORAGE_CUSTOM_KEY, []);
    return sanitizeCustomProfiles(Array.isArray(stored) ? stored : []);
  });
  // Refs to always-accessible latest state for the async sync loop.
  const profilesRef = useRef(profiles);
  const customProfilesRef = useRef(customProfiles);
  useEffect(() => { profilesRef.current = profiles; }, [profiles]);
  useEffect(() => { customProfilesRef.current = customProfiles; }, [customProfiles]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let isMounted = true;
    let intervalId: number | undefined;
    let realtimeLive = false;

    const refreshProfiles = async () => {
      try {
        const remoteProfiles = await fetchProfiles();
        if (!isMounted) return;

        const nextCustom = mergeRemoteProfiles(customProfilesRef.current, remoteProfiles);
        const nextBuiltIn = mergeRemoteProfilesIntoBuiltIn(profilesRef.current, remoteProfiles);
        setCustomProfiles(nextCustom);
        setProfiles(nextBuiltIn);
      } catch (error) {
        console.warn("Supabase profile sync skipped:", error);
      }
    };

    /**
     * Realtime is the fast path (Support messages, desk replies and admin edits
     * arrive instantly). The interval is only a safety net, and it backs off once
     * the channel is live so every open tab stops polling every 15 s.
     */
    const schedulePoll = () => {
      if (intervalId) window.clearInterval(intervalId);
      intervalId = window.setInterval(
        () => {
          void refreshProfiles();
        },
        realtimeLive ? 120000 : 15000
      );
    };

    void refreshProfiles();
    schedulePoll();

    const unsubscribe = subscribeToProfileChanges({
      onChange: () => {
        void refreshProfiles();
      },
      onStatus: (status) => {
        if (!isMounted) return;
        const wasLive = realtimeLive;
        realtimeLive = status === "live";
        if (wasLive !== realtimeLive) schedulePoll();
        // Catch up on anything that changed while the channel was connecting.
        if (realtimeLive) void refreshProfiles();
      },
    });

    return () => {
      isMounted = false;
      unsubscribe();
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  const [activeProfileKey, setActiveProfileKey] = useState<string | null>(() => {
    const persisted = loadStored<string | null>(STORAGE_SESSION_KEY, null);
    const cookieSession = readCookie(STORAGE_SESSION_COOKIE_KEY);
    return cookieSession ?? persisted ?? null;
  });
  const [cookieConsent, setCookieConsent] = useState<boolean>(() => {
    const localConsent = loadStored<boolean | null>(STORAGE_COOKIE_CONSENT_KEY, null);
    const cookieConsentValue = readCookie(STORAGE_COOKIE_CONSENT_KEY);
    return localConsent ?? cookieConsentValue === "accepted";
  });
  const [adminAuth, setAdminAuth] = useState<boolean>(() =>
    loadStored<boolean>(STORAGE_ADMIN_AUTH_KEY, false)
  );
  const [bankConfig, setBankConfig] = useState<GlobalBankConfig>(() =>
    loadStored(STORAGE_CONFIG_KEY, INITIAL_BANK_CONFIG)
  );
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() =>
    loadStored(STORAGE_AUDIT_KEY, INITIAL_AUDIT)
  );
  const [adminIdentity, setAdminIdentity] = useState<AdminIdentity | null>(() =>
    loadStored<AdminIdentity | null>("nbc_admin_identity_v1", null)
  );
  const [approvals, setApprovals] = useState<ApprovalRequest[]>(() =>
    loadStored<ApprovalRequest[]>("nbc_approvals_v1", [])
  );
  const [impersonating, setImpersonating] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem("nbc_admin_identity_v1", JSON.stringify(adminIdentity));
    } catch {}
  }, [adminIdentity]);

  useEffect(() => {
    try {
      window.localStorage.setItem("nbc_approvals_v1", JSON.stringify(approvals));
    } catch {}
  }, [approvals]);

  // Sync browser back/forward hash changes
  useEffect(() => {
    const onHashChange = () => {
      setRoute(hashToRoute(window.location.hash));
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_PROFILES_KEY, JSON.stringify(profiles));
    } catch {
      // ignore
    }
  }, [profiles]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(customProfiles));
    } catch {
      // ignore
    }
  }, [customProfiles]);

  useEffect(() => {
    try {
      if (activeProfileKey) {
        window.localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(activeProfileKey));
      } else {
        window.localStorage.removeItem(STORAGE_SESSION_KEY);
      }
    } catch {
      // ignore
    }

    if (cookieConsent && activeProfileKey) {
      setCookie(STORAGE_SESSION_COOKIE_KEY, activeProfileKey, 30);
    } else if (!cookieConsent) {
      clearCookie(STORAGE_SESSION_COOKIE_KEY);
    }
  }, [activeProfileKey, cookieConsent]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_COOKIE_CONSENT_KEY, JSON.stringify(cookieConsent));
    } catch {
      // ignore
    }
    if (cookieConsent) {
      setCookie(STORAGE_COOKIE_CONSENT_KEY, "accepted", 365);
    } else {
      clearCookie(STORAGE_COOKIE_CONSENT_KEY);
      clearCookie(STORAGE_SESSION_COOKIE_KEY);
    }
  }, [cookieConsent]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_ADMIN_AUTH_KEY, JSON.stringify(adminAuth));
    } catch {
      // ignore
    }
  }, [adminAuth]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(bankConfig));
    } catch {
      // ignore
    }
  }, [bankConfig]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_AUDIT_KEY, JSON.stringify(auditLogs));
    } catch {
      // ignore
    }
  }, [auditLogs]);

  const appendAudit = (
    action: string,
    detail: string,
    severity: AuditLogEntry["severity"] = "info",
    actor = "Administration"
  ) => {
    const entry: AuditLogEntry = {
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 999)}`,
      timestamp: new Date().toLocaleTimeString("en-CA", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }),
      actor,
      action,
      detail,
      severity,
    };
    setAuditLogs((prev) => [entry, ...prev].slice(0, 100));
  };

  const navigate = (next: PageRoute) => {
    const targetHash = routeToHash(next);
    if (window.location.hash !== targetHash) {
      window.history.pushState(null, "", targetHash);
    }
    setRoute(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if ((route.kind === "admin-login" || route.kind === "admin") && !(adminAuth && adminIdentity)) {
      navigate({ kind: "home" });
    }
  }, [route.kind, adminAuth, adminIdentity]);

  const activeProfile: BankUserProfile | null = useMemo(() => {
    if (!activeProfileKey) return null;
    if (activeProfileKey === "personal" || activeProfileKey === "business" || activeProfileKey === "wealth") {
      return profiles[activeProfileKey];
    }
    return customProfiles.find((c) => c.email.toLowerCase() === activeProfileKey.toLowerCase()) ?? null;
  }, [activeProfileKey, profiles, customProfiles]);

  useEffect(() => {
    if (!activeProfile) return;
    // A profile that has not finished loading from the server (or a placeholder
    // session) must never be written back: `profile_data` is a full-document
    // write, so an empty object here destroys that client's ledger everywhere.
    if (!isPersistableProfile(activeProfile)) {
      console.info("[profiles] Skipping write-back of an incomplete profile for", activeProfile.email);
      return;
    }

    let isMounted = true;

    void (async () => {
      try {
        const result = await upsertProfile(activeProfile);
        if (!isMounted) return;

        if (result && "ok" in result && result.ok) {
          console.info("Profile synced to Supabase", activeProfile.email);
        }
      } catch (error) {
        console.warn("Profile sync skipped:", error);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [activeProfile]);

  const activeDashboardRoute: PageRoute = useMemo(() => {
    if (activeProfile && isBusinessProfile(activeProfile)) {
      return { kind: "business-dashboard", tab: "cards" };
    }
    return { kind: "personal-dashboard" };
  }, [activeProfile]);

  const allManagedUsers: ManagedUserEntry[] = useMemo(() => {
    const builtIns: ManagedUserEntry[] = [
      { key: "personal", builtIn: true, profile: profiles.personal },
      { key: "business", builtIn: true, profile: profiles.business },
      { key: "wealth", builtIn: true, profile: profiles.wealth },
    ];
    const customs: ManagedUserEntry[] = customProfiles.map((cp) => ({
      key: cp.email,
      builtIn: false,
      profile: cp,
    }));
    return [...customs, ...builtIns];
  }, [profiles, customProfiles]);

  const updateUserByKey = (
    key: string,
    updater: (prev: BankUserProfile) => BankUserProfile,
    logAction?: string,
    logDetail?: string,
    severity: AuditLogEntry["severity"] = "info"
  ) => {
    const normalizeProfile = (profile: BankUserProfile): BankUserProfile =>
      ensureProfileShape({
        ...profile,
        cards: normalizeBankCardList(
          Array.isArray(profile.cards)
            ? profile.cards.filter((card, index, list) => list.findIndex((entry) => entry.id === card.id) === index)
            : []
        ),
      });

    if (key === "personal" || key === "business" || key === "wealth") {
      setProfiles((prev) => {
        const next = normalizeProfile(updater(prev[key]));
        // Persist to Supabase so remote sync cannot overwrite admin changes.
        // Fire-and-forget: the 15s sync loop will retry if this write fails.
        if (isSupabaseConfigured && isPersistableProfile(next)) {
          upsertProfile(next).catch((err) => console.warn("Supabase profile upsert failed:", err));
        }
        return { ...prev, [key]: next };
      });
    } else {
      setCustomProfiles((prev) => {
        const next = prev.map((cp) =>
          cp.email.toLowerCase() === key.toLowerCase() ? normalizeProfile(updater(cp)) : cp
        );
        // Persist to Supabase so remote sync cannot overwrite admin changes.
        const updated = next.find((cp) => cp.email.toLowerCase() === key.toLowerCase());
        if (isSupabaseConfigured && updated && isPersistableProfile(updated)) {
          upsertProfile(updated).catch((err) => console.warn("Supabase profile upsert failed:", err));
        }
        return next;
      });
    }
    if (logAction && logDetail) {
      appendAudit(logAction, logDetail, severity);
    }
  };

  const openDashboardForProfile = (profile: BankUserProfile) => {
    navigate(
      isBusinessProfile(profile)
        ? { kind: "business-dashboard", tab: "cards" }
        : { kind: "personal-dashboard" }
    );
  };

  /** Processes any scheduled transfers that have come due for a profile. */
  const processSchedules = (key: string, profile: BankUserProfile): BankUserProfile => {
    const result = runDueSchedules(profile);
    if (result.executed.length === 0) return result.profile;
    if (key === "personal" || key === "business" || key === "wealth") {
      setProfiles((prev) => ({ ...prev, [key]: result.profile }));
    } else {
      setCustomProfiles((prev) =>
        prev.map((c) => (c.email.toLowerCase() === key.toLowerCase() ? result.profile : c))
      );
    }
    appendAudit(
      "SCHEDULED_TRANSFERS_PROCESSED",
      `${result.executed.length} scheduled transfer(s) processed for ${profile.fullName}`,
      "info",
      "Scheduler"
    );
    return result.profile;
  };

  const handleSelectPersona = (persona: "personal" | "business" | "wealth") => {
    const stamp = new Date().toLocaleString("en-CA", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const withLogin = { ...profiles[persona], lastLogin: stamp };
    const ready = processSchedules(persona, withLogin);
    setProfiles((prev) => ({ ...prev, [persona]: ready }));
    setActiveProfileKey(persona);
    openDashboardForProfile(ready);
  };

  const handleSignInCustom = (profile: BankUserProfile) => {
    const stamp = new Date().toLocaleString("en-CA", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const ready = ensureProfileShape({ ...profile, lastLogin: stamp });
    // Upsert by email instead of only replacing an existing entry: on a fresh
    // device the profile was just fetched from Supabase, and the old
    // `prev.map(...)` silently dropped it, leaving the user on the login page
    // with an apparently empty history.
    setCustomProfiles((prev) => {
      const index = prev.findIndex((c) => c.email.toLowerCase() === ready.email.toLowerCase());
      if (index < 0) return [ready, ...prev];
      const next = [...prev];
      next[index] = ready;
      return next;
    });
    setActiveProfileKey(ready.email);
    openDashboardForProfile(ready);
  };

  const handleCreateProfile = (newProfile: BankUserProfile) => {
    setCustomProfiles((prev) => {
      const filtered = prev.filter((p) => p.email.toLowerCase() !== newProfile.email.toLowerCase());
      return [newProfile, ...filtered];
    });
    setActiveProfileKey(newProfile.email);
    appendAudit(
      "CLIENT_SIGNUP",
      `New ${newProfile.roleLabel} client registered: ${newProfile.fullName}`,
      "info",
      "Online Onboarding"
    );
    openDashboardForProfile(newProfile);
  };

  const handleAdminCreateUser = (newProfile: BankUserProfile) => {
    setCustomProfiles((prev) => {
      const filtered = prev.filter((p) => p.email.toLowerCase() !== newProfile.email.toLowerCase());
      return [newProfile, ...filtered];
    });
    appendAudit("USER_PROVISIONED", `Provisioned ${newProfile.roleLabel} client "${newProfile.fullName}"`, "info");
  };

  const handleDeleteCustomUser = (email: string) => {
    setCustomProfiles((prev) => prev.filter((p) => p.email.toLowerCase() !== email.toLowerCase()));
    if (activeProfileKey?.toLowerCase() === email.toLowerCase()) {
      setActiveProfileKey(null);
    }
    appendAudit("USER_DELETED", `Deleted custom client ${email}`, "critical");
  };

  const handleResetCustomPassword = (email: string, newPassword: string): boolean => {
    let found = false;
    setCustomProfiles((prev) =>
      prev.map((p) => {
        if (p.email.toLowerCase() === email.toLowerCase()) {
          found = true;
          return { ...p, password: newPassword };
        }
        return p;
      })
    );
    return found;
  };

  const handleUpdateActiveProfile = (updater: (prev: BankUserProfile) => BankUserProfile) => {
    if (!activeProfileKey) return;
    updateUserByKey(activeProfileKey, updater);
  };

  const handleFactoryReset = () => {
    setProfiles(INITIAL_PROFILES);
    setCustomProfiles([]);
    setBankConfig(INITIAL_BANK_CONFIG);
    setActiveProfileKey(null);
    setAuditLogs([
      {
        id: `aud-rst-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString("en-CA"),
        actor: "Administration",
        action: "FACTORY_RESET",
        detail: "Restored all profiles, balances, cards, and site settings to defaults.",
        severity: "critical",
      },
    ]);
  };

  const handleRequestApproval: AdminOps["onRequestApproval"] = (request) => {
    const entry: ApprovalRequest = {
      ...request,
      id: `apr-${Date.now()}`,
      requestedAt: new Date().toLocaleString("en-CA"),
      status: "pending",
    };
    setApprovals((prev) => [entry, ...prev]);
    appendAudit("APPROVAL_REQUESTED", `${entry.label} — awaiting authorisation`, "warning", entry.requestedBy);
  };

  const handleDecideApproval = (id: string, decision: "approved" | "rejected") => {
    const request = approvals.find((a) => a.id === id);
    if (!request) return;
    const decider = adminIdentity?.name ?? "Administration";
    setApprovals((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: decision, decidedAt: new Date().toLocaleString("en-CA"), decidedBy: decider }
          : a
      )
    );
    appendAudit(
      decision === "approved" ? "APPROVAL_GRANTED" : "APPROVAL_REJECTED",
      `${request.label} — ${decision} by ${decider}`,
      decision === "approved" ? "info" : "warning",
      decider
    );
    if (decision === "approved") {
      const payload = request.payload ?? {};
      if (request.action === "balance.override" && typeof payload.accountId === "string") {
        const newBalance = Number(payload.balance) || 0;
        updateUserByKey(
          request.targetKey,
          (prev) => ({
            ...prev,
            accounts: prev.accounts.map((a) =>
              a.id === payload.accountId ? { ...a, balance: Math.round(newBalance * 100) / 100 } : a
            ),
          }),
          "BALANCE_OVERRIDE_APPLIED",
          `Approved override applied: ${request.detail}`,
          "critical"
        );
      }
      if (request.action === "client.delete") {
        handleDeleteCustomUser(request.targetKey);
      }
      if (request.action === "config.publish" && payload.config) {
        setBankConfig(payload.config as typeof bankConfig);
      }
      if (request.action === "card.issue") {
        const cp = payload as CardApprovalPayload | undefined;
        const pendingCards = cp?.pendingCards ?? [];
        const pendingCard = pendingCards.find((p) => p.approvalRequestId === id);
        if (pendingCard) {
          updateUserByKey(request.targetKey, (prev) =>
            applyCardApprovalDecision(prev, pendingCard, decision, decider)
          );
        }
      }
    }
  };

  const handleRestoreBackup = (payload: { users: BankUserProfile[]; bankConfig?: Record<string, unknown> }) => {
    const restored = payload.users.filter((u) => u && u.email);
    setCustomProfiles(restored);
    setProfiles(INITIAL_PROFILES);
    if (payload.bankConfig) {
      setBankConfig({ ...INITIAL_BANK_CONFIG, ...(payload.bankConfig as typeof bankConfig) });
    }
    setActiveProfileKey(null);
    appendAudit("BACKUP_RESTORED", `Restored ${restored.length} client record(s) from an uploaded backup file`, "critical");
  };

  const handleAdminSignIn = (identity: AdminIdentity) => {
    setAdminIdentity(identity);
    setAdminAuth(true);
    appendAudit("ADMIN_SIGNIN", `${identity.name} signed in as ${identity.role}`, "info", identity.name);
    navigate({ kind: "admin" });
  };

  const handleImpersonate = (key: string) => {
    setActiveProfileKey(key);
    setImpersonating(true);
    appendAudit("CLIENT_SESSION_OPENED", `Opened an assisted client session (${key})`, "warning", adminIdentity?.name ?? "Administration");
    const target = allManagedUsers.find((u) => u.key === key)?.profile;
    if (target) openDashboardForProfile(target);
  };

  const handleReturnToAdmin = () => {
    setImpersonating(false);
    setActiveProfileKey(null);
    navigate({ kind: "admin" });
  };

  const handleCustomerSignOut = () => {
    setActiveProfileKey(null);
    window.localStorage.removeItem(STORAGE_SESSION_KEY);
    clearCookie(STORAGE_SESSION_COOKIE_KEY);
    navigate({ kind: "home" });
  };

  const handleAdminSignOut = () => {
    setAdminAuth(false);
    setAdminIdentity(null);
    appendAudit("ADMIN_SIGNOUT", "Administrator session ended", "info", adminIdentity?.name ?? "Administration");
    navigate({ kind: "home" });
  };

  const handleOpenAuthFromProduct = (
    mode: "signin" | "onboarding",
    persona?: "personal" | "business" | "wealth"
  ) => {
    if (mode === "onboarding") {
      navigate({
        kind: "signup",
        segment: persona === "business" ? "business" : "personal",
      });
    } else {
      navigate({
        kind: "login",
        portal: persona === "business" ? "business" : persona === "wealth" ? "wealth" : "personal",
      });
    }
  };

  // Resolve target profiles for separate Personal vs Business dashboard pages
  const personalPageProfile =
    activeProfile && !isBusinessProfile(activeProfile) ? activeProfile : null;
  const businessPageProfile =
    activeProfile && isBusinessProfile(activeProfile) ? activeProfile : null;

  const isDedicatedAdminDashboard = route.kind === "admin" && adminAuth && Boolean(adminIdentity);
  const isDedicatedPersonalDashboard = route.kind === "personal-dashboard" && Boolean(personalPageProfile);
  const isDedicatedBusinessDashboard = route.kind === "business-dashboard" && Boolean(businessPageProfile);
  const businessInitialTab: "treasury" | "payroll" | "invoices" | "wires" | "cards" | "ledger" | "settings" =
    route.kind === "business-dashboard"
      ? route.tab === "payroll"
        ? "payroll"
        : route.tab === "invoices"
          ? "invoices"
          : route.tab === "wires"
            ? "wires"
            : route.tab === "cards"
              ? "cards"
              : route.tab === "ledger"
                ? "ledger"
                : route.tab === "settings"
                  ? "settings"
                  : "treasury"
      : "treasury";
  const isAuthRoute =
    route.kind === "login" || route.kind === "admin-login" || route.kind === "signup";

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-nbc-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-nbc-navy focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
      >
        Go to page content
      </a>

      {impersonating && (isDedicatedPersonalDashboard || isDedicatedBusinessDashboard) && (
        <div className="bg-[#8a6d3b] text-white">
          <div className="nbc-container flex flex-wrap items-center justify-between gap-2 py-2 text-[12.5px]">
            <span>
              <strong className="font-semibold">Assisted client session.</strong> You are viewing{" "}
              {activeProfile?.fullName}&apos;s accounts as {adminIdentity?.name ?? "an administrator"}. This session is
              recorded in the audit log.
            </span>
            <button
              type="button"
              onClick={handleReturnToAdmin}
              className="rounded-full bg-white px-3 py-1 text-[12px] font-bold text-[#5c4520] hover:bg-white/90"
            >
              Return to administration
            </button>
          </div>
        </div>
      )}

      {isDedicatedAdminDashboard ? (
        <AdminDashboard
          users={allManagedUsers}
          identity={adminIdentity}
          approvals={approvals}
          bankConfig={bankConfig}
          auditLogs={auditLogs}
          onUpdateUser={updateUserByKey}
          onCreateUser={handleAdminCreateUser}
          onDeleteCustomUser={handleDeleteCustomUser}
          onImpersonateUser={handleImpersonate}
          onRequestApproval={handleRequestApproval}
          onDecideApproval={handleDecideApproval}
          onRestoreBackup={handleRestoreBackup}
          onSetIdentity={(next) => {
            setAdminIdentity(next);
            if (!next) {
              setAdminAuth(false);
              navigate({ kind: "home" });
            }
          }}
          onUpdateBankConfig={(next, detail) => {
            setBankConfig(next);
            appendAudit("CMS_CONFIG_UPDATED", detail, "info");
          }}
          onFactoryReset={handleFactoryReset}
          onGoPublicSite={() => navigate({ kind: "home" })}
          onSignOut={handleAdminSignOut}
        />
      ) : isDedicatedPersonalDashboard && personalPageProfile ? (
        <ErrorBoundary label="personal dashboard" onReset={() => setRoute({ kind: "personal-dashboard" })}>
          <Dashboard
            profile={personalPageProfile}
            onUpdateProfile={handleUpdateActiveProfile}
            onGoPublicSite={() => navigate({ kind: "home" })}
            onGoHelp={() => navigate({ kind: "support", section: "appointment" })}
            onSignOut={handleCustomerSignOut}
          />
        </ErrorBoundary>
      ) : isDedicatedBusinessDashboard && businessPageProfile ? (
        <ErrorBoundary label="business dashboard" onReset={() => setRoute({ kind: "business-dashboard", tab: "cards" })}>
          <BusinessDashboard
            profile={businessPageProfile}
            initialTab={businessInitialTab}
            onUpdateProfile={handleUpdateActiveProfile}
            onGoPublicSite={() => navigate({ kind: "home" })}
            onGoHelp={() => navigate({ kind: "support", section: "appointment" })}
            onSignOut={handleCustomerSignOut}
          />
        </ErrorBoundary>
      ) : (
        <>
          <Header
            route={route}
            bankConfig={bankConfig}
            signedInName={activeProfile?.fullName ?? null}
            dashboardRoute={activeDashboardRoute}
            onNavigate={navigate}
            onOpenSearch={() => setSearchOpen(true)}
            onOpenChat={() => setChatOpen(true)}
          />

          <main id="main-content" className="flex-1">
            {route.kind === "home" && (
              <>
                <Hero onNavigate={navigate} />
                <PromoSection onNavigate={navigate} bankConfig={bankConfig} />
                <ServicesSection onNavigate={navigate} />
                <AdviceSection onNavigate={navigate} />
                <HelpSection onOpenChat={() => setChatOpen(true)} onNavigate={navigate} />
              </>
            )}

            {(route.kind === "login" ||
              (route.kind === "personal-dashboard" && !personalPageProfile) ||
              (route.kind === "business-dashboard" && !businessPageProfile)) && (
              <LoginPage
                portal={
                  route.kind === "login"
                    ? route.portal
                    : route.kind === "business-dashboard"
                    ? "business"
                    : "personal"
                }
                customProfiles={customProfiles}
                onNavigate={navigate}
                onSelectPersona={handleSelectPersona}
                onSignInCustom={handleSignInCustom}
                onSignInAdmin={handleAdminSignIn}
                onResetCustomPassword={handleResetCustomPassword}
              />
            )}

            {(route.kind === "admin-login" || (route.kind === "admin" && (!adminAuth || !adminIdentity))) && (
              <AdminLoginPage onNavigate={navigate} onAuthenticated={handleAdminSignIn} />
            )}

            {route.kind === "signup" && (
              <SignupPage
                initialSegment={route.segment}
                onNavigate={navigate}
                onCreateProfile={handleCreateProfile}
              />
            )}

            {route.kind === "support" && (
              <SupportPages
                section={route.section}
                onNavigate={navigate}
                onOpenChat={() => setChatOpen(true)}
              />
            )}

            {(route.kind === "segment" || route.kind === "category") && (
              <ProductPages
                route={route}
                onNavigate={navigate}
                onOpenAuth={handleOpenAuthFromProduct}
              />
            )}
          </main>
        </>
      )}

      {!cookieConsent && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#d9d3c8] bg-[#fffdf9] shadow-[0_-8px_28px_rgba(10,18,26,0.08)]">
          <div className="nbc-container flex flex-col gap-3 py-4 text-[13.5px] text-[#333] md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl leading-[1.5]">
              <strong className="font-semibold text-nbc-navy">Cookies help keep you signed in.</strong> We use cookies only to remember your secure session and improve your banking experience. You can accept or decline at any time.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCookieConsent(false)}
                className="rounded-full border border-[#c9c3b6] bg-white px-4 py-2 font-semibold text-[#121212] transition hover:border-nbc-navy"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => setCookieConsent(true)}
                className="rounded-full bg-nbc-red px-4 py-2 font-semibold text-white transition hover:bg-nbc-red-dark"
              >
                Accept cookies
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer
        onNavigate={navigate}
        isSignedIn={Boolean(activeProfile)}
        dashboardRoute={activeDashboardRoute}
      />

      {/*
        One Support widget for the whole app: it replaces the old pair of
        floating buttons ("Ask a question" + "Support") that overlapped in the
        bottom-right corner. Signed in it talks to the client's own file and can
        reach the desk; signed out it answers general questions.
        The back office keeps using the Support inbox instead, and the sign-in
        pages stay uncluttered.
      */}
      {!isAuthRoute && route.kind !== "admin" && (
        <SupportChat
          profile={activeProfile}
          onUpdateProfile={activeProfileKey ? handleUpdateActiveProfile : undefined}
          onNavigate={navigate}
          open={chatOpen}
          onOpenChange={setChatOpen}
        />
      )}
      <SearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={navigate}
      />
    </div>
  );
}
