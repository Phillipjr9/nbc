import { useEffect, useMemo, useState } from "react";
import {
  AuditLogEntry,
  BankUserProfile,
  GlobalBankConfig,
  INITIAL_BANK_CONFIG,
  INITIAL_PROFILES,
  PageRoute,
  Transaction,
} from "./banking/bankingTypes";
import {
  AdminIdentity,
  AdminOps,
  ApprovalRequest,
  ManagedUserEntry,
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

const STORAGE_PROFILES_KEY = "nbc_profiles_v1";
const STORAGE_CUSTOM_KEY = "nbc_custom_profiles_v1";
const STORAGE_SESSION_KEY = "nbc_active_session_v1";
const STORAGE_ADMIN_AUTH_KEY = "nbc_admin_session_v1";
const STORAGE_CONFIG_KEY = "nbc_bank_config_v1";
const STORAGE_AUDIT_KEY = "nbc_audit_logs_v1";

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

const STARTER_CUSTOM_PROFILE: BankUserProfile = {
  ...INITIAL_PROFILES.business,
  fullName: "Phillip Johnson",
  roleLabel: "Business (SME) Banking",
  email: "phillip@nbc.ca",
  password: "Business2026!",
  pin: "4682",
  memberSince: "2026",
  branchName: "Commercial Centre — Ottawa, ON",
  advisorName: "Marie Lambert, Senior Commercial Account Manager",
  businessNumber: "BN 10204-7731 RC0001 · NEQ 1182149234",
  phone: "+1 (613) 555-0194",
  address: "1205 Wellington Street",
  city: "Ottawa",
  province: "ON",
  postalCode: "K1Y 1A6",
  lastLogin: "Just now",
};

const createSwiftdeviceTransactions = (): Transaction[] => {
  const entries: Transaction[] = [];
  const startDate = new Date("2024-02-02T00:00:00");
  const endDate = new Date();

  const totalMonths =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth()) +
    1;

  const formatDate = (target: Date) =>
    `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;

  const accountTargets: Record<string, number> = {
    "swift-chk": 1842782.55,
    "swift-treasury": 2993290.9,
    "swift-usd": 642750.86,
    "swift-cred": 46280.33,
  };

  const accountNarratives: Record<string, string[]> = {
    "swift-chk": [
      "Operating transfer settlement",
      "Treasury sweep transfer",
      "Commercial receivable transfer",
      "Expense funding transfer",
      "Payroll transfer",
      "Vendor settlement transfer",
    ],
    "swift-treasury": [
      "Reserve funding transfer",
      "Intercompany liquidity transfer",
      "Treasury allocation transfer",
      "Investment maturity transfer",
      "Reserve release transfer",
      "Capital rebalancing transfer",
    ],
    "swift-usd": [
      "Cross-border settlement transfer",
      "U.S. distributor transfer",
      "FX conversion transfer",
      "Global receivable transfer",
      "North American settle transfer",
      "USD treasury transfer",
    ],
    "swift-cred": [
      "Credit line draw transfer",
      "Supplier financing transfer",
      "Revolving credit transfer",
      "Working capital transfer",
      "Card rebate transfer",
      "Consolidated credit transfer",
    ],
  };

  Object.entries(accountTargets).forEach(([accountId, targetBalance]) => {
    let netLedgerBalance = 0;
    const narratives = accountNarratives[accountId] ?? ["Transfer"];

    for (let monthIndex = 0; monthIndex < totalMonths; monthIndex += 1) {
      const currentMonthStart = new Date(startDate.getFullYear(), startDate.getMonth() + monthIndex, 1);
      const maxDayInMonth = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + 1, 0).getDate();
      const monthLimit =
        currentMonthStart.getFullYear() === endDate.getFullYear() && currentMonthStart.getMonth() === endDate.getMonth()
          ? endDate.getDate()
          : maxDayInMonth;

      const transactionsPerMonth = accountId === "swift-cred" ? 5 : 6;

      for (let txIndex = 0; txIndex < transactionsPerMonth; txIndex += 1) {
        const day = Math.min(monthLimit, Math.max(2, 3 + txIndex * 4 + ((monthIndex + txIndex) % 5)));
        const dateObj = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth(), day);
        const date = formatDate(dateObj);
        const monthlyDrift = monthIndex * 8500 + txIndex * 2300;
        const variance = 1 + ((monthIndex + txIndex) % 4) * 0.18;
        const baseMagnitude = 12500 + monthlyDrift + (accountId === "swift-treasury" ? 21000 : 0);
        const signedAmount = Number((baseMagnitude * variance * (txIndex % 2 === 0 ? 1 : -1)).toFixed(2));
        const adjustedAmount = accountId === "swift-cred" ? signedAmount / 2 : signedAmount;
        const amount = Number((adjustedAmount + (txIndex % 3 === 0 ? 248.66 : 0)).toFixed(2));
        netLedgerBalance += amount;

        entries.push({
          id: `swift-${accountId}-${date}-${String(txIndex + 1).padStart(2, "0")}`,
          accountId,
          date,
          description: narratives[(monthIndex + txIndex) % narratives.length],
          category: "Transfer",
          amount,
          balanceAfter: Number(netLedgerBalance.toFixed(2)),
          status: "Posted",
        });
      }
    }

    const reconcileDifference = Number((targetBalance - netLedgerBalance).toFixed(2));
    const reconcileDate = formatDate(new Date(endDate.getFullYear(), endDate.getMonth(), Math.min(endDate.getDate(), 28)));

    if (Math.abs(reconcileDifference) > 0.01) {
      entries.push({
        id: `swift-${accountId}-reconcile-${reconcileDate}`,
        accountId,
        date: reconcileDate,
        description: "Balance reconciliation transfer",
        category: "Transfer",
        amount: reconcileDifference,
        balanceAfter: Number((netLedgerBalance + reconcileDifference).toFixed(2)),
        status: "Posted",
      });
    }
  });

  return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const getFreshSwiftdeviceProfile = (): BankUserProfile => ({
  ...SWIFDEVICE_CUSTOM_PROFILE,
  transactions: createSwiftdeviceTransactions(),
});

const SWIFDEVICE_CUSTOM_PROFILE: BankUserProfile = {
  id: "business",
  accountKind: "business",
  status: "active",
  fullName: "Catherine White",
  roleLabel: "Business (SME) Banking",
  email: "catherine.white@swiftdevice.ca",
  password: "Swiftdevice2025!",
  pin: "1988",
  memberSince: "2023",
  branchName: "Commercial Centre — Toronto, ON",
  advisorName: "Natalie Harper, Senior Business Advisor",
  businessNumber: "Swiftdevice LLC — Client account 2025",
  phone: "+1 (416) 555-0148",
  address: "180 King Street West",
  city: "Toronto",
  province: "ON",
  postalCode: "M5H 1J9",
  notes: "Commercial account for Swiftdevice LLC, focused on device distribution and enterprise hardware deployments.",
  lastLogin: "Today",
  accounts: [
    {
      id: "swift-chk",
      name: "Business Operating Account",
      number: "0006-14480-33",
      category: "chequing",
      balance: 1842782.55,
      currency: "CAD",
      subtitle: "Large enterprise receivables and vendor settlement",
    },
    {
      id: "swift-treasury",
      name: "Treasury Reserve Account",
      number: "0006-14480-88",
      category: "savings",
      balance: 2993290.90,
      currency: "CAD",
      rate: "1.85% yield",
      subtitle: "Operational reserve for 2025 hardware pipeline",
    },
    {
      id: "swift-usd",
      name: "U.S. Settlement Account",
      number: "0006-14480-91",
      category: "chequing",
      balance: 642750.86,
      currency: "USD",
      subtitle: "Global distributor settlements",
    },
    {
      id: "swift-cred",
      name: "Business Credit Line",
      number: "BL-330125",
      category: "credit",
      balance: 46280.33,
      limit: 800000,
      currency: "CAD",
      rate: "6.25%",
      subtitle: "Available limit: $753,720.00",
    },
  ],
  transactions: createSwiftdeviceTransactions(),
  payees: [
    { id: "swift-pay-1", name: "Revenu Québec — Source deductions", accountRef: "RQ-SWIFT-2025", category: "Tax" },
    { id: "swift-pay-2", name: "CIBC Commercial Lease", accountRef: "CIBC-LEASE-1186", category: "Operations" },
    { id: "swift-pay-3", name: "NorthAmerica Logistics Ltd.", accountRef: "NAL-44712", category: "Shipping" },
  ],
  recipients: [
    { id: "swift-rec-1", name: "Northstar Retail Group", email: "ap@northstarretail.example", bank: "Wire transfer" },
    { id: "swift-rec-2", name: "PeakWorks Distribution", email: "settlements@peakworks.example", bank: "Interac e-Transfer®" },
    { id: "swift-rec-3", name: "CityView Developments", email: "payments@cityview.example", bank: "Wire transfer" },
  ],
  cards: [
    {
      id: "swift-card-1",
      label: "Swiftdevice Business Mastercard",
      network: "Mastercard",
      last4: "1528",
      expiry: "07/29",
      cvv: "841",
      cardholderName: "CATHERINE WHITE",
      monthlyLimit: 80000,
      linkedAccountId: "swift-cred",
      locked: false,
      contactless: true,
      international: true,
      onlinePurchases: true,
      rewardsPoints: 286400,
      cashbackRate: "1.25% on corporate spend",
      accent: "business",
      status: "active",
      issuedAt: "2024-11-13",
    },
  ],
  goals: [
    {
      id: "swift-goal-1",
      title: "Ontario Distribution Expansion Reserve",
      target: 1800000,
      current: 1265000,
      deadline: "Dec 2025",
      linkedAccountId: "swift-treasury",
    },
    {
      id: "swift-goal-2",
      title: "Technology Procurement Reserve",
      target: 950000,
      current: 620000,
      deadline: "Mar 2026",
      linkedAccountId: "swift-treasury",
    },
  ],
  payrollRoster: [
    { id: "swift-emp-1", name: "Alicia Morgan", role: "Finance Director", biweeklyNet: 6200, department: "Finance", active: true },
    { id: "swift-emp-2", name: "Daniel Park", role: "Operations Manager", biweeklyNet: 5400, department: "Operations", active: true },
    { id: "swift-emp-3", name: "Monique Tremblay", role: "Procurement Lead", biweeklyNet: 4760, department: "Procurement", active: true },
    { id: "swift-emp-4", name: "Ethan Ross", role: "Sales Director", biweeklyNet: 6100, department: "Sales", active: true },
  ],
  invoices: [
    { id: "swift-inv-1", invoiceNo: "INV-2025-410", clientName: "Northstar Retail Group", amount: 24358.42, currency: "CAD", dueDate: "2025-01-20", status: "Paid" },
    { id: "swift-inv-2", invoiceNo: "INV-2025-511", clientName: "CityView Developments", amount: 18422.15, currency: "CAD", dueDate: "2025-02-08", status: "Paid" },
    { id: "swift-inv-3", invoiceNo: "INV-2025-602", clientName: "Harborline Logistics", amount: 31640.71, currency: "CAD", dueDate: "2025-02-22", status: "Paid" },
    { id: "swift-inv-4", invoiceNo: "INV-2025-714", clientName: "Summit Retail Group", amount: 67250.91, currency: "CAD", dueDate: "2025-04-11", status: "Open" },
    { id: "swift-inv-5", invoiceNo: "INV-2025-819", clientName: "Northshore Health Services", amount: 88340.46, currency: "CAD", dueDate: "2025-06-28", status: "Open" },
    { id: "swift-inv-6", invoiceNo: "INV-2025-922", clientName: "Atlas Mobility", amount: 94265.17, currency: "CAD", dueDate: "2025-08-18", status: "Paid" },
  ],
  scheduled: [
    {
      id: "swift-sch-1",
      fromAccountId: "swift-chk",
      toAccountId: "swift-treasury",
      kind: "internal",
      amount: 75000,
      frequency: "monthly",
      nextDate: "2026-01-15",
      description: "Treasury reserve transfer",
      active: true,
    },
  ],
};

const DEFAULT_CUSTOM_PROFILES = [STARTER_CUSTOM_PROFILE, SWIFDEVICE_CUSTOM_PROFILE];

const PIN_BY_EMAIL: Record<string, string> = {
  "phillip@nbc.ca": STARTER_CUSTOM_PROFILE.pin ?? "4682",
  "catherine.white@swiftdevice.ca": SWIFDEVICE_CUSTOM_PROFILE.pin ?? "1988",
  "comptabilite@ateliernord.ca": INITIAL_PROFILES.business.pin ?? "2486",
};

export default function App() {
  const [route, setRoute] = useState<PageRoute>(() => hashToRoute(window.location.hash));
  const [searchOpen, setSearchOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const [profiles, setProfiles] = useState<Record<"personal" | "business" | "wealth", BankUserProfile>>(() =>
    loadStored(STORAGE_PROFILES_KEY, INITIAL_PROFILES)
  );
  const [customProfiles, setCustomProfiles] = useState<BankUserProfile[]>(() => {
    const stored = loadStored<BankUserProfile[]>(STORAGE_CUSTOM_KEY, DEFAULT_CUSTOM_PROFILES);
    const merged = stored.map((item) => {
      const email = item.email?.toLowerCase();
      if (!email) return item;

      if (email === SWIFDEVICE_CUSTOM_PROFILE.email.toLowerCase()) {
        return {
          ...getFreshSwiftdeviceProfile(),
          ...item,
          pin: SWIFDEVICE_CUSTOM_PROFILE.pin ?? "1988",
          transactions: createSwiftdeviceTransactions(),
        };
      }

      const fallbackPin = PIN_BY_EMAIL[email];
      if (fallbackPin && (!item.pin || item.pin.trim() === "")) {
        return { ...item, pin: fallbackPin };
      }

      return item;
    });

    for (const candidate of DEFAULT_CUSTOM_PROFILES) {
      const found = merged.some((item) => item.email.toLowerCase() === candidate.email.toLowerCase());
      if (!found) {
        merged.push(candidate);
      }
    }

    return merged;
  });
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let isMounted = true;

    void (async () => {
      try {
        const remoteProfiles = await fetchProfiles();
        if (!isMounted || remoteProfiles.length === 0) return;

        setCustomProfiles((prev) => {
          const merged = [...prev];

          for (const remote of remoteProfiles) {
            const index = merged.findIndex((entry) => entry.email.toLowerCase() === remote.email.toLowerCase());
            if (index >= 0) {
              merged[index] = {
                ...merged[index],
                ...remote,
                pin: remote.pin || merged[index].pin || "1988",
              };
            } else {
              merged.push(remote);
            }
          }

          return merged;
        });
      } catch (error) {
        console.warn("Supabase profile sync skipped:", error);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const [activeProfileKey, setActiveProfileKey] = useState<string | null>(() =>
    loadStored<string | null>(STORAGE_SESSION_KEY, null)
  );
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
      window.localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(activeProfileKey));
    } catch {
      // ignore
    }
  }, [activeProfileKey]);

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
      return { kind: "business-dashboard", tab: "cash-position" };
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
    if (key === "personal" || key === "business" || key === "wealth") {
      setProfiles((prev) => ({
        ...prev,
        [key]: updater(prev[key]),
      }));
    } else {
      setCustomProfiles((prev) =>
        prev.map((cp) => (cp.email.toLowerCase() === key.toLowerCase() ? updater(cp) : cp))
      );
    }
    if (logAction && logDetail) {
      appendAudit(logAction, logDetail, severity);
    }
  };

  const openDashboardForProfile = (profile: BankUserProfile) => {
    navigate(
      isBusinessProfile(profile)
        ? { kind: "business-dashboard", tab: "cash-position" }
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
          initialTab="treasury"
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

      <Footer
        onNavigate={navigate}
        isSignedIn={Boolean(activeProfile)}
        dashboardRoute={activeDashboardRoute}
      />

      <Chatbot
        open={chatOpen}
        onOpen={() => setChatOpen(true)}
        onClose={() => setChatOpen(false)}
        onNavigate={navigate}
      />
      <SearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={navigate}
      />
    </div>
  );
}
