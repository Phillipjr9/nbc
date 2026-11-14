import { useMemo, useState } from "react";
import {
  logoNbc,
  pictoCarteCreditRed,
  pictoComptesRed,
  pictoEmpruntsRed,
  pictoOrdinateur,
} from "../assets/nbcAssets";
import {
  BusinessInvoice,
  DemoUserProfile,
  EmployeePayrollItem,
  formatMoney,
  FX_RATES,
} from "../banking/bankingTypes";
import { downloadFile, round2, statementCsv } from "../banking/adminOps";
import BankCardVisual from "./BankCardVisual";
import { ArrowRight, HelpIcon, LockIcon, SearchIcon } from "./icons";
import TransactionSendOverlay, {
  AnimatedTxPayload,
  AnimatedTxPhase,
} from "./TransactionSendOverlay";

type BizTab = "treasury" | "payroll" | "invoices" | "wires" | "cards" | "ledger";

type Props = {
  profile: DemoUserProfile;
  onUpdateProfile: (updater: (prev: DemoUserProfile) => DemoUserProfile) => void;
  onGoPublicSite: () => void;
  onGoHelp: () => void;
  onSignOut: () => void;
};

const DEFAULT_PAYROLL: EmployeePayrollItem[] = [
  { id: "emp-d1", name: "Marc-Olivier Dupont", role: "Operations Director", biweeklyNet: 3200, department: "Operations", active: true },
  { id: "emp-d2", name: "Chloé Deschamps", role: "Controller", biweeklyNet: 2900, department: "Finance", active: true },
];

const DEFAULT_INVOICES: BusinessInvoice[] = [
  { id: "inv-d1", invoiceNo: "INV-2060", clientName: "Groupe Boréal Ltée", amount: 12500, currency: "CAD", dueDate: "2026-05-26", status: "Open" },
];

export default function BusinessDashboard({
  profile,
  onUpdateProfile,
  onGoPublicSite,
  onGoHelp,
  onSignOut,
}: Props) {
  const [tab, setTab] = useState<BizTab>("treasury");
  const [toast, setToast] = useState<string | null>(null);
  const [activeAnimatedTx, setActiveAnimatedTx] = useState<AnimatedTxPayload | null>(null);
  const [animatedTxPhase, setAnimatedTxPhase] = useState<AnimatedTxPhase>("verifying");
  const [recentTxIds, setRecentTxIds] = useState<string[]>([]);

  // Payroll form
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpRole, setNewEmpRole] = useState("");
  const [newEmpDept, setNewEmpDept] = useState("Operations");
  const [newEmpPay, setNewEmpPay] = useState("2600");

  // Invoice form
  const [invClient, setInvClient] = useState("");
  const [invAmount, setInvAmount] = useState("8500");
  const [invCurr, setInvCurr] = useState<"CAD" | "USD">("CAD");
  const [invDue, setInvDue] = useState("2026-06-10");

  // Commercial payments sub-modes
  const operatingAccounts = useMemo(
    () => profile.accounts.filter((a) => a.category === "chequing" || a.category === "savings"),
    [profile.accounts]
  );
  const [wireMode, setWireMode] = useState<"wire" | "tax" | "treasury" | "fx">("wire");
  const [wireSrcId, setWireSrcId] = useState(operatingAccounts[0]?.id ?? "");
  const [wireBeneficiary, setWireBeneficiary] = useState("Studio Bois Franc Inc. — Transit 00061-006");
  const [wireAmt, setWireAmt] = useState("4250.00");
  const [wireFxCurr, setWireFxCurr] = useState<keyof typeof FX_RATES>("USD");

  const [taxPayeeId, setTaxPayeeId] = useState(profile.payees[0]?.id ?? "");
  const [taxAmt, setTaxAmt] = useState("3480.00");

  const [fxFromId, setFxFromId] = useState(operatingAccounts[0]?.id ?? "");
  const [fxAmount, setFxAmount] = useState("1000");
  const [trFromId, setTrFromId] = useState(operatingAccounts[0]?.id ?? "");
  const [trToId, setTrToId] = useState(profile.accounts[1]?.id ?? "");
  const [trAmt, setTrAmt] = useState("10000.00");

  // Ledger filters
  const [ledgerAcc, setLedgerAcc] = useState("all");
  const [ledgerQuery, setLedgerQuery] = useState("");

  const payroll = profile.payrollRoster ?? DEFAULT_PAYROLL;
  const invoices = profile.invoices ?? DEFAULT_INVOICES;

  const notify = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((c) => (c === msg ? null : c)), 4000);
  };

  const todayIso = () => new Date().toISOString().slice(0, 10);
  const nowStamp = () =>
    new Date().toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", hour12: true });
  const makeRef = (p: string) => `${p}-${Math.floor(100000 + Math.random() * 900000)}`;

  const runAnimatedTx = (payload: AnimatedTxPayload, commit: () => string[]) => {
    setActiveAnimatedTx(payload);
    setAnimatedTxPhase("verifying");
    window.setTimeout(() => setAnimatedTxPhase("sending"), 420);
    window.setTimeout(() => {
      const ids = commit();
      if (ids.length) setRecentTxIds((prev) => [...ids, ...prev].slice(0, 10));
      setAnimatedTxPhase("completed");
    }, 1150);
  };

  const summary = useMemo(() => {
    const operatingAndReserves = profile.accounts.filter(
      (a) => a.category === "chequing" || a.category === "savings" || a.category === "investment"
    );
    const facilities = profile.accounts.filter(
      (a) => a.category === "credit" || a.category === "loan"
    );
    const totalLiquidityCad = operatingAndReserves.reduce(
      (s, a) => s + a.balance * (a.currency === "USD" ? FX_RATES.USD.buyCad : 1),
      0
    );
    const creditUsed = facilities.reduce((s, a) => s + a.balance, 0);
    const creditLimit = facilities.reduce((s, a) => s + (a.limit ?? a.balance), 0);
    const openReceivables = invoices
      .filter((i) => i.status !== "Paid")
      .reduce((s, i) => s + (i.currency === "USD" ? i.amount * FX_RATES.USD.buyCad : i.amount), 0);
    const activePayrollTotal = payroll.filter((e) => e.active).reduce((s, e) => s + e.biweeklyNet, 0);

    return {
      operatingAndReserves,
      facilities,
      totalLiquidityCad,
      creditUsed,
      availableCredit: Math.max(0, creditLimit - creditUsed),
      openReceivables,
      activePayrollTotal,
    };
  }, [profile.accounts, invoices, payroll]);

  // Handlers
  const handleRunPayroll = () => {
    const activeEmps = payroll.filter((e) => e.active);
    const total = activeEmps.reduce((s, e) => s + e.biweeklyNet, 0);
    const src = operatingAccounts.find((a) => a.currency === "CAD") ?? operatingAccounts[0];
    if (!src || total <= 0) {
      notify("Select at least one employee on the payroll list.");
      return;
    }
    if (src.balance < total) {
      notify(`Insufficient operating funds in ${src.name}.`);
      return;
    }

    const updatedBal = Math.round((src.balance - total) * 100) / 100;
    runAnimatedTx(
      {
        kind: "bill",
        amount: total,
        currency: "CAD",
        fromLabel: src.name,
        toLabel: `EFT Payroll Batch (${activeEmps.length} employees)`,
        memo: "Bi-weekly direct deposit file",
        reference: makeRef("EFT"),
        timestamp: `${todayIso()} · ${nowStamp()}`,
        updatedBalanceLabel: `${src.name}: ${formatMoney(updatedBal)}`,
      },
      () => {
        const txId = `pay-${Date.now()}`;
        onUpdateProfile((prev) => ({
          ...prev,
          accounts: prev.accounts.map((a) =>
            a.id === src.id ? { ...a, balance: updatedBal } : a
          ),
          transactions: [
            {
              id: txId,
              accountId: src.id,
              date: todayIso(),
              description: `EFT Payroll Batch (${activeEmps.length} employees)`,
              category: "Business",
              amount: -total,
              status: "Posted",
            },
            ...prev.transactions,
          ],
        }));
        return [txId];
      }
    );
  };

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const pay = Number(newEmpPay);
    if (!newEmpName.trim() || !pay || pay <= 0) return;
    const item: EmployeePayrollItem = {
      id: `emp-${Date.now()}`,
      name: newEmpName.trim(),
      role: newEmpRole.trim() || "Staff",
      department: newEmpDept,
      biweeklyNet: pay,
      active: true,
    };
    onUpdateProfile((prev) => ({
      ...prev,
      payrollRoster: [...(prev.payrollRoster ?? DEFAULT_PAYROLL), item],
    }));
    setNewEmpName("");
    setNewEmpRole("");
    notify(`${item.name} added to direct deposit list.`);
  };

  const toggleEmployeeActive = (empId: string) => {
    onUpdateProfile((prev) => ({
      ...prev,
      payrollRoster: (prev.payrollRoster ?? DEFAULT_PAYROLL).map((e) =>
        e.id === empId ? { ...e, active: !e.active } : e
      ),
    }));
  };

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(invAmount);
    if (!invClient.trim() || !amt || amt <= 0) return;
    const inv: BusinessInvoice = {
      id: `inv-${Date.now()}`,
      invoiceNo: `INV-${Math.floor(2065 + Math.random() * 800)}`,
      clientName: invClient.trim(),
      amount: amt,
      currency: invCurr,
      dueDate: invDue,
      status: "Open",
    };
    onUpdateProfile((prev) => ({
      ...prev,
      invoices: [inv, ...(prev.invoices ?? DEFAULT_INVOICES)],
    }));
    setInvClient("");
    notify(`Invoice ${inv.invoiceNo} created.`);
  };

  const handleCollectInvoice = (inv: BusinessInvoice) => {
    const dst =
      profile.accounts.find((a) => a.category === "chequing" && a.currency === inv.currency) ??
      operatingAccounts[0];
    if (!dst) return;
    const updatedBal = Math.round((dst.balance + inv.amount) * 100) / 100;

    runAnimatedTx(
      {
        kind: "deposit",
        amount: inv.amount,
        currency: inv.currency,
        fromLabel: `${inv.clientName} (${inv.invoiceNo})`,
        toLabel: dst.name,
        reference: makeRef("REC"),
        timestamp: `${todayIso()} · ${nowStamp()}`,
        updatedBalanceLabel: `${dst.name}: ${formatMoney(updatedBal, dst.currency)}`,
      },
      () => {
        const txId = `inv-pay-${Date.now()}`;
        onUpdateProfile((prev) => ({
          ...prev,
          accounts: prev.accounts.map((a) =>
            a.id === dst.id ? { ...a, balance: updatedBal } : a
          ),
          invoices: (prev.invoices ?? DEFAULT_INVOICES).map((i) =>
            i.id === inv.id ? { ...i, status: "Paid" } : i
          ),
          transactions: [
            {
              id: txId,
              accountId: dst.id,
              date: todayIso(),
              description: `Incoming EFT — ${inv.clientName} (${inv.invoiceNo})`,
              category: "Income",
              amount: inv.amount,
              status: "Posted",
            },
            ...prev.transactions,
          ],
        }));
        return [txId];
      }
    );
  };

  const handleSendWire = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(wireAmt);
    const src = profile.accounts.find((a) => a.id === wireSrcId) ?? operatingAccounts[0];
    if (!src || !amt || amt <= 0 || amt > src.balance) {
      notify("Please enter an amount within your operating balance.");
      return;
    }
    const updatedBal = Math.round((src.balance - amt) * 100) / 100;
    runAnimatedTx(
      {
        kind: "etransfer",
        amount: amt,
        currency: src.currency,
        fromLabel: src.name,
        toLabel: wireBeneficiary,
        memo: `Wire settlement (${wireFxCurr})`,
        reference: makeRef("WIR"),
        timestamp: `${todayIso()} · ${nowStamp()}`,
        updatedBalanceLabel: `${src.name}: ${formatMoney(updatedBal, src.currency)}`,
      },
      () => {
        const txId = `wir-${Date.now()}`;
        onUpdateProfile((prev) => ({
          ...prev,
          accounts: prev.accounts.map((a) =>
            a.id === src.id ? { ...a, balance: updatedBal } : a
          ),
          transactions: [
            {
              id: txId,
              accountId: src.id,
              date: todayIso(),
              description: `Commercial wire — ${wireBeneficiary}`,
              category: "Business",
              amount: -amt,
              status: "Posted",
            },
            ...prev.transactions,
          ],
        }));
        return [txId];
      }
    );
  };

  const handleTaxRemittance = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(taxAmt);
    const src = operatingAccounts.find((a) => a.currency === "CAD") ?? operatingAccounts[0];
    const payee = profile.payees.find((p) => p.id === taxPayeeId) ?? profile.payees[0];
    if (!src || !payee || !amt || amt <= 0 || amt > src.balance) {
      notify("Verify remittance amount and operating balance.");
      return;
    }
    const updatedBal = Math.round((src.balance - amt) * 100) / 100;
    runAnimatedTx(
      {
        kind: "bill",
        amount: amt,
        currency: "CAD",
        fromLabel: src.name,
        toLabel: `${payee.name} (${payee.accountRef})`,
        memo: "Government tax remittance",
        reference: makeRef("TAX"),
        timestamp: `${todayIso()} · ${nowStamp()}`,
        updatedBalanceLabel: `${src.name}: ${formatMoney(updatedBal)}`,
      },
      () => {
        const txId = `tax-${Date.now()}`;
        onUpdateProfile((prev) => ({
          ...prev,
          accounts: prev.accounts.map((a) =>
            a.id === src.id ? { ...a, balance: updatedBal } : a
          ),
          transactions: [
            {
              id: txId,
              accountId: src.id,
              date: todayIso(),
              description: `Tax remittance — ${payee.name}`,
              category: "Business",
              amount: -amt,
              status: "Posted",
            },
            ...prev.transactions,
          ],
        }));
        return [txId];
      }
    );
  };

  /** Converts funds between the corporate CAD and USD operating accounts at the posted rate. */
  const handleFxConvert = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(fxAmount);
    const from = profile.accounts.find((a) => a.id === fxFromId);
    if (!from || !amt || amt <= 0) {
      notify("Enter an amount to convert.");
      return;
    }
    if (from.balance < amt) {
      notify(`Insufficient funds in ${from.name}.`);
      return;
    }
    const toCurrency = from.currency === "CAD" ? "USD" : "CAD";
    const target =
      profile.accounts.find((a) => a.currency === toCurrency && a.category === "chequing") ??
      profile.accounts.find((a) => a.currency === toCurrency);
    if (!target) {
      notify(`Open a ${toCurrency} account before converting.`);
      return;
    }
    const rate = toCurrency === "USD" ? FX_RATES.USD.sellCad : 1 / FX_RATES.USD.buyCad;
    const converted = from.currency === "CAD"
      ? Math.round((amt / FX_RATES.USD.sellCad) * 100) / 100
      : Math.round(amt * FX_RATES.USD.buyCad * 100) / 100;
    const ref = makeRef("FX");

    runAnimatedTx(
      {
        kind: "transfer",
        amount: amt,
        currency: from.currency,
        fromLabel: from.name,
        toLabel: `${target.name} (${converted.toFixed(2)} ${target.currency})`,
        memo: `FX at ${rate.toFixed(4)}`,
        reference: ref,
        timestamp: `${todayIso()} · ${nowStamp()}`,
        updatedBalanceLabel: `${target.name}: ${formatMoney(round2(target.balance + converted), target.currency)}`,
      },
      () => {
        const outId = `fx-${Date.now()}-o`;
        const inId = `fx-${Date.now()}-i`;
        onUpdateProfile((prev) => ({
          ...prev,
          accounts: prev.accounts.map((a) => {
            if (a.id === from.id) return { ...a, balance: round2(a.balance - amt) };
            if (a.id === target.id) return { ...a, balance: round2(a.balance + converted) };
            return a;
          }),
          transactions: [
            {
              id: inId,
              accountId: target.id,
              date: todayIso(),
              description: `FX conversion from ${from.name} @ ${rate.toFixed(4)}`,
              category: "Transfer",
              amount: converted,
              status: "Posted",
              reference: ref,
              createdBy: "Client",
            },
            {
              id: outId,
              accountId: from.id,
              date: todayIso(),
              description: `FX conversion to ${target.name} @ ${rate.toFixed(4)}`,
              category: "Transfer",
              amount: -amt,
              status: "Posted",
              reference: ref,
              createdBy: "Client",
            },
            ...prev.transactions,
          ],
        }));
        return [inId, outId];
      }
    );
  };

  const handleTreasuryTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(trAmt);
    const src = profile.accounts.find((a) => a.id === trFromId);
    const dst = profile.accounts.find((a) => a.id === trToId);
    if (!src || !dst || src.id === dst.id || !amt || amt <= 0 || src.balance < amt) {
      notify("Select two distinct accounts and a valid amount.");
      return;
    }
    const updatedSrc = Math.round((src.balance - amt) * 100) / 100;
    runAnimatedTx(
      {
        kind: "transfer",
        amount: amt,
        currency: src.currency,
        fromLabel: src.name,
        toLabel: dst.name,
        reference: makeRef("SWP"),
        timestamp: `${todayIso()} · ${nowStamp()}`,
        updatedBalanceLabel: `${src.name}: ${formatMoney(updatedSrc, src.currency)}`,
      },
      () => {
        const outId = `trs-${Date.now()}-o`;
        const inId = `trs-${Date.now()}-i`;
        onUpdateProfile((prev) => ({
          ...prev,
          accounts: prev.accounts.map((a) => {
            if (a.id === src.id) return { ...a, balance: updatedSrc };
            if (a.id === dst.id) {
              const isDebt = a.category === "credit" || a.category === "loan";
              return {
                ...a,
                balance: Math.round((isDebt ? Math.max(0, a.balance - amt) : a.balance + amt) * 100) / 100,
              };
            }
            return a;
          }),
          transactions: [
            {
              id: inId,
              accountId: dst.id,
              date: todayIso(),
              description: `Inter-account transfer from ${src.name}`,
              category: "Transfer",
              amount: amt,
              status: "Posted",
            },
            {
              id: outId,
              accountId: src.id,
              date: todayIso(),
              description: `Inter-account transfer to ${dst.name}`,
              category: "Transfer",
              amount: -amt,
              status: "Posted",
            },
            ...prev.transactions,
          ],
        }));
        return [inId, outId];
      }
    );
  };

  const toggleCardSetting = (
    cardId: string,
    field: "locked" | "contactless" | "international" | "onlinePurchases"
  ) => {
    onUpdateProfile((prev) => ({
      ...prev,
      cards: prev.cards.map((c) => (c.id === cardId ? { ...c, [field]: !c[field] } : c)),
    }));
    notify("Corporate card setting updated.");
  };

  const filteredLedger = useMemo(() => {
    return profile.transactions.filter((tx) => {
      if (ledgerAcc !== "all" && tx.accountId !== ledgerAcc) return false;
      if (ledgerQuery.trim() && !tx.description.toLowerCase().includes(ledgerQuery.trim().toLowerCase())) return false;
      return true;
    });
  }, [profile.transactions, ledgerAcc, ledgerQuery]);

  const navTabs: [BizTab, string][] = [
    ["treasury", "Cash position"],
    ["payroll", "Payroll & EFT"],
    ["invoices", "Receivables"],
    ["wires", "Wires & tax remittances"],
    ["cards", "Corporate cards"],
    ["ledger", "Statements"],
  ];

  return (
    <div className="flex-1 bg-[#f8f6f1] pb-14">
      {/* Top Dark Utility Bar — Matches nbc.ca Business segment */}
      <div className="bg-nbc-topbar text-white">
        <div className="nbc-container flex h-[52px] items-center justify-between gap-4 text-[13.5px]">
          <div className="flex h-full items-center">
            <button
              type="button"
              onClick={onGoPublicSite}
              className="flex h-full items-center px-4 text-white/85 transition hover:bg-white/10 hover:text-white"
            >
              nbc.ca Home
            </button>
            <span className="flex h-full items-center bg-white/15 px-4 font-medium text-white">
              Business
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <button
              type="button"
              onClick={onGoHelp}
              className="inline-flex items-center gap-1.5 text-white/90 transition hover:text-white"
            >
              <HelpIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Commercial support</span>
            </button>
            <span className="hidden h-4 w-px bg-white/25 sm:inline-block" />
            <span className="hidden text-[13px] text-white/90 md:inline">
              {profile.fullName}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex h-8 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border border-white bg-nbc-red px-3 text-[12.5px] font-semibold text-white transition hover:bg-nbc-red-dark sm:gap-2 sm:px-3.5 sm:text-[13px]"
            >
              <LockIcon className="h-3.5 w-3.5 flex-none" />
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* White Commercial Header — Matches nbc.ca */}
      <header className="sticky top-0 z-40 border-b border-[#e5e5e5] bg-white">
        <div className="nbc-container flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-5 py-3 lg:py-0">
            <button
              type="button"
              onClick={() => setTab("treasury")}
              className="flex items-center gap-3 py-2"
            >
              <img src={logoNbc} alt="National Bank" width={155} height={50} className="h-[38px] w-auto lg:h-[44px]" />
              <span className="hidden h-6 w-px bg-[#d8d8d8] sm:inline-block" />
              <span className="hidden text-[13.5px] font-semibold text-nbc-navy sm:inline">
                Business Cash Management
              </span>
            </button>

          </div>

          <nav aria-label="Commercial banking navigation" className="hidden lg:block">
            <ul className="flex items-center">
              {navTabs.map(([id, label]) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setTab(id)}
                    className={`border-b-[3px] px-3 py-[26px] text-[14px] leading-[20px] transition xl:px-3.5 ${
                      tab === id
                        ? "border-nbc-red font-semibold text-nbc-navy"
                        : "border-transparent text-[#565656] hover:text-nbc-navy"
                    }`}
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="lg:hidden"><div className="scroll-tabs border-t border-[#efefef] px-2">
          {navTabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`whitespace-nowrap border-b-[3px] px-3.5 py-3 text-[13.5px] transition ${
                tab === id
                  ? "border-nbc-red font-semibold text-nbc-navy"
                  : "border-transparent text-[#565656]"
              }`}
            >
              {label}
            </button>
          ))}
          </div>
        </div>
      </header>

      {/* Transaction Sending Overlay */}
      <TransactionSendOverlay
        tx={activeAnimatedTx}
        phase={animatedTxPhase}
        onClose={() => setActiveAnimatedTx(null)}
        onViewActivity={() => {
          setActiveAnimatedTx(null);
          setTab("ledger");
        }}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[6px] bg-nbc-navy px-5 py-3 text-[13.5px] font-medium text-white shadow-lg animate-fade-up">
          {toast}
        </div>
      )}

      <main className="nbc-container pt-8">
        {/* Entity Identification Strip */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[#e5e2da] pb-5">
          <div className="min-w-0">
            <h1 className="break-words text-[26px] font-bold leading-[32px] text-nbc-navy sm:text-[32px] sm:leading-[38px]">
              {profile.fullName}
            </h1>
            <p className="mt-1 text-[13px] text-[#565656] sm:text-[13.5px]">
              {profile.businessNumber ?? "Corporate Operating Profile"} · {profile.branchName}
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-4 sm:flex sm:w-auto sm:gap-6 sm:text-right">
            <div>
              <span className="block text-[12px] text-[#565656]">Consolidated liquidity (CAD eq.)</span>
              <span className="text-[18px] font-bold tabular-nums text-nbc-navy sm:text-[20px]">
                {formatMoney(summary.totalLiquidityCad)}
              </span>
            </div>
            <div>
              <span className="block text-[12px] text-[#565656]">Available credit facilities</span>
              <span className="text-[18px] font-bold tabular-nums text-[#121212] sm:text-[20px]">
                {formatMoney(summary.availableCredit)}
              </span>
            </div>
          </div>
        </div>

        {/* TAB 1: COMMERCIAL CASH POSITION (Distinct Corporate Treasury Table Layout) */}
        {tab === "treasury" && (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left 8 Columns: Structured Multi-Currency Treasury Tables */}
            <div className="space-y-6 lg:col-span-8">
              {/* Operating & Treasury Accounts Table */}
              <section className="overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <div className="flex items-center justify-between border-b border-[#ece8df] bg-[#fcfbf8] px-5 py-4">
                  <div className="flex items-center gap-3">
                    <img src={pictoComptesRed} alt="" aria-hidden className="h-7 w-7 object-contain" />
                    <h2 className="text-[18px] font-bold text-nbc-navy">
                      Operating and treasury accounts
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setWireMode("treasury");
                      setTab("wires");
                    }}
                    className="text-[13.5px] font-medium text-[#1572C5] underline decoration-1 underline-offset-2 hover:no-underline"
                  >
                    Inter-account sweep
                  </button>
                </div>

                <div>
                  <table className="w-full text-left text-[13.5px] sm:text-[14px]">
                    <thead className="border-b border-[#ececec] bg-[#faf9f6] text-[11.5px] font-semibold text-[#565656] sm:text-[12px]">
                      <tr>
                        <th className="px-3.5 py-2.5 sm:px-5 sm:py-3">Account</th>
                        <th className="hidden px-5 py-3 md:table-cell">Account number</th>
                        <th className="hidden px-5 py-3 sm:table-cell">Ccy</th>
                        <th className="px-3.5 py-2.5 text-right sm:px-5 sm:py-3">Available balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#efefef]">
                      {summary.operatingAndReserves.map((acc) => (
                        <tr key={acc.id} className="hover:bg-[#faf8f3]">
                          <td className="px-4 py-4 sm:px-5">
                            <button
                              type="button"
                              onClick={() => {
                                setLedgerAcc(acc.id);
                                setTab("ledger");
                              }}
                              className="text-left font-semibold text-[#1572C5] underline decoration-1 underline-offset-2 hover:text-[#105797] hover:no-underline"
                            >
                              {acc.name}
                            </button>
                            <p className="mt-0.5 text-[12.5px] text-[#565656]">
                              {acc.subtitle}
                              {acc.rate ? ` · ${acc.rate}` : ""}
                            </p>
                            <p className="mt-0.5 font-mono text-[12px] text-[#777] md:hidden">
                              {acc.number}
                              <span className="sm:hidden"> · {acc.currency}</span>
                            </p>
                          </td>
                          <td className="hidden whitespace-nowrap px-5 py-4 font-mono text-[13px] text-[#565656] md:table-cell">
                            {acc.number}
                          </td>
                          <td className="hidden px-5 py-4 font-semibold text-[#333] sm:table-cell">{acc.currency}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-right text-[15.5px] font-bold tabular-nums text-[#121212] sm:px-5 sm:text-[16.5px]">
                            {formatMoney(acc.balance, acc.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Credit Lines & Commercial Cards Table */}
              <section className="overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <div className="flex items-center justify-between border-b border-[#ece8df] bg-[#fcfbf8] px-5 py-4">
                  <div className="flex items-center gap-3">
                    <img src={pictoEmpruntsRed} alt="" aria-hidden className="h-7 w-7 object-contain" />
                    <h2 className="text-[18px] font-bold text-nbc-navy">
                      Lines of credit and corporate cards
                    </h2>
                  </div>
                  <span className="text-[13px] text-[#565656]">
                    Drawn: <strong className="tabular-nums text-[#121212]">{formatMoney(summary.creditUsed)}</strong>
                  </span>
                </div>

                <div>
                  <table className="w-full text-left text-[13.5px] sm:text-[14px]">
                    <thead className="border-b border-[#ececec] bg-[#faf9f6] text-[11.5px] font-semibold text-[#565656] sm:text-[12px]">
                      <tr>
                        <th className="px-3.5 py-2.5 sm:px-5 sm:py-3">Facility</th>
                        <th className="hidden px-5 py-3 sm:table-cell">Authorized limit</th>
                        <th className="hidden px-5 py-3 md:table-cell">Rate</th>
                        <th className="px-3.5 py-2.5 text-right sm:px-5 sm:py-3">Balance drawn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#efefef]">
                      {summary.facilities.map((acc) => (
                        <tr key={acc.id} className="hover:bg-[#faf8f3]">
                          <td className="px-4 py-4 sm:px-5">
                            <p className="font-semibold text-[#121212]">{acc.name}</p>
                            <p className="mt-0.5 font-mono text-[12.5px] text-[#565656]">{acc.number}</p>
                            <p className="mt-0.5 text-[12px] text-[#777] md:hidden">
                              <span className="sm:hidden">
                                Limit {acc.limit ? formatMoney(acc.limit, acc.currency) : "—"} ·{" "}
                              </span>
                              {acc.rate ?? "—"}
                            </p>
                          </td>
                          <td className="hidden whitespace-nowrap px-5 py-4 tabular-nums text-[#565656] sm:table-cell">
                            {acc.limit ? formatMoney(acc.limit, acc.currency) : "—"}
                          </td>
                          <td className="hidden whitespace-nowrap px-5 py-4 text-[13px] text-[#565656] md:table-cell">
                            {acc.rate ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-right text-[15.5px] font-bold tabular-nums text-[#121212] sm:px-5 sm:text-[16.5px]">
                            {formatMoney(acc.balance, acc.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Recent Commercial Activity */}
              <section className="overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <div className="flex items-center justify-between border-b border-[#ece8df] px-5 py-4">
                  <h2 className="text-[18px] font-bold text-nbc-navy">Recent commercial postings</h2>
                  <button
                    type="button"
                    onClick={() => setTab("ledger")}
                    className="text-[14px] font-medium text-[#1572C5] underline decoration-1 underline-offset-2 hover:no-underline"
                  >
                    Full ledger
                  </button>
                </div>
                {/* Compact Mobile Commercial Postings (zero horizontal scroll) */}
                <ul className="divide-y divide-[#f1f1f1] sm:hidden">
                  {profile.transactions.slice(0, 5).map((tx) => {
                    const acc = profile.accounts.find((a) => a.id === tx.accountId);
                    const isNew = recentTxIds.includes(tx.id);
                    return (
                      <li
                        key={tx.id}
                        className={`flex items-start justify-between gap-3 px-3.5 py-2.5 ${
                          isNew ? "animate-tx-row-new" : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-[13px] font-medium leading-[18px] text-[#121212]">
                            {tx.description}
                          </p>
                          <p className="mt-0.5 truncate text-[11.5px] text-[#666]">
                            <span className="tabular-nums">{tx.date}</span> · {acc?.name ?? tx.accountId}
                          </p>
                        </div>
                        <span
                          className={`flex-none whitespace-nowrap pt-0.5 text-right text-[13px] font-semibold tabular-nums ${
                            tx.amount >= 0 ? "text-[#017a33]" : "text-[#121212]"
                          }`}
                        >
                          {tx.amount >= 0
                            ? `+${formatMoney(tx.amount, acc?.currency ?? "CAD")}`
                            : formatMoney(tx.amount, acc?.currency ?? "CAD")}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {/* Tablet & Desktop Table */}
                <div className="hidden sm:block">
                  <table className="w-full table-fixed text-left text-[13.5px]">
                    <thead className="border-b border-[#ececec] bg-[#faf9f6] text-[12px] font-semibold text-[#565656]">
                      <tr>
                        <th className="w-[112px] px-5 py-3">Date</th>
                        <th className="px-5 py-3">Transaction</th>
                        <th className="hidden w-[195px] px-5 py-3 md:table-cell">Account</th>
                        <th className="w-[130px] px-5 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f1f1]">
                      {profile.transactions.slice(0, 5).map((tx) => {
                        const acc = profile.accounts.find((a) => a.id === tx.accountId);
                        const isNew = recentTxIds.includes(tx.id);
                        return (
                          <tr key={tx.id} className={`hover:bg-[#faf8f3] ${isNew ? "animate-tx-row-new" : ""}`}>
                            <td className="whitespace-nowrap px-5 py-3 tabular-nums text-[#565656]">{tx.date}</td>
                            <td className="break-words px-5 py-3 font-medium text-[#121212]">
                              {tx.description}
                              <span className="mt-0.5 block text-[12px] font-normal text-[#777] md:hidden">
                                {acc?.name ?? tx.accountId}
                              </span>
                            </td>
                            <td className="hidden truncate px-5 py-3 text-[13px] text-[#565656] md:table-cell">
                              {acc?.name ?? tx.accountId}
                            </td>
                            <td
                              className={`whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums ${
                                tx.amount >= 0 ? "text-[#017a33]" : "text-[#121212]"
                              }`}
                            >
                              {tx.amount >= 0
                                ? `+${formatMoney(tx.amount, acc?.currency ?? "CAD")}`
                                : formatMoney(tx.amount, acc?.currency ?? "CAD")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* Right 4 Columns: Pending Batches, Receivables & Commercial Manager */}
            <aside className="space-y-6 lg:col-span-4">
              {/* Scheduled EFT & Tax Obligations */}
              <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <h2 className="text-[18px] font-bold text-nbc-navy">Scheduled batches & obligations</h2>
                <div className="mt-4 divide-y divide-[#efefef] text-[14px]">
                  <div className="pb-4">
                    <div className="flex items-baseline justify-between">
                      <span className="font-semibold text-[#121212]">Bi-weekly EFT payroll</span>
                      <span className="font-bold tabular-nums text-nbc-navy">
                        {formatMoney(summary.activePayrollTotal)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-[#565656]">
                      {payroll.filter((e) => e.active).length} active employees ready for release
                    </p>
                    <button
                      type="button"
                      onClick={handleRunPayroll}
                      className="mt-2.5 text-[13.5px] font-semibold text-[#1572C5] underline decoration-1 underline-offset-2 hover:no-underline"
                    >
                      Approve and release batch →
                    </button>
                  </div>

                  <div className="pt-4">
                    <div className="flex items-baseline justify-between">
                      <span className="font-semibold text-[#121212]">Open client receivables</span>
                      <span className="font-bold tabular-nums text-[#121212]">
                        {formatMoney(summary.openReceivables)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-[#565656]">
                      {invoices.filter((i) => i.status !== "Paid").length} unpaid invoices outstanding
                    </p>
                    <button
                      type="button"
                      onClick={() => setTab("invoices")}
                      className="mt-2.5 text-[13.5px] font-semibold text-[#1572C5] underline decoration-1 underline-offset-2 hover:no-underline"
                    >
                      Manage receivables →
                    </button>
                  </div>
                </div>
              </div>

              {/* Commercial Quick Operations */}
              <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <h2 className="text-[18px] font-bold text-nbc-navy">Cash management tools</h2>
                <ul className="mt-3 divide-y divide-[#efefef] text-[14.5px]">
                  {[
                    {
                      label: "Send domestic or international wire",
                      onClick: () => {
                        setWireMode("wire");
                        setTab("wires");
                      },
                    },
                    {
                      label: "CRA & Revenu Québec tax remittance",
                      onClick: () => {
                        setWireMode("tax");
                        setTab("wires");
                      },
                    },
                    {
                      label: "Issue a client invoice",
                      onClick: () => setTab("invoices"),
                    },
                    {
                      label: "Manage employee Mastercard® cards",
                      onClick: () => setTab("cards"),
                    },
                  ].map((item) => (
                    <li key={item.label}>
                      <button
                        type="button"
                        onClick={item.onClick}
                        className="group flex w-full items-center justify-between py-3 text-left font-medium text-[#1572C5] hover:text-[#105797]"
                      >
                        <span className="underline decoration-transparent underline-offset-2 group-hover:decoration-current">
                          {item.label}
                        </span>
                        <ArrowRight className="h-3 w-3 text-[#7a7a7a] transition group-hover:translate-x-0.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Commercial Relationship Manager */}
              <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <div className="flex items-start gap-3.5">
                  <img src={pictoOrdinateur} alt="" aria-hidden className="h-11 w-11 flex-none object-contain" />
                  <div>
                    <h2 className="text-[17px] font-bold text-nbc-navy">Commercial banking team</h2>
                    <p className="mt-1 text-[14px] font-medium text-[#121212]">{profile.advisorName}</p>
                    <p className="mt-0.5 text-[13px] text-[#565656]">{profile.branchName}</p>
                    <p className="mt-2 text-[12.5px] text-[#565656]">
                      USD indicative rate: 1 USD = {FX_RATES.USD.buyCad} CAD
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* TAB 2: PAYROLL & EFT BATCHES */}
        {tab === "payroll" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[6px] border border-[#e5e2da] bg-white p-6">
              <div>
                <h2 className="text-[22px] font-bold text-nbc-navy">Direct deposit payroll batch</h2>
                <p className="mt-1 text-[14px] text-[#565656]">
                  {payroll.filter((e) => e.active).length} of {payroll.length} employees selected · Total batch:{" "}
                  <strong className="tabular-nums text-[#121212]">{formatMoney(summary.activePayrollTotal)}</strong>
                </p>
              </div>
              <button type="button" onClick={handleRunPayroll} className="nbc-btn nbc-btn-primary">
                Release EFT payroll batch
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
              <div className="overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white lg:col-span-8">
                <div>
                  <table className="w-full text-left text-[13px] sm:text-[14px]">
                    <thead className="border-b border-[#e5e2da] bg-[#fcfbf8] text-[11.5px] font-semibold text-[#565656] sm:text-[12px]">
                      <tr>
                        <th className="w-12 px-3 py-3 sm:px-5">Pay</th>
                        <th className="px-3 py-3 sm:px-5">Employee</th>
                        <th className="hidden px-5 py-3.5 md:table-cell">Department</th>
                        <th className="px-3 py-3 text-right sm:px-5">Net ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#efefef]">
                      {payroll.map((emp) => (
                        <tr key={emp.id} className="hover:bg-[#faf8f3]">
                          <td className="px-4 py-3.5 sm:px-5">
                            <input
                              type="checkbox"
                              checked={emp.active}
                              onChange={() => toggleEmployeeActive(emp.id)}
                              className="h-4 w-4 accent-[#e41c23]"
                            />
                          </td>
                          <td className="px-4 py-3.5 sm:px-5">
                            <p className="font-semibold text-[#121212]">{emp.name}</p>
                            <p className="text-[12.5px] text-[#565656]">
                              {emp.role}
                              <span className="md:hidden"> · {emp.department}</span>
                            </p>
                          </td>
                          <td className="hidden px-5 py-3.5 text-[#565656] md:table-cell">{emp.department}</td>
                          <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-[#121212] sm:px-5">
                            {formatMoney(emp.biweeklyNet)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <form
                onSubmit={handleAddEmployee}
                className="h-fit space-y-4 rounded-[6px] border border-[#e5e2da] bg-white p-6 lg:col-span-4"
              >
                <h3 className="text-[18px] font-bold text-nbc-navy">Add employee to roster</h3>
                <div>
                  <label htmlFor="emp-n" className="block text-[13px] font-semibold text-[#121212]">
                    Employee name
                  </label>
                  <input
                    id="emp-n"
                    type="text"
                    value={newEmpName}
                    onChange={(e) => setNewEmpName(e.target.value)}
                    required
                    className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                  />
                </div>
                <div>
                  <label htmlFor="emp-r" className="block text-[13px] font-semibold text-[#121212]">
                    Role / title
                  </label>
                  <input
                    id="emp-r"
                    type="text"
                    value={newEmpRole}
                    onChange={(e) => setNewEmpRole(e.target.value)}
                    className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="emp-d" className="block text-[13px] font-semibold text-[#121212]">
                      Department
                    </label>
                    <select
                      id="emp-d"
                      value={newEmpDept}
                      onChange={(e) => setNewEmpDept(e.target.value)}
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-2.5 py-2 text-[13.5px] text-nbc-navy"
                    >
                      <option>Operations</option>
                      <option>Design</option>
                      <option>Production</option>
                      <option>Sales</option>
                      <option>Finance</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="emp-p" className="block text-[13px] font-semibold text-[#121212]">
                      Net pay ($)
                    </label>
                    <input
                      id="emp-p"
                      type="number"
                      min="100"
                      value={newEmpPay}
                      onChange={(e) => setNewEmpPay(e.target.value)}
                      required
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] font-semibold tabular-nums text-[#121212]"
                    />
                  </div>
                </div>
                <button type="submit" className="nbc-btn nbc-btn-ghost w-full">
                  Add employee
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: RECEIVABLES & INVOICES */}
        {tab === "invoices" && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white lg:col-span-8">
              <div className="border-b border-[#ece8df] bg-[#fcfbf8] px-5 py-4">
                <h2 className="text-[19px] font-bold text-nbc-navy">Accounts receivable ledger</h2>
              </div>
              {/* Compact Mobile Receivables List (zero horizontal scroll) */}
              <ul className="divide-y divide-[#efefef] sm:hidden">
                {invoices.map((inv) => (
                  <li key={inv.id} className="px-3.5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-[13.5px] font-semibold text-[#121212]">
                          {inv.clientName}
                        </p>
                        <p className="mt-0.5 font-mono text-[11.5px] text-[#666]">
                          {inv.invoiceNo} · Due {inv.dueDate}
                        </p>
                      </div>
                      <span className="flex-none whitespace-nowrap text-[14px] font-bold tabular-nums text-[#121212]">
                        {formatMoney(inv.amount, inv.currency)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[12px]">
                      <span
                        className={`font-semibold ${
                          inv.status === "Paid"
                            ? "text-[#017a33]"
                            : inv.status === "Overdue"
                            ? "text-nbc-red"
                            : "text-nbc-navy"
                        }`}
                      >
                        {inv.status}
                      </span>
                      {inv.status !== "Paid" ? (
                        <button
                          type="button"
                          onClick={() => handleCollectInvoice(inv)}
                          className="font-medium text-[#1572C5] underline decoration-1 underline-offset-2"
                        >
                          Record payment
                        </button>
                      ) : (
                        <span className="text-[#777]">Settled</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {/* Tablet & Desktop Receivables Table */}
              <div className="hidden sm:block">
                <table className="w-full table-fixed text-left text-[14px]">
                  <thead className="border-b border-[#ececec] bg-[#faf9f6] text-[12px] font-semibold text-[#565656]">
                    <tr>
                      <th className="hidden w-[105px] px-5 py-3 md:table-cell">Invoice</th>
                      <th className="px-5 py-3">Client</th>
                      <th className="hidden w-[115px] px-5 py-3 lg:table-cell">Due date</th>
                      <th className="w-[88px] px-4 py-3">Status</th>
                      <th className="w-[125px] px-4 py-3 text-right">Amount</th>
                      <th className="w-[130px] px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#efefef]">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-[#faf8f3]">
                        <td className="hidden whitespace-nowrap px-5 py-3.5 font-mono text-[13px] text-[#565656] md:table-cell">
                          {inv.invoiceNo}
                        </td>
                        <td className="break-words px-5 py-3.5 font-semibold text-[#121212]">
                          {inv.clientName}
                          <span className="mt-0.5 block font-mono text-[12px] font-normal text-[#777] lg:hidden">
                            <span className="md:hidden">{inv.invoiceNo} · </span>Due {inv.dueDate}
                          </span>
                        </td>
                        <td className="hidden whitespace-nowrap px-5 py-3.5 tabular-nums text-[#565656] lg:table-cell">
                          {inv.dueDate}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`text-[12.5px] font-semibold ${
                              inv.status === "Paid"
                                ? "text-[#017a33]"
                                : inv.status === "Overdue"
                                ? "text-nbc-red"
                                : "text-nbc-navy"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right font-bold tabular-nums text-[#121212]">
                          {formatMoney(inv.amount, inv.currency)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right">
                          {inv.status !== "Paid" ? (
                            <button
                              type="button"
                              onClick={() => handleCollectInvoice(inv)}
                              className="font-medium text-[#1572C5] underline decoration-1 underline-offset-2 hover:no-underline"
                            >
                              Record payment
                            </button>
                          ) : (
                            <span className="text-[12.5px] text-[#777]">Settled</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <form
              onSubmit={handleCreateInvoice}
              className="h-fit space-y-4 rounded-[6px] border border-[#e5e2da] bg-white p-6 lg:col-span-4"
            >
              <h3 className="text-[18px] font-bold text-nbc-navy">Issue client invoice</h3>
              <div>
                <label htmlFor="inv-c" className="block text-[13px] font-semibold text-[#121212]">
                  Client company name
                </label>
                <input
                  id="inv-c"
                  type="text"
                  value={invClient}
                  onChange={(e) => setInvClient(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="inv-a" className="block text-[13px] font-semibold text-[#121212]">
                    Amount
                  </label>
                  <input
                    id="inv-a"
                    type="number"
                    min="1"
                    value={invAmount}
                    onChange={(e) => setInvAmount(e.target.value)}
                    required
                    className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] font-semibold tabular-nums text-[#121212]"
                  />
                </div>
                <div>
                  <label htmlFor="inv-cur" className="block text-[13px] font-semibold text-[#121212]">
                    Currency
                  </label>
                  <select
                    id="inv-cur"
                    value={invCurr}
                    onChange={(e) => setInvCurr(e.target.value as "CAD" | "USD")}
                    className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-2.5 py-2 text-[14px] text-nbc-navy"
                  >
                    <option value="CAD">CAD</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="inv-d" className="block text-[13px] font-semibold text-[#121212]">
                  Due date
                </label>
                <input
                  id="inv-d"
                  type="date"
                  value={invDue}
                  onChange={(e) => setInvDue(e.target.value)}
                  className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                />
              </div>
              <button type="submit" className="nbc-btn nbc-btn-primary w-full">
                Create invoice
              </button>
            </form>
          </div>
        )}

        {/* TAB 4: WIRES, TAX REMITTANCES & SWEEPS */}
        {tab === "wires" && (
          <div className="space-y-6">
            <div className="scroll-tabs rounded-t-[6px] border-b border-[#dcd8ce] bg-white px-2">
              {(
                [
                  ["wire", "Domestic & international wire"],
                  ["tax", "Government tax remittance (CRA / RQ)"],
                  ["treasury", "Inter-account treasury sweep"],
                  ["fx", "Currency conversion"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setWireMode(id)}
                  className={`border-b-[3px] px-4 py-3.5 text-[14px] transition sm:px-5 ${
                    wireMode === id
                      ? "border-nbc-red font-semibold text-nbc-navy"
                      : "border-transparent text-[#565656] hover:text-nbc-navy"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {wireMode === "wire" && (
              <form
                onSubmit={handleSendWire}
                className="max-w-[680px] space-y-4 rounded-[6px] border border-[#e5e2da] bg-white p-6"
              >
                <h2 className="text-[20px] font-bold text-nbc-navy">Send a commercial wire</h2>
                <div>
                  <label htmlFor="w-src" className="block text-[13px] font-semibold text-[#121212]">
                    Debit account
                  </label>
                  <select
                    id="w-src"
                    value={wireSrcId}
                    onChange={(e) => setWireSrcId(e.target.value)}
                    className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                  >
                    {operatingAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({formatMoney(a.balance, a.currency)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="w-ben" className="block text-[13px] font-semibold text-[#121212]">
                    Beneficiary name & routing / SWIFT
                  </label>
                  <input
                    id="w-ben"
                    type="text"
                    value={wireBeneficiary}
                    onChange={(e) => setWireBeneficiary(e.target.value)}
                    required
                    className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2.5 text-[14px] text-[#121212]"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="w-amt" className="block text-[13px] font-semibold text-[#121212]">
                      Amount
                    </label>
                    <input
                      id="w-amt"
                      type="number"
                      min="1"
                      step="0.01"
                      value={wireAmt}
                      onChange={(e) => setWireAmt(e.target.value)}
                      required
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2.5 text-[15px] font-semibold tabular-nums text-[#121212]"
                    />
                  </div>
                  <div>
                    <label htmlFor="w-fx" className="block text-[13px] font-semibold text-[#121212]">
                      Destination currency
                    </label>
                    <select
                      id="w-fx"
                      value={wireFxCurr}
                      onChange={(e) => setWireFxCurr(e.target.value as keyof typeof FX_RATES)}
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                    >
                      {Object.entries(FX_RATES).map(([code, fx]) => (
                        <option key={code} value={code}>
                          {code} — {fx.name} ({fx.sellCad} CAD)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button type="submit" className="nbc-btn nbc-btn-primary">
                  Submit wire payment
                </button>
              </form>
            )}

            {wireMode === "tax" && (
              <form
                onSubmit={handleTaxRemittance}
                className="max-w-[620px] space-y-4 rounded-[6px] border border-[#e5e2da] bg-white p-6"
              >
                <h2 className="text-[20px] font-bold text-nbc-navy">Government tax & source deductions</h2>
                <div>
                  <label htmlFor="tx-pay" className="block text-[13px] font-semibold text-[#121212]">
                    Tax authority / remittance type
                  </label>
                  <select
                    id="tx-pay"
                    value={taxPayeeId}
                    onChange={(e) => setTaxPayeeId(e.target.value)}
                    className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                  >
                    {profile.payees.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.accountRef})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="tx-amt" className="block text-[13px] font-semibold text-[#121212]">
                    Remittance amount (CAD)
                  </label>
                  <input
                    id="tx-amt"
                    type="number"
                    min="1"
                    step="0.01"
                    value={taxAmt}
                    onChange={(e) => setTaxAmt(e.target.value)}
                    required
                    className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2.5 text-[15px] font-semibold tabular-nums text-[#121212]"
                  />
                </div>
                <button type="submit" className="nbc-btn nbc-btn-primary">
                  Submit remittance
                </button>
              </form>
            )}

            {wireMode === "treasury" && (
              <form
                onSubmit={handleTreasuryTransfer}
                className="max-w-[660px] space-y-4 rounded-[6px] border border-[#e5e2da] bg-white p-6"
              >
                <h2 className="text-[20px] font-bold text-nbc-navy">Inter-account treasury sweep</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="ts-f" className="block text-[13px] font-semibold text-[#121212]">
                      From account
                    </label>
                    <select
                      id="ts-f"
                      value={trFromId}
                      onChange={(e) => setTrFromId(e.target.value)}
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                    >
                      {operatingAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({formatMoney(a.balance, a.currency)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="ts-t" className="block text-[13px] font-semibold text-[#121212]">
                      To account / credit line
                    </label>
                    <select
                      id="ts-t"
                      value={trToId}
                      onChange={(e) => setTrToId(e.target.value)}
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                    >
                      {profile.accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({formatMoney(a.balance, a.currency)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="ts-a" className="block text-[13px] font-semibold text-[#121212]">
                    Transfer amount
                  </label>
                  <input
                    id="ts-a"
                    type="number"
                    min="1"
                    step="0.01"
                    value={trAmt}
                    onChange={(e) => setTrAmt(e.target.value)}
                    required
                    className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2.5 text-[15px] font-semibold tabular-nums text-[#121212]"
                  />
                </div>
                <button type="submit" className="nbc-btn nbc-btn-primary">
                  Confirm transfer
                </button>
              </form>
            )}

            {wireMode === "fx" && (
              <form onSubmit={handleFxConvert} className="max-w-[620px] space-y-4 rounded-[6px] border border-[#e5e2da] bg-white p-6">
                <h2 className="text-[20px] font-bold text-nbc-navy">Convert between CAD and USD</h2>
                <p className="text-[13px] text-[#565656]">
                  Funds are converted at the posted rate and both accounts are updated.
                </p>
                <div>
                  <label htmlFor="fx-from" className="block text-[13px] font-semibold text-[#121212]">
                    Convert from
                  </label>
                  <select
                    id="fx-from"
                    value={fxFromId}
                    onChange={(e) => setFxFromId(e.target.value)}
                    className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                  >
                    {operatingAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({formatMoney(a.balance, a.currency)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="fx-amt" className="block text-[13px] font-semibold text-[#121212]">
                    Amount to convert
                  </label>
                  <input
                    id="fx-amt"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={fxAmount}
                    onChange={(e) => setFxAmount(e.target.value)}
                    className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2.5 text-[15px] font-semibold tabular-nums text-[#121212]"
                  />
                </div>
                <div className="rounded-[6px] bg-[#faf8f3] p-3 text-[13px] text-[#565656]">
                  {(() => {
                    const from = profile.accounts.find((a) => a.id === fxFromId);
                    const amt = Number(fxAmount) || 0;
                    if (!from) return "Select an account.";
                    if (from.currency === "CAD") {
                      return `You receive approximately ${(amt / FX_RATES.USD.sellCad).toFixed(2)} USD at 1 USD = ${FX_RATES.USD.sellCad} CAD.`;
                    }
                    return `You receive approximately ${(amt * FX_RATES.USD.buyCad).toFixed(2)} CAD at 1 USD = ${FX_RATES.USD.buyCad} CAD.`;
                  })()}
                </div>
                <button type="submit" className="nbc-btn nbc-btn-primary">
                  Convert funds
                </button>
              </form>
            )}
          </div>
        )}

        {/* TAB 5: CORPORATE CARDS */}
        {tab === "cards" && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <img src={pictoCarteCreditRed} alt="" aria-hidden className="h-8 w-8 object-contain" />
              <div>
                <h2 className="text-[24px] font-bold text-nbc-navy">Corporate Mastercard® cards</h2>
                <p className="text-[13.5px] text-[#565656]">
                  Manage cardholder controls across executive and operational cards
                </p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {profile.cards.map((card) => (
                <div
                  key={card.id}
                  className="mx-auto w-full max-w-[400px] rounded-[6px] border border-[#e5e2da] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
                >
                  <BankCardVisual card={card} holderName={profile.fullName} />
                  <div className="mt-5 divide-y divide-[#efefef] text-[14px]">
                    {(
                      [
                        ["locked", "Lock corporate card", card.locked],
                        ["contactless", "Contactless purchases", card.contactless],
                        ["international", "Foreign / travel charges", card.international],
                        ["onlinePurchases", "Online & software subscriptions", card.onlinePurchases],
                      ] as const
                    ).map(([field, label, active]) => (
                      <div key={field} className="flex items-center justify-between py-3">
                        <span className="text-[#333333]">{label}</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={active}
                          onClick={() => toggleCardSetting(card.id, field)}
                          className={`relative h-6 w-11 rounded-full transition ${
                            active ? "bg-nbc-red" : "bg-[#cfcfcf]"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                              active ? "left-5" : "left-0.5"
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: COMMERCIAL STATEMENTS */}
        {tab === "ledger" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3 rounded-[6px] border border-[#e5e2da] bg-white p-4">
              <select
                value={ledgerAcc}
                onChange={(e) => setLedgerAcc(e.target.value)}
                className="rounded-[6px] border border-[#c9c3b6] bg-white px-3.5 py-2 text-[14px] font-medium text-nbc-navy"
              >
                <option value="all">All corporate accounts</option>
                {profile.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </option>
                ))}
              </select>
              <div className="relative flex-1 min-w-[200px]">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777]" />
                <input
                  type="text"
                  value={ledgerQuery}
                  onChange={(e) => setLedgerQuery(e.target.value)}
                  placeholder="Search commercial transactions…"
                  className="w-full rounded-[6px] border border-[#c9c3b6] py-2 pl-9 pr-3 text-[14px] text-nbc-navy"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  downloadFile(
                    `statement-${profile.fullName.replace(/[^a-z0-9]+/gi, "-")}-${todayIso()}.csv`,
                    statementCsv(profile, ledgerAcc)
                  )
                }
                className="rounded-full border border-nbc-navy px-4 py-2 text-[12.5px] font-semibold text-nbc-navy transition hover:bg-nbc-navy hover:text-white"
              >
                Download statement (CSV)
              </button>
            </div>

            <div className="overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white">
              {/* Compact Mobile Commercial Statement List (zero horizontal scroll) */}
              <div className="sm:hidden">
                <div className="flex items-center justify-between border-b border-[#e5e2da] bg-[#fcfbf8] px-3.5 py-2.5 text-[11.5px] font-semibold text-[#565656]">
                  <span>Transaction</span>
                  <span>Amount</span>
                </div>
                <ul className="divide-y divide-[#efefef]">
                  {filteredLedger.map((tx) => {
                    const acc = profile.accounts.find((a) => a.id === tx.accountId);
                    const isNew = recentTxIds.includes(tx.id);
                    return (
                      <li
                        key={tx.id}
                        className={`flex items-start justify-between gap-3 px-3.5 py-2.5 ${
                          isNew ? "animate-tx-row-new" : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-[13px] font-medium leading-[18px] text-[#121212]">
                            {tx.description}
                          </p>
                          <p className="mt-0.5 truncate text-[11.5px] text-[#666]">
                            <span className="tabular-nums">{tx.date}</span> · {acc?.name ?? tx.accountId}
                          </p>
                        </div>
                        <div className="flex-none pt-0.5 text-right">
                          <span
                            className={`block whitespace-nowrap text-[13px] font-semibold tabular-nums ${
                              tx.amount >= 0 ? "text-[#017a33]" : "text-[#121212]"
                            }`}
                          >
                            {tx.amount >= 0
                              ? `+${formatMoney(tx.amount, acc?.currency ?? "CAD")}`
                              : formatMoney(tx.amount, acc?.currency ?? "CAD")}
                          </span>
                          <span className="block text-[10.5px] text-[#777]">
                            {tx.amount >= 0 ? "Credit" : "Debit"}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Tablet & Desktop Statement Table */}
              <div className="hidden sm:block">
                <table className="w-full table-fixed text-left text-[14px]">
                  <thead className="border-b border-[#e5e2da] bg-[#fcfbf8] text-[12px] font-semibold text-[#565656]">
                    <tr>
                      <th className="w-[112px] px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5">Description</th>
                      <th className="hidden w-[185px] px-5 py-3.5 md:table-cell">Account</th>
                      <th className="w-[125px] px-5 py-3.5 text-right">Debit ($)</th>
                      <th className="w-[125px] px-5 py-3.5 text-right">Credit ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#efefef]">
                    {filteredLedger.map((tx) => {
                      const acc = profile.accounts.find((a) => a.id === tx.accountId);
                      const isNew = recentTxIds.includes(tx.id);
                      return (
                        <tr key={tx.id} className={`hover:bg-[#faf8f3] ${isNew ? "animate-tx-row-new" : ""}`}>
                          <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-[#565656]">{tx.date}</td>
                          <td className="break-words px-5 py-3.5 font-medium text-[#121212]">
                            {tx.description}
                            <span className="mt-0.5 block text-[12px] font-normal text-[#777] md:hidden">
                              {acc?.name ?? tx.accountId}
                            </span>
                          </td>
                          <td className="hidden truncate px-5 py-3.5 text-[13px] text-[#565656] md:table-cell">
                            {acc?.name ?? tx.accountId}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold tabular-nums text-[#121212]">
                            {tx.amount < 0 ? formatMoney(Math.abs(tx.amount), acc?.currency ?? "CAD") : "—"}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold tabular-nums text-[#017a33]">
                            {tx.amount >= 0 ? formatMoney(tx.amount, acc?.currency ?? "CAD") : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
