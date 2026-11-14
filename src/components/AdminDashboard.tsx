import { useMemo, useState } from "react";
import { logoNbc } from "../assets/nbcAssets";
import {
  AdminOps,
  AdminTabId,
  ROLE_LABEL,
  auditCsv,
  can,
  downloadFile,
  nowStamp,
  todayIso,
} from "../banking/adminOps";
import { AuditLogEntry, GlobalBankConfig, formatMoney } from "../banking/bankingTypes";
import AdminAccounts from "./admin/AdminAccounts";
import AdminApprovals from "./admin/AdminApprovals";
import AdminClients from "./admin/AdminClients";
import {
  AdminAnalytics,
  AdminAuditLog,
  AdminRoles,
  AdminSearch,
} from "./admin/AdminInsights";
import AdminOperations from "./admin/AdminOperations";
import { AdminCards, AdminConfig } from "./admin/AdminService";
import AdminTransactions from "./admin/AdminTransactions";
import { ArrowRight, LockIcon } from "./icons";

type Props = {
  users: AdminOps["users"];
  identity: AdminOps["identity"];
  approvals: AdminOps["approvals"];
  bankConfig: GlobalBankConfig;
  auditLogs: AuditLogEntry[];
  onUpdateUser: AdminOps["onUpdateUser"];
  onCreateUser: AdminOps["onCreateUser"];
  onDeleteCustomUser: AdminOps["onDeleteCustomUser"];
  onImpersonateUser: AdminOps["onImpersonateUser"];
  onRequestApproval: AdminOps["onRequestApproval"];
  onDecideApproval: AdminOps["onDecideApproval"];
  onRestoreBackup: AdminOps["onRestoreBackup"];
  onSetIdentity: AdminOps["onSetIdentity"];
  onUpdateBankConfig: (next: GlobalBankConfig, detail: string) => void;
  onFactoryReset: () => void;
  onGoPublicSite: () => void;
  onSignOut: () => void;
};

const TAB_LABEL: Record<AdminTabId, string> = {
  overview: "Overview",
  clients: "Clients",
  accounts: "Accounts",
  transactions: "Transactions",
  cards: "Cards",
  operations: "Operations",
  approvals: "Approvals",
  config: "Rates & banners",
  audit: "Audit log",
};

const EXTRA_TABS: [string, string][] = [
  ["analytics", "Analytics"],
  ["search", "Search"],
  ["roles", "Access & security"],
];

export default function AdminDashboard({
  users,
  identity,
  approvals,
  bankConfig,
  auditLogs,
  onUpdateUser,
  onCreateUser,
  onDeleteCustomUser,
  onImpersonateUser,
  onRequestApproval,
  onDecideApproval,
  onRestoreBackup,
  onSetIdentity,
  onUpdateBankConfig,
  onFactoryReset,
  onGoPublicSite,
  onSignOut,
}: Props) {
  const [tab, setTab] = useState<AdminTabId | "analytics" | "search" | "roles">("overview");
  const [selectedKey, setSelectedKey] = useState(users[0]?.key ?? "personal");
  const [toast, setToast] = useState<string | null>(null);
  const [createRequest, setCreateRequest] = useState(0);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((cur) => (cur === message ? null : cur)), 4000);
  };

  const ops: AdminOps = {
    users,
    identity,
    approvals,
    onUpdateUser,
    onCreateUser,
    onDeleteCustomUser,
    onImpersonateUser,
    onRequestApproval,
    onDecideApproval,
    onRestoreBackup,
    onSetIdentity,
    notify,
  };

  const panelProps = {
    ops,
    selectedKey,
    onSelectKey: setSelectedKey,
    onOpenTab: (next: AdminTabId, key?: string) => {
      if (key) setSelectedKey(key);
      setTab(next);
    },
  };

  const pendingApprovals = approvals.filter((a) => a.status === "pending").length;

  const stats = useMemo(() => {
    let deposits = 0;
    let credit = 0;
    let accounts = 0;
    let entries = 0;
    let cards = 0;
    let lockedCards = 0;
    let frozen = 0;
    let unverified = 0;
    const today = todayIso();
    let todayCredits = 0;
    let todayDebits = 0;

    for (const u of users) {
      const p = u.profile;
      if (p.status === "frozen") frozen += 1;
      if ((p.kycStatus ?? "unverified") !== "verified") unverified += 1;
      accounts += p.accounts.length;
      entries += p.transactions.length;
      cards += p.cards.length;
      lockedCards += p.cards.filter((c) => c.locked).length;
      for (const a of p.accounts) {
        const fx = a.currency === "USD" ? 1.36 : 1;
        if (a.category === "credit" || a.category === "loan") credit += a.balance * fx;
        else deposits += a.balance * fx;
      }
      for (const tx of p.transactions) {
        if (tx.date !== today) continue;
        if (tx.amount >= 0) todayCredits += tx.amount;
        else todayDebits += Math.abs(tx.amount);
      }
    }
    return { deposits, credit, accounts, entries, cards, lockedCards, frozen, unverified, todayCredits, todayDebits };
  }, [users]);

  const allTabs = [
    ...(Object.keys(TAB_LABEL) as AdminTabId[]),
    ...EXTRA_TABS.map(([id]) => id as "analytics" | "search" | "roles"),
  ];

  const labelFor = (id: string) =>
    TAB_LABEL[id as AdminTabId] ?? EXTRA_TABS.find(([x]) => x === id)?.[1] ?? id;

  return (
    <div className="flex-1 bg-[#f8f6f1] pb-14">
      {/* Utility bar */}
      <div className="bg-nbc-topbar text-white">
        <div className="nbc-container flex h-[52px] items-center justify-between gap-2 text-[13px] sm:gap-4 sm:text-[13.5px]">
          <div className="flex h-full items-center">
            <button type="button" onClick={onGoPublicSite} className="flex h-full items-center whitespace-nowrap px-3 text-white/85 transition hover:bg-white/10 hover:text-white sm:px-4">
              nbc.ca Home
            </button>
            <span className="flex h-full items-center whitespace-nowrap bg-white/15 px-3 font-medium text-white sm:px-4">
              Administration
            </span>
          </div>
          <div className="flex flex-none items-center gap-2">
            <span className="hidden whitespace-nowrap text-[12px] text-white/80 lg:inline">
              {identity ? `${identity.name} · ${ROLE_LABEL[identity.role]}` : "Not signed in"}
            </span>
            <button
              type="button"
              onClick={() =>
                downloadFile(
                  `nbc-admin-backup-${todayIso()}.json`,
                  JSON.stringify({ exportedAt: nowStamp(), bankConfig, users: users.map((u) => u.profile) }, null, 2),
                  "application/json"
                )
              }
              className="hidden whitespace-nowrap rounded-full border border-white/60 px-3.5 py-1 text-[12.5px] font-medium text-white transition hover:bg-white/15 md:inline-flex"
            >
              Export backup
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex h-8 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border border-white bg-nbc-red px-3 text-[12.5px] font-semibold text-white transition hover:bg-nbc-red-dark sm:px-3.5 sm:text-[13px]"
            >
              <LockIcon className="h-3.5 w-3.5 flex-none" />
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#e5e5e5] bg-white">
        <div className="nbc-container flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-3">
            <img src={logoNbc} alt="National Bank" width={155} height={50} className="h-[36px] w-auto lg:h-[42px]" />
            <span className="h-6 w-px bg-[#d8d8d8]" />
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-nbc-red">Core banking administration</p>
              <p className="text-[14px] font-semibold text-nbc-navy">Back-office console</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {can(identity, "clients.create") && (
              <button
                type="button"
                onClick={() => {
                  setTab("clients");
                  setCreateRequest((n) => n + 1);
                }}
                className="rounded-full border border-[#c9c3b6] bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-nbc-navy transition hover:border-nbc-navy"
              >
                + New client
              </button>
            )}
            {can(identity, "transactions.post") && (
              <button type="button" onClick={() => panelProps.onOpenTab("transactions")} className="rounded-full bg-nbc-red px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-nbc-red-dark">
                Post transaction
              </button>
            )}
          </div>
        </div>
        <div className="border-t border-[#efefef]">
          <div className="nbc-container scroll-tabs">
            {allTabs.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`border-b-[3px] px-3.5 py-3 text-[13.5px] transition ${
                  tab === id ? "border-nbc-red font-semibold text-nbc-navy" : "border-transparent text-[#565656] hover:text-nbc-navy"
                }`}
              >
                {labelFor(id)}
                {id === "clients" && <span className="ml-1 text-[11.5px] text-[#777]">({users.length})</span>}
                {id === "approvals" && pendingApprovals > 0 && (
                  <span className="ml-1.5 rounded-full bg-nbc-red px-1.5 py-0.5 text-[10px] font-bold text-white">{pendingApprovals}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[90] w-[calc(100%-32px)] max-w-[460px] -translate-x-1/2 rounded-[6px] bg-nbc-navy px-4 py-3 text-center text-[13px] font-medium text-white shadow-lg animate-fade-up">
          {toast}
        </div>
      )}

      <main className="nbc-container py-7">
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-[25px] font-bold text-nbc-navy sm:text-[28px]">Operations overview</h1>
                <p className="mt-1 text-[13.5px] text-[#565656]">
                  {users.length} client profiles · {stats.accounts} accounts · {stats.entries} ledger entries · {todayIso()}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => downloadFile(`audit-${todayIso()}.csv`, auditCsv(auditLogs))} className="rounded-full border border-[#c9c3b6] bg-white px-4 py-2 text-[12.5px] font-semibold text-nbc-navy hover:border-nbc-navy">
                  Export audit log
                </button>
                <button type="button" onClick={() => setTab("analytics")} className="rounded-full bg-nbc-navy px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-nbc-red">
                  View analytics
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi label="Total deposits & investments" value={formatMoney(stats.deposits)} sub={`${users.length} client profiles`} />
              <Kpi label="Credit & mortgages outstanding" value={formatMoney(stats.credit)} sub={`Prime ${bankConfig.primeRate.toFixed(2)}%`} />
              <Kpi label="Accounts & entries" value={`${stats.accounts} / ${stats.entries}`} sub={`${stats.cards} cards · ${stats.lockedCards} frozen`} />
              <Kpi label="Needs attention" value={`${pendingApprovals} / ${stats.unverified}`} sub="Pending approvals / unverified KYC" alert />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MiniStat label="Credits posted today" value={formatMoney(stats.todayCredits)} tone="green" />
              <MiniStat label="Debits posted today" value={formatMoney(stats.todayDebits)} tone="dark" />
              <MiniStat label="Profiles on hold" value={String(stats.frozen)} tone={stats.frozen ? "red" : "dark"} />
              <MiniStat label="Promo savings rate" value={`${bankConfig.promoSavingsRate.toFixed(2)}%`} tone="red" />
            </div>

            <div className="grid gap-5 lg:grid-cols-12">
              <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5 lg:col-span-5">
                <h2 className="text-[17px] font-bold text-nbc-navy">Quick operations</h2>
                <p className="text-[12.5px] text-[#565656]">Common back-office tasks</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[
                    { label: "Create client", desc: "Open profiles manually", tab: "clients" as AdminTabId },
                    { label: "Post transaction", desc: "Custom date & amount", tab: "transactions" as AdminTabId },
                    { label: "Adjust balances", desc: "Credit, debit or override", tab: "accounts" as AdminTabId },
                    { label: "Issue card", desc: "Set limits & points", tab: "cards" as AdminTabId },
                    { label: "Batch processing", desc: "Interest & fees", tab: "operations" as AdminTabId },
                    { label: "Approvals", desc: `${pendingApprovals} waiting`, tab: "approvals" as AdminTabId },
                  ].map((a) => (
                    <button key={a.label} type="button" onClick={() => setTab(a.tab)} className="group flex items-center justify-between gap-2 rounded-[6px] border border-[#e5e2da] px-3 py-2.5 text-left transition hover:border-nbc-navy hover:bg-[#fcfbf8]">
                      <span>
                        <span className="block text-[13px] font-semibold text-nbc-navy">{a.label}</span>
                        <span className="block text-[11.5px] text-[#777]">{a.desc}</span>
                      </span>
                      <ArrowRight className="h-3 w-3 flex-none text-[#999] transition group-hover:translate-x-0.5 group-hover:text-nbc-red" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5 lg:col-span-7">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-[17px] font-bold text-nbc-navy">Open a client record</h2>
                    <p className="text-[12.5px] text-[#565656]">Review a profile and its accounts</p>
                  </div>
                  <button type="button" onClick={() => setTab("clients")} className="text-[12.5px] font-semibold text-[#1572C5] underline decoration-1 underline-offset-2">
                    All clients
                  </button>
                </div>
                <ul className="mt-2 divide-y divide-[#efefef]">
                  {users.slice(0, 5).map((u) => {
                    let assets = 0;
                    for (const a of u.profile.accounts) {
                      if (a.category !== "credit" && a.category !== "loan") assets += a.balance * (a.currency === "USD" ? 1.36 : 1);
                    }
                    const kyc = u.profile.kycStatus ?? "unverified";
                    return (
                      <li key={u.key} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-semibold text-nbc-navy">
                            {u.profile.fullName}
                            {u.profile.status === "frozen" && <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">ON HOLD</span>}
                            {kyc !== "verified" && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">{kyc.toUpperCase()}</span>}
                          </p>
                          <p className="truncate text-[11.5px] text-[#777]">
                            {u.profile.roleLabel} · {formatMoney(assets)} assets · {u.profile.accounts.length} accounts
                          </p>
                        </div>
                        <div className="flex flex-none gap-1.5">
                          <button type="button" onClick={() => panelProps.onOpenTab("accounts", u.key)} className="rounded-full border border-[#c9c3b6] px-2.5 py-1 text-[11.5px] font-semibold text-nbc-navy hover:border-nbc-navy">
                            Accounts
                          </button>
                          {can(identity, "impersonate") && (
                            <button type="button" onClick={() => onImpersonateUser(u.key)} className="rounded-full bg-nbc-navy px-2.5 py-1 text-[11.5px] font-semibold text-white hover:bg-nbc-red">
                              Sign in as
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <div className="rounded-[6px] border border-[#e5e2da] bg-white">
              <div className="flex items-center justify-between border-b border-[#ece8df] px-5 py-3.5">
                <h2 className="text-[17px] font-bold text-nbc-navy">Recent administrative activity</h2>
                <button type="button" onClick={() => setTab("audit")} className="text-[12.5px] font-semibold text-[#1572C5] underline decoration-1 underline-offset-2">
                  Full audit log
                </button>
              </div>
              <ul className="divide-y divide-[#efefef]">
                {auditLogs.slice(0, 8).map((log) => (
                  <li key={log.id} className="px-5 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${log.severity === "critical" ? "bg-rose-100 text-rose-800" : log.severity === "warning" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}>
                        {log.action}
                      </span>
                      <span className="text-[11px] text-[#999]">{log.timestamp} · {log.actor}</span>
                    </div>
                    <p className="mt-0.5 break-words text-[12.5px] text-[#333]">{log.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {tab === "clients" && <AdminClients {...panelProps} autoCreate={createRequest} />}
        {tab === "accounts" && <AdminAccounts {...panelProps} />}
        {tab === "transactions" && <AdminTransactions {...panelProps} />}
        {tab === "cards" && <AdminCards {...panelProps} />}
        {tab === "operations" && <AdminOperations {...panelProps} />}
        {tab === "approvals" && <AdminApprovals {...panelProps} />}
        {tab === "analytics" && <AdminAnalytics {...panelProps} />}
        {tab === "search" && <AdminSearch {...panelProps} />}
        {tab === "roles" && <AdminRoles {...panelProps} />}
        {tab === "config" && (
          <AdminConfig bankConfig={bankConfig} onUpdateBankConfig={onUpdateBankConfig} onFactoryReset={onFactoryReset} ops={ops} />
        )}
        {tab === "audit" && <AdminAuditLog auditLogs={auditLogs} />}
      </main>
    </div>
  );
}

function Kpi({ label, value, sub, alert = false }: { label: string; value: string; sub: string; alert?: boolean }) {
  return (
    <div className={`rounded-[6px] border bg-white p-4 ${alert ? "border-l-4 border-[#e5e2da] border-l-nbc-red" : "border-[#e5e2da]"}`}>
      <p className="text-[11.5px] font-semibold uppercase tracking-wide text-[#777]">{label}</p>
      <p className="mt-1.5 break-words text-[22px] font-bold tabular-nums text-nbc-navy sm:text-[24px]">{value}</p>
      <p className="mt-0.5 text-[12px] text-[#565656]">{sub}</p>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: "green" | "dark" | "red" }) {
  const color = tone === "green" ? "text-[#017a33]" : tone === "red" ? "text-nbc-red" : "text-[#121212]";
  return (
    <div className="rounded-[6px] border border-[#e5e2da] bg-[#fcfbf8] px-4 py-3">
      <p className="text-[11.5px] text-[#777]">{label}</p>
      <p className={`mt-0.5 text-[17px] font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
