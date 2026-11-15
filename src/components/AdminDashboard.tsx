import { useEffect, useMemo, useRef, useState } from "react";
import { logoNbc } from "../assets/nbcAssets";
import {
  AdminOps,
  AdminTabId,
  AdminTransactionInput,
  ROLE_LABEL,
  applyAdminTransaction,
  auditCsv,
  can,
  downloadFile,
  freezeCard,
  maskSin,
  nowStamp,
  statementCsv,
  todayIso,
} from "../banking/adminOps";
import { AuditLogEntry, BankUserProfile, GlobalBankConfig, Transaction, TRANSFER_FAILURE_REASONS, formatMoney } from "../banking/bankingTypes";
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
import AdminSupport from "./admin/AdminSupport";
import AdminTransactions from "./admin/AdminTransactions";
import { supportThreadOf, unreadSupportCount } from "../banking/supportChat";
import {
  isNotificationAudioReady,
  isSupportSoundEnabled,
  playSupportChime,
  setSupportSoundEnabled,
  unlockNotificationAudio,
} from "../lib/notificationSound";
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
  support: "Support inbox",
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
  // When a client is selected, their own tabs (overview/transactions/accounts/cards)
  // replace the global tabs so each client sees only their own data.
  const [clientTab, setClientTab] = useState<"overview" | "transactions" | "accounts" | "cards" | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab, clientTab]);

  const [selectedKey, setSelectedKey] = useState(users[0]?.key ?? "personal");
  const [toast, setToast] = useState<string | null>(null);
  const [createRequest, setCreateRequest] = useState(0);

  useEffect(() => {
    if (users.length === 0) {
      setSelectedKey("personal");
      return;
    }
    if (!users.some((user) => user.key === selectedKey)) {
      setSelectedKey(users[0].key);
    }
  }, [users, selectedKey]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((cur) => (cur === message ? null : cur)), 4000);
  };

  /* ---------------- Support inbox notifications ---------------- */

  const [soundOn, setSoundOn] = useState<boolean>(() => isSupportSoundEnabled());
  const [audioReady, setAudioReady] = useState<boolean>(() => isNotificationAudioReady());

  // Browsers only allow audio after a gesture; unlock on the first click/key.
  useEffect(() => {
    const unlock = () => {
      unlockNotificationAudio();
      setAudioReady(isNotificationAudioReady());
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const supportUnread = useMemo(
    () => users.reduce((sum, entry) => sum + unreadSupportCount(entry.profile, "support"), 0),
    [users]
  );

  const supportAwaiting = useMemo(
    () =>
      users.filter((entry) => {
        const thread = supportThreadOf(entry.profile);
        const last = thread[thread.length - 1];
        return Boolean(last && last.side === "client");
      }).length,
    [users]
  );

  const seenSupportUnread = useRef(supportUnread);

  useEffect(() => {
    const previous = seenSupportUnread.current;
    seenSupportUnread.current = supportUnread;
    if (supportUnread <= previous) return;

    playSupportChime();

    const sender = users
      .map((entry) => {
        const thread = supportThreadOf(entry.profile);
        const lastClient = [...thread].reverse().find((message) => message.side === "client");
        return { entry, at: lastClient?.createdAt ?? "" };
      })
      .filter((row) => row.at)
      .sort((a, b) => (a.at < b.at ? 1 : -1))[0];

    notify(
      sender
        ? `New support message from ${sender.entry.profile.fullName || sender.entry.profile.email}`
        : "New support message"
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supportUnread]);

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
      // Client-specific tabs show only that client's data
      if (next === "transactions" || next === "accounts" || next === "cards") {
        setClientTab(next);
      } else {
        setClientTab(null);
        setTab(next);
      }
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
      entries += (p.transactions ?? []).length;
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
            <button
              type="button"
              onClick={() => {
                if (!audioReady) {
                  unlockNotificationAudio();
                  setAudioReady(isNotificationAudioReady());
                }
                const next = !soundOn;
                setSupportSoundEnabled(next);
                setSoundOn(next);
                if (next) playSupportChime();
              }}
              aria-pressed={soundOn}
              title={soundOn ? "Mute new-message sound" : "Enable new-message sound"}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${
                soundOn
                  ? "border-[#c9c3b6] bg-white text-nbc-navy hover:border-nbc-navy"
                  : "border-[#e0b4b4] bg-[#fff5f5] text-[#842029]"
              }`}
            >
              <span aria-hidden="true">{soundOn ? "🔔" : "🔕"}</span>
              <span className="hidden sm:inline">{soundOn ? "Sound on" : "Muted"}</span>
              {supportUnread > 0 && (
                <span className="rounded-full bg-nbc-red px-1.5 text-[10px] font-bold text-white">{supportUnread}</span>
              )}
            </button>
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
                {id === "support" && supportUnread > 0 && (
                  <span className="ml-1.5 rounded-full bg-nbc-red px-1.5 py-0.5 text-[10px] font-bold text-white">{supportUnread}</span>
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
                    { label: "Support inbox", desc: `${supportUnread} unread · ${supportAwaiting} waiting`, tab: "support" as AdminTabId },
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

        {/* Client detail view: when a client is selected, show their own tabs */}
        {clientTab && selectedKey && (
          <ClientDetailView
            key={selectedKey}
            clientKey={selectedKey}
            clientTab={clientTab}
            setClientTab={setClientTab}
            onBack={() => setClientTab(null)}
            {...panelProps}
          />
        )}

        {tab === "clients" && <AdminClients {...panelProps} autoCreate={createRequest} />}
        {tab === "accounts" && clientTab === null && <AdminAccounts {...panelProps} />}
        {tab === "transactions" && clientTab === null && <AdminTransactions {...panelProps} />}
        {tab === "support" && <AdminSupport {...panelProps} />}
        {tab === "cards" && clientTab === null && <AdminCards {...panelProps} />}
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

function ClientDetailView({
  clientKey,
  clientTab,
  setClientTab,
  onBack,
  ops,
}: {
  clientKey: string;
  clientTab: "overview" | "transactions" | "accounts" | "cards";
  setClientTab: (tab: "overview" | "transactions" | "accounts" | "cards") => void;
  onBack: () => void;
  ops: AdminOps;
}) {
  const entry = ops.users.find((u) => u.key === clientKey);
  if (!entry) return null;
  const p = entry.profile;

  const clientTabs: { id: "overview" | "transactions" | "accounts" | "cards"; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "transactions", label: "Transactions" },
    { id: "accounts", label: "Accounts" },
    { id: "cards", label: "Cards" },
  ];

  return (
    <div className="flex-1 bg-[#f8f6f1] pb-14">
      {/* Back bar */}
      <div className="bg-nbc-navy">
        <div className="nbc-container flex items-center justify-between gap-3 py-2.5">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-white/20"
          >
            <span className="flex-none">←</span>
            <span className="flex-none">All clients</span>
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-white/80">{ops.identity?.name ?? "Administration"}</span>
            <button
              type="button"
              onClick={() => {
                downloadFile(
                  `nbc-client-${p.email}-${todayIso()}.json`,
                  JSON.stringify(p, null, 2),
                  "application/json"
                );
                ops.notify(`Exported ${p.fullName}'s record.`);
              }}
              className="rounded-full border border-white/40 bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-white/20"
            >
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Client header */}
      <header className="sticky top-0 z-40 border-b border-[#e5e5e5] bg-white">
        <div className="nbc-container flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-[18px] font-bold text-nbc-navy">{p.fullName}</h1>
            {p.status === "frozen" && (
              <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
                ON HOLD
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => ops.onImpersonateUser(clientKey)}
              className="rounded-full bg-nbc-navy px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-nbc-red"
            >
              Sign in as this client
            </button>
          </div>
        </div>
        {/* Client tabs */}
        <div className="border-t border-[#efefef]">
          <div className="nbc-container scroll-tabs">
            {clientTabs.map((ct) => (
              <button
                key={ct.id}
                type="button"
                onClick={() => setClientTab(ct.id)}
                className={`border-b-[3px] px-3.5 py-3 text-[13.5px] transition ${
                  clientTab === ct.id ? "border-nbc-red font-semibold text-nbc-navy" : "border-transparent text-[#565656] hover:text-nbc-navy"
                }`}
              >
                {ct.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Client tab content */}
      <main className="nbc-container py-7">
        {clientTab === "overview" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[22px] font-bold text-nbc-navy">Client overview</h2>
                <p className="mt-1 text-[13px] text-[#565656]">{p.email} · {p.branchName} · {p.roleLabel}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setClientTab("transactions")}
                  className="rounded-full bg-nbc-red px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-nbc-red-dark"
                >
                  View transactions
                </button>
                <button
                  type="button"
                  onClick={() => setClientTab("accounts")}
                  className="rounded-full border border-[#c9c3b6] bg-white px-4 py-2 text-[13px] font-semibold text-nbc-navy transition hover:border-nbc-navy"
                >
                  Manage accounts
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi label="Accounts" value={String(p.accounts.length)} sub={`${p.cards.length} cards`} />
              <Kpi label="Total deposits" value={formatMoney(p.accounts.filter((a) => a.category !== "credit" && a.category !== "loan").reduce((s, a) => s + a.balance * (a.currency === "USD" ? 1.36 : 1), 0))} sub="Cash & savings" />
              <Kpi label="Credit owing" value={formatMoney(p.accounts.filter((a) => a.category === "credit" || a.category === "loan").reduce((s, a) => s + Math.min(a.balance, a.limit ?? 0), 0))} sub="Credit & loans" />
              <Kpi label="Transactions" value={String((p.transactions ?? []).length)} sub={`${(p.transactions ?? []).filter((t) => t.date === todayIso()).length} today`} />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5">
                <h3 className="text-[16px] font-bold text-nbc-navy">Identity</h3>
                <dl className="mt-3 grid gap-2.5 text-[13px]">
                  <div className="flex justify-between"><dt className="text-[#666]">Email</dt><dd>{p.email}</dd></div>
                  <div className="flex justify-between"><dt className="text-[#666]">Phone</dt><dd>{p.phone || "—"}</dd></div>
                  <div className="flex justify-between"><dt className="text-[#666]">Date of birth</dt><dd>{p.dateOfBirth || "—"}</dd></div>
                  <div className="flex justify-between"><dt className="text-[#666]">SIN</dt><dd>{maskSin(p.sin)}</dd></div>
                  <div className="flex justify-between"><dt className="text-[#666]">Member since</dt><dd>{p.memberSince}</dd></div>
                  <div className="flex justify-between"><dt className="text-[#666]">Status</dt><dd>{p.status ?? "active"}</dd></div>
                </dl>
              </div>

              <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5">
                <h3 className="text-[16px] font-bold text-nbc-navy">Address & advisor</h3>
                <dl className="mt-3 grid gap-2.5 text-[13px]">
                  <div className="flex justify-between"><dt className="text-[#666]">Branch</dt><dd>{p.branchName}</dd></div>
                  <div className="flex justify-between"><dt className="text-[#666]">Advisor</dt><dd>{p.advisorName}</dd></div>
                  <div className="flex justify-between"><dt className="text-[#666]">Address</dt><dd>{[p.address, p.city, p.province, p.postalCode].filter(Boolean).join(", ") || "—"}</dd></div>
                  <div className="flex justify-between"><dt className="text-[#666]">Business number</dt><dd>{p.businessNumber || "—"}</dd></div>
                </dl>
              </div>
            </div>

            {p.notes && (
              <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5">
                <h3 className="text-[16px] font-bold text-nbc-navy">Internal notes</h3>
                <p className="mt-1 text-[13px] text-[#444] whitespace-pre-wrap">{p.notes}</p>
              </div>
            )}

            <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5">
              <h3 className="text-[16px] font-bold text-nbc-navy">Accounts on file</h3>
              <div className="mt-3 divide-y divide-[#efefef]">
                {p.accounts.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="font-semibold text-nbc-navy">{a.name}</p>
                      <p className="text-[11.5px] text-[#777]">{a.number} · {a.category} · {a.currency}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold tabular-nums text-nbc-navy">{formatMoney(a.balance, a.currency)}</p>
                      {a.limit !== undefined && a.category === "credit" && (
                        <p className="text-[11px] text-[#777]">Limit: {formatMoney(a.limit)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {clientTab === "transactions" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[22px] font-bold text-nbc-navy">Transaction history</h2>
                <p className="mt-1 text-[13px] text-[#565656]">{p.fullName} · {p.email}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => downloadFile(`statement-${p.email}-${todayIso()}.csv`, statementCsv(p))}
                  className="rounded-full border border-[#c9c3b6] bg-white px-4 py-2 text-[13px] font-semibold text-nbc-navy transition hover:border-nbc-navy"
                >
                  Download CSV
                </button>
              </div>
            </div>

            {/* Post transaction form */}
            <PostTransactionForm
              key={clientKey}
              profile={p}
              accountId={p.accounts[0]?.id ?? ""}
              onPost={(tx) => {
                ops.onUpdateUser(clientKey, (prev) => applyAdminTransaction(prev, tx), "TRANSACTION_POSTED", `Posted transaction on ${p.fullName}`);
                ops.notify("Transaction posted.");
              }}
            />

            {/* Transaction table */}
            <div className="overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white">
              <div className="flex flex-wrap items-center gap-2 border-b border-[#e5e2da] bg-[#fcfbf8] px-3.5 py-2.5 text-[11.5px] font-semibold text-[#565656]">
                <span>Date</span>
                <span>Description</span>
                <span>Account</span>
                <span className="text-right">Amount</span>
                <span className="text-right">Status</span>
              </div>
              <div className="divide-y divide-[#efefef]">
                {(p.transactions ?? []).length === 0 ? (
                  <p className="px-4 py-8 text-center text-[13px] text-[#565656]">No transactions yet.</p>
                ) : (
                  p.transactions
                    .slice()
                    .sort((a, b) => (a.date < b.date ? 1 : -1))
                    .map((tx) => {
                      const acc = p.accounts.find((a) => a.id === tx.accountId);
                      return (
                        <div key={tx.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-[13px]">
                          <span className="text-[#565656]">{tx.date}</span>
                          <span className="min-w-0 flex-1">
                            <span className="font-medium text-[#121212]">{tx.description}</span>
                            {tx.failureReason && (
                              <span className="mt-0.5 block text-[11px] font-semibold text-[#b91c1c] bg-rose-50 px-1.5 py-0.5 rounded">
                                Reversal reason: {tx.failureReason}
                              </span>
                            )}
                          </span>
                          <span className="text-[#565656]">{acc?.name ?? tx.accountId}</span>
                          <span className={`whitespace-nowrap text-right font-semibold tabular-nums ${tx.amount >= 0 ? "text-[#017a33]" : "text-[#121212]"}`}>
                            {tx.amount >= 0 ? `+${formatMoney(tx.amount, acc?.currency ?? "CAD")}` : formatMoney(tx.amount, acc?.currency ?? "CAD")}
                          </span>
                          <span className="text-right">{tx.status ?? "Posted"}</span>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        )}

        {clientTab === "accounts" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[22px] font-bold text-nbc-navy">Account management</h2>
                <p className="mt-1 text-[13px] text-[#565656]">{p.fullName} · {p.email}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {p.accounts.map((a) => (
                <div key={a.id} className="rounded-[6px] border border-[#e5e2da] bg-white p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-nbc-navy">{a.name}</p>
                      <p className="text-[11.5px] text-[#777]">{a.number}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${a.category === "credit" || a.category === "loan" ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>
                      {a.category}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] text-[#565656]">{a.subtitle}</p>
                  <p className="mt-2 text-[17px] font-bold tabular-nums text-nbc-navy">{formatMoney(a.balance, a.currency)}</p>
                  {a.limit !== undefined && (
                    <p className="mt-0.5 text-[11.5px] text-[#777]">Limit: {formatMoney(a.limit)}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => ops.onUpdateUser(clientKey, (prev) => applyAdminTransaction(prev, { accountId: a.id, description: "Administrative credit", amount: 100, type: "credit", category: "Income", status: "Posted", date: todayIso(), applyBalance: true }), "TRANSACTION_POSTED", `Credited $100 to ${a.name}`)}
                      className="rounded-full bg-[#017a33] px-3 py-1 text-[11.5px] font-semibold text-white hover:bg-[#015c27]"
                    >
                      + Credit $100
                    </button>
                    <button
                      type="button"
                      onClick={() => ops.onUpdateUser(clientKey, (prev) => applyAdminTransaction(prev, { accountId: a.id, description: "Administrative debit", amount: 100, type: "debit", category: "Utilities", status: "Posted", date: todayIso(), applyBalance: true }), "TRANSACTION_POSTED", `Debited $100 from ${a.name}`)}
                      className="rounded-full bg-rose-100 px-3 py-1 text-[11.5px] font-semibold text-rose-700 hover:bg-rose-200"
                    >
                      - Debit $100
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {clientTab === "cards" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[22px] font-bold text-nbc-navy">Cards & limits</h2>
                <p className="mt-1 text-[13px] text-[#565656]">{p.fullName} · {p.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setClientTab("transactions")}
                className="rounded-full border border-[#c9c3b6] bg-white px-4 py-2 text-[13px] font-semibold text-nbc-navy transition hover:border-nbc-navy"
              >
                Back to transactions
              </button>
            </div>

            {p.cards.length === 0 ? (
              <p className="text-[13px] text-[#565656]">No cards issued for this client.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {p.cards.map((card) => {
                  const linked = p.accounts.find((a) => a.id === card.linkedAccountId);
                  return (
                    <div key={card.id} className="rounded-[6px] border border-[#e5e2da] bg-white p-5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-nbc-navy">{card.label}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${card.locked ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>
                          {card.locked ? "Frozen" : "Active"}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-[#565656]">{card.network} · ending {card.last4}</p>
                      <p className="mt-1 text-[12px] text-[#565656]">Cardholder: {card.cardholderName || "—"}</p>
                      <p className="mt-1 text-[12px] text-[#565656]">Card number: {card.number ? card.number.replace(/(.{4})/g, "$1 ").trim() : `•••• •••• •••• ${card.last4}`}</p>
                      <p className="mt-1 text-[12px] text-[#565656]">CVV: {card.cvv ?? "—"}</p>
                      <p className="mt-1 text-[12px] text-[#565656]">Expiry: {card.expiry}</p>
                      <p className="mt-1 text-[12px] text-[#565656]">Billing address: {card.billingAddress || "—"}</p>
                      <p className="mt-1 text-[12px] text-[#565656]">Linked account: {linked?.name ?? "Unassigned"}</p>
                      {card.monthlyLimit !== undefined && (
                        <p className="mt-1 text-[12px] text-[#565656]">Monthly limit: {formatMoney(card.monthlyLimit)}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => ops.onUpdateUser(clientKey, (prev) => freezeCard(prev, card.id, "Admin"), "CARD_FROZEN", `Froze ${card.label}`)}
                          className={`rounded-full px-3 py-1 text-[11.5px] font-semibold ${card.locked ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}
                        >
                          {card.locked ? "Unfreeze" : "Freeze"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function PostTransactionForm({
  profile,
  accountId,
  onPost,
}: {
  profile: BankUserProfile;
  accountId: string;
  onPost: (input: AdminTransactionInput) => void;
}) {
  const [type, setType] = useState<"credit" | "debit">("credit");
  const [desc, setDesc] = useState("Administration entry");
  const [amount, setAmount] = useState("100");
  const [category, setCategory] = useState<Transaction["category"]>("Income");
  const [status, setStatus] = useState<"Posted" | "Pending" | "Failed">("Posted");
  const [date, setDate] = useState(todayIso());
  const [applyBalance, setApplyBalance] = useState(true);

  const activeAccount = profile.accounts.find((a) => a.id === accountId) ?? profile.accounts[0];
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || !Number.isFinite(amt)) return;
    onPost({
      accountId: activeAccount?.id ?? "",
      description: desc.trim() || "Administration entry",
      amount: amt,
      type,
      category,
      status,
      failureReason: status === "Failed" ? TRANSFER_FAILURE_REASONS[0] : undefined,
      date,
      applyBalance,
    });
    setAmount("100");
    setDesc("Administration entry");
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-[6px] border border-[#e5e2da] bg-white p-5 space-y-3">
      <h3 className="text-[15px] font-bold text-nbc-navy">Post a transaction</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex gap-2">
          <label className="flex items-center gap-1.5 text-[12.5px] font-semibold text-nbc-navy">
            <input type="radio" name="type" value="credit" checked={type === "credit"} onChange={(e) => setType(e.target.value as "credit" | "debit")} className="h-3.5 w-3.5 accent-nbc-red" />
            Credit
          </label>
          <label className="flex items-center gap-1.5 text-[12.5px] font-semibold text-nbc-navy">
            <input type="radio" name="type" value="debit" checked={type === "debit"} onChange={(e) => setType(e.target.value as "credit" | "debit")} className="h-3.5 w-3.5 accent-nbc-red" />
            Debit
          </label>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-1.5 text-[12.5px] font-semibold">
            <input type="checkbox" checked={applyBalance} onChange={(e) => setApplyBalance(e.target.checked)} className="h-3.5 w-3.5 accent-nbc-red" />
            Apply to balance
          </label>
          <select value={category} onChange={(e) => setCategory(e.target.value as Transaction["category"])} className="rounded-[6px] border border-[#c9c3b6] bg-white px-2 py-1 text-[12.5px]">
            <option value="Income">Income</option>
            <option value="Transfer">Transfer</option>
            <option value="Utilities">Utilities</option>
            <option value="Shopping">Shopping</option>
            <option value="Business">Business</option>
            <option value="Groceries">Groceries</option>
            <option value="Dining">Dining</option>
            <option value="Investments">Investments</option>
          </select>
        </div>
        <div className="flex gap-2 items-end">
          <label className="text-[12.5px] font-semibold text-[#121212]">Amount</label>
          <input className="flex-1 rounded-[6px] border border-[#c9c3b6] bg-white px-2.5 py-1.5 text-[13px] text-nbc-navy" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <span className="text-[12px] text-[#777]">{activeAccount?.currency ?? "CAD"}</span>
        </div>
        <div className="flex gap-2 items-end">
          <label className="text-[12.5px] font-semibold text-[#121212]">Description</label>
          <input className="flex-1 rounded-[6px] border border-[#c9c3b6] bg-white px-2.5 py-1.5 text-[13px]" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Entry description" />
        </div>
        <div className="flex gap-2 items-end">
          <label className="text-[12.5px] font-semibold text-[#121212]">Date</label>
          <input className="flex-1 rounded-[6px] border border-[#c9c3b6] bg-white px-2.5 py-1.5 text-[13px]" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <select value={status} onChange={(e) => setStatus(e.target.value as "Posted" | "Pending" | "Failed")} className="rounded-[6px] border border-[#c9c3b6] bg-white px-2 py-1 text-[12.5px]">
            <option value="Posted">Posted</option>
            <option value="Pending">Pending</option>
            <option value="Failed">Failed</option>
          </select>
        </div>
      </div>
      <button type="submit" className="nbc-btn nbc-btn-primary py-2 text-[13px]">Post transaction</button>
    </form>
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
