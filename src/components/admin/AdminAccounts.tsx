import { useMemo, useState } from "react";
import {
  AdminPanelProps,
  ACCOUNT_PRODUCTS,
  applyAdminTransaction,
  can,
  closeAccount,
  downloadFile,
  makeAccountNumber,
  newId,
  round2,
  statementCsv,
  todayIso,
} from "../../banking/adminOps";
import { AccountCategory, BankAccount, formatMoney } from "../../banking/bankingTypes";
import { ArrowRight, SearchIcon } from "../icons";
import { Field, inputCls } from "./AdminClients";

export default function AdminAccounts({ ops, selectedKey, onSelectKey, onOpenTab }: AdminPanelProps) {
  const entry = ops.users.find((u) => u.key === selectedKey) ?? ops.users[0];
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [exactDrafts, setExactDrafts] = useState<Record<string, string>>({});

  // Open new account
  const [presetId, setPresetId] = useState("");
  const [accName, setAccName] = useState("High-Interest Project Reserve");
  const [accCategory, setAccCategory] = useState<AccountCategory>("savings");
  const [accCurrency, setAccCurrency] = useState<"CAD" | "USD">("CAD");
  const [accBalance, setAccBalance] = useState("5000");
  const [accRate, setAccRate] = useState("3.00% promo");
  const [accLimit, setAccLimit] = useState("15000");

  // Custom adjustment
  const [adjAccountId, setAdjAccountId] = useState("");
  const [adjAmount, setAdjAmount] = useState("1000");
  const [adjNote, setAdjNote] = useState("Administrative adjustment");

  // Cross-client transfer
  const [trFromKey, setTrFromKey] = useState(entry?.key ?? "");
  const [trFromAcc, setTrFromAcc] = useState(entry?.profile.accounts[0]?.id ?? "");
  const [trToKey, setTrToKey] = useState(ops.users[1]?.key ?? entry?.key ?? "");
  const [trToAcc, setTrToAcc] = useState(ops.users[1]?.profile.accounts[0]?.id ?? "");
  const [trAmount, setTrAmount] = useState("500");
  const [trNote, setTrNote] = useState("Administration transfer");
  const [trDate, setTrDate] = useState(todayIso());

  if (!entry) return <p className="text-[13.5px] text-[#565656]">No client profiles available.</p>;
  const profile = entry.profile;

  const totals = useMemo(() => {
    let assets = 0;
    let debts = 0;
    for (const a of profile.accounts) {
      const fx = a.currency === "USD" ? 1.36 : 1;
      if (a.category === "credit" || a.category === "loan") debts += a.balance * fx;
      else assets += a.balance * fx;
    }
    return { assets, debts, net: assets - debts };
  }, [profile.accounts]);

  const adjust = (acc: BankAccount, delta: number, note: string) => {
    ops.onUpdateUser(
      entry.key,
      (prev) => applyAdminTransaction(prev, {
        accountId: acc.id,
        description: note,
        amount: Math.abs(delta),
        type: delta >= 0 ? "credit" : "debit",
        category: delta >= 0 ? "Income" : "Business",
        status: "Posted",
        date: todayIso(),
        applyBalance: true,
      }),
      delta >= 0 ? "BALANCE_CREDITED" : "BALANCE_DEBITED",
      `${delta >= 0 ? "Credited" : "Debited"} ${formatMoney(Math.abs(delta), acc.currency)} on ${acc.name} (${note})`,
      "warning"
    );
    ops.notify(`${acc.name} adjusted by ${delta >= 0 ? "+" : "−"}${formatMoney(Math.abs(delta), acc.currency)}.`);
  };

  const setExactBalance = (acc: BankAccount, raw: string) => {
    const target = Number(raw);
    if (!Number.isFinite(target) || target < 0) {
      ops.notify("Enter a valid non-negative balance.");
      return;
    }
    const next = round2(target);
    const delta = round2(next - acc.balance);
    if (!can(ops.identity, "accounts.adjust") || ops.identity?.role === "operations") {
      ops.onRequestApproval({
        requestedBy: ops.identity?.name ?? "Administration",
        action: "balance.override",
        label: `Balance override — ${acc.name}`,
        detail: `Set ${acc.name} from ${formatMoney(acc.balance, acc.currency)} to ${formatMoney(next, acc.currency)} for ${profile.fullName}`,
        targetKey: entry.key,
        payload: { accountId: acc.id, balance: next },
      });
      ops.notify("Override submitted for second authorisation.");
      return;
    }
    ops.onUpdateUser(
      entry.key,
      (prev) => applyAdminTransaction(prev, {
        accountId: acc.id,
        description: `Balance override to ${formatMoney(next, acc.currency)}`,
        amount: Math.abs(delta),
        type: delta >= 0 ? "credit" : "debit",
        category: "Transfer",
        status: "Posted",
        date: todayIso(),
        applyBalance: true,
      }),
      "BALANCE_OVERRIDE",
      `Overrode ${acc.name} to ${formatMoney(next, acc.currency)}`,
      "critical"
    );
    setExactDrafts((d) => ({ ...d, [acc.id]: "" }));
    ops.notify(`${acc.name} balance overridden.`);
  };

  const handleOpenAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const created: BankAccount = {
      id: newId(accCategory),
      name: accName.trim() || "New account",
      number: makeAccountNumber(accCategory, accCurrency),
      category: accCategory,
      balance: round2(Number(accBalance) || 0),
      currency: accCurrency,
      rate: accRate.trim() || undefined,
      limit:
        accCategory === "credit" || accCategory === "loan"
          ? round2(Number(accLimit) || 15000)
          : undefined,
      subtitle: "Opened by National Bank administration",
    };
    ops.onUpdateUser(
      entry.key,
      (prev) => ({
        ...prev,
        accounts: [...prev.accounts, created],
        transactions:
          created.balance > 0
            ? [
                {
                  id: newId("tx"),
                  accountId: created.id,
                  date: todayIso(),
                  description: `Opening balance — ${created.name}`,
                  category: "Income" as const,
                  amount: created.balance,
                  status: "Posted" as const,
                  reference: `OPN-${Math.floor(Math.random() * 900000 + 100000)}`,
                  createdBy: "Administration",
                },
                ...prev.transactions,
              ]
            : prev.transactions,
      }),
      "ACCOUNT_OPENED",
      `Opened ${created.name} (${formatMoney(created.balance, created.currency)}) for ${profile.fullName}`
    );
    ops.notify(`${created.name} opened for ${profile.fullName}.`);
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(trAmount);
    const fromUser = ops.users.find((u) => u.key === trFromKey);
    const toUser = ops.users.find((u) => u.key === trToKey);
    const fromAcc = fromUser?.profile.accounts.find((a) => a.id === trFromAcc);
    const toAcc = toUser?.profile.accounts.find((a) => a.id === trToAcc);
    if (!fromUser || !toUser || !fromAcc || !toAcc) {
      ops.notify("Select both a source and destination account.");
      return;
    }
    if (fromAcc.id === toAcc.id && fromUser.key === toUser.key) {
      ops.notify("Source and destination accounts must be different.");
      return;
    }
    if (!amt || amt <= 0) {
      ops.notify("Enter a transfer amount greater than zero.");
      return;
    }
    if (fromAcc.balance < amt) {
      ops.notify(`Insufficient balance in ${fromAcc.name}.`);
      return;
    }

    ops.onUpdateUser(
      fromUser.key,
      (prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) => (a.id === fromAcc.id ? { ...a, balance: round2(a.balance - amt) } : a)),
        transactions: [
          {
            id: newId("tx"),
            accountId: fromAcc.id,
            date: trDate || todayIso(),
            description: `Transfer to ${toUser.profile.fullName} — ${toAcc.name}${trNote ? ` (${trNote})` : ""}`,
            category: "Transfer",
            amount: -Math.abs(amt),
            status: "Posted",
            reference: `ADM-${Math.floor(Math.random() * 900000 + 100000)}`,
            createdBy: "Administration",
          },
          ...prev.transactions,
        ],
      }),
      "ADMIN_TRANSFER_OUT",
      `Transferred ${formatMoney(amt, fromAcc.currency)} from ${fromUser.profile.fullName} / ${fromAcc.name} to ${toUser.profile.fullName} / ${toAcc.name}`,
      "warning"
    );

    ops.onUpdateUser(
      toUser.key,
      (prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) => (a.id === toAcc.id ? { ...a, balance: round2(a.balance + amt) } : a)),
        transactions: [
          {
            id: newId("tx"),
            accountId: toAcc.id,
            date: trDate || todayIso(),
            description: `Transfer from ${fromUser.profile.fullName} — ${fromAcc.name}${trNote ? ` (${trNote})` : ""}`,
            category: "Transfer",
            amount: Math.abs(amt),
            status: "Posted",
            reference: `ADM-${Math.floor(Math.random() * 900000 + 100000)}`,
            createdBy: "Administration",
          },
          ...prev.transactions,
        ],
      }),
      "ADMIN_TRANSFER_IN",
      `Received ${formatMoney(amt, toAcc.currency)} into ${toUser.profile.fullName} / ${toAcc.name}`,
      "warning"
    );

    ops.notify(`Moved ${formatMoney(amt, fromAcc.currency)} from ${fromUser.profile.fullName} to ${toUser.profile.fullName}.`);
  };

  const trFromUser = ops.users.find((u) => u.key === trFromKey);
  const trToUser = ops.users.find((u) => u.key === trToKey);

  return (
    <div className="space-y-6">
      {/* Client selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-[#e5e2da] bg-white p-4">
        <div className="min-w-0">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-nbc-red">Accounts & balances</p>
          <h2 className="break-words text-[21px] font-bold text-nbc-navy">{profile.fullName}</h2>
          <p className="text-[12.5px] text-[#565656]">
            {profile.email} · {profile.branchName}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <div className="grid grid-cols-3 gap-4 rounded-[6px] bg-[#faf8f3] px-3.5 py-2 text-right">
            <div>
              <span className="block text-[10.5px] uppercase text-[#777]">Assets</span>
              <span className="text-[13.5px] font-bold tabular-nums text-nbc-navy">{formatMoney(totals.assets)}</span>
            </div>
            <div>
              <span className="block text-[10.5px] uppercase text-[#777]">Owed</span>
              <span className="text-[13.5px] font-bold tabular-nums text-[#121212]">{formatMoney(totals.debts)}</span>
            </div>
            <div>
              <span className="block text-[10.5px] uppercase text-[#777]">Net</span>
              <span className="text-[13.5px] font-bold tabular-nums text-[#017a33]">{formatMoney(totals.net)}</span>
            </div>
          </div>
          <select
            value={entry.key}
            onChange={(e) => onSelectKey(e.target.value)}
            className="w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2 text-[13px] font-semibold text-nbc-navy sm:w-auto"
          >
            {ops.users.map((u) => (
              <option key={u.key} value={u.key}>
                {u.profile.fullName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Accounts */}
      <div className="space-y-3">
        {profile.accounts.map((acc) => {
          const isDebt = acc.category === "credit" || acc.category === "loan";
          const editing = editingAccountId === acc.id;
          return (
            <div key={acc.id} className="rounded-[6px] border border-[#e5e2da] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15.5px] font-bold text-nbc-navy">{acc.name}</h3>
                    <span className="rounded bg-[#f4f1ea] px-2 py-0.5 text-[10.5px] font-bold uppercase text-[#565656]">
                      {acc.category} · {acc.currency}
                    </span>
                    {acc.rate && <span className="text-[12px] text-[#105797]">{acc.rate}</span>}
                  </div>
                  <p className="font-mono text-[12px] text-[#777]">{acc.number}</p>
                  <p className="text-[12px] text-[#565656]">
                    {isDebt
                      ? `Limit ${formatMoney(acc.limit ?? 0, acc.currency)} · available ${formatMoney(Math.max(0, (acc.limit ?? 0) - acc.balance), acc.currency)}`
                      : acc.subtitle}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[19px] font-bold tabular-nums text-[#121212]">{formatMoney(acc.balance, acc.currency)}</p>
                  <span className="text-[11.5px] text-[#777]">{isDebt ? "Balance owed" : "Available balance"}</span>
                </div>
              </div>

              {editing ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget as HTMLFormElement);
                    ops.onUpdateUser(
                      entry.key,
                      (prev) => ({
                        ...prev,
                        accounts: prev.accounts.map((a) =>
                          a.id === acc.id
                            ? {
                                ...a,
                                name: String(data.get("name") || a.name).trim(),
                                number: String(data.get("number") || a.number).trim(),
                                rate: String(data.get("rate") || "").trim() || undefined,
                                limit: isDebt ? round2(Number(data.get("limit")) || 0) : a.limit,
                                subtitle: String(data.get("subtitle") || a.subtitle).trim(),
                              }
                            : a
                        ),
                      }),
                      "ACCOUNT_UPDATED",
                      `Edited account details for ${acc.name} (${profile.fullName})`
                    );
                    ops.notify("Account details saved.");
                    setEditingAccountId(null);
                  }}
                  className="mt-3 grid gap-2.5 rounded-[6px] bg-[#faf8f3] p-3 sm:grid-cols-2 lg:grid-cols-4"
                >
                  <Field label="Account name"><input name="name" className={inputCls} defaultValue={acc.name} /></Field>
                  <Field label="Account number"><input name="number" className={inputCls} defaultValue={acc.number} /></Field>
                  <Field label="Rate label"><input name="rate" className={inputCls} defaultValue={acc.rate ?? ""} /></Field>
                  {isDebt ? (
                    <Field label="Authorized limit"><input name="limit" type="number" className={inputCls} defaultValue={acc.limit ?? 0} /></Field>
                  ) : (
                    <Field label="Description"><input name="subtitle" className={inputCls} defaultValue={acc.subtitle} /></Field>
                  )}
                  <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
                    <button type="submit" className="nbc-btn nbc-btn-primary py-2 text-[12.5px]">Save details</button>
                    <button type="button" onClick={() => setEditingAccountId(null)} className="nbc-btn nbc-btn-ghost py-2 text-[12.5px]">Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[#efefef] pt-3">
                  <button type="button" onClick={() => adjust(acc, 1000, "Administration credit +$1,000")} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-800 hover:bg-emerald-100">
                    + $1,000
                  </button>
                  <button type="button" onClick={() => adjust(acc, 10000, "Administration credit +$10,000")} className="rounded-full bg-emerald-600 px-2.5 py-1 text-[11.5px] font-semibold text-white hover:bg-emerald-700">
                    + $10,000
                  </button>
                  <button type="button" onClick={() => adjust(acc, -500, "Administration debit −$500")} className="rounded-full bg-amber-50 px-2.5 py-1 text-[11.5px] font-semibold text-amber-900 hover:bg-amber-100">
                    − $500
                  </button>
                  <div className="flex w-full items-center gap-1.5 sm:ml-auto sm:w-auto">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Set exact balance"
                      value={exactDrafts[acc.id] ?? ""}
                      onChange={(e) => setExactDrafts((d) => ({ ...d, [acc.id]: e.target.value }))}
                      className="min-w-0 flex-1 rounded-[6px] border border-[#c9c3b6] px-2.5 py-1 text-[12px] font-semibold text-nbc-navy sm:w-36 sm:flex-none"
                    />
                    <button type="button" onClick={() => setExactBalance(acc, exactDrafts[acc.id] ?? "")} className="rounded bg-nbc-navy px-2.5 py-1 text-[11.5px] font-semibold text-white hover:bg-nbc-red">
                      Set
                    </button>
                  </div>
                  <button type="button" onClick={() => setEditingAccountId(acc.id)} className="rounded-full border border-[#c9c3b6] px-2.5 py-1 text-[11.5px] font-semibold text-nbc-navy hover:border-nbc-navy">
                    Edit
                  </button>
                  <button type="button" onClick={() => onOpenTab("transactions", entry.key)} className="rounded-full border border-[#c9c3b6] px-2.5 py-1 text-[11.5px] font-semibold text-nbc-navy hover:border-nbc-navy">
                    Post entry
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadFile(`statement-${profile.email}-${acc.number}-${todayIso()}.csv`, statementCsv(profile, acc.id))}
                    className="rounded-full border border-[#c9c3b6] px-2.5 py-1 text-[11.5px] font-semibold text-nbc-navy hover:border-nbc-navy"
                  >
                    Statement
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (profile.accounts.length <= 1) {
                        ops.notify("A client must keep at least one account.");
                        return;
                      }
                      if (window.confirm(`Close ${acc.name}? Linked card, transactions and goals will be removed.`)) {
                        if (ops.identity?.role !== "superadmin") {
                          ops.onRequestApproval({
                            requestedBy: ops.identity?.name ?? "Administration",
                            action: "account.close",
                            label: `Close account — ${acc.name}`,
                            detail: `Close ${acc.name} (${acc.number}) for ${profile.fullName}`,
                            targetKey: entry.key,
                            payload: { accountId: acc.id },
                          });
                          ops.notify("Closure submitted for second authorisation.");
                          return;
                        }
                        ops.onUpdateUser(entry.key, (prev) => closeAccount(prev, acc.id), "ACCOUNT_CLOSED", `Closed ${acc.name} (${acc.number})`, "critical");
                        ops.notify(`${acc.name} closed.`);
                      }
                    }}
                    className="rounded-full bg-rose-50 px-2.5 py-1 text-[11.5px] font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    Close account
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Open account + adjustment */}
        <div className="space-y-5 lg:col-span-5">
          <form onSubmit={handleOpenAccount} className="space-y-3 rounded-[6px] border border-[#e5e2da] bg-white p-4">
            <h3 className="text-[16px] font-bold text-nbc-navy">Open a new account</h3>
            <p className="text-[12px] text-[#565656]">
              Choose a business or personal product, then adjust the opening balance.
            </p>
            <Field label="Product">
              <select
                className={inputCls}
                value={presetId}
                onChange={(e) => {
                  const id = e.target.value;
                  setPresetId(id);
                  const preset = ACCOUNT_PRODUCTS.find((x) => x.id === id);
                  if (!preset) return;
                  setAccName(preset.name);
                  setAccCategory(preset.category);
                  setAccCurrency(preset.currency);
                  setAccRate(preset.rate ?? "");
                  setAccLimit(String(preset.limit ?? 15000));
                  setAccBalance(preset.category === "credit" || preset.category === "loan" ? "0" : "5000");
                }}
              >
                <option value="">Custom account…</option>
                <optgroup label="Business (SME)">
                  {ACCOUNT_PRODUCTS.filter((x) => x.segment === "business").map((x) => (
                    <option key={x.id} value={x.id}>{x.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Personal">
                  {ACCOUNT_PRODUCTS.filter((x) => x.segment === "personal").map((x) => (
                    <option key={x.id} value={x.id}>{x.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Wealth 1859">
                  {ACCOUNT_PRODUCTS.filter((x) => x.segment === "wealth").map((x) => (
                    <option key={x.id} value={x.id}>{x.label}</option>
                  ))}
                </optgroup>
              </select>
            </Field>
            {presetId && (
              <p className="rounded-[6px] bg-[#faf8f3] p-2.5 text-[11.5px] leading-[17px] text-[#565656]">
                {ACCOUNT_PRODUCTS.find((x) => x.id === presetId)?.description}
                {ACCOUNT_PRODUCTS.find((x) => x.id === presetId)?.monthlyFee
                  ? ` Monthly fee: ${ACCOUNT_PRODUCTS.find((x) => x.id === presetId)?.monthlyFee}.`
                  : ""}
              </p>
            )}
            <Field label="Account name"><input className={inputCls} value={accName} onChange={(e) => setAccName(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Product type">
                <select className={inputCls} value={accCategory} onChange={(e) => setAccCategory(e.target.value as AccountCategory)}>
                  <option value="chequing">Chequing</option>
                  <option value="savings">Savings</option>
                  <option value="investment">Investment</option>
                  <option value="credit">Credit card</option>
                  <option value="loan">Loan / Mortgage / LOC</option>
                </select>
              </Field>
              <Field label="Currency">
                <select className={inputCls} value={accCurrency} onChange={(e) => setAccCurrency(e.target.value as "CAD" | "USD")}>
                  <option value="CAD">CAD</option>
                  <option value="USD">USD</option>
                </select>
              </Field>
              <Field label="Opening balance"><input className={inputCls} type="number" min="0" step="0.01" value={accBalance} onChange={(e) => setAccBalance(e.target.value)} /></Field>
              <Field label="Rate label"><input className={inputCls} value={accRate} onChange={(e) => setAccRate(e.target.value)} /></Field>
              {(accCategory === "credit" || accCategory === "loan") && (
                <div className="col-span-2">
                  <Field label="Authorized limit"><input className={inputCls} type="number" min="0" value={accLimit} onChange={(e) => setAccLimit(e.target.value)} /></Field>
                </div>
              )}
            </div>
            <button type="submit" className="nbc-btn nbc-btn-primary w-full py-2.5 text-[13px]">Open account</button>
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const acc = profile.accounts.find((a) => a.id === adjAccountId) ?? profile.accounts[0];
              if (!acc) return;
              const val = Number(adjAmount);
              if (!val) {
                ops.notify("Enter a non-zero amount.");
                return;
              }
              adjust(acc, val, adjNote || "Administrative adjustment");
            }}
            className="space-y-3 rounded-[6px] border border-[#e5e2da] bg-white p-4"
          >
            <h3 className="text-[16px] font-bold text-nbc-navy">Custom credit or debit</h3>
            <Field label="Account">
              <select className={inputCls} value={adjAccountId || profile.accounts[0]?.id} onChange={(e) => setAdjAccountId(e.target.value)}>
                {profile.accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Amount (negative to debit)">
              <input className={inputCls} type="number" step="0.01" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} />
            </Field>
            <Field label="Ledger description">
              <input className={inputCls} value={adjNote} onChange={(e) => setAdjNote(e.target.value)} />
            </Field>
            <button type="submit" className="nbc-btn nbc-btn-ghost w-full py-2.5 text-[13px]">Apply adjustment</button>
          </form>
        </div>

        {/* Cross-client transfer */}
        <form onSubmit={handleTransfer} className="space-y-3 rounded-[6px] border border-[#e5e2da] bg-white p-4 lg:col-span-7">
          <div>
            <h3 className="text-[16px] font-bold text-nbc-navy">Move money between any two accounts</h3>
            <p className="text-[12.5px] text-[#565656]">
              Books a debit and matching credit with references and audit trail — can cross client profiles.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 rounded-[6px] bg-[#faf8f3] p-3">
              <p className="text-[11.5px] font-bold uppercase tracking-wide text-[#565656]">From</p>
              <select
                className={inputCls}
                value={trFromKey}
                onChange={(e) => {
                  setTrFromKey(e.target.value);
                  const u = ops.users.find((x) => x.key === e.target.value);
                  setTrFromAcc(u?.profile.accounts[0]?.id ?? "");
                }}
              >
                {ops.users.map((u) => (
                  <option key={u.key} value={u.key}>{u.profile.fullName}</option>
                ))}
              </select>
              <select className={inputCls} value={trFromAcc} onChange={(e) => setTrFromAcc(e.target.value)}>
                {(trFromUser?.profile.accounts ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.name} — {formatMoney(a.balance, a.currency)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2 rounded-[6px] bg-[#faf8f3] p-3">
              <p className="text-[11.5px] font-bold uppercase tracking-wide text-[#565656]">To</p>
              <select
                className={inputCls}
                value={trToKey}
                onChange={(e) => {
                  setTrToKey(e.target.value);
                  const u = ops.users.find((x) => x.key === e.target.value);
                  setTrToAcc(u?.profile.accounts[0]?.id ?? "");
                }}
              >
                {ops.users.map((u) => (
                  <option key={u.key} value={u.key}>{u.profile.fullName}</option>
                ))}
              </select>
              <select className={inputCls} value={trToAcc} onChange={(e) => setTrToAcc(e.target.value)}>
                {(trToUser?.profile.accounts ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.name} — {formatMoney(a.balance, a.currency)}</option>
                ))}
              </select>
            </div>
            <Field label="Amount"><input className={inputCls} type="number" min="0.01" step="0.01" value={trAmount} onChange={(e) => setTrAmount(e.target.value)} /></Field>
            <Field label="Effective date"><input className={inputCls} type="date" value={trDate} onChange={(e) => setTrDate(e.target.value)} /></Field>
            <div className="sm:col-span-2">
              <Field label="Reference note (appears on both statements)">
                <input className={inputCls} value={trNote} onChange={(e) => setTrNote(e.target.value)} />
              </Field>
            </div>
          </div>
          <button type="submit" className="nbc-btn nbc-btn-primary inline-flex items-center gap-2 py-2.5 text-[13px]">
            Post transfer <ArrowRight className="h-3 w-3" />
          </button>
        </form>
      </div>

      {/* Payees, recipients, goals */}
      <div className="grid gap-5 lg:grid-cols-3">
        <ManageList
          title="Bill payees"
          hint="Registered billers for this client"
          onAdd={(value) =>
            ops.onUpdateUser(
              entry.key,
              (prev) => ({
                ...prev,
                payees: [
                  ...prev.payees,
                  { id: newId("payee"), name: value, accountRef: `REF-${Math.floor(Math.random() * 900000 + 100000)}`, category: "Registered biller" },
                ],
              }),
              "PAYEE_ADDED",
              `Added payee ${value} for ${profile.fullName}`
            )
          }
          items={profile.payees.map((p) => ({ id: p.id, label: p.name, meta: p.accountRef }))}
          onRemove={(id) =>
            ops.onUpdateUser(entry.key, (prev) => ({ ...prev, payees: prev.payees.filter((p) => p.id !== id) }), "PAYEE_REMOVED", `Removed a payee for ${profile.fullName}`)
          }
          addLabel="Add payee"
        />
        <ManageList
          title="e-Transfer recipients"
          hint="Saved Interac recipient list"
          onAdd={(value) =>
            ops.onUpdateUser(
              entry.key,
              (prev) => ({
                ...prev,
                recipients: [...prev.recipients, { id: newId("rec"), name: value, email: `${value.toLowerCase().replace(/\s+/g, ".")}@example.ca`, bank: "Interac e-Transfer®" }],
              }),
              "RECIPIENT_ADDED",
              `Added e-Transfer recipient ${value}`
            )
          }
          items={profile.recipients.map((r) => ({ id: r.id, label: r.name, meta: r.email }))}
          onRemove={(id) =>
            ops.onUpdateUser(entry.key, (prev) => ({ ...prev, recipients: prev.recipients.filter((r) => r.id !== id) }), "RECIPIENT_REMOVED", `Removed an e-Transfer recipient`)
          }
          addLabel="Add recipient"
        />
        <div className="rounded-[6px] border border-[#e5e2da] bg-white p-4">
          <h3 className="text-[15.5px] font-bold text-nbc-navy">Savings goals</h3>
          <p className="text-[12px] text-[#565656]">Balances held in linked savings accounts</p>
          <ul className="mt-2 divide-y divide-[#efefef] text-[12.5px]">
            {profile.goals.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-[#121212]">{g.title}</span>
                  <span className="block text-[11.5px] text-[#777]">
                    {formatMoney(g.current)} of {formatMoney(g.target)} · {g.deadline}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => ops.onUpdateUser(entry.key, (prev) => ({ ...prev, goals: prev.goals.filter((x) => x.id !== g.id) }), "GOAL_REMOVED", `Removed goal ${g.title}`)}
                  className="flex-none rounded bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700"
                >
                  Remove
                </button>
              </li>
            ))}
            {profile.goals.length === 0 && <li className="py-2 text-[#777]">No goals.</li>}
          </ul>
          <button
            type="button"
            onClick={() => {
              const title = window.prompt("New savings goal name?");
              if (!title) return;
              const target = Number(window.prompt("Target amount (CAD)?") ?? "0");
              ops.onUpdateUser(
                entry.key,
                (prev) => ({
                  ...prev,
                  goals: [
                    ...prev.goals,
                    {
                      id: newId("goal"),
                      title,
                      target: Math.max(round2(target) || 1000, 100),
                      current: 0,
                      deadline: "Dec 2026",
                      linkedAccountId: prev.accounts.find((a) => a.category === "savings")?.id ?? prev.accounts[0]?.id ?? "",
                    },
                  ],
                }),
                "GOAL_ADDED",
                `Created savings goal ${title} for ${profile.fullName}`
              );
              ops.notify("Savings goal created.");
            }}
            className="mt-2 w-full rounded-[6px] border border-[#c9c3b6] py-1.5 text-[12.5px] font-semibold text-nbc-navy hover:border-nbc-navy"
          >
            + Add goal
          </button>
        </div>
      </div>
    </div>
  );
}

function ManageList({
  title,
  hint,
  items,
  onAdd,
  onRemove,
  addLabel,
}: {
  title: string;
  hint: string;
  items: { id: string; label: string; meta?: string }[];
  onAdd: (value: string) => void;
  onRemove: (id: string) => void;
  addLabel: string;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="rounded-[6px] border border-[#e5e2da] bg-white p-4">
      <h3 className="text-[15.5px] font-bold text-nbc-navy">{title}</h3>
      <p className="text-[12px] text-[#565656]">{hint}</p>
      <ul className="mt-2 divide-y divide-[#efefef] text-[12.5px]">
        {items.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-2 py-2">
            <span className="min-w-0">
              <span className="block truncate font-semibold text-[#121212]">{i.label}</span>
              {i.meta && <span className="block truncate font-mono text-[11px] text-[#777]">{i.meta}</span>}
            </span>
            <button type="button" onClick={() => onRemove(i.id)} className="flex-none rounded bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
              Remove
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="py-2 text-[#777]">None registered.</li>}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!value.trim()) return;
          onAdd(value.trim());
          setValue("");
        }}
        className="mt-2 flex gap-1.5"
      >
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#999]" />
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Name" className={`${inputCls} pl-8`} />
        </div>
        <button type="submit" className="rounded-[6px] bg-nbc-navy px-3 text-[12px] font-semibold text-white hover:bg-nbc-red">
          {addLabel}
        </button>
      </form>
    </div>
  );
}
