import {
  AccountCategory,
  BankAccount,
  BankCard,
  BankUserProfile,
  Payee,
  Recipient,
  PendingCard,
  SavingsGoal,
  Transaction,
} from "../banking/bankingTypes";

export type ManagedUserEntry = {
  key: string;
  builtIn: boolean;
  profile: BankUserProfile;
};

export type AdminTabId =
  | "overview"
  | "clients"
  | "accounts"
  | "transactions"
  | "cards"
  | "operations"
  | "approvals"
  | "config"
  | "audit";

/* ------------------------------------------------------------------ *
 * Administrator identity, roles & permissions
 * ------------------------------------------------------------------ */

// Single super-administrator role — all admin permissions granted.
export type AdminRole = "superadmin";

export type AdminIdentity = {
  name: string;
  email: string;
  role: AdminRole;
};

export type AdminPermission =
  | "clients.create"
  | "clients.edit"
  | "clients.delete"
  | "clients.freeze"
  | "accounts.adjust"
  | "accounts.close"
  | "transactions.post"
  | "transactions.reverse"
  | "transactions.pause"
  | "transactions.delete"
  | "cards.issue"
  | "cards.revoke"
  | "config.publish"
  | "ops.run"
  | "approvals.act"
  | "impersonate"
  | "system.reset";

export const ROLE_LABEL: Record<AdminRole, string> = {
  superadmin: "Super administrator",
};

/**
 * Provisioned administrator accounts.
 * In a production deployment these would live server-side with hashed credentials.
 */
export type AdminAccountRecord = AdminIdentity & { password: string };

export const ADMIN_ACCOUNTS: AdminAccountRecord[] = [
  {
    name: "Marie Deschamps",
    email: "admin@nbc.ca",
    role: "superadmin",
    password: "admin1234",
  },
];

export type AdminAuthResult =
  | { ok: true; identity: AdminIdentity }
  | { ok: false; error: string };

export function authenticateAdmin(email: string, password: string): AdminAuthResult {
  const clean = email.trim().toLowerCase();
  const pass = password.trim();
  if (!clean || !pass) {
    return { ok: false, error: "Enter your employee email and passcode." };
  }
  const record = ADMIN_ACCOUNTS.find((a) => a.email === clean);
  if (!record) {
    return { ok: false, error: "No administrator account matches that email address." };
  }
  if (record.password !== pass) {
    return { ok: false, error: "Incorrect passcode. Check your credentials and try again." };
  }
  return {
    ok: true,
    identity: { name: record.name, email: record.email, role: record.role },
  };
}

<<<<<<< HEAD
export function can(_identity: AdminIdentity | null, _permission: AdminPermission): boolean {
  // Single super-administrator role — all permissions granted.
  return true;
=======
export function can(identity: AdminIdentity | null, permission: AdminPermission): boolean {
  if (!identity) return false;
  const allowed = ROLE_PERMISSIONS[identity.role];
  return allowed === "*" || allowed.includes(permission);
>>>>>>> origin/arena/4558a41e-nbc
}

/* ------------------------------------------------------------------ *
 * Maker-checker approvals
 * ------------------------------------------------------------------ */

export type ApprovalActionType =
  | "balance.override"
  | "account.close"
  | "transaction.post"
  | "card.issue"
  | "card.replace"
  | "card.pin.change"
  | "card.lost"
  | "config.publish"
  | "client.delete";

export type ApprovalRequest = {
  id: string;
  requestedAt: string;
  requestedBy: string;
  action: ApprovalActionType;
  label: string;
  detail: string;
  targetKey: string;
  payload?: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  decidedAt?: string;
  decidedBy?: string;
};

export type AdminPanelProps = {
  ops: AdminOps;
  selectedKey: string;
  onSelectKey: (key: string) => void;
  onOpenTab: (tab: AdminTabId, key?: string) => void;
  autoCreate?: number;
};

export type AdminOps = {
  users: ManagedUserEntry[];
  identity: AdminIdentity | null;
  approvals: ApprovalRequest[];
  onRequestApproval: (request: Omit<ApprovalRequest, "id" | "requestedAt" | "status">) => void;
  onDecideApproval: (id: string, decision: "approved" | "rejected") => void;
  onRestoreBackup: (payload: { users: BankUserProfile[]; bankConfig?: Record<string, unknown> }) => void;
  onSetIdentity: (identity: AdminIdentity | null) => void;
  onUpdateUser: (
    key: string,
    updater: (prev: BankUserProfile) => BankUserProfile,
    action: string,
    detail: string,
    severity?: "info" | "warning" | "critical"
  ) => void;
  onCreateUser: (profile: BankUserProfile) => void;
  onDeleteCustomUser: (email: string) => void;
  onImpersonateUser: (key: string) => void;
  notify: (message: string) => void;
};

export const ADMIN_ACTOR = "Administration";

export const PROVINCES = ["QC", "ON", "BC", "AB", "MB", "SK", "NS", "NB", "NL", "PE"];

export const BRANCHES = [
  "Place Ville Marie, Montreal, QC",
  "King Street West, Toronto, ON",
  "Laurier Boulevard, Quebec City, QC",
  "Sparks Street, Ottawa, ON",
  "Burrard Street, Vancouver, BC",
  "Stephen Avenue, Calgary, AB",
  "Portage Avenue, Winnipeg, MB",
  "Barrington Street, Halifax, NS",
  "Commercial Centre, Saint-Laurent, QC",
  "Private Banking 1859, Montreal Downtown",
];

export const ADVISORS = [
  "Sophie Gagnon, Financial Advisor",
  "David Chen, Senior Commercial Account Manager",
  "Jean-François Mercier, Private Banker",
  "Amélie Roy, Mortgage Specialist",
  "Karim Haddad, Business Advisor",
  "Unassigned",
];

export const TX_CATEGORIES: Transaction["category"][] = [
  "Income",
  "Transfer",
  "Utilities",
  "Groceries",
  "Dining",
  "Shopping",
  "Housing",
  "Investments",
  "Business",
];

export const ACCOUNT_CATEGORIES: { value: AccountCategory; label: string }[] = [
  { value: "chequing", label: "Chequing" },
  { value: "savings", label: "Savings" },
  { value: "credit", label: "Credit card" },
  { value: "loan", label: "Loan / Mortgage / Line of credit" },
  { value: "investment", label: "Investment" },
];

/** Business (SME) account products offered by the commercial team. */
export type AccountProductPreset = {
  id: string;
  label: string;
  name: string;
  category: AccountCategory;
  currency: "CAD" | "USD";
  rate?: string;
  monthlyFee?: string;
  description: string;
  limit?: number;
  segment: "personal" | "business" | "wealth";
};

export const ACCOUNT_PRODUCTS: AccountProductPreset[] = [
  {
    id: "biz-operating",
    label: "Business Operating Account (CAD)",
    name: "CDN Business Operating Account",
    category: "chequing",
    currency: "CAD",
    monthlyFee: "$20.00 / month",
    description: "Unlimited electronic debits, EFT payroll and Interac e-Transfer®.",
    segment: "business",
  },
  {
    id: "biz-operating-usd",
    label: "Business Operating Account (USD)",
    name: "U.S. Dollar Business Account",
    category: "chequing",
    currency: "USD",
    monthlyFee: "$20.00 / month",
    description: "Cross-border settlements and USD supplier payments.",
    segment: "business",
  },
  {
    id: "biz-investment",
    label: "Business Investment Account",
    name: "Business Investment Account",
    category: "savings",
    currency: "CAD",
    rate: "1.70% (incl. 0.05% bonus)",
    description: "Tiered daily interest with full liquidity for treasury reserves.",
    segment: "business",
  },
  {
    id: "biz-platinum",
    label: "Business Platinum Mastercard®",
    name: "Business Platinum Mastercard®",
    category: "credit",
    currency: "CAD",
    rate: "14.99%",
    limit: 50000,
    description: "Employee cards, expense controls and 1.5 points per $1.",
    segment: "business",
  },
  {
    id: "biz-loc",
    label: "Operating Line of Credit",
    name: "Operating Line of Credit",
    category: "loan",
    currency: "CAD",
    rate: "5.45% (prime + 0.75%)",
    limit: 150000,
    description: "Revolving credit for inventory, receivables and working capital.",
    segment: "business",
  },
  {
    id: "biz-equipment",
    label: "Equipment & Expansion Loan",
    name: "Equipment & Expansion Loan",
    category: "loan",
    currency: "CAD",
    rate: "6.20% fixed",
    limit: 250000,
    description: "Amortising term financing for machinery and expansion projects.",
    segment: "business",
  },
  {
    id: "personal-chequing",
    label: "Total Chequing Account",
    name: "Total Chequing Account",
    category: "chequing",
    currency: "CAD",
    monthlyFee: "$15.95 / month",
    description: "Unlimited electronic transactions and free e-Transfers.",
    segment: "personal",
  },
  {
    id: "personal-savings",
    label: "Cash Advantage Solution",
    name: "Cash Advantage Solution",
    category: "savings",
    currency: "CAD",
    rate: "3.00% promo",
    description: "Promotional high-interest savings with no minimum balance.",
    segment: "personal",
  },
  {
    id: "personal-tfsa",
    label: "Tax-Free Savings Account (TFSA)",
    name: "Tax-Free Savings Account (TFSA)",
    category: "investment",
    currency: "CAD",
    rate: "+7.4% YTD",
    description: "Registered tax-free investment portfolio.",
    segment: "personal",
  },
  {
    id: "personal-allure",
    label: "Allure® Mastercard®",
    name: "Allure® Mastercard®",
    category: "credit",
    currency: "CAD",
    rate: "20.99%",
    limit: 12000,
    description: "Everyday rewards with support for breast cancer research.",
    segment: "personal",
  },
  {
    id: "wealth-1859",
    label: "Private Banking 1859 Cash Management",
    name: "Private Banking 1859 Cash Management",
    category: "chequing",
    currency: "CAD",
    monthlyFee: "$0 with relationship",
    description: "Concierge banking and global wire privileges.",
    segment: "wealth",
  },
  {
    id: "wealth-managed",
    label: "NBF Managed Portfolio",
    name: "NBF Managed RRSP Portfolio",
    category: "investment",
    currency: "CAD",
    rate: "+9.1% YTD",
    description: "Discretionary managed portfolio from National Bank Financial.",
    segment: "wealth",
  },
];

export type CardTemplate = {
  label: string;
  accent: BankCard["accent"];
  network: BankCard["network"];
  points: number;
  limit: number;
  perks: string;
};

export const CARD_TEMPLATES: CardTemplate[] = [
  {
    label: "Allure® Mastercard®",
    accent: "allure",
    network: "Mastercard",
    points: 5000,
    limit: 12000,
    perks: "Up to 2% rewards + cause support",
  },
  {
    label: "World Elite® Mastercard®",
    accent: "world-elite",
    network: "Mastercard",
    points: 25000,
    limit: 40000,
    perks: "Travel insurance, lounge access, 2 pts/$1",
  },
  {
    label: "Business Platinum Mastercard®",
    accent: "business",
    network: "Mastercard",
    points: 10000,
    limit: 35000,
    perks: "Employee cards & expense controls",
  },
  {
    label: "Cashback World Mastercard®",
    accent: "allure",
    network: "Mastercard",
    points: 2500,
    limit: 9000,
    perks: "Automatic statement cashback",
  },
  {
    label: "National Bank Debit Mastercard",
    accent: "debit",
    network: "Debit",
    points: 0,
    limit: 3000,
    perks: "Everyday debit & ABM access",
  },
];

const CARD_BIN_PREFIX: Record<BankCard["accent"], string> = {
  allure: "541288246190",
  "world-elite": "545892103418",
  business: "552466108094",
  debit: "519140287315",
};

export const generateCardNumber = (accent: BankCard["accent"]): string => {
  const prefix = CARD_BIN_PREFIX[accent] ?? "0000000000000000";
  const suffix = randomDigits(16 - prefix.length);
  return `${prefix.slice(0, 4)} ${prefix.slice(4, 8)} ${prefix.slice(8, 12)} ${prefix.slice(12, 16)} ${suffix}`;
};

export const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
export const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
export const todayIso = () => new Date().toISOString().slice(0, 10);
export const nowStamp = () =>
  new Date().toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

export const lostStamp = () =>
  new Date().toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

export const pinStamp = () =>
  new Date().toISOString().slice(0, 10);

export const randomDigits = (count: number) =>
  Array.from({ length: count }, () => Math.floor(Math.random() * 10)).join("");

export const makeAccountNumber = (category: AccountCategory, currency: "CAD" | "USD") => {
  const suffix = currency === "USD" ? "88" : category === "credit" ? "45" : category === "loan" ? "60" : "10";
  return `0006-${randomDigits(5)}-${suffix}`;
};

export const maskSin = (sin?: string) => (sin ? `••• ••• ${sin.slice(-3)}` : "Not provided");

export const transactionSign = (type: "credit" | "debit", amount: number) =>
  type === "credit" ? Math.abs(amount) : -Math.abs(amount);

export type NewClientAccountInput = {
  id: string;
  label: string;
  name: string;
  category: AccountCategory;
  currency: "CAD" | "USD";
  balance: number;
  rate?: string;
  limit?: number;
  include: boolean;
};

export type NewClientInput = {
  segment: "personal" | "business" | "wealth";
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  dateOfBirth?: string;
  sin?: string;
  businessNumber?: string;
  branchName: string;
  advisorName: string;
  notes?: string;
  accounts: NewClientAccountInput[];
  card?: CardTemplate | null;
  goal?: { title: string; target: number } | null;
};

const buildAccount = (input: NewClientAccountInput): BankAccount => ({
  id: newId(input.category),
  name: input.name.trim() || input.label,
  number: makeAccountNumber(input.category, input.currency),
  category: input.category,
  balance: round2(Math.abs(input.balance)),
  currency: input.currency,
  rate: input.rate?.trim() || undefined,
  limit:
    input.category === "credit" || input.category === "loan"
      ? round2(input.limit || Math.max(input.balance, 10000))
      : undefined,
  subtitle:
    input.category === "credit"
      ? `Admin-issued · available credit ${input.limit ? input.limit.toLocaleString() : "10,000"}`
      : input.category === "loan"
      ? "Administration booked facility"
      : "Opened by National Bank administration",
});

export function buildManagedProfile(input: NewClientInput): BankUserProfile {
  const included = input.accounts.filter((a) => a.include);
  const builtAccounts = included.map(buildAccount);
  const cheque = builtAccounts.find((a) => a.category === "chequing") ?? builtAccounts[0];
  const savings = builtAccounts.find((a) => a.category === "savings");

  const cards: BankCard[] = [];
  if (input.card && cheque) {
    const creditAcc = builtAccounts.find((a) => a.category === "credit");
    cards.push({
      id: newId("card"),
      label: input.card.label,
      network: input.card.network,
      number: generateCardNumber(input.card.accent),
      last4: randomDigits(4),
      expiry: "05/30",
      cvv: randomDigits(3),
      cardholderName: input.fullName.toUpperCase().slice(0, 28),
      monthlyLimit: input.card.limit,
      linkedAccountId: creditAcc?.id ?? cheque.id,
      locked: false,
      contactless: true,
      international: true,
      onlinePurchases: true,
      rewardsPoints: input.card.points,
      cashbackRate: input.card.perks,
      accent: input.card.accent,
    });
  }

  const goals: SavingsGoal[] = input.goal
    ? [
        {
          id: newId("goal"),
          title: input.goal.title,
          target: Math.max(round2(input.goal.target), 100),
          current: round2(Math.max(0, savings?.balance ?? 0)),
          deadline: "Dec 2026",
          linkedAccountId: savings?.id ?? cheque?.id ?? "",
        },
      ]
    : [];

  const now = nowStamp();
  const openingTx: Transaction[] = builtAccounts
    .filter((a) => a.balance > 0)
    .map((a) => ({
      id: newId("tx"),
      accountId: a.id,
      date: todayIso(),
      description: `Opening balance — ${a.name}`,
      category: a.category === "credit" || a.category === "loan" ? "Transfer" : "Income",
      amount: a.balance,
      status: "Posted",
      reference: `OPN-${randomDigits(6)}`,
      createdBy: ADMIN_ACTOR,
    }));

  const isBiz = input.segment === "business";
  const isWealth = input.segment === "wealth";

  const payees: Payee[] = [
    { id: newId("payee"), name: "Hydro-Québec", accountRef: `HQ-${randomDigits(6)}`, category: "Utilities" },
    { id: newId("payee"), name: isBiz ? "Revenu Québec — Source Deductions" : "Bell Canada", accountRef: `REF-${randomDigits(6)}`, category: isBiz ? "Tax" : "Telecom" },
  ];

  const recipients: Recipient[] = [
    { id: newId("rec"), name: "National Bank Test Recipient", email: "recipient@example.ca", bank: "Interac e-Transfer®" },
  ];

  return {
    id: "custom",
    accountKind: input.segment,
    status: "active",
    fullName: input.fullName.trim(),
    roleLabel: isBiz ? "Business (SME) Banking" : isWealth ? "Private Banking 1859" : "Personal Banking",
    email: input.email.trim(),
    password: input.password.trim(),
    memberSince: String(new Date().getFullYear()),
    branchName: input.branchName,
    advisorName: input.advisorName,
    businessNumber: isBiz ? input.businessNumber?.trim() || `BN ${randomDigits(5)}-RC0001` : undefined,
    phone: input.phone?.trim() || undefined,
    address: input.address?.trim() || undefined,
    city: input.city?.trim() || undefined,
    province: input.province || undefined,
    postalCode: input.postalCode?.trim() || undefined,
    dateOfBirth: input.dateOfBirth || undefined,
    sin: input.sin?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    accounts: builtAccounts,
    transactions: openingTx,
    payees,
    recipients,
    cards,
    pendingCards: [],
    goals,
    payrollRoster: isBiz
      ? [
          { id: newId("emp"), name: "New Employee", role: "Staff", biweeklyNet: 2200, department: "Operations", active: true },
        ]
      : undefined,
    invoices: isBiz
      ? [
          {
            id: newId("inv"),
            invoiceNo: `INV-${randomDigits(4)}`,
            clientName: "First Client (edit me)",
            amount: 5000,
            currency: "CAD",
            dueDate: todayIso(),
            status: "Open",
          },
        ]
      : undefined,
    lastLogin: now,
  };
}

export type AdminTransactionInput = {
  accountId: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  category: Transaction["category"];
  status: "Posted" | "Pending" | "Failed";
  failureReason?: string;
  failureDetails?: string;
  date: string;
  applyBalance: boolean;
};

export function applyAdminTransaction(
  profile: BankUserProfile,
  input: AdminTransactionInput,
  actor = ADMIN_ACTOR
): BankUserProfile {
  const signed = transactionSign(input.type, input.amount);
  const tx: Transaction = {
    id: newId("tx"),
    accountId: input.accountId,
    date: input.date || todayIso(),
    description: input.description.trim() || "Administration entry",
    category: input.category,
    amount: signed,
    status: input.status,
    failureReason: input.status === "Failed" ? input.failureReason || "Other" : undefined,
    failureDetails: input.status === "Failed" ? input.failureDetails?.trim() || undefined : undefined,
    reference: `ADM-${randomDigits(6)}`,
    createdBy: actor,
  };

  const accounts = profile.accounts.map((a) => {
    if (!input.applyBalance || a.id !== input.accountId || input.status === "Pending") return a;
    const isDebt = a.category === "credit" || a.category === "loan";
    const next = isDebt ? Math.max(0, a.balance - signed) : Math.max(0, a.balance + signed);
    return { ...a, balance: round2(next) };
  });

  return {
    ...profile,
    accounts,
    transactions: [tx, ...profile.transactions].sort((a, b) => (a.date < b.date ? 1 : -1)),
  };
}

export function closeAccount(profile: BankUserProfile, accountId: string): BankUserProfile {
  return {
    ...profile,
    accounts: profile.accounts.filter((a) => a.id !== accountId),
    cards: profile.cards.filter((c) => c.linkedAccountId !== accountId),
    transactions: profile.transactions.filter((t) => t.accountId !== accountId),
    goals: profile.goals.filter((g) => g.linkedAccountId !== accountId),
  };
}

export function downloadFile(filename: string, content: string, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

export function statementCsv(profile: BankUserProfile, accountId = "all") {
  const rows = [
    ["National Bank of Canada — Account statement"],
    ["Client", profile.fullName, "Email", profile.email],
    ["Branch", profile.branchName, "Generated", nowStamp()],
    [],
    ["Date", "Account", "Description", "Category", "Debit", "Credit", "Status", "Reference", "Entered by"],
  ];
  const txs = profile.transactions.filter((t) => accountId === "all" || t.accountId === accountId);
  for (const tx of txs) {
    const acc = profile.accounts.find((a) => a.id === tx.accountId);
    rows.push([
      tx.date,
      acc?.name ?? tx.accountId,
      tx.description,
      tx.category,
      tx.amount < 0 ? Math.abs(tx.amount).toFixed(2) : "",
      tx.amount >= 0 ? tx.amount.toFixed(2) : "",
      tx.status ?? "Posted",
      tx.reference ?? "",
      tx.createdBy ?? "Client",
    ]);
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

export function auditCsv(logs: { timestamp: string; actor: string; action: string; detail: string; severity: string }[]) {
  const rows = [["Timestamp", "Actor", "Action", "Detail", "Severity"]];
  for (const l of logs) rows.push([l.timestamp, l.actor, l.action, l.detail, l.severity]);
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}


/* ------------------------------------------------------------------ *
 * Month-end batch processing
 * ------------------------------------------------------------------ */

export type BatchResult = { key: string; name: string; amount: number; description: string };

/** Posts one month of interest on every savings and investment account. */
export function batchPostInterest(users: ManagedUserEntry[], annualRate = 0.03): BatchResult[] {
  const out: BatchResult[] = [];
  for (const u of users) {
    for (const acc of u.profile.accounts) {
      if (acc.category !== "savings" && acc.category !== "investment") continue;
      if (acc.balance <= 0) continue;
      const monthly = Math.round(((acc.balance * annualRate) / 12) * 100) / 100;
      if (monthly <= 0) continue;
      out.push({
        key: u.key,
        name: u.profile.fullName,
        amount: monthly,
        description: `Monthly interest — ${acc.name}`,
      });
    }
  }
  return out;
}

/** Posts a monthly account fee on every chequing account. */
export function batchPostFees(users: ManagedUserEntry[], fee = 15.95): BatchResult[] {
  const out: BatchResult[] = [];
  for (const u of users) {
    for (const acc of u.profile.accounts) {
      if (acc.category !== "chequing") continue;
      out.push({
        key: u.key,
        name: u.profile.fullName,
        amount: fee,
        description: `Monthly account fee — ${acc.name}`,
      });
    }
  }
  return out;
}

/** Applies a batch result set to a profile (credit or debit). */
export function applyBatchToProfile(
  profile: BankUserProfile,
  items: { description: string; amount: number; type: "credit" | "debit"; accountMatch: (a: BankAccount) => boolean }[],
  actor: string
): BankUserProfile {
  let accounts = [...profile.accounts];
  const txs: Transaction[] = [];
  for (const item of items) {
    const target = accounts.find(item.accountMatch);
    if (!target) continue;
    const signed = item.type === "credit" ? Math.abs(item.amount) : -Math.abs(item.amount);
    const isDebt = target.category === "credit" || target.category === "loan";
    const next = isDebt ? Math.max(0, target.balance - signed) : Math.max(0, target.balance + signed);
    accounts = accounts.map((a) => (a.id === target.id ? { ...a, balance: round2(next) } : a));
    txs.push({
      id: newId("tx"),
      accountId: target.id,
      date: todayIso(),
      description: item.description,
      category: item.type === "credit" ? "Income" : "Utilities",
      amount: signed,
      status: "Posted",
      reference: `BAT-${randomDigits(6)}`,
      createdBy: actor,
    });
  }
  if (txs.length === 0) return profile;
  return { ...profile, accounts, transactions: [...txs, ...profile.transactions] };
}

/* ------------------------------------------------------------------ *
 * Backup validation
 * ------------------------------------------------------------------ */

export function parseBackup(raw: string): { users: BankUserProfile[]; bankConfig?: Record<string, unknown> } {
  const data = JSON.parse(raw) as { users?: unknown; bankConfig?: unknown };
  if (!Array.isArray(data.users)) throw new Error("Backup file has no client records.");
  const users = (data.users as BankUserProfile[]).filter(
    (u) => u && typeof u.email === "string" && Array.isArray(u.accounts)
  );
  if (users.length === 0) throw new Error("No valid client records found in the file.");
  return {
    users,
    bankConfig: (data.bankConfig as Record<string, unknown>) ?? undefined,
  };
}


/* ------------------------------------------------------------------ *
 * Historical / multi-year transaction generator
 * ------------------------------------------------------------------ */

export type GeneratorFrequency = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";

export type GeneratorInput = {
  fromDate: string; // YYYY-MM-DD
  toDate: string;   // YYYY-MM-DD
  frequency: GeneratorFrequency;
  minAmount: number;
  maxAmount: number;
  direction: "credit" | "debit" | "mixed";
  category: Transaction["category"];
  description: string;
  status: "Posted" | "Pending" | "Failed";
  failureReason?: string;
  failureDetails?: string;
  accountId: string;
  applyBalance: boolean;
};

export type GeneratedEntry = Omit<Transaction, "accountId"> & { accountId: string };

const FREQUENCY_DAYS: Record<GeneratorFrequency, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 91,
  yearly: 365,
};

export const MAX_GENERATED_ENTRIES = 600;

/**
 * Builds a deterministic-ish series of entries between two dates.
 * Amounts are drawn from [minAmount, maxAmount] and alternate sensibly for "mixed".
 */
export function generateTransactionSeries(input: GeneratorInput, seed = 1): GeneratedEntry[] {
  const start = new Date(`${input.fromDate}T12:00:00`);
  const end = new Date(`${input.toDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const step = FREQUENCY_DAYS[input.frequency];
  const min = Math.min(input.minAmount, input.maxAmount);
  const max = Math.max(input.minAmount, input.maxAmount);
  const entries: GeneratedEntry[] = [];
  let cursor = new Date(start);
  let randomState = Math.abs(Math.floor(seed)) || 1;
  const nextRandom = () => {
    // simple LCG so the preview and the committed run match
    randomState = (randomState * 9301 + 49297) % 233280;
    return randomState / 233280;
  };

  let index = 0;
  while (cursor <= end && entries.length < MAX_GENERATED_ENTRIES) {
    const magnitude = Math.round((min + nextRandom() * (max - min)) * 100) / 100;
    let signed: number;
    if (input.direction === "credit") signed = magnitude;
    else if (input.direction === "debit") signed = -magnitude;
    else signed = index % 2 === 0 ? magnitude : -magnitude;

    entries.push({
      id: `gen-${cursor.toISOString().slice(0, 10)}-${index}`,
      accountId: input.accountId,
      date: cursor.toISOString().slice(0, 10),
      description: input.description.trim() || "Administration historical entry",
      category: input.category,
      amount: signed,
      status: input.status,
      failureReason: input.status === "Failed" ? input.failureReason || "Other" : undefined,
      failureDetails: input.status === "Failed" ? input.failureDetails?.trim() || undefined : undefined,
      reference: `GEN-${randomDigits(6)}`,
      createdBy: ADMIN_ACTOR,
    });

    index += 1;
    cursor = new Date(cursor.getTime() + step * 24 * 60 * 60 * 1000);
  }
  return entries;
}

/** Applies a generated series to a profile, updating the balance by the net amount. */
export function applyGeneratedSeries(
  profile: BankUserProfile,
  entries: GeneratedEntry[],
  input: GeneratorInput
): BankUserProfile {
  if (entries.length === 0) return profile;
  const account = profile.accounts.find((a) => a.id === input.accountId);
  if (!account) return profile;

  const stamped: Transaction[] = entries.map((e) => ({ ...e, accountId: account.id }));
  let accounts = profile.accounts;
  if (input.applyBalance && input.status === "Posted") {
    const isDebt = account.category === "credit" || account.category === "loan";
    const net = round2(entries.reduce((sum, e) => sum + e.amount, 0));
    const next = isDebt ? Math.max(0, round2(account.balance - net)) : Math.max(0, round2(account.balance + net));
    accounts = profile.accounts.map((a) => (a.id === account.id ? { ...a, balance: next } : a));
  }

  return {
    ...profile,
    accounts,
    transactions: [...stamped, ...profile.transactions].sort((a, b) => (a.date < b.date ? 1 : -1)),
  };
}

/* ------------------------------------------------------------------ *
 * Card operations: approval queue, replacement, PIN, freeze, disputes
 * ------------------------------------------------------------------ */

export type CardApprovalPayload = {
  label: string;
  network: BankCard["network"];
  accent: BankCard["accent"];
  monthlyLimit: number;
  points: number;
  perks: string;
  cardholderName: string;
  linkedAccountId: string;
  pendingCards: PendingCard[];
};

export function submitCardForApproval(
  profile: BankUserProfile,
  input: CardApprovalPayload,
  actor: string
): { profile: BankUserProfile; approvalRequestId: string } {
  const reqId = `CARDPEND-${randomDigits(8)}`;
  const pendingCard: PendingCard = {
    approvalRequestId: reqId,
    card: {
      id: newId("card-pend"),
      label: input.label,
      network: input.network,
      number: generateCardNumber(input.accent),
      last4: randomDigits(4),
      expiry: "05/30",
      cvv: randomDigits(3),
      cardholderName: input.cardholderName,
      monthlyLimit: input.monthlyLimit,
      linkedAccountId: input.linkedAccountId,
      locked: false,
      contactless: true,
      international: true,
      onlinePurchases: true,
      rewardsPoints: input.points,
      cashbackRate: input.perks,
      accent: input.accent,
      deliveryStatus: "ordered",
    },
    requestedAt: todayIso(),
    requestedBy: actor,
  };
  const updatedProfile = { ...profile, pendingCards: [...(profile.pendingCards ?? []), pendingCard] };
  return {
    profile: updatedProfile,
    approvalRequestId: reqId,
  };
}

export function applyCardApprovalDecision(
  profile: BankUserProfile,
  pendingCard: PendingCard,
  decision: "approved" | "rejected",
  actor: string
): BankUserProfile {
  const remainingPending = (profile.pendingCards ?? []).filter(
    (pc) => pc.approvalRequestId !== pendingCard.approvalRequestId
  );
  if (decision === "rejected") {
    return {
      ...profile,
      pendingCards: remainingPending,
      notes: [profile.notes ?? "", `Card ${pendingCard.card.label} (${pendingCard.card.last4}) rejected by ${actor}`].filter(Boolean).join("\n"),
    };
  }
  const card = pendingCard.card;
  return {
    ...profile,
    pendingCards: remainingPending,
    cards: [...profile.cards, card],
    notes: [profile.notes ?? "", `Card ${card.label} (${card.last4}) issued by ${actor}`].filter(Boolean).join("\n"),
  };
}

export function generateCardReplacement(
  profile: BankUserProfile,
  originalCardId: string,
  _actor: string
): BankUserProfile {
  const original = profile.cards.find((c) => c.id === originalCardId);
  if (!original) return profile;
  const replacement: BankCard = {
    ...original,
    id: newId("card"),
    number: generateCardNumber(original.accent),
    last4: randomDigits(4),
    cvv: randomDigits(3),
    expiry: "05/30",
    locked: false,
    status: "active",
    deliveryStatus: "ordered",
    issuedAt: todayIso(),
    previousCardId: original.id,
  };
  return {
    ...profile,
    cards: profile.cards.map((c) =>
      c.id === originalCardId
        ? { ...c, status: "cancelled" as const, locked: true, lostReportedAt: lostStamp() }
        : c
    ).concat(replacement),
  };
}

export function changeCardPin(
  profile: BankUserProfile,
  cardId: string,
  currentPin: string,
  newPin: string,
  _actor: string
): BankUserProfile {
  const target = profile.cards.find((c) => c.id === cardId);
  if (!target) return profile;
  const normalizedCurrent = currentPin.replace(/\D/g, "");
  const normalizedNew = newPin.replace(/\D/g, "");
  if (normalizedCurrent !== (target.pin ?? "0000")) {
    throw new Error("Incorrect current PIN");
  }
  if (!/^\d{4}$/.test(normalizedNew)) {
    throw new Error("New PIN must be exactly 4 digits");
  }
  return {
    ...profile,
    cards: profile.cards.map((c) =>
      c.id === cardId
        ? { ...c, pin: normalizedNew, pinUpdatedAt: pinStamp() }
        : c
    ),
  };
}

export function checkCardExpiry(users: ManagedUserEntry[]): { key: string; name: string; cardLabel: string; last4: string; expiry: string }[] {
  const out: { key: string; name: string; cardLabel: string; last4: string; expiry: string }[] = [];
  const now = Date.now();
  for (const u of users) {
    for (const card of u.profile.cards) {
      if (!card.expiry) continue;
      const [expMonth, expYear] = card.expiry.split("/").map(Number);
      const expDate = new Date(expYear, expMonth);
      const daysUntilExpiry = Math.floor((expDate.getTime() - now) / 86400000);
      if (daysUntilExpiry > 0 && daysUntilExpiry <= 60) {
        out.push({ key: u.key, name: u.profile.fullName, cardLabel: card.label, last4: card.last4, expiry: card.expiry });
      }
    }
  }
  return out;
}

export function freezeCard(profile: BankUserProfile, cardId: string, _actor: string): BankUserProfile {
  return {
    ...profile,
    cards: profile.cards.map((c) =>
      c.id === cardId ? { ...c, locked: true } : c
    ),
  };
}

export function thawCard(profile: BankUserProfile, cardId: string, _actor: string): BankUserProfile {
  return {
    ...profile,
    cards: profile.cards.map((c) =>
      c.id === cardId ? { ...c, locked: false } : c
    ),
  };
}

export function reportCardLost(profile: BankUserProfile, cardId: string, _reason: string, _actor: string): BankUserProfile {
  return {
    ...profile,
    cards: profile.cards.map((c) =>
      c.id === cardId
        ? { ...c, locked: true, status: "cancelled" as const, lostReportedAt: lostStamp() }
        : c
    ),
  };
}

export function addCardDispute(profile: BankUserProfile, cardId: string, txId: string, _reason: string, _actor: string): BankUserProfile {
  const card = profile.cards.find((c) => c.id === cardId);
  if (!card) return profile;
  const existing = card.disputedTxIds ?? [];
  if (existing.includes(txId)) return profile;
  return {
    ...profile,
    cards: profile.cards.map((c) =>
      c.id === cardId
        ? { ...c, disputedTxIds: [...existing, txId] }
        : c
    ),
  };
}
