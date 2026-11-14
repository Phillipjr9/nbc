import { useEffect, useMemo, useState } from "react";
import {
  logoNbc,
  pictoCarteCreditRed,
  pictoComptesRed,
  pictoEmpruntsRed,
  pictoOrdinateur,
} from "../assets/nbcAssets";
import {
  BusinessInvoice,
  BankUserProfile,
  DEFAULT_PREFERENCES,
  EmployeePayrollItem,
  formatMoney,
  FX_RATES,
} from "../banking/bankingTypes";
import { round2 } from "../banking/adminOps";
import BankCardVisual from "./BankCardVisual";
import { ArrowRight, HelpIcon, LockIcon, SearchIcon } from "./icons";
import TransactionSendOverlay, {
  AnimatedTxPayload,
  AnimatedTxPhase,
} from "./TransactionSendOverlay";

type BizTab = "treasury" | "payroll" | "invoices" | "wires" | "cards" | "ledger" | "account" | "settings";

type Props = {
  profile: BankUserProfile;
  initialTab?: BizTab;
  onUpdateProfile: (updater: (prev: BankUserProfile) => BankUserProfile) => void;
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

const EXTERNAL_TRANSFER_COUNTRIES = [
  "Canada",
  "United States",
  "United Kingdom",
  "Germany",
  "France",
  "Australia",
  "Singapore",
  "United Arab Emirates",
  "Japan",
  "India",
  "Mexico",
  "Brazil",
  "Sweden",
  "Belgium",
  "Hong Kong",
  "Switzerland",
];

export default function BusinessDashboard({
  profile,
  initialTab = "treasury",
  onUpdateProfile,
  onGoPublicSite,
  onGoHelp,
  onSignOut,
}: Props) {
  const [tab, setTab] = useState<BizTab>(initialTab);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab]);

  const [toast, setToast] = useState<string | null>(null);
  const [activeAnimatedTx, setActiveAnimatedTx] = useState<AnimatedTxPayload | null>(null);
  const [animatedTxPhase, setAnimatedTxPhase] = useState<AnimatedTxPhase>("verifying");
  const [recentTxIds, setRecentTxIds] = useState<string[]>([]);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [accountDetailId, setAccountDetailId] = useState<string | null>(
    () => profile.accounts.find((account) => account.id === "swift-chk")?.id ?? profile.accounts[0]?.id ?? null
  );
  const [activityPage, setActivityPage] = useState(0);
  const ACTIVITY_PAGE_SIZE = 6;
  const sortedTransactions = useMemo(
    () => [...profile.transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [profile.transactions]
  );
  const selectedTx = profile.transactions.find((tx) => tx.id === selectedTxId) ?? null;
  const selectedTxAccount = selectedTx ? profile.accounts.find((a) => a.id === selectedTx.accountId) : null;
  const accountDetail = profile.accounts.find((a) => a.id === accountDetailId) ?? null;
  const accountDetailTransactions = useMemo(
    () =>
      accountDetail
        ? sortedTransactions.filter((tx) => tx.accountId === accountDetail.id)
        : [],
    [accountDetail, sortedTransactions]
  );
  const accountDetailMeta = useMemo(() => {
    if (!accountDetail) return null;

    const accountTypeName =
      accountDetail.category === "chequing"
        ? "Business chequing"
        : accountDetail.category === "savings"
          ? "Treasury reserve"
          : accountDetail.category === "credit"
            ? "Business credit line"
            : "Business account";

    const remainingAvailable =
      accountDetail.category === "credit" && typeof accountDetail.limit === "number"
        ? Math.max(accountDetail.limit - (accountDetail.balance ?? 0), 0)
        : null;

    return {
      accountTypeName,
      remainingAvailable,
    };
  }, [accountDetail]);
  const activityPageCount = Math.max(1, Math.ceil(accountDetailTransactions.length / ACTIVITY_PAGE_SIZE));
  const safeActivityPage = Math.min(activityPage, activityPageCount - 1);
  const pagedAccountDetailTransactions = useMemo(
    () => accountDetailTransactions.slice(safeActivityPage * ACTIVITY_PAGE_SIZE, (safeActivityPage + 1) * ACTIVITY_PAGE_SIZE),
    [accountDetailTransactions, safeActivityPage]
  );
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
  const [wireBeneficiary, setWireBeneficiary] = useState("Studio Bois Franc Inc.");
  const [wireBankName, setWireBankName] = useState("Bank of Montreal Corporate Treasury");
  const [wireBankCountry, setWireBankCountry] = useState("United States");
  const [wireBankSwift, setWireBankSwift] = useState("BOMCUS33");
  const [wireAccountNumber, setWireAccountNumber] = useState("004112883420");
  const [wirePurpose, setWirePurpose] = useState("Equipment procurement");
  const [wireFeeMode, setWireFeeMode] = useState<"OUR" | "BEN" | "SHA">("SHA");
  const [wireCountry, setWireCountry] = useState("United States");
  const [wireAmt, setWireAmt] = useState("4250.00");
  const [wireFxCurr, setWireFxCurr] = useState<keyof typeof FX_RATES>("USD");

  type PendingTransfer = {
    kind: "wire" | "tax" | "treasury" | "fx";
    title: string;
    summary: string;
    fromLabel: string;
    toLabel: string;
    amount: number;
    actionLabel: string;
    onConfirm: () => void;
  };

  const [pendingTransfer, setPendingTransfer] = useState<PendingTransfer | null>(null);

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
  const txDisplayAmount = (amount: number, currency: "CAD" | "USD" = "CAD") =>
    formatMoney(Math.abs(amount), currency);

  const openAccountDetail = (accountId: string) => {
    setAccountDetailId(accountId);
    setSelectedTxId(null);
    setActivityPage(0);
    setTab("account");
  };

  const generatePdfStatement = (accountId: string | "all") => {
    const subjectAccount = accountId === "all" ? null : profile.accounts.find((a) => a.id === accountId) ?? null;
    const rows = accountId === "all"
      ? [...profile.transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      : accountDetailTransactions.length
        ? accountDetailTransactions
        : profile.transactions
            .filter((tx) => tx.accountId === accountId)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const statementDate = new Date();
    const statementPeriodLabel = new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric" }).format(statementDate);
    const summaryBalance = subjectAccount ? subjectAccount.balance : rows.reduce((sum, tx) => sum + tx.amount, 0);
    const accountLabel = subjectAccount ? `${subjectAccount.name} · ${subjectAccount.number}` : "All active corporate accounts";
    const rowsPerPage = 12;
    const statementPages: Transaction[][] = [];

    for (let index = 0; index < rows.length; index += rowsPerPage) {
      statementPages.push(rows.slice(index, index + rowsPerPage));
    }

    if (statementPages.length === 0) {
      statementPages.push([]);
    }

    const pageMarkup = statementPages
      .map((pageRows, pageIndex) => {
        const pageTransactions = pageRows.length
          ? pageRows
              .map((tx) => {
                const acc = profile.accounts.find((a) => a.id === tx.accountId);
                const dr = tx.amount < 0 ? formatMoney(Math.abs(tx.amount), acc?.currency ?? "CAD") : "—";
                const cr = tx.amount >= 0 ? formatMoney(Math.abs(tx.amount), acc?.currency ?? "CAD") : "—";
                return `
                  <tr>
                    <td>${tx.date}</td>
                    <td>${tx.description}</td>
                    <td>${acc?.name ?? tx.accountId}</td>
                    <td>${dr}</td>
                    <td>${cr}</td>
                  </tr>
                `;
              })
              .join("")
          : '<tr><td colspan="5">No transactions available for this statement period.</td></tr>';

        const totalDebits = pageRows.reduce((sum, tx) => (tx.amount < 0 ? sum + Math.abs(tx.amount) : sum), 0);
        const totalCredits = pageRows.reduce((sum, tx) => (tx.amount >= 0 ? sum + Math.abs(tx.amount) : sum), 0);

        return `
          <section class="statement-page">
            <header class="statement-header">
              <div class="brand-wrap">
                <img src="${logoNbc}" alt="National Bank" class="brand-logo" />
                <div class="brand-mark-wrap">
                  <img src="${logoBnMark}" alt="National Bank mark" class="brand-mark" />
                </div>
              </div>
              <div class="header-meta">
                <span class="eyebrow">Business banking</span>
                <strong>Account statement</strong>
              </div>
            </header>

            <div class="client-box">
              <div>
                <div class="eyebrow">Client</div>
                <div class="client-name">${profile.fullName}</div>
                <div class="client-sub">${profile.email}</div>
              </div>
              <div>
                <div class="eyebrow">Branch</div>
                <div class="client-sub">${profile.branchName}</div>
              </div>
              <div>
                <div class="eyebrow">Advisor</div>
                <div class="client-sub">${profile.advisorName}</div>
              </div>
            </div>

            <div class="summary-grid">
              <div class="summary-card">
                <span class="eyebrow">Account</span>
                <strong>${subjectAccount ? subjectAccount.name : "Commercial portfolio"}</strong>
                <small>${accountLabel}</small>
              </div>
              <div class="summary-card">
                <span class="eyebrow">Statement period</span>
                <strong>${statementPeriodLabel}</strong>
                <small>Prepared ${new Date().toLocaleDateString("en-CA")}</small>
              </div>
              <div class="summary-card highlight">
                <span class="eyebrow">Closing balance</span>
                <strong>${formatMoney(Math.abs(summaryBalance), subjectAccount?.currency ?? "CAD")}</strong>
                <small>${subjectAccount?.currency ?? "CAD"} • ${subjectAccount ? "Available" : "Portfolio"}</small>
              </div>
            </div>

            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Account</th>
                    <th>Debit</th>
                    <th>Credit</th>
                  </tr>
                </thead>
                <tbody>${pageTransactions}</tbody>
              </table>
            </div>

            <div class="totals-row">
              <span>Page ${pageIndex + 1} of ${statementPages.length}</span>
              <span>Debits: ${formatMoney(totalDebits, subjectAccount?.currency ?? "CAD")}</span>
              <span>Credits: ${formatMoney(totalCredits, subjectAccount?.currency ?? "CAD")}</span>
            </div>

            <footer class="statement-footer">
              <span>National Bank of Canada</span>
              <span>Secure banking • Confidential statement</span>
            </footer>
          </section>
        `;
      })
      .join("");

    const documentMarkup = `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><title>${subjectAccount ? `${subjectAccount.name} account statement` : "Commercial account statement"}</title><style>@page { size: A4; margin: 12mm; } * { box-sizing: border-box; } body { margin: 0; background: #f3f1ee; color: #121212; font-family: Arial, Helvetica, sans-serif; } .statement-page { width: 210mm; min-height: 297mm; margin: 0 auto 12mm; padding: 12mm 14mm 12mm; background: #ffffff; box-shadow: 0 1px 8px rgba(0,0,0,0.08); page-break-after: always; } .statement-page:last-child { page-break-after: auto; margin-bottom: 0; } .statement-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 2px solid #ece7df; padding-bottom: 12px; margin-bottom: 18px; } .brand-wrap { display: flex; align-items: center; gap: 12px; } .brand-logo { width: 150px; height: auto; } .brand-mark-wrap { display: inline-flex; width: 34px; height: 34px; border-radius: 50%; background: #f6f3ee; padding: 6px; align-items: center; justify-content: center; } .brand-mark { width: 100%; height: 100%; } .header-meta { text-align: right; } .eyebrow { display: block; color: #6d6b66; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 4px; } .header-meta strong { display: block; font-size: 18px; color: #00314d; } .client-box { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; padding: 14px 16px; background: #faf8f3; border: 1px solid #e9e1d5; border-radius: 8px; margin-bottom: 18px; } .client-name { font-size: 16px; font-weight: 700; color: #00314d; margin-bottom: 2px; } .client-sub { color: #565656; font-size: 12px; line-height: 1.5; } .summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; } .summary-card { padding: 12px 14px; border: 1px solid #ece7df; border-radius: 8px; background: #fff; } .summary-card strong { display: block; font-size: 18px; color: #00314d; margin-bottom: 4px; } .summary-card small { display: block; color: #565656; font-size: 11px; } .summary-card.highlight { background: #fff8f7; border-color: #f0cdc9; } .table-wrap { border: 1px solid #ece7df; border-radius: 8px; overflow: hidden; } table { width: 100%; border-collapse: collapse; table-layout: fixed; } th, td { text-align: left; padding: 9px 8px; border-bottom: 1px solid #eeeae2; font-size: 11px; vertical-align: top; } th { background: #faf8f3; color: #565656; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; } tbody tr:last-child td { border-bottom: none; } .totals-row { display: flex; justify-content: space-between; gap: 12px; font-size: 11px; color: #565656; padding-top: 12px; margin-top: 14px; border-top: 1px solid #ece7df; } .statement-footer { display: flex; justify-content: space-between; gap: 16px; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ece7df; font-size: 10px; color: #6d6b66; text-transform: uppercase; letter-spacing: 0.06em; } @media print { body { background: #fff; } .statement-page { box-shadow: none; margin: 0; } }</style></head><body>${pageMarkup}</body></html>`;

    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1200,height=1400");
    if (!printWindow) {
      notify("The browser blocked the statement popup. Please allow pop-ups and try again.");
      return;
    }

    try {
      printWindow.document.open();
      printWindow.document.write(documentMarkup);
      printWindow.document.close();
      printWindow.focus();
      window.setTimeout(() => {
        try {
          printWindow.print();
        } catch {
          notify("The statement preview loaded, but the browser blocked the print dialog.");
        }
      }, 250);
    } catch {
      notify("The statement preview could not be opened. Please try again.");
    }
  };

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
    const beneficiaryName = wireBeneficiary.trim();
    const bankName = wireBankName.trim();
    const beneficiaryAccount = wireAccountNumber.trim();

    if (!src || !amt || amt <= 0 || amt > src.balance) {
      notify("Please enter an amount within your operating balance.");
      return;
    }
    if (!beneficiaryName || !bankName || !beneficiaryAccount) {
      notify("Complete the beneficiary, bank, and account details before submitting the transfer.");
      return;
    }

    const destinationLabel = `${beneficiaryName} • ${wireCountry}`;
    setPendingTransfer({
      kind: "wire",
      title: "Review external wire",
      summary: `Confirm the wire to ${destinationLabel} before it is sent.`,
      fromLabel: `${src.name} (${src.currency})`,
      toLabel: `${beneficiaryName} · ${wireBankName} · ${wireCountry}`,
      amount: amt,
      actionLabel: "Confirm & send wire",
      onConfirm: () => {
        const updatedBal = Math.round((src.balance - amt) * 100) / 100;
        const transferRef = makeRef("WIR");
        runAnimatedTx(
          {
            kind: "etransfer",
            amount: amt,
            currency: src.currency,
            fromLabel: src.name,
            toLabel: destinationLabel,
            memo: `External wire (${wireFxCurr}, ${wireFeeMode})`,
            reference: transferRef,
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
                  description: `External wire — ${beneficiaryName} (${wireCountry}) • ${bankName}`,
                  category: "Business",
                  amount: -amt,
                  status: "Posted",
                  reference: transferRef,
                  createdBy: "Client",
                },
                ...prev.transactions,
              ],
            }));
            return [txId];
          }
        );
        notify(`Transfer sent to ${destinationLabel}.`);
        setPendingTransfer(null);
      },
    });
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

    setPendingTransfer({
      kind: "tax",
      title: "Review tax remittance",
      summary: `Confirm the payment to ${payee.name} before it is sent.`,
      fromLabel: `${src.name} (${src.currency})`,
      toLabel: `${payee.name} (${payee.accountRef})`,
      amount: amt,
      actionLabel: "Confirm & send remittance",
      onConfirm: () => {
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
        notify(`Tax remittance sent to ${payee.name}.`);
        setPendingTransfer(null);
      },
    });
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

    setPendingTransfer({
      kind: "fx",
      title: "Review FX conversion",
      summary: `Confirm the conversion from ${from.name} to ${target.name} before it is processed.`,
      fromLabel: `${from.name} (${from.currency})`,
      toLabel: `${target.name} (${target.currency})`,
      amount: amt,
      actionLabel: "Confirm & convert funds",
      onConfirm: () => {
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
        notify(`FX conversion sent from ${from.name}.`);
        setPendingTransfer(null);
      },
    });
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

    setPendingTransfer({
      kind: "treasury",
      title: "Review treasury transfer",
      summary: `Confirm the internal transfer from ${src.name} to ${dst.name} before it is sent.`,
      fromLabel: `${src.name} (${src.currency})`,
      toLabel: `${dst.name} (${dst.currency})`,
      amount: amt,
      actionLabel: "Confirm & send transfer",
      onConfirm: () => {
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
        notify(`Transfer from ${src.name} sent successfully.`);
        setPendingTransfer(null);
      },
    });
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
    return profile.transactions
      .filter((tx) => {
        if (ledgerAcc !== "all" && tx.accountId !== ledgerAcc) return false;
        if (ledgerQuery.trim() && !tx.description.toLowerCase().includes(ledgerQuery.trim().toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [profile.transactions, ledgerAcc, ledgerQuery]);

  const groupedLedger = useMemo(() => {
    const groups = new Map<string, { label: string; txs: typeof filteredLedger }>();

    for (const tx of filteredLedger) {
      const monthKey = tx.date.slice(0, 7);
      const label = new Date(`${tx.date}T12:00:00`).toLocaleDateString("en-CA", {
        month: "long",
        year: "numeric",
      });

      const existing = groups.get(monthKey);
      if (existing) {
        existing.txs.push(tx);
      } else {
        groups.set(monthKey, { label, txs: [tx] });
      }
    }

    return Array.from(groups.entries()).map(([monthKey, group]) => ({
      monthKey,
      label: group.label,
      txs: group.txs,
    }));
  }, [filteredLedger]);

  const navTabs: [BizTab, string][] = [
    ["treasury", "Cash position"],
    ["payroll", "Payroll & EFT"],
    ["invoices", "Receivables"],
    ["wires", "Wires & tax remittances"],
    ["cards", "Corporate cards"],
    ["ledger", "Statements"],
    ["settings", "Profile & security"],
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
        {!tab.includes("settings") && (
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
        )}

        {tab === "settings" && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <div>
                <h1 className="text-[28px] font-bold text-nbc-navy">Profile and security</h1>
                <p className="mt-1 text-[14px] text-[#565656]">
                  Signed in as <span className="font-semibold text-[#121212]">{profile.fullName}</span> · {profile.email}
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget as HTMLFormElement;
                  const data = new FormData(form);
                  const get = (key: string) => String(data.get(key) ?? "").trim();
                  onUpdateProfile((prev) => ({
                    ...prev,
                    fullName: get("fullName") || prev.fullName,
                    phone: get("phone") || prev.phone,
                    address: get("address") || prev.address,
                    city: get("city") || prev.city,
                    province: get("province") || prev.province,
                    postalCode: get("postalCode") || prev.postalCode,
                    branchName: get("branchName") || prev.branchName,
                  }));
                  notify("Your business profile has been updated.");
                }}
                className="space-y-4 rounded-[6px] border border-[#e5e2da] bg-white p-6"
              >
                <h2 className="text-[19px] font-bold text-nbc-navy">Business contact details</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-[12.5px] font-semibold text-[#121212]">Full name</span>
                    <input
                      name="fullName"
                      defaultValue={profile.fullName}
                      className="w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12.5px] font-semibold text-[#121212]">Business phone</span>
                    <input
                      name="phone"
                      defaultValue={profile.phone ?? ""}
                      placeholder="416-555-0148"
                      className="w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12.5px] font-semibold text-[#121212]">Primary branch</span>
                    <input
                      name="branchName"
                      defaultValue={profile.branchName}
                      className="w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-[12.5px] font-semibold text-[#121212]">Street address</span>
                    <input
                      name="address"
                      defaultValue={profile.address ?? ""}
                      className="w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12.5px] font-semibold text-[#121212]">City</span>
                    <input
                      name="city"
                      defaultValue={profile.city ?? ""}
                      className="w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-[12.5px] font-semibold text-[#121212]">Province</span>
                      <select
                        name="province"
                        defaultValue={profile.province ?? "ON"}
                        className="w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2 text-[14px] text-nbc-navy"
                      >
                        {[
                          "QC",
                          "ON",
                          "BC",
                          "AB",
                          "MB",
                          "SK",
                          "NS",
                          "NB",
                          "NL",
                          "PE",
                        ].map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[12.5px] font-semibold text-[#121212]">Postal code</span>
                      <input
                        name="postalCode"
                        defaultValue={profile.postalCode ?? ""}
                        placeholder="M5H 1J9"
                        className="w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                      />
                    </label>
                  </div>
                </div>
                <button type="submit" className="nbc-btn nbc-btn-primary">
                  Save profile
                </button>
              </form>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget as HTMLFormElement;
                  const data = new FormData(form);
                  const current = String(data.get("current") ?? "");
                  const next = String(data.get("next") ?? "");
                  const confirm = String(data.get("confirm") ?? "");

                  if (profile.password && current !== profile.password) {
                    notify("Your current password is incorrect.");
                    return;
                  }
                  if (next.length < 4) {
                    notify("Choose a new password of at least 4 characters.");
                    return;
                  }
                  if (next !== confirm) {
                    notify("The new passwords do not match.");
                    return;
                  }

                  onUpdateProfile((prev) => ({ ...prev, password: next }));
                  notify("Your password has been updated.");
                  form.reset();
                }}
                className="space-y-4 rounded-[6px] border border-[#e5e2da] bg-white p-6"
              >
                <h2 className="text-[19px] font-bold text-nbc-navy">Change your password</h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { name: "current", label: "Current password", placeholder: "••••••••" },
                    { name: "next", label: "New password", placeholder: "Minimum 4 characters" },
                    { name: "confirm", label: "Confirm new password", placeholder: "Repeat password" },
                  ].map((field) => (
                    <label key={field.name} className="block">
                      <span className="mb-1 block text-[12.5px] font-semibold text-[#121212]">{field.label}</span>
                      <input
                        name={field.name}
                        type="password"
                        placeholder={field.placeholder}
                        autoComplete="new-password"
                        className="w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                      />
                    </label>
                  ))}
                </div>
                <button type="submit" className="nbc-btn nbc-btn-ghost">
                  Update password
                </button>
              </form>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget as HTMLFormElement;
                  const data = new FormData(form);
                  const current = String(data.get("currentPin") ?? "").replace(/\D/g, "");
                  const next = String(data.get("nextPin") ?? "").replace(/\D/g, "");
                  const confirm = String(data.get("confirmPin") ?? "").replace(/\D/g, "");

                  if (profile.pin && current !== profile.pin) {
                    notify("Your current security PIN is incorrect.");
                    return;
                  }
                  if (!/^\d{4}$/.test(next)) {
                    notify("Choose a 4-digit PIN.");
                    return;
                  }
                  if (next !== confirm) {
                    notify("The new PINs do not match.");
                    return;
                  }

                  onUpdateProfile((prev) => ({ ...prev, pin: next }));
                  notify("Your security PIN has been updated.");
                  form.reset();
                }}
                className="space-y-4 rounded-[6px] border border-[#e5e2da] bg-white p-6"
              >
                <h2 className="text-[19px] font-bold text-nbc-navy">Change your security PIN</h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { name: "currentPin", label: "Current PIN", placeholder: "1234" },
                    { name: "nextPin", label: "New PIN", placeholder: "4 digits" },
                    { name: "confirmPin", label: "Confirm PIN", placeholder: "Repeat PIN" },
                  ].map((field) => (
                    <label key={field.name} className="block">
                      <span className="mb-1 block text-[12.5px] font-semibold text-[#121212]">{field.label}</span>
                      <input
                        name={field.name}
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder={field.placeholder}
                        autoComplete="one-time-code"
                        className="w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                      />
                    </label>
                  ))}
                </div>
                <button type="submit" className="nbc-btn nbc-btn-ghost">
                  Update PIN
                </button>
              </form>
            </div>

            <div className="space-y-5 lg:col-span-5">
              <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5">
                <h2 className="text-[17px] font-bold text-nbc-navy">Security preferences</h2>
                <p className="mt-1 text-[13px] text-[#565656]">
                  Choose how we confirm it is really you when you sign in.
                </p>
                <div className="mt-3 divide-y divide-[#efefef] text-[13.5px]">
                  {(
                    [
                      ["emailNotifications", "Email notifications", "Alerts sent to " + profile.email],
                      ["loginAlerts", "Login alerts", "Notify me when my account is accessed"],
                      ["largeTransactionAlerts", "Large transaction alerts", "Notify me for debits over $500"],
                      ["newPayeeAlerts", "New payee alerts", "Confirm before paying a new biller"],
                    ] as [keyof typeof DEFAULT_PREFERENCES, string, string][]
                  ).map(([key, label, desc]) => {
                    const enabled = (profile.preferences ?? DEFAULT_PREFERENCES)[key];
                    return (
                      <div key={key} className="flex items-start justify-between gap-3 py-2.5">
                        <span>
                          <span className="block font-medium text-[#333]">{label}</span>
                          <span className="block text-[11.5px] text-[#777]">{desc}</span>
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={Boolean(enabled)}
                          aria-label={label}
                          onClick={() =>
                            onUpdateProfile((prev) => ({
                              ...prev,
                              preferences: {
                                ...DEFAULT_PREFERENCES,
                                ...(prev.preferences ?? {}),
                                [key]: !Boolean(enabled),
                              },
                            }))
                          }
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${enabled ? "bg-nbc-red" : "bg-[#d7d4ce]"}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${enabled ? "translate-x-6" : "translate-x-1"}`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5">
                <h2 className="text-[17px] font-bold text-nbc-navy">Access details</h2>
                <ul className="mt-3 space-y-3 text-[13.5px] text-[#565656]">
                  <li className="flex items-center justify-between gap-3 border-b border-[#efefef] pb-2">
                    <span>Account type</span>
                    <span className="font-semibold text-[#121212]">Business banking</span>
                  </li>
                  <li className="flex items-center justify-between gap-3 border-b border-[#efefef] pb-2">
                    <span>Business number</span>
                    <span className="font-semibold text-[#121212]">{profile.businessNumber ?? "Not provided"}</span>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <span>Last sign-in</span>
                    <span className="font-semibold text-[#121212]">{profile.lastLogin ?? "First sign-in on this device"}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

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
                              onClick={() => openAccountDetail(acc.id)}
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
                            <button
                              type="button"
                              onClick={() => openAccountDetail(acc.id)}
                              className="text-left font-semibold text-[#1572C5] underline decoration-1 underline-offset-2 hover:text-[#105797] hover:no-underline"
                            >
                              {acc.name}
                            </button>
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
                  {sortedTransactions.slice(0, 5).map((tx) => {
                    const acc = profile.accounts.find((a) => a.id === tx.accountId);
                    const isNew = recentTxIds.includes(tx.id);
                    return (
                      <li
                        key={tx.id}
                        onClick={() => setSelectedTxId(tx.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedTxId(tx.id);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        className={`flex cursor-pointer items-start justify-between gap-3 px-3.5 py-2.5 outline-none transition hover:bg-[#faf8f3] focus:bg-[#faf8f3] ${
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
                          {txDisplayAmount(tx.amount, acc?.currency ?? "CAD")}
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
                      {sortedTransactions.slice(0, 5).map((tx) => {
                        const acc = profile.accounts.find((a) => a.id === tx.accountId);
                        const isNew = recentTxIds.includes(tx.id);
                        return (
                          <tr
                            key={tx.id}
                            onClick={() => setSelectedTxId(tx.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedTxId(tx.id);
                              }
                            }}
                            tabIndex={0}
                            role="button"
                            className={`cursor-pointer hover:bg-[#faf8f3] focus:bg-[#faf8f3] ${isNew ? "animate-tx-row-new" : ""}`}
                          >
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
                              {txDisplayAmount(tx.amount, acc?.currency ?? "CAD")}
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
          <div className="space-y-6 rounded-[6px] bg-[#f8f6f1] p-0">
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
                  onClick={() => {
                    setPendingTransfer(null);
                    setWireMode(id);
                  }}
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

            {pendingTransfer && (
              <div className="max-w-[760px] rounded-[6px] border border-[#d8d1c2] bg-white p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#565656]">Transfer review</p>
                    <h2 className="mt-1 text-[24px] font-bold text-nbc-navy">{pendingTransfer.title}</h2>
                  </div>
                  <span className="rounded-full bg-[#faf3f3] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-nbc-red">
                    Verify before send
                  </span>
                </div>

                <p className="mt-4 text-[14px] text-[#565656]">{pendingTransfer.summary}</p>

                <div className="mt-5 grid gap-4 rounded-[6px] border border-[#e5e2da] bg-[#f8f6f1] p-4 md:grid-cols-2">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#565656]">From</p>
                    <p className="mt-1 text-[15px] font-semibold text-nbc-navy">{pendingTransfer.fromLabel}</p>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#565656]">To</p>
                    <p className="mt-1 text-[15px] font-semibold text-nbc-navy">{pendingTransfer.toLabel}</p>
                  </div>
                </div>

                <div className="mt-5 rounded-[6px] bg-[#faf8f3] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#565656]">Amount</span>
                    <span className="text-[24px] font-bold tabular-nums text-nbc-navy">
                      {formatMoney(pendingTransfer.amount, pendingTransfer.kind === "wire" ? (wireFxCurr === "USD" ? "USD" : "CAD") : "CAD")}
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button type="button" onClick={pendingTransfer.onConfirm} className="nbc-btn nbc-btn-primary">
                    {pendingTransfer.actionLabel}
                  </button>
                  <button type="button" onClick={() => setPendingTransfer(null)} className="nbc-btn nbc-btn-ghost">
                    Edit details
                  </button>
                </div>
              </div>
            )}

            {!pendingTransfer && wireMode === "wire" && (
              <form
                onSubmit={handleSendWire}
                className="max-w-[760px] space-y-5 rounded-[6px] border border-[#e5e2da] bg-[#f8f6f1] p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-[20px] font-bold text-nbc-navy">Send an external wire</h2>
                    <p className="mt-1 text-[13px] text-[#565656]">
                      Domestic and international transfers to other banks and countries.
                    </p>
                  </div>
                  <span className="rounded-full bg-[#faf3f3] px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-nbc-red">
                    Cross-border
                  </span>
                </div>

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

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="w-ben" className="block text-[13px] font-semibold text-[#121212]">
                      Beneficiary name
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
                  <div>
                    <label htmlFor="w-country" className="block text-[13px] font-semibold text-[#121212]">
                      Beneficiary country
                    </label>
                    <select
                      id="w-country"
                      value={wireCountry}
                      onChange={(e) => setWireCountry(e.target.value)}
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                    >
                      {EXTERNAL_TRANSFER_COUNTRIES.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="w-bank" className="block text-[13px] font-semibold text-[#121212]">
                      Beneficiary bank name
                    </label>
                    <input
                      id="w-bank"
                      type="text"
                      value={wireBankName}
                      onChange={(e) => setWireBankName(e.target.value)}
                      required
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2.5 text-[14px] text-[#121212]"
                    />
                  </div>
                  <div>
                    <label htmlFor="w-bank-country" className="block text-[13px] font-semibold text-[#121212]">
                      Bank country
                    </label>
                    <select
                      id="w-bank-country"
                      value={wireBankCountry}
                      onChange={(e) => setWireBankCountry(e.target.value)}
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                    >
                      {EXTERNAL_TRANSFER_COUNTRIES.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="w-swift" className="block text-[13px] font-semibold text-[#121212]">
                      SWIFT / BIC
                    </label>
                    <input
                      id="w-swift"
                      type="text"
                      value={wireBankSwift}
                      onChange={(e) => setWireBankSwift(e.target.value)}
                      required
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2.5 text-[14px] uppercase text-[#121212]"
                    />
                  </div>
                  <div>
                    <label htmlFor="w-acc" className="block text-[13px] font-semibold text-[#121212]">
                      Account / IBAN number
                    </label>
                    <input
                      id="w-acc"
                      type="text"
                      value={wireAccountNumber}
                      onChange={(e) => setWireAccountNumber(e.target.value)}
                      required
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2.5 text-[14px] text-[#121212]"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
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
                  <div>
                    <label htmlFor="w-fee" className="block text-[13px] font-semibold text-[#121212]">
                      Fee method
                    </label>
                    <select
                      id="w-fee"
                      value={wireFeeMode}
                      onChange={(e) => setWireFeeMode(e.target.value as "OUR" | "BEN" | "SHA")}
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                    >
                      <option value="OUR">OUR</option>
                      <option value="BEN">BEN</option>
                      <option value="SHA">SHA</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="w-purpose" className="block text-[13px] font-semibold text-[#121212]">
                    Purpose of payment
                  </label>
                  <input
                    id="w-purpose"
                    type="text"
                    value={wirePurpose}
                    onChange={(e) => setWirePurpose(e.target.value)}
                    className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2.5 text-[14px] text-[#121212]"
                  />
                </div>

                <div className="rounded-[6px] bg-[#faf8f3] p-3 text-[13px] text-[#565656]">
                  Payment summary: {(wireBeneficiary || "Beneficiary").trim() || "Beneficiary"} • {wireBankName || "Bank name"} • {wireCountry} • {wireFeeMode} fees.
                </div>

                <button type="submit" className="nbc-btn nbc-btn-primary">
                  Submit wire payment
                </button>
              </form>
            )}

            {!pendingTransfer && wireMode === "tax" && (
              <form
                onSubmit={handleTaxRemittance}
                className="max-w-[620px] space-y-4 rounded-[6px] border border-[#e5e2da] bg-[#f8f6f1] p-6"
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

            {!pendingTransfer && wireMode === "treasury" && (
              <form
                onSubmit={handleTreasuryTransfer}
                className="max-w-[660px] space-y-4 rounded-[6px] border border-[#e5e2da] bg-[#f8f6f1] p-6"
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

            {!pendingTransfer && wireMode === "fx" && (
              <form onSubmit={handleFxConvert} className="max-w-[620px] space-y-4 rounded-[6px] border border-[#e5e2da] bg-[#f8f6f1] p-6">
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

        {/* TAB: ACCOUNT DETAILS */}
        {tab === "account" && accountDetail && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-[#e5e2da] bg-white p-5">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#565656]">Account overview</p>
                <h2 className="mt-1 text-[26px] font-bold text-nbc-navy">{accountDetail.name}</h2>
                <p className="mt-1 text-[13px] text-[#565656]">{accountDetail.number} · {accountDetail.currency}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setTab("treasury")}
                  className="rounded-full border border-[#c9c3b6] px-4 py-2 text-[12.5px] font-semibold text-nbc-navy transition hover:bg-[#f7f5f2]"
                >
                  Back to accounts
                </button>
                <button
                  type="button"
                  onClick={() => generatePdfStatement(accountDetail.id)}
                  className="rounded-full bg-nbc-navy px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-[#0b1a2d]"
                >
                  Generate PDF statement
                </button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
              <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5 lg:col-span-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#565656]">Available balance</p>
                <div className="mt-3 text-[30px] font-bold tabular-nums text-nbc-navy">
                  {formatMoney(accountDetail.balance, accountDetail.currency)}
                </div>
                <div className="mt-4 space-y-3 text-[14px] text-[#333]">
                  <div className="flex items-center justify-between border-b border-[#efefef] pb-2">
                    <span>Account type</span>
                    <strong>{accountDetailMeta?.accountTypeName ?? accountDetail.category}</strong>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#efefef] pb-2">
                    <span>Currency</span>
                    <strong>{accountDetail.currency}</strong>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#efefef] pb-2">
                    <span>Reference</span>
                    <strong>{accountDetail.number}</strong>
                  </div>
                  {accountDetail.category === "credit" && typeof accountDetail.limit === "number" && (
                    <div className="flex items-center justify-between border-b border-[#efefef] pb-2">
                      <span>Approved limit</span>
                      <strong>{formatMoney(accountDetail.limit, accountDetail.currency)}</strong>
                    </div>
                  )}
                  {accountDetailMeta && typeof accountDetailMeta.remainingAvailable === "number" && (
                    <div className="flex items-center justify-between border-b border-[#efefef] pb-2">
                      <span>Available to draw</span>
                      <strong>{formatMoney(accountDetailMeta.remainingAvailable, accountDetail.currency)}</strong>
                    </div>
                  )}
                  {accountDetail.rate ? (
                    <div className="flex items-center justify-between border-b border-[#efefef] pb-2">
                      <span>Rate</span>
                      <strong>{accountDetail.rate}</strong>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between pb-2">
                    <span>Last activity</span>
                    <strong>{accountDetailTransactions[0]?.date ?? "No transactions"}</strong>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white lg:col-span-8">
                <div className="border-b border-[#e5e2da] bg-[#fcfbf8] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[18px] font-bold text-nbc-navy">Recent account activity</h3>
                    <button
                      type="button"
                      onClick={() => generatePdfStatement(accountDetail.id)}
                      className="text-[13px] font-semibold text-[#1572C5] underline decoration-1 underline-offset-2 hover:no-underline"
                    >
                      Download PDF statement
                    </button>
                  </div>

                  {accountDetailTransactions.length > ACTIVITY_PAGE_SIZE && (
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setActivityPage((page) => Math.max(page - 1, 0))}
                        disabled={safeActivityPage === 0}
                        className="rounded-full border border-[#c9c3b6] px-3 py-1.5 text-[12px] font-semibold text-nbc-navy transition hover:bg-[#f7f5f2] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="text-[12px] font-semibold text-[#565656]">
                        {safeActivityPage + 1} / {activityPageCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActivityPage((page) => Math.min(page + 1, activityPageCount - 1))}
                        disabled={safeActivityPage >= activityPageCount - 1}
                        className="rounded-full border border-[#c9c3b6] px-3 py-1.5 text-[12px] font-semibold text-nbc-navy transition hover:bg-[#f7f5f2] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>

                <ul className="divide-y divide-[#efefef]">
                  {pagedAccountDetailTransactions.map((tx) => (
                    <li
                      key={tx.id}
                      onClick={() => setSelectedTxId(tx.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedTxId(tx.id);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      className="flex cursor-pointer items-start justify-between gap-3 px-4 py-3 outline-none transition hover:bg-[#faf8f3] focus:bg-[#faf8f3]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-[13.5px] font-medium text-[#121212]">{tx.description}</p>
                        <p className="mt-0.5 text-[11.5px] text-[#666]">{tx.date}</p>
                      </div>
                      <span className={`whitespace-nowrap text-right text-[13.5px] font-semibold tabular-nums ${tx.amount >= 0 ? "text-[#017a33]" : "text-[#121212]"}`}>
                        {txDisplayAmount(tx.amount, accountDetail.currency)}
                      </span>
                    </li>
                  ))}
                  {accountDetailTransactions.length === 0 && (
                    <li className="px-4 py-5 text-[13.5px] text-[#565656]">No transactions available for this account.</li>
                  )}
                </ul>

                {accountDetailTransactions.length > ACTIVITY_PAGE_SIZE && (
                  <div className="flex items-center justify-end gap-2 border-t border-[#e5e2da] bg-[#fcfbf8] px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setActivityPage((page) => Math.max(page - 1, 0))}
                      disabled={safeActivityPage === 0}
                      className="rounded-full border border-[#c9c3b6] px-3 py-1.5 text-[12px] font-semibold text-nbc-navy transition hover:bg-[#f7f5f2] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-[12px] font-semibold text-[#565656]">
                      {safeActivityPage + 1} / {activityPageCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActivityPage((page) => Math.min(page + 1, activityPageCount - 1))}
                      disabled={safeActivityPage >= activityPageCount - 1}
                      className="rounded-full border border-[#c9c3b6] px-3 py-1.5 text-[12px] font-semibold text-nbc-navy transition hover:bg-[#f7f5f2] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
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
                onClick={() => generatePdfStatement(ledgerAcc)}
                className="rounded-full border border-nbc-navy px-4 py-2 text-[12.5px] font-semibold text-nbc-navy transition hover:bg-nbc-navy hover:text-white"
              >
                Generate PDF statement
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
                  {groupedLedger.map(({ monthKey, label, txs }) => (
                    <li key={monthKey} className="border-b border-[#efefef]">
                      <div className="bg-[#faf8f3] px-3.5 py-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#565656]">
                        {label}
                      </div>
                      <ul className="divide-y divide-[#efefef]">
                        {txs.map((tx) => {
                          const acc = profile.accounts.find((a) => a.id === tx.accountId);
                          const isNew = recentTxIds.includes(tx.id);
                          return (
                            <li
                              key={tx.id}
                              onClick={() => setSelectedTxId(tx.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setSelectedTxId(tx.id);
                                }
                              }}
                              tabIndex={0}
                              role="button"
                              className={`flex cursor-pointer items-start justify-between gap-3 px-3.5 py-2.5 outline-none transition hover:bg-[#faf8f3] focus:bg-[#faf8f3] ${
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
                                  {txDisplayAmount(tx.amount, acc?.currency ?? "CAD")}
                                </span>
                                <span className="block text-[10.5px] text-[#777]">
                                  {tx.amount >= 0 ? "Credit" : "Debit"}
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
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
                    {groupedLedger.flatMap(({ monthKey, label, txs }) => [
                      <tr key={`${monthKey}-header`} className="bg-[#faf8f3]">
                        <td colSpan={5} className="px-5 py-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#565656]">
                          {label}
                        </td>
                      </tr>,
                      ...txs.map((tx) => {
                        const acc = profile.accounts.find((a) => a.id === tx.accountId);
                        const isNew = recentTxIds.includes(tx.id);
                        return (
                          <tr
                            key={tx.id}
                            onClick={() => setSelectedTxId(tx.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedTxId(tx.id);
                              }
                            }}
                            tabIndex={0}
                            role="button"
                            className={`cursor-pointer hover:bg-[#faf8f3] focus:bg-[#faf8f3] ${isNew ? "animate-tx-row-new" : ""}`}
                          >
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
                              {tx.amount < 0 ? txDisplayAmount(tx.amount, acc?.currency ?? "CAD") : "—"}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold tabular-nums text-[#017a33]">
                              {tx.amount >= 0 ? txDisplayAmount(tx.amount, acc?.currency ?? "CAD") : "—"}
                            </td>
                          </tr>
                        );
                      }),
                    ])}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {selectedTx && selectedTxAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-[12px] border border-[#e5e2da] bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#565656]">Transaction details</p>
                <h3 className="mt-2 text-[24px] font-bold text-nbc-navy">{selectedTx.description}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTxId(null)}
                className="rounded-full border border-[#d7d3ca] px-2.5 py-1 text-[12px] font-medium text-[#121212] hover:bg-[#f7f5f2]"
              >
                Close
              </button>
            </div>

            <dl className="mt-5 space-y-3 text-[14px]">
              <div className="flex items-center justify-between gap-4 border-b border-[#efefef] pb-2">
                <dt className="text-[#565656]">Date</dt>
                <dd className="font-semibold tabular-nums text-[#121212]">{selectedTx.date}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-[#efefef] pb-2">
                <dt className="text-[#565656]">Account</dt>
                <dd className="font-semibold text-[#121212]">{selectedTxAccount.name}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-[#efefef] pb-2">
                <dt className="text-[#565656]">Category</dt>
                <dd className="font-semibold text-[#121212]">{selectedTx.category ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-[#efefef] pb-2">
                <dt className="text-[#565656]">Status</dt>
                <dd className="font-semibold text-[#121212]">{selectedTx.status ?? "Posted"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-[#efefef] pb-2">
                <dt className="text-[#565656]">Type</dt>
                <dd className="font-semibold text-[#121212]">{selectedTx.amount >= 0 ? "Credit" : "Debit"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-[#efefef] pb-2">
                <dt className="text-[#565656]">Amount</dt>
                <dd className={`font-bold tabular-nums ${selectedTx.amount >= 0 ? "text-[#017a33]" : "text-[#121212]"}`}>
                  {txDisplayAmount(selectedTx.amount, selectedTxAccount.currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-[#efefef] pb-2">
                <dt className="text-[#565656]">Reference</dt>
                <dd className="font-semibold tabular-nums text-[#121212]">{selectedTx.reference ?? `REF-${selectedTx.id.toUpperCase()}`}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-[#efefef] pb-2">
                <dt className="text-[#565656]">Memo</dt>
                <dd className="max-w-[60%] text-right font-medium text-[#121212]">{selectedTx.description}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-[#efefef] pb-2">
                <dt className="text-[#565656]">Posted by</dt>
                <dd className="font-semibold text-[#121212]">{selectedTx.createdBy ?? "System"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 pb-1">
                <dt className="text-[#565656]">Transaction ID</dt>
                <dd className="font-semibold tabular-nums text-[#121212]">{selectedTx.id}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
