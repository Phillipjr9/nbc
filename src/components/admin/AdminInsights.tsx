import { useMemo, useState } from "react";
import {
  AdminPanelProps,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  downloadFile,
  todayIso,
} from "../../banking/adminOps";
import { AuditLogEntry, formatMoney } from "../../banking/bankingTypes";
import { SearchIcon } from "../icons";

/* ----------------------------- analytics ----------------------------- */

export function AdminAnalytics({ ops }: AdminPanelProps) {
  const data = useMemo(() => {
    let deposits = 0;
    let credit = 0;
    const segments = { personal: 0, business: 0, wealth: 0 };
    const categories = new Map<string, number>();
    const monthly = new Map<string, { credits: number; debits: number }>();
    const exceptions: {
      key: string;
      name: string;
      description: string;
      amount: number;
      date: string;
      status: string;
    }[] = [];

    for (const u of ops.users) {
      const kind = u.profile.accountKind ?? (u.profile.id === "business" ? "business" : u.profile.id === "wealth" ? "wealth" : "personal");
      for (const a of u.profile.accounts) {
        const fx = a.currency === "USD" ? 1.36 : 1;
        if (a.category === "credit" || a.category === "loan") credit += a.balance * fx;
        else {
          deposits += a.balance * fx;
          segments[kind] += a.balance * fx;
        }
      }
      for (const t of u.profile.transactions) {
        categories.set(t.category, (categories.get(t.category) ?? 0) + Math.abs(t.amount));
        const month = t.date.slice(0, 7);
        const bucket = monthly.get(month) ?? { credits: 0, debits: 0 };
        if (t.amount >= 0) bucket.credits += t.amount;
        else bucket.debits += Math.abs(t.amount);
        monthly.set(month, bucket);
        if (Math.abs(t.amount) >= 2000 || (t.status ?? "Posted") === "Pending") {
          exceptions.push({
            key: u.key,
            name: u.profile.fullName,
            description: t.description,
            amount: t.amount,
            date: t.date,
            status: t.status ?? "Posted",
          });
        }
      }
    }

    const monthlyList = Array.from(monthly.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 6)
      .reverse();
    const maxMonthly = Math.max(1, ...monthlyList.flatMap(([, v]) => [v.credits, v.debits]));
    const categoryList = Array.from(categories.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const categoryTotal = categoryList.reduce((s, [, v]) => s + v, 0) || 1;

    return { deposits, credit, segments, monthlyList, maxMonthly, categoryList, categoryTotal, exceptions };
  }, [ops.users]);

  const segmentTotal = data.segments.personal + data.segments.business + data.segments.wealth || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold text-nbc-navy sm:text-[24px]">Portfolio analytics</h2>
          <p className="mt-0.5 text-[13.5px] text-[#565656]">
            Book position, segment mix, monthly movement and exceptions requiring review.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            downloadFile(
              `exceptions-${todayIso()}.csv`,
              ["Client,Date,Description,Amount,Status", ...data.exceptions.map((e) => `"${e.name}",${e.date},"${e.description.replace(/"/g, '""')}",${e.amount.toFixed(2)},${e.status}`)].join("\n")
            )
          }
          className="rounded-full border border-[#c9c3b6] bg-white px-4 py-2 text-[13px] font-semibold text-nbc-navy hover:border-nbc-navy"
        >
          Export exceptions
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Deposits & investments" value={formatMoney(data.deposits)} />
        <Metric label="Credit outstanding" value={formatMoney(data.credit)} />
        <Metric label="Net book position" value={formatMoney(data.deposits - data.credit)} />
        <Metric label="Exceptions flagged" value={String(data.exceptions.length)} tone={data.exceptions.length > 0 ? "amber" : "green"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Deposits by segment */}
        <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5">
          <h3 className="text-[16px] font-bold text-nbc-navy">Deposits by segment</h3>
          <div className="mt-4 space-y-3">
            {(
              [
                ["Personal", data.segments.personal],
                ["Business (SME)", data.segments.business],
                ["Wealth 1859", data.segments.wealth],
              ] as const
            ).map(([label, value]) => {
              const pct = Math.round((value / segmentTotal) * 100);
              return (
                <div key={label}>
                  <div className="flex justify-between text-[12.5px]">
                    <span className="font-medium text-[#121212]">{label}</span>
                    <span className="tabular-nums text-[#565656]">{formatMoney(value)} · {pct}%</span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[#f1ede3]">
                    <div className="h-full rounded-full bg-nbc-navy" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Spend by category */}
        <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5">
          <h3 className="text-[16px] font-bold text-nbc-navy">Ledger volume by category</h3>
          <div className="mt-4 space-y-3">
            {data.categoryList.map(([cat, value]) => {
              const pct = Math.round((value / data.categoryTotal) * 100);
              return (
                <div key={cat}>
                  <div className="flex justify-between text-[12.5px]">
                    <span className="font-medium text-[#121212]">{cat}</span>
                    <span className="tabular-nums text-[#565656]">{formatMoney(value)}</span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[#f1ede3]">
                    <div className="h-full rounded-full bg-nbc-red" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {data.categoryList.length === 0 && <p className="text-[12.5px] text-[#777]">No ledger activity yet.</p>}
          </div>
        </div>
      </div>

      {/* Monthly movement */}
      <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[16px] font-bold text-nbc-navy">Monthly money movement</h3>
          <div className="flex items-center gap-3 text-[11.5px] text-[#565656]">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#017a33]" /> In</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-nbc-navy" /> Out</span>
          </div>
        </div>
        <div className="mt-4 flex items-end gap-3 overflow-x-auto pb-1">
          {data.monthlyList.map(([month, v]) => (
            <div key={month} className="flex min-w-[54px] flex-1 flex-col items-center gap-1">
              <div className="flex h-28 w-full items-end justify-center gap-1">
                <div className="w-3 rounded-t bg-[#017a33]" style={{ height: `${Math.max(3, (v.credits / data.maxMonthly) * 100)}%` }} title={formatMoney(v.credits)} />
                <div className="w-3 rounded-t bg-nbc-navy" style={{ height: `${Math.max(3, (v.debits / data.maxMonthly) * 100)}%` }} title={formatMoney(v.debits)} />
              </div>
              <span className="text-[10.5px] text-[#777]">{month}</span>
            </div>
          ))}
          {data.monthlyList.length === 0 && <p className="text-[12.5px] text-[#777]">No activity.</p>}
        </div>
      </div>

      {/* Exceptions */}
      <div className="overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white">
        <div className="border-b border-[#ece8df] bg-[#fcfbf8] px-5 py-3.5">
          <h3 className="text-[16px] font-bold text-nbc-navy">Exceptions for review ({data.exceptions.length})</h3>
          <p className="text-[12px] text-[#565656]">Entries of $2,000 or more, plus anything still pending.</p>
        </div>
        <ul className="divide-y divide-[#efefef]">
          {data.exceptions.slice(0, 12).map((e, i) => (
            <li key={`${e.key}-${i}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[12.5px]">
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#121212]">{e.description}</p>
                <p className="truncate text-[11.5px] text-[#777]">{e.name} · {e.date}</p>
              </div>
              <div className="text-right">
                <p className={`font-semibold tabular-nums ${e.amount >= 0 ? "text-[#017a33]" : "text-[#121212]"}`}>{formatMoney(e.amount)}</p>
                <p className="text-[10.5px] uppercase text-[#8a6d3b]">{e.status}</p>
              </div>
            </li>
          ))}
          {data.exceptions.length === 0 && <li className="px-5 py-8 text-center text-[12.5px] text-[#565656]">No exceptions flagged.</li>}
        </ul>
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "dark" }: { label: string; value: string; tone?: "dark" | "amber" | "green" }) {
  const color = tone === "amber" ? "text-[#8a6d3b]" : tone === "green" ? "text-[#017a33]" : "text-nbc-navy";
  return (
    <div className="rounded-[6px] border border-[#e5e2da] bg-white p-4">
      <p className="text-[11.5px] text-[#777]">{label}</p>
      <p className={`mt-1 break-words text-[20px] font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

/* ---------------------------- global search ---------------------------- */

export function AdminSearch({ ops, onOpenTab, onSelectKey }: AdminPanelProps) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (q.length < 2) return [];
    const hits: { kind: string; label: string; meta: string; key: string; tab: "clients" | "accounts" | "transactions" | "cards" }[] = [];
    for (const u of ops.users) {
      if (u.profile.fullName.toLowerCase().includes(q) || u.profile.email.toLowerCase().includes(q) || (u.profile.phone ?? "").includes(q)) {
        hits.push({ kind: "Client", label: u.profile.fullName, meta: `${u.profile.email} · ${u.profile.roleLabel}`, key: u.key, tab: "clients" });
      }
      for (const a of u.profile.accounts) {
        if (a.name.toLowerCase().includes(q) || a.number.toLowerCase().includes(q)) {
          hits.push({ kind: "Account", label: a.name, meta: `${u.profile.fullName} · ${a.number} · ${formatMoney(a.balance, a.currency)}`, key: u.key, tab: "accounts" });
        }
      }
      for (const t of u.profile.transactions.slice(0, 60)) {
        if (t.description.toLowerCase().includes(q) || (t.reference ?? "").toLowerCase().includes(q)) {
          hits.push({ kind: "Transaction", label: t.description, meta: `${u.profile.fullName} · ${t.date} · ${formatMoney(t.amount)}`, key: u.key, tab: "transactions" });
        }
      }
      for (const c of u.profile.cards) {
        if (c.label.toLowerCase().includes(q) || c.last4.includes(q)) {
          hits.push({ kind: "Card", label: `${c.label} · ${c.number ?? `•••• ${c.last4}`}`, meta: `${u.profile.fullName} · limit ${c.monthlyLimit ? formatMoney(c.monthlyLimit) : "—"}`, key: u.key, tab: "cards" });
        }
      }
    }
    return hits.slice(0, 40);
  }, [ops.users, q]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[22px] font-bold text-nbc-navy sm:text-[24px]">Global search</h2>
        <p className="mt-0.5 text-[13.5px] text-[#565656]">Search clients, accounts, transactions and cards in one place.</p>
      </div>
      <div className="relative rounded-[6px] border border-[#e5e2da] bg-white p-3">
        <SearchIcon className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, email, phone, account number, description, reference, card ending…"
          className="w-full rounded-[6px] border border-[#c9c3b6] py-2.5 pl-10 pr-3 text-[14px] text-nbc-navy"
        />
      </div>
      <div className="overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white">
        {q.length < 2 ? (
          <p className="px-5 py-10 text-center text-[13px] text-[#565656]">Type at least two characters to search.</p>
        ) : results.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-[#565656]">No matches found.</p>
        ) : (
          <ul className="divide-y divide-[#efefef]">
            {results.map((r, i) => (
              <li key={`${r.kind}-${i}`}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectKey(r.key);
                    onOpenTab(r.tab, r.key);
                  }}
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-left transition hover:bg-[#faf8f3]"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="rounded bg-[#f4f1ea] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#565656]">{r.kind}</span>
                      <span className="truncate text-[13px] font-semibold text-[#121212]">{r.label}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-[#777]">{r.meta}</span>
                  </span>
                  <span className="text-[11.5px] font-semibold text-[#1572C5]">Open →</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* --------------------------- roles & access --------------------------- */

export function AdminRoles({ ops }: AdminPanelProps) {
  const [secondFactor, setSecondFactor] = useState(true);
  const [sessionMinutes, setSessionMinutes] = useState("15");
  const identity = ops.identity;

  const matrix = [
    ["View all client records", "support", "operations", "superadmin"],
    ["Edit client contact details", "support", "operations", "superadmin"],
    ["Create clients", "—", "operations", "superadmin"],
    ["Adjust balances / post transactions", "—", "operations", "superadmin"],
    ["Issue & revoke cards", "—", "operations", "superadmin"],
    ["Delete clients / close accounts", "—", "—", "superadmin"],
    ["Publish rates & site banners", "—", "—", "superadmin"],
    ["Decide approvals", "—", "—", "superadmin"],
    ["Impersonate a client", "—", "—", "superadmin"],
    ["Factory reset", "—", "—", "superadmin"],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[22px] font-bold text-nbc-navy sm:text-[24px]">Roles, access & security</h2>
        <p className="mt-0.5 text-[13.5px] text-[#565656]">Least-privilege access control for the administration console.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {(["superadmin", "operations", "support"] as const).map((role) => {
          const active = identity?.role === role;
          return (
            <div key={role} className={`rounded-[6px] border p-4 ${active ? "border-nbc-navy bg-[#faf8f3]" : "border-[#e5e2da] bg-white"}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[14.5px] font-bold text-nbc-navy">{ROLE_LABEL[role]}</h3>
                {active && <span className="rounded-full bg-nbc-navy px-2 py-0.5 text-[10px] font-bold uppercase text-white">You</span>}
              </div>
              <p className="mt-1 text-[12px] leading-[18px] text-[#565656]">{ROLE_DESCRIPTION[role]}</p>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white">
        <div className="border-b border-[#ece8df] bg-[#fcfbf8] px-4 py-3">
          <h3 className="text-[15.5px] font-bold text-nbc-navy">Permission matrix</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12.5px]">
            <thead className="border-b border-[#e5e2da] text-[11px] uppercase tracking-wide text-[#777]">
              <tr>
                <th className="px-4 py-2.5">Capability</th>
                <th className="px-3 py-2.5 text-center">Support</th>
                <th className="px-3 py-2.5 text-center">Operations</th>
                <th className="px-3 py-2.5 text-center">Super admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f1f1]">
              {matrix.map(([cap, ...cols]) => (
                <tr key={cap}>
                  <td className="px-4 py-2 text-[#333]">{cap}</td>
                  {cols.map((c, i) => (
                    <td key={i} className="px-3 py-2 text-center">
                      {c === "—" ? <span className="text-[#c9c3b6]">—</span> : <span className="font-bold text-[#017a33]">✓</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5">
          <h3 className="text-[16px] font-bold text-nbc-navy">Administrator session</h3>
          <dl className="mt-2 space-y-1.5 text-[12.5px]">
            <div className="flex justify-between"><dt className="text-[#565656]">Signed in as</dt><dd className="font-semibold text-[#121212]">{identity?.name ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-[#565656]">Email</dt><dd className="font-semibold text-[#121212]">{identity?.email ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-[#565656]">Role</dt><dd className="font-semibold text-[#121212]">{identity ? ROLE_LABEL[identity.role] : "—"}</dd></div>
          </dl>
          <button
            type="button"
            onClick={() => ops.onSetIdentity(null)}
            className="mt-3 w-full rounded-full border border-[#c9c3b6] py-2 text-[12.5px] font-semibold text-nbc-navy hover:border-nbc-red hover:text-nbc-red"
          >
            End administrator session
          </button>
        </div>

        <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5">
          <h3 className="text-[16px] font-bold text-nbc-navy">Sign-in protection</h3>
          <div className="mt-3 space-y-3 text-[12.5px]">
            <label className="flex items-start justify-between gap-3">
              <span>
                <span className="block font-medium text-[#333]">Require a second factor</span>
                <span className="block text-[11.5px] text-[#777]">Verification code at every administrator sign-in</span>
              </span>
              <input type="checkbox" checked={secondFactor} onChange={(e) => setSecondFactor(e.target.checked)} className="mt-1 h-4 w-4 accent-[#e41c23]" />
            </label>
            <label className="flex items-start justify-between gap-3">
              <span>
                <span className="block font-medium text-[#333]">Automatic idle lock</span>
                <span className="block text-[11.5px] text-[#777]">Sign out inactive administrator sessions</span>
              </span>
              <select value={sessionMinutes} onChange={(e) => setSessionMinutes(e.target.value)} className="rounded border border-[#c9c3b6] px-2 py-1 text-[12px]">
                {["5", "10", "15", "30", "60"].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
            </label>
          </div>
          <p className="mt-3 rounded-[6px] bg-[#faf8f3] p-2.5 text-[11.5px] leading-[17px] text-[#565656]">
            These settings are enforced in this browser session. Server-side enforcement requires the authentication
            service to apply them at sign-in.
          </p>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- audit log filters --------------------------- */

export function AdminAuditLog({ auditLogs }: { auditLogs: AuditLogEntry[] }) {
  const [severity, setSeverity] = useState("all");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = auditLogs.filter((l) => {
    if (severity !== "all" && l.severity !== severity) return false;
    if (from && l.timestamp < from) return false;
    if (to && l.timestamp > to) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return l.action.toLowerCase().includes(q) || l.detail.toLowerCase().includes(q) || l.actor.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold text-nbc-navy sm:text-[24px]">Audit log</h2>
          <p className="text-[13px] text-[#565656]">Every administrative action is timestamped, attributed and exportable.</p>
        </div>
        <button
          type="button"
          onClick={() =>
            downloadFile(
              `audit-log-${todayIso()}.csv`,
              ["Timestamp,Actor,Action,Detail,Severity", ...filtered.map((l) => [l.timestamp, l.actor, l.action, l.detail, l.severity].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n")
            )
          }
          className="rounded-full border border-[#c9c3b6] bg-white px-4 py-2 text-[13px] font-semibold text-nbc-navy hover:border-nbc-navy"
        >
          Export filtered log
        </button>
      </div>

      <div className="grid gap-2 rounded-[6px] border border-[#e5e2da] bg-white p-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search action, detail or actor" className="rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[13px] text-nbc-navy" />
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2 text-[13px] text-nbc-navy">
          <option value="all">All severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" className="rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[13px] text-nbc-navy" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" className="rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[13px] text-nbc-navy" />
      </div>

      <div className="overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white">
        <ul className="divide-y divide-[#efefef]">
          {filtered.map((log) => (
            <li key={log.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-2 py-0.5 font-mono text-[10.5px] font-bold ${log.severity === "critical" ? "bg-rose-100 text-rose-800" : log.severity === "warning" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}>
                  {log.action}
                </span>
                <span className="text-[11.5px] text-[#777]">{log.timestamp}</span>
                <span className="text-[11.5px] text-[#999]">· {log.actor}</span>
              </div>
              <p className="mt-1 break-words text-[13px] text-[#121212]">{log.detail}</p>
            </li>
          ))}
          {filtered.length === 0 && <li className="px-4 py-10 text-center text-[13px] text-[#565656]">No entries match these filters.</li>}
        </ul>
      </div>
      <p className="text-[11.5px] text-[#777]">{filtered.length} of {auditLogs.length} entries shown. Log entry timestamps use the browser locale.</p>
    </div>
  );
}
