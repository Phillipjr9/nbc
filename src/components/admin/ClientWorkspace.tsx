import { useMemo, useState } from "react";
import type { AdminOps, AdminPanelProps } from "../../banking/adminOps";
import { can, downloadFile, maskSin, statementCsv, todayIso } from "../../banking/adminOps";
import { formatMoney } from "../../banking/bankingTypes";
import {
  formatSupportAge,
  needsSupportReply,
  supportThreadOf,
  unreadSupportCount,
} from "../../banking/supportChat";
import AdminAccounts from "./AdminAccounts";
import AdminClients from "./AdminClients";
import AdminSupport from "./AdminSupport";
import AdminTransactions from "./AdminTransactions";
import { AdminCards } from "./AdminService";
import { ArrowRight, SearchIcon } from "../icons";

/**
 * The client workspace: one page per client.
 *
 * Everything the back office needs about a single person lives here — their
 * identity, ledger, accounts, cards and their support conversation — instead of
 * being mixed with every other client's data in one global table. The client
 * rail on the left switches files in one click, so the admin never loses their
 * place.
 */

export type ClientTabId = "overview" | "transactions" | "accounts" | "cards" | "support";

export const CLIENT_TABS: { id: ClientTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "transactions", label: "Transactions" },
  { id: "accounts", label: "Accounts" },
  { id: "cards", label: "Cards" },
  { id: "support", label: "Support" },
];

export type ClientWorkspaceProps = {
  ops: AdminOps;
  /** Selected client, or `null` for the directory. */
  clientKey: string | null;
  clientTab: ClientTabId;
  onSelectClient: (key: string) => void;
  onSelectTab: (tab: ClientTabId) => void;
  /** The full client directory (create, edit, delete, bulk actions). */
  directoryOpen: boolean;
  onDirectoryChange: (open: boolean) => void;
  onOpenTab: AdminPanelProps["onOpenTab"];
  autoCreate?: number;
};

export default function ClientWorkspace({
  ops,
  clientKey,
  clientTab,
  onSelectClient,
  onSelectTab,
  directoryOpen,
  onDirectoryChange,
  onOpenTab,
  autoCreate,
}: ClientWorkspaceProps) {
  const [search, setSearch] = useState("");

  const rows = useMemo(
    () =>
      ops.users
        .map((entry) => ({
          key: entry.key,
          name: entry.profile.fullName || entry.profile.email,
          email: entry.profile.email,
          segment: entry.profile.roleLabel.replace(" Banking", ""),
          status: entry.profile.status ?? "active",
          unread: unreadSupportCount(entry.profile, "support"),
          awaiting: needsSupportReply(entry.profile),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [ops.users]
  );

  const filtered = rows.filter((row) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return row.name.toLowerCase().includes(needle) || row.email.toLowerCase().includes(needle);
  });

  const entry = clientKey ? ops.users.find((user) => user.key === clientKey) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[25px] font-bold text-nbc-navy sm:text-[28px]">Clients</h1>
          <p className="mt-1 text-[13.5px] text-[#565656]">
            One file per client — their own ledger, accounts, cards and support conversation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onDirectoryChange(!directoryOpen)}
            aria-pressed={directoryOpen}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
              directoryOpen
                ? "bg-nbc-navy text-white"
                : "border border-[#c9c3b6] bg-white text-nbc-navy hover:border-nbc-navy"
            }`}
          >
            Client directory & new client
          </button>
        </div>
      </div>

      {directoryOpen ? (
        <AdminClients
          ops={ops}
          selectedKey={clientKey ?? ""}
          onSelectKey={(key) => {
            // Picking a client in the directory opens that client's own file.
            onSelectClient(key);
            onSelectTab("overview");
            onDirectoryChange(false);
          }}
          onOpenTab={onOpenTab}
          autoCreate={autoCreate}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Client rail */}
          <nav aria-label="Clients" className="overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white">
            <div className="border-b border-[#efefef] p-2.5">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999]" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Find a client…"
                  aria-label="Find a client"
                  className="w-full rounded-[6px] border border-[#d8d3c7] py-2 pl-9 pr-3 text-[13px] text-nbc-navy outline-none focus:border-nbc-navy"
                />
              </div>
            </div>
            <ul className="max-h-[280px] divide-y divide-[#f1efe9] overflow-y-auto lg:max-h-[620px]">
              {filtered.length === 0 && (
                <li className="px-3 py-6 text-center text-[12.5px] text-[#777]">No client matches.</li>
              )}
              {filtered.map((row) => {
                const isActive = row.key === clientKey;
                return (
                  <li key={row.key}>
                    <button
                      type="button"
                      onClick={() => onSelectClient(row.key)}
                      aria-current={isActive ? "true" : undefined}
                      className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition ${
                        isActive ? "bg-[#f4f1ea]" : "hover:bg-[#faf8f3]"
                      }`}
                    >
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-nbc-navy text-[11.5px] font-bold text-white">
                        {(row.name || "?").slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-nbc-navy">{row.name}</span>
                        <span className="block truncate text-[11px] text-[#777]">
                          {row.segment} · {row.status === "frozen" ? "on hold" : "active"}
                        </span>
                      </span>
                      {(row.unread > 0 || row.awaiting) && (
                        <span
                          title={row.unread > 0 ? `${row.unread} unread support message(s)` : "Waiting for a reply"}
                          className={`flex h-4 min-w-4 flex-none items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${
                            row.unread > 0 ? "bg-nbc-red" : "bg-amber-500"
                          }`}
                        >
                          {row.unread > 0 ? row.unread : "!"}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Selected client file */}
          <section aria-label="Client file" className="min-w-0">
            {entry ? (
              <ClientFile
                ops={ops}
                entryKey={entry.key}
                clientTab={clientTab}
                onSelectClient={onSelectClient}
                onSelectTab={onSelectTab}
                onOpenDirectory={() => onDirectoryChange(true)}
              />
            ) : (
              <div className="rounded-[6px] border border-dashed border-[#d8d3c7] bg-white p-10 text-center">
                <p className="text-[14px] font-semibold text-nbc-navy">Select a client to open their file</p>
                <p className="mx-auto mt-1 max-w-[380px] text-[12.5px] text-[#565656]">
                  Each client has their own transactions, accounts, cards and support conversation — nothing is
                  mixed together.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function ClientFile({
  ops,
  entryKey,
  clientTab,
  onSelectClient,
  onSelectTab,
  onOpenDirectory,
}: {
  ops: AdminOps;
  entryKey: string;
  clientTab: ClientTabId;
  onSelectClient: (key: string) => void;
  onSelectTab: (tab: ClientTabId) => void;
  onOpenDirectory: () => void;
}) {
  const entry = ops.users.find((user) => user.key === entryKey);
  if (!entry) return null;

  const p = entry.profile;
  const thread = supportThreadOf(p);
  const unread = unreadSupportCount(p, "support");
  const awaiting = needsSupportReply(p);
  const lastMessage = thread.length > 0 ? thread[thread.length - 1] : null;

  const deposits = p.accounts
    .filter((account) => account.category !== "credit" && account.category !== "loan")
    .reduce((sum, account) => sum + account.balance * (account.currency === "USD" ? 1.36 : 1), 0);
  const credit = p.accounts
    .filter((account) => account.category === "credit" || account.category === "loan")
    .reduce((sum, account) => sum + account.balance, 0);
  const kyc = p.kycStatus ?? "unverified";

  // The embedded pages (ledger, accounts, cards, support) keep their own client
  // picker; pointing it at this workspace means switching client re-scopes the
  // page in place instead of dropping the admin back to a global list.
  const panelProps: AdminPanelProps = {
    ops,
    selectedKey: entry.key,
    onSelectKey: (key) => onSelectClient(key),
    onOpenTab: (tab, key) => {
      if (key && key !== entry.key) onSelectClient(key);
      if (tab === "transactions" || tab === "accounts" || tab === "cards" || tab === "support") {
        onSelectTab(tab);
      }
    },
  };

  return (
    <div className="overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white">
      {/* Client header */}
      <div className="border-b border-[#efefef] bg-[#fcfbf8] px-4 py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-nbc-navy text-[15px] font-bold text-white">
              {(p.fullName || p.email).slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[19px] font-bold text-nbc-navy">{p.fullName || p.email}</h2>
              <p className="truncate text-[12.5px] text-[#565656]">
                {p.email} · {p.roleLabel} · {p.branchName}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] ${
                    p.status === "frozen" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {p.status === "frozen" ? "On hold" : "Active"}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] ${
                    kyc === "verified" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
                  }`}
                >
                  KYC {kyc}
                </span>
                {awaiting && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-amber-900">
                    Waiting for Support
                  </span>
                )}
                {p.transfersPaused && (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-sky-800">
                    Transfers paused
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSelectTab("support")}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#c9c3b6] bg-white px-3 py-1.5 text-[12px] font-semibold text-nbc-navy transition hover:border-nbc-navy"
            >
              Support
              {unread > 0 && (
                <span className="rounded-full bg-nbc-red px-1.5 text-[10px] font-bold text-white">{unread}</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                downloadFile(`nbc-client-${p.email}-${todayIso()}.json`, JSON.stringify(p, null, 2), "application/json");
                ops.notify(`Exported ${p.fullName || p.email}'s record.`);
              }}
              className="rounded-full border border-[#c9c3b6] bg-white px-3 py-1.5 text-[12px] font-semibold text-nbc-navy transition hover:border-nbc-navy"
            >
              Export
            </button>
            {can(ops.identity, "impersonate") && (
              <button
                type="button"
                onClick={() => ops.onImpersonateUser(entry.key)}
                className="rounded-full bg-nbc-navy px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-nbc-red"
              >
                Sign in as this client
              </button>
            )}
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniTile label="Deposits" value={formatMoney(deposits)} />
          <MiniTile label="Credit & loans" value={formatMoney(credit)} />
          <MiniTile label="Accounts" value={String(p.accounts.length)} />
          <MiniTile label="Ledger entries" value={String((p.transactions ?? []).length)} />
        </dl>
      </div>

      {/* Client tabs */}
      <div className="scroll-tabs border-b border-[#efefef] px-1">
        {CLIENT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            aria-current={clientTab === tab.id ? "page" : undefined}
            className={`border-b-[3px] px-3.5 py-2.5 text-[13.5px] transition ${
              clientTab === tab.id
                ? "border-nbc-red font-semibold text-nbc-navy"
                : "border-transparent text-[#565656] hover:text-nbc-navy"
            }`}
          >
            {tab.label}
            {tab.id === "support" && unread > 0 && (
              <span className="ml-1.5 rounded-full bg-nbc-red px-1.5 py-0.5 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="p-4">
        {clientTab === "overview" && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Block title="Identity">
                <p>Phone: {p.phone || "—"}</p>
                <p>Date of birth: {p.dateOfBirth || "—"}</p>
                <p>SIN: {maskSin(p.sin)}</p>
                <p>Client since: {p.memberSince || "—"}</p>
              </Block>
              <Block title="Address & advisor">
                <p>{p.address || "—"}</p>
                <p>{[p.city, p.province, p.postalCode].filter(Boolean).join(", ") || "—"}</p>
                <p className="mt-1">Advisor: {p.advisorName || "—"}</p>
              </Block>
              <Block title="Products">
                <p>{p.accounts.length} account(s)</p>
                <p>{p.cards.length} card(s)</p>
                <p>
                  {p.payees.length} payees · {p.recipients.length} recipients
                </p>
                <p>{p.goals.length} savings goal(s)</p>
              </Block>
              <Block title="Support">
                <p>{thread.length} message(s) in the thread</p>
                <p>
                  {unread > 0 ? `${unread} unread by the desk` : "Nothing unread"}
                  {awaiting ? " · needs a reply" : ""}
                </p>
                {lastMessage && (
                  <p className="mt-1 line-clamp-3 italic text-[#666]">
                    “{lastMessage.body}” · {formatSupportAge(lastMessage.createdAt)}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => onSelectTab("support")}
                  className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-[#1572C5] underline decoration-1 underline-offset-2"
                >
                  Open conversation <ArrowRight className="h-3 w-3" />
                </button>
              </Block>
            </div>

            {p.notes && (
              <div className="rounded-[6px] border border-[#e5e2da] bg-[#fcfbf8] p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#565656]">Internal notes</p>
                <p className="mt-1 whitespace-pre-wrap text-[12.5px] text-[#444]">{p.notes}</p>
              </div>
            )}

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[15px] font-bold text-nbc-navy">Recent transactions</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectTab("transactions")}
                    className="rounded-full border border-[#c9c3b6] bg-white px-3 py-1 text-[11.5px] font-semibold text-nbc-navy hover:border-nbc-navy"
                  >
                    Full ledger
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadFile(`statement-${p.email}-${todayIso()}.csv`, statementCsv(p))}
                    className="rounded-full border border-[#c9c3b6] bg-white px-3 py-1 text-[11.5px] font-semibold text-nbc-navy hover:border-nbc-navy"
                  >
                    Statement CSV
                  </button>
                </div>
              </div>
              <ul className="divide-y divide-[#efefef] overflow-hidden rounded-[6px] border border-[#e5e2da]">
                {(p.transactions ?? []).length === 0 && (
                  <li className="px-3.5 py-6 text-center text-[12.5px] text-[#777]">No entries yet.</li>
                )}
                {[...(p.transactions ?? [])]
                  .sort((a, b) => (a.date < b.date ? 1 : -1))
                  .slice(0, 6)
                  .map((tx) => {
                    const account = p.accounts.find((item) => item.id === tx.accountId);
                    return (
                      <li key={tx.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2">
                        <span className="w-[76px] flex-none text-[11.5px] text-[#777]">{tx.date}</span>
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#121212]">{tx.description}</span>
                        <span className="hidden flex-none text-[11.5px] text-[#777] sm:block">
                          {account?.name ?? tx.accountId}
                        </span>
                        <span
                          className={`flex-none text-right text-[12.5px] font-semibold tabular-nums ${
                            tx.amount >= 0 ? "text-[#017a33]" : "text-[#121212]"
                          }`}
                        >
                          {tx.amount >= 0 ? "+" : ""}
                          {formatMoney(tx.amount, account?.currency ?? "CAD")}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </div>
          </div>
        )}

        {clientTab === "transactions" && <AdminTransactions {...panelProps} />}
        {clientTab === "accounts" && <AdminAccounts {...panelProps} />}
        {clientTab === "cards" && <AdminCards {...panelProps} />}
        {clientTab === "support" && <AdminSupport {...panelProps} focusedClientKey={entry.key} />}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[#ececec] px-4 py-2.5 text-[12px] text-[#565656]">
        <span>Client file</span>
        <button
          type="button"
          onClick={onOpenDirectory}
          className="font-semibold text-[#1572C5] underline decoration-1 underline-offset-2"
        >
          Back to the directory
        </button>
      </div>
    </div>
  );
}

function MiniTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[6px] border border-[#e5e2da] bg-white px-3 py-2">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[#777]">{label}</dt>
      <dd className="text-[15px] font-bold tabular-nums text-nbc-navy">{value}</dd>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[6px] border border-[#e5e2da] bg-white p-3.5 text-[12.5px] leading-[19px] text-[#444]">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#565656]">{title}</p>
      {children}
    </div>
  );
}
