export type PersonaId = "personal" | "business" | "wealth" | "custom";

export type SupportSection = "help" | "appointment" | "branches" | "notices" | "security" | "cdic";

export type LoginPortal = "personal" | "business" | "wealth" | "brokerage";

export type PageRoute =
  | { kind: "home" }
  | { kind: "login"; portal?: LoginPortal }
  | { kind: "signup"; segment?: "personal" | "business" }
  | { kind: "support"; section?: SupportSection }
  | { kind: "segment"; segment: "business" | "wealth" | "about" }
  | {
      kind: "category";
      slug:
        | "accounts"
        | "cards"
        | "borrowing"
        | "mortgages"
        | "savings"
        | "insurance"
        | "advice"
        | "offers"
        | "rates";
    }
  | { kind: "personal-dashboard" }
  | {
      kind: "business-dashboard";
      tab?: "cash-position" | "payroll" | "invoices" | "wires" | "cards" | "ledger" | "settings";
    }
  | { kind: "admin-login" }
  | { kind: "admin" };

export type AccountCategory = "chequing" | "savings" | "credit" | "investment" | "loan";

export type BankAccount = {
  id: string;
  name: string;
  number: string;
  category: AccountCategory;
  balance: number; // positive = asset for chequing/savings/investment; positive = balance owed for credit/loan
  currency: "CAD" | "USD";
  rate?: string;
  limit?: number;
  subtitle: string;
};

export type Transaction = {
  id: string;
  accountId: string;
  date: string; // posting date (YYYY-MM-DD) — may be back-dated or post-dated by administration
  description: string;
  category: "Groceries" | "Dining" | "Utilities" | "Income" | "Transfer" | "Shopping" | "Housing" | "Investments" | "Business";
  amount: number; // positive = inflow/credit, negative = outflow/debit
  balanceAfter?: number;
  status?: "Posted" | "Pending" | "Failed";
  failureReason?: string;
  failureDetails?: string;
  reference?: string;
  createdBy?: string; // "Client" or the administrator who keyed the entry
};

export type Payee = {
  id: string;
  name: string;
  accountRef: string;
  category: string;
  lastPaid?: string;
};

export type Recipient = {
  id: string;
  name: string;
  email: string;
  bank: string;
};

export type BankCard = {
  id: string;
  label: string;
  network: "Mastercard" | "Debit";
  number?: string;
  last4: string;
  expiry: string;
  cvv?: string;
  cardholderName?: string;
  billingAddress?: string;
  monthlyLimit?: number;
  linkedAccountId: string;
  locked: boolean;
  liked?: boolean;
  status?: "active" | "frozen" | "cancelled" | "expired";
  issuedAt?: string;
  contactless: boolean;
  international: boolean;
  onlinePurchases: boolean;
  rewardsPoints?: number;
  cashbackRate?: string;
  accent: "allure" | "world-elite" | "debit" | "business";
};

export function normalizeBankCardList(cards?: BankCard[] | null): BankCard[] {
  if (!Array.isArray(cards)) return [];

  const seen = new Set<string>();

  return cards
    .filter((card) => !!card && typeof card.id === "string" && !seen.has(card.id) && seen.add(card.id))
    .map((card) => ({
      ...card,
      liked: Boolean(card.liked),
    }));
}

export type ClientPreferences = {
  emailNotifications: boolean;
  loginAlerts: boolean;
  largeTransactionAlerts: boolean;
  newPayeeAlerts: boolean;
  largeTransactionThreshold: number;
};

export const DEFAULT_PREFERENCES: ClientPreferences = {
  emailNotifications: true,
  loginAlerts: true,
  largeTransactionAlerts: true,
  newPayeeAlerts: true,
  largeTransactionThreshold: 500,
};

export const TRANSFER_FAILURE_REASONS = [
  "Insufficient funds",
  "Invalid account number or routing details",
  "Beneficiary mismatch or unverified details",
  "Transfer exceeds daily or per-payment limit",
  "Security hold or fraud review",
  "Manual review required",
  "Payment stopped by account holder",
  "Compliance or AML screening failed",
  "Banking system timeout",
  "Scheduled cut-off time missed",
  "Duplicate payment detected",
  "Currency conversion unavailable",
  "Missing or incomplete reference data",
  "Outdated beneficiary information",
  "Account is frozen or restricted",
  "Pending document verification",
  "Business account transfer restriction",
  "User transfer paused by administration",
  "Technical processing error",
  "Other",
] as const;

export type ClientNotification = {
  id: string;
  createdAt: string;
  title: string;
  body: string;
  kind: "payment" | "transfer" | "security" | "statement" | "info";
  read: boolean;
  href?: string;
};

export type ClientDocument = {
  id: string;
  type: "Government photo ID" | "Proof of address" | "Proof of income" | "Business registration" | "Other";
  fileName: string;
  uploadedAt: string;
  status: "received" | "verified" | "rejected";
};

export type ClientMessage = {
  id: string;
  sentAt: string;
  channel: "Email" | "SMS" | "Secure message";
  subject: string;
  body: string;
  sentBy: string;
};

export type ScheduledTransfer = {
  id: string;
  fromAccountId: string;
  toAccountId?: string;
  payeeId?: string;
  kind: "internal" | "bill";
  amount: number;
  frequency: "once" | "weekly" | "biweekly" | "monthly";
  nextDate: string;
  description: string;
  active: boolean;
};

export type SavingsGoal = {
  id: string;
  title: string;
  target: number;
  current: number;
  deadline: string;
  linkedAccountId: string;
};

export type EmployeePayrollItem = {
  id: string;
  name: string;
  role: string;
  biweeklyNet: number;
  department: string;
  active: boolean;
};

export type BusinessInvoice = {
  id: string;
  invoiceNo: string;
  clientName: string;
  amount: number;
  currency: "CAD" | "USD";
  dueDate: string;
  status: "Open" | "Paid" | "Overdue";
};

export type AuditLogEntry = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  detail: string;
  severity: "info" | "warning" | "critical";
};

export type GlobalBankConfig = {
  primeRate: number;
  promoSavingsRate: number;
  fiveYearMortgageRate: number;
  alertBannerEnabled: boolean;
  alertBannerTitle: string;
  alertBannerBody: string;
  migrationBannerEnabled: boolean;
  migrationBannerText: string;
  maintenanceBannerEnabled: boolean;
  maintenanceBannerText: string;
};

export const INITIAL_BANK_CONFIG: GlobalBankConfig = {
  primeRate: 4.7,
  promoSavingsRate: 3.0,
  fiveYearMortgageRate: 4.89,
  alertBannerEnabled: true,
  alertBannerTitle: "Canada Post service disruption",
  alertBannerBody: "Certain mail delivery interruptions may occur.",
  migrationBannerEnabled: true,
  migrationBannerText: "Laurentian Bank personal and business (SME) clients have officially joined National Bank.",
  maintenanceBannerEnabled: false,
  maintenanceBannerText: "Scheduled digital banking maintenance Sunday 2:00 AM – 4:00 AM ET.",
};

export type BankUserProfile = {
  id: PersonaId;
  accountKind?: "personal" | "business" | "wealth";
  status?: "active" | "frozen";
  transfersPaused?: boolean;
  transferPauseReason?: string;
  transferPausedBy?: string;
  transferPausedAt?: string;
  fullName: string;
  roleLabel: string;
  email: string;
  password?: string;
  pin?: string;
  memberSince: string;
  branchName: string;
  advisorName: string;
  businessNumber?: string;
  phone?: string;
  emailSecondary?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  dateOfBirth?: string;
  sin?: string;
  notes?: string;
  lastLogin?: string;
  /** Identity verification state used by the back office. */
  kycStatus?: "unverified" | "pending" | "verified" | "rejected";
  preferences?: ClientPreferences;
  notifications?: ClientNotification[];
  kycReference?: string;
  documents?: ClientDocument[];
  messages?: ClientMessage[];
  closedReason?: string;
  accounts: BankAccount[];
  transactions: Transaction[];
  payees: Payee[];
  recipients: Recipient[];
  cards: BankCard[];
  goals: SavingsGoal[];
  payrollRoster?: EmployeePayrollItem[];
  invoices?: BusinessInvoice[];
  scheduled?: ScheduledTransfer[];
};

export const INITIAL_PROFILES: Record<"personal" | "business" | "wealth", BankUserProfile> = {
  personal: {
    id: "personal",
    fullName: "Alex Tremblay",
    roleLabel: "Personal Banking",
    email: "alex.tremblay@videotron.ca",
    pin: "7935",
    memberSince: "2018",
    branchName: "Place Ville Marie, Montreal, QC",
    advisorName: "Sophie Gagnon, Financial Advisor",
    accounts: [
      {
        id: "chk-1",
        name: "Total Chequing Account",
        number: "0006-18421-19",
        category: "chequing",
        balance: 6482.55,
        currency: "CAD",
        subtitle: "Unlimited electronic transactions",
      },
      {
        id: "sav-1",
        name: "Cash Advantage Solution",
        number: "0006-18421-42",
        category: "savings",
        balance: 24850.0,
        currency: "CAD",
        rate: "3.00% promo",
        subtitle: "Promotional interest rate active",
      },
      {
        id: "inv-1",
        name: "Tax-Free Savings Account (TFSA)",
        number: "NBDB-77410-TF",
        category: "investment",
        balance: 41320.8,
        currency: "CAD",
        rate: "+7.4% YTD",
        subtitle: "Balanced Growth ETF Portfolio",
      },
      {
        id: "crd-1",
        name: "Allure® Mastercard®",
        number: "5412 •••• •••• 4829",
        category: "credit",
        balance: 1146.32,
        limit: 12000,
        currency: "CAD",
        rate: "20.99%",
        subtitle: "Available credit: $10,853.68",
      },
      {
        id: "mtg-1",
        name: "5-Year Fixed Residential Mortgage",
        number: "MTG-902418-01",
        category: "loan",
        balance: 298450.0,
        currency: "CAD",
        rate: "4.89% fixed",
        subtitle: "Next payment: $1,842.00 on 1st of month",
      },
    ],
    transactions: [
      {
        id: "tx-101",
        accountId: "chk-1",
        date: "2026-05-14",
        description: "Payroll Deposit — Groupe Boréal Inc.",
        category: "Income",
        amount: 2895.4,
        status: "Posted",
      },
      {
        id: "tx-102",
        accountId: "chk-1",
        date: "2026-05-13",
        description: "Hydro-Québec — Bill Payment",
        category: "Utilities",
        amount: -128.65,
        status: "Posted",
      },
      {
        id: "tx-103",
        accountId: "crd-1",
        date: "2026-05-12",
        description: "IGA Extra Marché Duchemin",
        category: "Groceries",
        amount: -142.18,
        status: "Posted",
      },
      {
        id: "tx-104",
        accountId: "sav-1",
        date: "2026-05-10",
        description: "Automated Savings Transfer",
        category: "Transfer",
        amount: 500.0,
        status: "Posted",
      },
      {
        id: "tx-105",
        accountId: "chk-1",
        date: "2026-05-10",
        description: "Automated Transfer to Cash Advantage",
        category: "Transfer",
        amount: -500.0,
        status: "Posted",
      },
      {
        id: "tx-106",
        accountId: "crd-1",
        date: "2026-05-09",
        description: "Café Olimpico Montréal",
        category: "Dining",
        amount: -18.75,
        status: "Posted",
      },
      {
        id: "tx-107",
        accountId: "crd-1",
        date: "2026-05-08",
        description: "Simons — Sainte-Catherine",
        category: "Shopping",
        amount: -186.4,
        status: "Posted",
      },
      {
        id: "tx-108",
        accountId: "chk-1",
        date: "2026-05-01",
        description: "Residential Mortgage Payment",
        category: "Housing",
        amount: -1842.0,
        status: "Posted",
      },
      {
        id: "tx-109",
        accountId: "sav-1",
        date: "2026-05-01",
        description: "Promotional 3.00% Monthly Interest",
        category: "Income",
        amount: 61.85,
        status: "Posted",
      },
      {
        id: "tx-110",
        accountId: "inv-1",
        date: "2026-04-29",
        description: "TFSA Dividend Reinvestment",
        category: "Investments",
        amount: 194.2,
        status: "Posted",
      },
      ...[
        ["2026-05-16", "IGA Extra — Weekly groceries", "Groceries", -96.42, "chk-1"],
        ["2026-05-15", "Netflix Canada", "Shopping", -17.99, "crd-1"],
        ["2026-05-15", "Tim Hortons", "Dining", -6.85, "crd-1"],
        ["2026-05-14", "SAQ — Saint-Denis", "Shopping", -48.3, "crd-1"],
        ["2026-05-13", "Prairie Sky Cabs", "Dining", -23.5, "crd-1"],
        ["2026-05-12", "Jean Coutu — Pharmacy", "Shopping", -34.16, "crd-1"],
        ["2026-05-11", "Metro Plus Ontario", "Groceries", -112.77, "crd-1"],
        ["2026-05-10", "Spotify Premium", "Shopping", -11.99, "crd-1"],
        ["2026-05-09", "Boucherie du Plateau", "Groceries", -54.9, "crd-1"],
        ["2026-05-08", "Bell Fibe — Internet", "Utilities", -82.45, "chk-1"],
        ["2026-05-07", "Cineplex StarCité", "Dining", -42.0, "crd-1"],
        ["2026-05-06", "Épicerie Adonis", "Groceries", -134.28, "crd-1"],
        ["2026-05-05", "Uber — Montreal", "Dining", -19.75, "crd-1"],
        ["2026-05-04", "Canadian Tire", "Shopping", -89.99, "crd-1"],
        ["2026-05-03", "Restaurant Ginza", "Dining", -76.5, "crd-1"],
        ["2026-05-02", "IGA Extra — Stock-up", "Groceries", -187.63, "crd-1"],
        ["2026-04-30", "Payroll Deposit — Groupe Boréal Inc.", "Income", 2895.4, "chk-1"],
        ["2026-04-28", "Pharmaprix", "Shopping", -28.44, "crd-1"],
        ["2026-04-27", "Fromagerie Hamel", "Groceries", -41.25, "crd-1"],
        ["2026-04-25", "Air Canada — Vacations deposit", "Shopping", -450.0, "crd-1"],
      ].map(
        ([date, description, category, amount, accountId], i): Transaction => ({
          id: `tx-seed-${i}`,
          accountId: accountId as string,
          date: date as string,
          description: description as string,
          category: category as Transaction["category"],
          amount: amount as number,
          status: "Posted",
        })
      ),
    ],
    payees: [
      { id: "pay-1", name: "Hydro-Québec", accountRef: "HQ-8841209", category: "Utilities", lastPaid: "$128.65 on May 13" },
      { id: "pay-2", name: "Bell Canada Mobility & Internet", accountRef: "BC-5519023", category: "Telecom", lastPaid: "$94.30 on Apr 26" },
      { id: "pay-3", name: "Énergir", accountRef: "EN-3029184", category: "Utilities", lastPaid: "$76.10 on Apr 19" },
      { id: "pay-4", name: "City of Montreal — Property Tax", accountRef: "MTL-2026-991", category: "Municipal", lastPaid: "$615.00 on Mar 01" },
      { id: "pay-5", name: "Canada Revenue Agency (CRA)", accountRef: "CRA-INST-2026", category: "Government" },
    ],
    recipients: [
      { id: "rec-1", name: "Marc-Antoine Roy", email: "marc.roy@example.ca", bank: "Interac e-Transfer®" },
      { id: "rec-2", name: "Camille Bouchard", email: "camille.b@example.ca", bank: "Interac e-Transfer®" },
      { id: "rec-3", name: "Dr. Nadia Karim (Dental Clinic)", email: "billing@cliniquekarim.example.ca", bank: "Interac e-Transfer®" },
    ],
    cards: [
      {
        id: "card-allure",
        label: "Allure® Mastercard®",
        network: "Mastercard",
        last4: "4829",
        expiry: "09/29",
        cvv: "418",
        cardholderName: "ALEX TREMBLAY",
        monthlyLimit: 5000,
        linkedAccountId: "crd-1",
        locked: false,
        contactless: true,
        international: true,
        onlinePurchases: true,
        rewardsPoints: 38450,
        cashbackRate: "Up to 2% rewards + charity support",
        accent: "allure",
        status: "active",
        issuedAt: "2024-09-12",
      },
      {
        id: "card-debit",
        label: "National Bank Debit Mastercard",
        network: "Debit",
        last4: "1904",
        expiry: "04/28",
        cvv: "207",
        cardholderName: "ALEX TREMBLAY",
        monthlyLimit: 3000,
        linkedAccountId: "chk-1",
        locked: false,
        contactless: true,
        international: false,
        onlinePurchases: true,
        accent: "debit",
        status: "active",
        issuedAt: "2023-04-02",
      },
    ],
    goals: [
      {
        id: "goal-1",
        title: "Kitchen & Workshop Renovation",
        target: 18000,
        current: 12450,
        deadline: "Nov 2026",
        linkedAccountId: "sav-1",
      },
      {
        id: "goal-2",
        title: "6-Month Emergency Cushion",
        target: 15000,
        current: 12400,
        deadline: "Sep 2026",
        linkedAccountId: "sav-1",
      },
      {
        id: "goal-3",
        title: "Lisbon & Azores Trip",
        target: 4500,
        current: 2150,
        deadline: "Aug 2026",
        linkedAccountId: "sav-1",
      },
    ],
    preferences: {
      emailNotifications: true,
      loginAlerts: true,
      largeTransactionAlerts: true,
      newPayeeAlerts: true,
      largeTransactionThreshold: 500,
    },
    notifications: [
      {
        id: "ntf-welcome",
        createdAt: "2026-05-14",
        title: "Your May e-Statement is ready",
        body: "Your statement for April 2026 is available to download.",
        kind: "statement",
        read: false,
      },
      {
        id: "ntf-transfer",
        createdAt: "2026-05-10",
        title: "Scheduled transfer completed",
        body: "Automated savings transfer of $500.00 to Cash Advantage Solution.",
        kind: "transfer",
        read: false,
      },
    ],
  },

  business: {
    id: "business",
    accountKind: "business",
    status: "active",
    fullName: "Atelier Nord Design Inc.",
    roleLabel: "Business (SME) Banking",
    email: "comptabilite@ateliernord.ca",
    pin: "2486",
    memberSince: "2020",
    branchName: "Commercial Centre, Saint-Laurent, QC",
    advisorName: "David Chen, Senior Commercial Account Manager",
    businessNumber: "BN 84920-1142 RC0001 · NEQ 1176482901",
    accounts: [
      {
        id: "biz-chk",
        name: "CDN Business Operating Account",
        number: "0006-99204-10",
        category: "chequing",
        balance: 84620.4,
        currency: "CAD",
        subtitle: "Digital Business Package — Unlimited e-Transfers",
      },
      {
        id: "biz-inv",
        name: "Business Investment Account",
        number: "0006-99204-55",
        category: "savings",
        balance: 215000.0,
        currency: "CAD",
        rate: "1.70% (incl. bonus)",
        subtitle: "Liquid corporate treasury reserve",
      },
      {
        id: "biz-usd",
        name: "U.S. Dollar Business Account",
        number: "0006-99204-88",
        category: "chequing",
        balance: 31480.0,
        currency: "USD",
        subtitle: "Cross-border supplier settlements",
      },
      {
        id: "biz-crd",
        name: "Business Platinum Mastercard®",
        number: "5524 •••• •••• 7710",
        category: "credit",
        balance: 4820.15,
        limit: 50000,
        currency: "CAD",
        rate: "14.99%",
        subtitle: "4 employee cards active",
      },
      {
        id: "biz-loc",
        name: "Operating Line of Credit",
        number: "LOC-441092-B",
        category: "loan",
        balance: 15000.0,
        limit: 150000,
        currency: "CAD",
        rate: "5.45% (Prime + 0.75%)",
        subtitle: "Available credit: $135,000.00",
      },
    ],
    transactions: [
      {
        id: "btx-1",
        accountId: "biz-chk",
        date: "2026-05-14",
        description: "Client Wire — Maison Verrière Ltée (INV-2048)",
        category: "Income",
        amount: 18450.0,
        status: "Posted",
      },
      {
        id: "btx-2",
        accountId: "biz-chk",
        date: "2026-05-12",
        description: "Bi-weekly Payroll Batch (11 employees)",
        category: "Business",
        amount: -24680.5,
        status: "Posted",
      },
      {
        id: "btx-3",
        accountId: "biz-crd",
        date: "2026-05-11",
        description: "AWS Cloud Services Canada",
        category: "Utilities",
        amount: -642.8,
        status: "Posted",
      },
      {
        id: "btx-4",
        accountId: "biz-inv",
        date: "2026-05-01",
        description: "Monthly Treasury Interest + Bonus",
        category: "Income",
        amount: 304.58,
        status: "Posted",
      },
    ],
    payees: [
      { id: "bpay-1", name: "Revenu Québec — Source Deductions", accountRef: "RQ-DAS-99204", category: "Tax" },
      { id: "bpay-2", name: "CRA — GST/HST Corporate Remittance", accountRef: "CRA-RT0001", category: "Tax" },
      { id: "bpay-3", name: "Hydro-Québec Commercial", accountRef: "HQC-44102", category: "Utilities" },
    ],
    recipients: [
      { id: "brec-1", name: "Studio Bois Franc (Supplier)", email: "ap@boisfranc.example.ca", bank: "Interac e-Transfer®" },
      { id: "brec-2", name: "Émilie Lavoie CPA", email: "facturation@lavoiecpa.example.ca", bank: "Interac e-Transfer®" },
    ],
    cards: [
      {
        id: "card-biz",
        label: "Business Platinum Mastercard®",
        network: "Mastercard",
        last4: "7710",
        expiry: "11/28",
        cvv: "842",
        cardholderName: "ATELIER NORD — EXEC",
        monthlyLimit: 35000,
        linkedAccountId: "biz-crd",
        locked: false,
        contactless: true,
        international: true,
        onlinePurchases: true,
        rewardsPoints: 114200,
        cashbackRate: "1.5 pts per $1 on business spend",
        accent: "business",
        status: "active",
        issuedAt: "2024-02-19",
      },
      {
        id: "card-biz-ops",
        label: "Corporate Fleet & Operations Card",
        network: "Mastercard",
        last4: "3398",
        expiry: "08/29",
        cvv: "519",
        cardholderName: "MARC DUPONT — OPS",
        monthlyLimit: 15000,
        linkedAccountId: "biz-crd",
        locked: false,
        contactless: true,
        international: false,
        onlinePurchases: true,
        rewardsPoints: 18900,
        cashbackRate: "1.5 pts per $1 · Operations cap $15k",
        accent: "world-elite",
      },
    ],
    goals: [
      {
        id: "bgoal-1",
        title: "Q4 CNC Equipment Upgrade Reserve",
        target: 85000,
        current: 62000,
        deadline: "Oct 2026",
        linkedAccountId: "biz-inv",
      },
      {
        id: "bgoal-2",
        title: "Corporate Tax Instalment Reserve",
        target: 45000,
        current: 41500,
        deadline: "Dec 2026",
        linkedAccountId: "biz-inv",
      },
    ],
    payrollRoster: [
      { id: "emp-1", name: "Marc-Olivier Dupont", role: "Lead Industrial Designer", biweeklyNet: 3250, department: "Design", active: true },
      { id: "emp-2", name: "Chloé Deschamps", role: "Operations Manager", biweeklyNet: 2980, department: "Operations", active: true },
      { id: "emp-3", name: "Karim Benali", role: "CNC Fabrication Specialist", biweeklyNet: 2640, department: "Production", active: true },
      { id: "emp-4", name: "Amélie Côté", role: "Client Accounts Lead", biweeklyNet: 2510, department: "Sales", active: true },
      { id: "emp-5", name: "Lucas Pelletier", role: "Junior Architect", biweeklyNet: 2180, department: "Design", active: true },
    ],
    invoices: [
      { id: "inv-b1", invoiceNo: "INV-2051", clientName: "Hôtel Saint-Paul Montréal", amount: 14800, currency: "CAD", dueDate: "2026-05-24", status: "Open" },
      { id: "inv-b2", invoiceNo: "INV-2052", clientName: "Nordic Timber Boston LLC", amount: 9400, currency: "USD", dueDate: "2026-05-28", status: "Open" },
      { id: "inv-b3", invoiceNo: "INV-2046", clientName: "Espace Vieux-Port Inc.", amount: 6250, currency: "CAD", dueDate: "2026-05-08", status: "Overdue" },
      { id: "inv-b4", invoiceNo: "INV-2048", clientName: "Maison Verrière Ltée", amount: 18450, currency: "CAD", dueDate: "2026-05-14", status: "Paid" },
    ],
  },

  wealth: {
    id: "wealth",
    fullName: "Claire Beaumont",
    roleLabel: "Private Banking 1859",
    email: "claire.beaumont@sympatico.ca",
    pin: "6194",
    memberSince: "2012",
    branchName: "Private Banking 1859, Montreal Downtown",
    advisorName: "Jean-François Mercier, Private Banker",
    accounts: [
      {
        id: "w-chk",
        name: "Private Banking 1859 Cash Management",
        number: "1859-30118-01",
        category: "chequing",
        balance: 48920.0,
        currency: "CAD",
        subtitle: "Concierge banking & global wire privileges",
      },
      {
        id: "w-sav",
        name: "Cash Advantage High-Yield Reserve",
        number: "1859-30118-09",
        category: "savings",
        balance: 185000.0,
        currency: "CAD",
        rate: "3.00% promo",
        subtitle: "Short-term liquidity allocation",
      },
      {
        id: "w-rrsp",
        name: "NBF Managed RRSP Portfolio",
        number: "NBF-88012-RR",
        category: "investment",
        balance: 642800.0,
        currency: "CAD",
        rate: "+9.1% YTD",
        subtitle: "Discretionary North American & Global Equities",
      },
      {
        id: "w-nbdb",
        name: "National Bank Direct Brokerage ($0 Commission)",
        number: "NBDB-88012-M",
        category: "investment",
        balance: 278450.0,
        currency: "CAD",
        rate: "+11.3% YTD",
        subtitle: "Self-directed Canadian & U.S. equities",
      },
      {
        id: "w-crd",
        name: "World Elite® Mastercard®",
        number: "5458 •••• •••• 9012",
        category: "credit",
        balance: 2640.9,
        limit: 40000,
        currency: "CAD",
        rate: "20.99%",
        subtitle: "Airport lounge access & comprehensive travel protection",
      },
    ],
    transactions: [
      {
        id: "wtx-1",
        accountId: "w-nbdb",
        date: "2026-05-13",
        description: "Quarterly Dividend — National Bank (NA.TO)",
        category: "Investments",
        amount: 1420.0,
        status: "Posted",
      },
      {
        id: "wtx-2",
        accountId: "w-crd",
        date: "2026-05-11",
        description: "Air Canada — Montreal to Zurich",
        category: "Shopping",
        amount: -1890.4,
        status: "Posted",
      },
      {
        id: "wtx-3",
        accountId: "w-chk",
        date: "2026-05-05",
        description: "RRSP Monthly Contribution Transfer",
        category: "Investments",
        amount: -2500.0,
        status: "Posted",
      },
    ],
    payees: [
      { id: "wpay-1", name: "Fondation CHU Sainte-Justine", accountRef: "DON-2026-1859", category: "Philanthropy" },
      { id: "wpay-2", name: "Hydro-Québec", accountRef: "HQ-1009482", category: "Utilities" },
    ],
    recipients: [
      { id: "wrec-1", name: "Julien Beaumont", email: "julien.b@example.ca", bank: "Interac e-Transfer®" },
    ],
    cards: [
      {
        id: "card-we",
        label: "World Elite® Mastercard®",
        network: "Mastercard",
        last4: "9012",
        expiry: "06/29",
        linkedAccountId: "w-crd",
        locked: false,
        contactless: true,
        international: true,
        onlinePurchases: true,
        rewardsPoints: 192400,
        cashbackRate: "Up to 2 pts/$1 + $150 annual travel perks",
        accent: "world-elite",
        status: "active",
        issuedAt: "2023-06-30",
      },
    ],
    goals: [
      {
        id: "wgoal-1",
        title: "Eastern Townships Lakefront Chalet Down Payment",
        target: 250000,
        current: 185000,
        deadline: "Spring 2027",
        linkedAccountId: "w-sav",
      },
    ],
  },
};

export const FX_RATES: Record<string, { name: string; buyCad: number; sellCad: number; flag: string }> = {
  USD: { name: "U.S. Dollar", buyCad: 1.352, sellCad: 1.389, flag: "🇺🇸" },
  EUR: { name: "Euro", buyCad: 1.468, sellCad: 1.516, flag: "🇪🇺" },
  GBP: { name: "British Pound", buyCad: 1.718, sellCad: 1.774, flag: "🇬🇧" },
  CHF: { name: "Swiss Franc", buyCad: 1.529, sellCad: 1.582, flag: "🇨🇭" },
  JPY: { name: "Japanese Yen", buyCad: 0.0089, sellCad: 0.0094, flag: "🇯🇵" },
  MXN: { name: "Mexican Peso", buyCad: 0.076, sellCad: 0.082, flag: "🇲🇽" },
};

/**
 * Split an account's transactions into cleared (posted) and pending.
 * Pending entries are authorized/held but have not yet settled.
 */
export function splitPostedPending(transactions: Transaction[], accountId: string) {
  let pendingNet = 0;
  for (const tx of transactions) {
    if (tx.accountId !== accountId) continue;
    if ((tx.status ?? "Posted") === "Pending") pendingNet += tx.amount;
  }
  return { pendingNet };
}

/** Current (book) balance vs available balance after holds and pending items. */
export function balanceAvailability(
  account: BankAccount,
  transactions: Transaction[]
): { current: number; available: number; pendingNet: number; isDebt: boolean } {
  const isDebt = account.category === "credit" || account.category === "loan";
  const { pendingNet } = splitPostedPending(transactions, account.id);
  // For deposit accounts, pending debits reduce available funds.
  // For credit facilities, pending purchases increase the balance owing.
  const available = isDebt ? account.balance + pendingNet : Math.max(0, account.balance + pendingNet);
  return {
    current: account.balance,
    available: Math.max(0, Math.round(available * 100) / 100),
    pendingNet: Math.round(pendingNet * 100) / 100,
    isDebt,
  };
}

/** Credit still available on a card or line of credit. */
export function availableCredit(account: BankAccount, transactions: Transaction[] = []): number {
  const limit = account.limit ?? 0;
  if (!limit) return 0;
  return Math.max(0, Math.round((limit - balanceAvailability(account, transactions).available) * 100) / 100);
}

export function formatMoney(amount: number, currency: "CAD" | "USD" = "CAD"): string {
  const numeric = new Intl.NumberFormat("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  const symbol = currency === "USD" ? "US$" : "$";
  return `${symbol}${numeric}`;
}


/* ------------------------------------------------------------------ *
 * Scheduled transfer execution
 * ------------------------------------------------------------------ */

const FREQUENCY_STEP_DAYS: Record<ScheduledTransfer["frequency"], number> = {
  once: 0,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export type ScheduleRunResult = {
  profile: BankUserProfile;
  executed: { description: string; amount: number; date: string }[];
  notifications: ClientNotification[];
};

/**
 * Executes every scheduled transfer whose due date has arrived.
 * Repeating schedules advance to their next occurrence; one-off schedules close.
 */
export function runDueSchedules(profile: BankUserProfile, today = new Date().toISOString().slice(0, 10)): ScheduleRunResult {
  const scheduled = profile.scheduled ?? [];
  if (scheduled.length === 0) return { profile, executed: [], notifications: [] };

  let accounts = [...profile.accounts];
  const newTx: Transaction[] = [];
  const executed: ScheduleRunResult["executed"] = [];
  const notifications: ClientNotification[] = [];

  const updatedSchedules = scheduled.map((sch) => {
    if (!sch.active) return sch;
    let next = sch.nextDate;
    let guard = 0;

    while (next <= today && guard < 24) {
      guard += 1;
      const from = accounts.find((a) => a.id === sch.fromAccountId);
      const to = sch.toAccountId ? accounts.find((a) => a.id === sch.toAccountId) : undefined;

      if (from && (sch.kind === "internal" ? to : true)) {
        const available = from.category === "credit" || from.category === "loan" ? from.balance : from.balance;
        if (available >= sch.amount) {
          accounts = accounts.map((a) => {
            if (a.id === from.id) return { ...a, balance: Math.round((a.balance - sch.amount) * 100) / 100 };
            if (to && a.id === to.id) {
              const isDebt = a.category === "credit" || a.category === "loan";
              const value = isDebt ? Math.max(0, a.balance - sch.amount) : a.balance + sch.amount;
              return { ...a, balance: Math.round(value * 100) / 100 };
            }
            return a;
          });
          newTx.push({
            id: `sch-tx-${sch.id}-${next}`,
            accountId: from.id,
            date: next,
            description: `Scheduled ${sch.frequency === "once" ? "transfer" : sch.frequency + " transfer"} — ${sch.description}`,
            category: "Transfer",
            amount: -sch.amount,
            status: "Posted",
            reference: `SCH-${sch.id.slice(-6)}`,
            createdBy: "Scheduled instruction",
          });
          if (to) {
            newTx.push({
              id: `sch-tx-${sch.id}-${next}-in`,
              accountId: to.id,
              date: next,
              description: `Scheduled transfer from ${from.name} — ${sch.description}`,
              category: "Transfer",
              amount: sch.amount,
              status: "Posted",
              reference: `SCH-${sch.id.slice(-6)}`,
              createdBy: "Scheduled instruction",
            });
          }
          executed.push({ description: sch.description, amount: sch.amount, date: next });
          notifications.push({
            id: `ntf-sch-${sch.id}-${next}`,
            createdAt: next,
            title: "Scheduled transfer completed",
            body: `${formatMoney(sch.amount)} — ${sch.description}`,
            kind: "transfer",
            read: false,
          });
        } else {
          notifications.push({
            id: `ntf-sch-fail-${sch.id}-${next}`,
            createdAt: next,
            title: "Scheduled transfer not processed",
            body: `${formatMoney(sch.amount)} could not be moved from ${from.name} (insufficient funds).`,
            kind: "security",
            read: false,
          });
        }
      }

      if (sch.frequency === "once") return { ...sch, active: false, nextDate: next };
      next = addDays(next, FREQUENCY_STEP_DAYS[sch.frequency]);
    }
    return { ...sch, nextDate: next };
  });

  if (newTx.length === 0 && notifications.length === 0) {
    return { profile: { ...profile, scheduled: updatedSchedules }, executed: [], notifications: [] };
  }

  return {
    profile: {
      ...profile,
      accounts,
      transactions: [...newTx, ...profile.transactions].sort((a, b) => (a.date < b.date ? 1 : -1)),
      scheduled: updatedSchedules,
      notifications: [...notifications, ...(profile.notifications ?? [])],
    },
    executed,
    notifications,
  };
}

/** Generates alerts for a new transaction according to the client's preferences. */
export function transactionNotifications(
  profile: BankUserProfile,
  txns: Transaction[]
): ClientNotification[] {
  const prefs = profile.preferences ?? DEFAULT_PREFERENCES;
  if (!prefs.largeTransactionAlerts) return [];
  const out: ClientNotification[] = [];
  for (const tx of txns) {
    if (tx.amount < 0 && Math.abs(tx.amount) >= prefs.largeTransactionThreshold) {
      out.push({
        id: `ntf-tx-${tx.id}`,
        createdAt: tx.date,
        title: "Large transaction alert",
        body: `${formatMoney(Math.abs(tx.amount))} debited — ${tx.description}`,
        kind: "security",
        read: false,
      });
    }
  }
  return out;
}
