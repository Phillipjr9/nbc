import { useEffect, useMemo, useState } from "react";
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
import Chatbot from "./components/Chatbot";
import Dashboard from "./components/Dashboard";
import Footer from "./components/Footer";
import Header from "./components/Header";
import ProductPages from "./components/ProductPages";
import SearchDialog from "./components/SearchDialog";
import { AdviceSection, HelpSection, Hero, PromoSection, ServicesSection } from "./components/Sections";
import SupportPages from "./components/SupportPages";
import { fetchProfiles, upsertProfile } from "./lib/profileSync";
import { isSupabaseConfigured } from "./lib/supabase";

/** Catherine White's complete profile - seeded to Supabase for cross-device access */
const CATHERINE_WHITE_PROFILE: BankUserProfile = {
  id: "catherine-white",
  accountKind: "personal",
  status: "active",
  fullName: "Catherine White",
  roleLabel: "Personal Banking",
  email: "catherine.white@swiftdevice.ca",
  password: "Swiftdevice2025!",
  pin: "4521",
  memberSince: "2024",
  branchName: "Place Ville Marie, Montreal, QC",
  advisorName: "Sophie Gagnon, Financial Advisor",
  phone: "514-555-0198",
  address: "1200 Rue Sainte-Catherine",
  city: "Montréal",
  province: "QC",
  postalCode: "H3G 1P2",
  dateOfBirth: "1990-03-15",
  accounts: [
    {
      id: "cwh-chk-1",
      name: "Total Chequing Account",
      number: "0006-77411-20",
      category: "chequing",
      balance: 12450.75,
      currency: "CAD",
      subtitle: "Unlimited electronic transactions",
    },
    {
      id: "cwh-sav-1",
      name: "Cash Advantage Solution",
      number: "0006-77411-45",
      category: "savings",
      balance: 18500.0,
      currency: "CAD",
      rate: "3.00% promo",
      subtitle: "Promotional interest rate active",
    },
    {
      id: "cwh-crd-1",
      name: "Allure® Mastercard®",
      number: "5412 •••• •••• 8834",
      category: "credit",
      balance: 2340.50,
      limit: 15000,
      currency: "CAD",
      rate: "20.99%",
      subtitle: "Available credit: $12,659.50",
    },
  ],
  transactions: [
    {
      id: "cwh-tx-001",
      accountId: "cwh-chk-1",
      date: "2026-05-14",
      description: "Payroll Deposit — SwiftDevice Inc.",
      category: "Income",
      amount: 4250.0,
      status: "Posted",
    },
    {
      id: "cwh-tx-002",
      accountId: "cwh-chk-1",
      date: "2026-05-13",
      description: "Hydro-Québec — Bill Payment",
      category: "Utilities",
      amount: -145.25,
      status: "Posted",
    },
    {
      id: "cwh-tx-003",
      accountId: "cwh-crd-1",
      date: "2026-05-12",
      description: "IGA Extra — Weekly groceries",
      category: "Groceries",
      amount: -167.42,
      status: "Posted",
    },
    {
      id: "cwh-tx-004",
      accountId: "cwh-sav-1",
      date: "2026-05-10",
      description: "Automated Savings Transfer",
      category: "Transfer",
      amount: 500.0,
      status: "Posted",
    },
    {
      id: "cwh-tx-005",
      accountId: "cwh-crd-1",
      date: "2026-05-09",
      description: "Café Olimpico Montréal",
      category: "Dining",
      amount: -8.75,
      status: "Posted",
    },
    {
      id: "cwh-tx-006",
      accountId: "cwh-crd-1",
      date: "2026-05-08",
      description: "Simons — Sainte-Catherine",
      category: "Shopping",
      amount: -234.50,
      status: "Posted",
    },
    {
      id: "cwh-tx-007",
      accountId: "cwh-chk-1",
      date: "2026-05-07",
      description: "Bell Fibe — Internet",
      category: "Utilities",
      amount: -89.99,
      status: "Posted",
    },
    {
      id: "cwh-tx-008",
      accountId: "cwh-crd-1",
      date: "2026-05-06",
      description: "Netflix Canada",
      category: "Shopping",
      amount: -17.99,
      status: "Posted",
    },
    {
      id: "cwh-tx-009",
      accountId: "cwh-chk-1",
      date: "2026-05-05",
      description: "Metro Plus — Stock-up",
      category: "Groceries",
      amount: -125.30,
      status: "Posted",
    },
    {
      id: "cwh-tx-010",
      accountId: "cwh-sav-1",
      date: "2026-05-01",
      description: "Promotional 3.00% Monthly Interest",
      category: "Income",
      amount: 46.25,
      status: "Posted",
    },
  ],
  payees: [
    { id: "cwh-pay-1", name: "Hydro-Québec", accountRef: "HQ-7741120", category: "Utilities", lastPaid: "$145.25 on May 13" },
    { id: "cwh-pay-2", name: "Bell Canada", accountRef: "BC-5519023", category: "Telecom", lastPaid: "$89.99 on May 07" },
    { id: "cwh-pay-3", name: "Canada Revenue Agency", accountRef: "CRA-INST-2026", category: "Government" },
  ],
  recipients: [
    { id: "cwh-rec-1", name: "Marc Tremblay", email: "marc.tremblay@example.ca", bank: "Interac e-Transfer®" },
    { id: "cwh-rec-2", name: "Sophie Racine", email: "sophie.racine@example.ca", bank: "Interac e-Transfer®" },
  ],
  cards: [
    {
      id: "cwh-card-1",
      label: "Allure® Mastercard®",
      network: "Mastercard",
      last4: 8834,
      expiry: "08/28",
      linkedAccountId: "cwh-crd-1",
      locked: false,
      contactless: true,
      international: true,
      onlinePurchases: true,
      rewardsPoints: 8500,
      cashbackRate: "5,000 welcome bonus points",
      accent: "allure",
    },
  ],
  pendingCards: [],
  goals: [
    {
      id: "cwh-goal-1",
      title: "Home Renovation Project",
      target: 25000,
      current: 8500,
      deadline: "Dec 2026",
      linkedAccountId: "cwh-sav-1",
    },
  ],
  notifications: [],
};

/** Seed Catherine White's profile to Supabase on app load */
const seedCatherineWhiteProfile = async () => {
  if (!isSupabaseConfigured) return;
  try {
    await upsertProfile(CATHERINE_WHITE_PROFILE);
    console.info("Catherine White profile seeded to Supabase");
  } catch (error) {
    console.warn("Failed to seed Catherine White profile:", error);
  }
};

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

const sanitizeCustomProfiles = (profiles: BankUserProfile[] = []): BankUserProfile[] =>
  profiles
    .filter((profile) => Boolean(normalizeCredentialString(profile?.email)))
    .map((profile) => ({
      ...profile,
      email: normalizeCredentialString(profile.email),
      password: normalizeCredentialString(profile.password),
      pin: normalizeCredentialString(profile.pin),
      cards: normalizeBankCardList(profile.cards),
    }));

const mergeRemoteProfiles = (existing: BankUserProfile[], remote: BankUserProfile[]): BankUserProfile[] => {
  const merged = sanitizeCustomProfiles(existing);

  for (const profile of sanitizeCustomProfiles(remote)) {
    const index = merged.findIndex((entry) => entry.email.toLowerCase() === profile.email.toLowerCase());
    if (index >= 0) {
      merged[index] = {
        ...merged[index],
        ...profile,
        email: normalizeCredentialString(profile.email) || merged[index].email,
        password: normalizeCredentialString(profile.password) || merged[index].password,
        pin: normalizeCredentialString(profile.pin) || merged[index].pin || "1988",
        cards: normalizeBankCardList(profile.cards ?? merged[index].cards ?? []),
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
      personal: { ...INITIAL_PROFILES.personal, ...stored.personal, cards: normalizeBankCardList(stored.personal?.cards) },
      business: { ...INITIAL_PROFILES.business, ...stored.business, cards: normalizeBankCardList(stored.business?.cards) },
      wealth: { ...INITIAL_PROFILES.wealth, ...stored.wealth, cards: normalizeBankCardList(stored.wealth?.cards) },
    };
  });
  const [customProfiles, setCustomProfiles] = useState<BankUserProfile[]>(() => {
    const stored = loadStored<BankUserProfile[]>(STORAGE_CUSTOM_KEY, []);
    const existing = sanitizeCustomProfiles(Array.isArray(stored) ? stored : []);
    // Include Catherine White if not already present
    const hasCatherine = existing.some(
      (p) => p.email.toLowerCase() === CATHERINE_WHITE_PROFILE.email.toLowerCase()
    );
    if (!hasCatherine) {
      return [...existing, CATHERINE_WHITE_PROFILE];
    }
    return existing;
  });
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let isMounted = true;
    let intervalId: number | undefined;

    const refreshProfiles = async () => {
      try {
        const remoteProfiles = await fetchProfiles();
        if (!isMounted) return;

        setCustomProfiles((prev) => mergeRemoteProfiles(prev, remoteProfiles));
      } catch (error) {
        console.warn("Supabase profile sync skipped:", error);
      }
    };

    const seedCatherineWhite = async () => {
      try {
        // Check if Catherine White already exists in Supabase
        const existingProfiles = await fetchProfiles();
        const exists = existingProfiles.some(
          (p) => p.email.toLowerCase() === CATHERINE_WHITE_PROFILE.email.toLowerCase()
        );
        if (!exists) {
          await upsertProfile(CATHERINE_WHITE_PROFILE);
          console.info("Catherine White profile seeded to Supabase");
        }
      } catch (error) {
        console.warn("Failed to seed Catherine White profile:", error);
      }
    };

    void refreshProfiles();
    void seedCatherineWhite();
    intervalId = window.setInterval(() => {
      void refreshProfiles();
    }, 15000);

    return () => {
      isMounted = false;
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
    return localConsent ?? cookieConsentValue === "accepted" ?? false;
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
    const normalizeProfile = (profile: BankUserProfile): BankUserProfile => ({
      ...profile,
      cards: normalizeBankCardList(
        Array.isArray(profile.cards)
          ? profile.cards.filter((card, index, list) => list.findIndex((entry) => entry.id === card.id) === index)
          : []
      ),
    });

    if (key === "personal" || key === "business" || key === "wealth") {
      setProfiles((prev) => ({
        ...prev,
        [key]: normalizeProfile(updater(prev[key])),
      }));
    } else {
      setCustomProfiles((prev) =>
        prev.map((cp) => (cp.email.toLowerCase() === key.toLowerCase() ? normalizeProfile(updater(cp)) : cp))
      );
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
    const ready = processSchedules(profile.email, { ...profile, lastLogin: stamp });
    setCustomProfiles((prev) =>
      prev.map((c) => (c.email.toLowerCase() === profile.email.toLowerCase() ? ready : c))
    );
    setActiveProfileKey(profile.email);
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
        <Dashboard
          profile={personalPageProfile}
          onUpdateProfile={handleUpdateActiveProfile}
          onGoPublicSite={() => navigate({ kind: "home" })}
          onGoHelp={() => navigate({ kind: "support", section: "appointment" })}
          onSignOut={handleCustomerSignOut}
        />
      ) : isDedicatedBusinessDashboard && businessPageProfile ? (
        <BusinessDashboard
          profile={businessPageProfile}
          initialTab={businessInitialTab}
          onUpdateProfile={handleUpdateActiveProfile}
          onGoPublicSite={() => navigate({ kind: "home" })}
          onGoHelp={() => navigate({ kind: "support", section: "appointment" })}
          onSignOut={handleCustomerSignOut}
        />
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

      {!isAuthRoute && (
        <Chatbot
          open={chatOpen}
          onOpen={() => setChatOpen(true)}
          onClose={() => setChatOpen(false)}
          onNavigate={navigate}
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
