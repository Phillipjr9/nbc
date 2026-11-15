import { useEffect, useMemo, useRef, useState } from "react";
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
import AdminApprovals from "./admin/AdminApprovals";
import {
  AdminAnalytics,
  AdminAuditLog,
  AdminRoles,
  AdminSearch,
} from "./admin/AdminInsights";
import AdminOperations from "./admin/AdminOperations";
import { AdminConfig } from "./admin/AdminService";
import AdminSupport from "./admin/AdminSupport";
import ClientWorkspace, { type ClientTabId } from "./admin/ClientWorkspace";
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

/**
 * Back-office navigation.
 *
 * Accounts, transactions and cards are no longer top-level sections: they are
 * pages *inside* a client's file, so an administrator can never mistake one
 * client's ledger for another's. What is left at the top level is only work that
 * genuinely spans clients.
 */
type AdminSectionId = AdminTabId | "analytics" | "search" | "roles";

const NAV_GROUPS: { title: string; items: { id: AdminSectionId; label: string; hint: string }[] }[] = [
  {
    title: "Clients",
    items: [
      { id: "overview", label: "Overview", hint: "Bank-wide numbers" },
      { id: "clients", label: "Clients", hint: "One file per client" },
      { id: "support", label: "Support inbox", hint: "Client conversations" },
      { id: "approvals", label: "Approvals", hint: "Actions waiting on you" },
    ],
  },
  {
    title: "Operations",
    items: [
      { id: "operations", label: "Batch operations", hint: "Interest, fees, backups" },
      { id: "analytics", label: "Analytics", hint: "Growth and segments" },
      { id: "search", label: "Search", hint: "Find anything" },
    ],
  },
  {
    title: "Administration",
    items: [
      { id: "config", label: "Rates & banners", hint: "Publish to clients" },
      { id: "roles", label: "Access & security", hint: "Roles and audit" },
      { id: "audit", label: "Audit log", hint: "Every action taken" },
    ],
  },
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
  const [tab, setTab] = useState<AdminSectionId>("overview");
  // The client whose file is open. Every client-owned page (ledger, accounts,
  // cards, support) lives inside that file, never in a shared table.
  const [clientKey, setClientKey] = useState<string | null>(() => users[0]?.key ?? null);
  const [clientTab, setClientTab] = useState<ClientTabId>("overview");
  const [directoryOpen, setDirectoryOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab, clientKey, clientTab, directoryOpen]);

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
    // A client that was deleted (or renamed) must not leave the workspace
    // pointing at a file that no longer exists.
    if (clientKey && !users.some((user) => user.key === clientKey)) {
      setClientKey(users[0].key);
    }
  }, [users, selectedKey, clientKey]);

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

  /**
   * Single way to move around the console.
   *
   * Anything that belongs to a client (ledger, accounts, cards, their support
   * thread) opens that client's file on the right page; everything else is a
   * section of its own.
   */
  const openClient = (key: string, page: ClientTabId = "overview") => {
    setSelectedKey(key);
    setClientKey(key);
    setClientTab(page);
    setDirectoryOpen(false);
    setTab("clients");
  };

  const openTab = (next: AdminTabId, key?: string) => {
    if (next === "clients") {
      if (key) openClient(key, "overview");
      else {
        setDirectoryOpen(false);
        setTab("clients");
      }
      return;
    }
    if (next === "transactions" || next === "accounts" || next === "cards" || next === "support") {
      const target = key ?? clientKey ?? selectedKey;
      if (next === "support" && !key) {
        // The inbox is its own section; a client's thread opens their file.
        setTab("support");
        return;
      }
      if (target) {
        openClient(target, next);
        return;
      }
    }
    setTab(next);
  };

  const panelProps = {
    ops,
    selectedKey,
    onSelectKey: setSelectedKey,
    onOpenTab: openTab,
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
                  setDirectoryOpen(true);
                  setCreateRequest((n) => n + 1);
                }}
                className="rounded-full border border-[#c9c3b6] bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-nbc-navy transition hover:border-nbc-navy"
              >
                + New client
              </button>
            )}
            {can(identity, "transactions.post") && (
              <button
                type="button"
                onClick={() => openTab("transactions", clientKey ?? selectedKey)}
                title="Posts on the selected client's ledger"
                className="rounded-full bg-nbc-red px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-nbc-red-dark"
              >
                Post transaction
              </button>
            )}
          </div>
        </div>
      </header>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[90] w-[calc(100%-32px)] max-w-[460px] -translate-x-1/2 rounded-[6px] bg-nbc-navy px-4 py-3 text-center text-[13px] font-medium text-white shadow-lg animate-fade-up">
          {toast}
        </div>
      )}

      <div className="nbc-container grid gap-6 py-6 lg:grid-cols-[236px_minmax(0,1fr)]">
        {/* Section navigation: a sidebar on desktop, a picker on phones */}
        <aside className="lg:sticky lg:top-[76px] lg:h-fit">
          <div className="mb-3 flex items-center gap-2 rounded-[6px] border border-[#e5e2da] bg-white px-3 py-2 lg:hidden">
            <span className="flex-none text-[12px] font-semibold text-nbc-navy">Go to</span>
            <select
              aria-label="Administration section"
              value={tab}
              onChange={(event) => setTab(event.target.value as AdminSectionId)}
              className="min-w-0 flex-1 rounded-[4px] border border-[#d8d3c7] bg-white px-2 py-1 text-[12.5px] text-nbc-navy"
            >
              {NAV_GROUPS.map((group) => (
                <optgroup key={group.title} label={group.title}>
                  {group.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <nav aria-label="Administration" className="hidden lg:block">
            {NAV_GROUPS.map((group) => (
              <div key={group.title} className="mb-4">
                <p className="mb-1.5 px-2 text-[10.5px] font-bold uppercase tracking-[0.09em] text-[#8a8a8a]">
                  {group.title}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = tab === item.id;
                    const badge =
                      item.id === "clients"
                        ? users.length
                        : item.id === "support"
                          ? supportUnread
                          : item.id === "approvals"
                            ? pendingApprovals
                            : 0;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setTab(item.id)}
                          aria-current={isActive ? "page" : undefined}
                          className={`flex w-full items-center justify-between gap-2 rounded-[5px] px-2.5 py-2 text-left transition ${
                            isActive ? "bg-nbc-navy text-white" : "text-[#333] hover:bg-[#f1eee6] hover:text-nbc-navy"
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-semibold">{item.label}</span>
                            <span
                              className={`block truncate text-[10.5px] ${isActive ? "text-white/70" : "text-[#8a8a8a]"}`}
                            >
                              {item.hint}
                            </span>
                          </span>
                          {badge > 0 && (
                            <span
                              className={`flex h-[18px] min-w-[18px] flex-none items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                                isActive ? "bg-white text-nbc-navy" : "bg-nbc-red text-white"
                              }`}
                            >
                              {badge > 99 ? "99+" : badge}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            {clientKey && (
              <div className="border-t border-[#e5e2da] pt-3">
                <p className="mb-1.5 px-2 text-[10.5px] font-bold uppercase tracking-[0.09em] text-[#8a8a8a]">
                  Open client file
                </p>
                <button
                  type="button"
                  onClick={() => setTab("clients")}
                  className="flex w-full items-center gap-2 rounded-[5px] border border-[#d8d3c7] bg-white px-2 py-1.5 text-left text-[11.5px] font-semibold text-nbc-navy hover:border-nbc-navy"
                >
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-nbc-navy text-[10px] font-bold text-white">
                    {(users.find((user) => user.key === clientKey)?.profile.fullName ?? "?").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 truncate">
                    {users.find((user) => user.key === clientKey)?.profile.fullName ?? "Client file"}
                  </span>
                </button>
              </div>
            )}
          </nav>
        </aside>

        <main className="min-w-0">
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
                    { label: "Create client", desc: "Open profiles manually", tab: "clients" as AdminTabId, create: true },
                    { label: "Post transaction", desc: "On the client's ledger", tab: "transactions" as AdminTabId },
                    { label: "Adjust balances", desc: "Credit, debit or override", tab: "accounts" as AdminTabId },
                    { label: "Issue card", desc: "Set limits & points", tab: "cards" as AdminTabId },
                    { label: "Batch processing", desc: "Interest & fees", tab: "operations" as AdminTabId },
                    { label: "Approvals", desc: `${pendingApprovals} waiting`, tab: "approvals" as AdminTabId },
                    { label: "Support inbox", desc: `${supportUnread} unread · ${supportAwaiting} waiting`, tab: "support" as AdminTabId },
                  ].map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      onClick={() => {
                        if (a.create) {
                          setTab("clients");
                          setDirectoryOpen(true);
                          setCreateRequest((n) => n + 1);
                          return;
                        }
                        openTab(a.tab, clientKey ?? selectedKey);
                      }}
                      className="group flex items-center justify-between gap-2 rounded-[6px] border border-[#e5e2da] px-3 py-2.5 text-left transition hover:border-nbc-navy hover:bg-[#fcfbf8]"
                    >
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
                            <button
                              type="button"
                              onClick={() => openClient(u.key, "overview")}
                              className="text-left underline decoration-1 underline-offset-2 hover:text-[#1572C5]"
                            >
                              {u.profile.fullName}
                            </button>
                            {u.profile.status === "frozen" && <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">ON HOLD</span>}
                            {kyc !== "verified" && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">{kyc.toUpperCase()}</span>}
                          </p>
                          <p className="truncate text-[11.5px] text-[#777]">
                            {u.profile.roleLabel} · {formatMoney(assets)} assets · {u.profile.accounts.length} accounts
                          </p>
                        </div>
                        <div className="flex flex-none gap-1.5">
                          <button type="button" onClick={() => openClient(u.key, "overview")} className="rounded-full border border-[#c9c3b6] px-2.5 py-1 text-[11.5px] font-semibold text-nbc-navy hover:border-nbc-navy">
                            Open file
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

        {tab === "clients" && (
          <ClientWorkspace
            ops={ops}
            clientKey={clientKey}
            clientTab={clientTab}
            onSelectClient={(key) => {
              setSelectedKey(key);
              setClientKey(key);
            }}
            onSelectTab={setClientTab}
            directoryOpen={directoryOpen}
            onDirectoryChange={setDirectoryOpen}
            onOpenTab={openTab}
            autoCreate={createRequest}
          />
        )}

        {tab === "support" && <AdminSupport {...panelProps} />}
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
