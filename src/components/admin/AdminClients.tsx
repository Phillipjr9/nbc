import { useEffect, useMemo, useState } from "react";
import {
  AdminPanelProps,
  ADVISORS,
  BRANCHES,
  ACCOUNT_PRODUCTS,
  CARD_TEMPLATES,
  PROVINCES,
  buildManagedProfile,
  maskSin,
  NewClientAccountInput,
  NewClientInput,
  statementCsv,
  downloadFile,
  todayIso,
} from "../../banking/adminOps";
import { AccountCategory, BankUserProfile, formatMoney } from "../../banking/bankingTypes";
import { ArrowRight, LockIcon, SearchIcon } from "../icons";

const emptyAccounts = (): NewClientAccountInput[] => [
  { id: "chk", label: "Chequing account", name: "Total Chequing Account", category: "chequing", currency: "CAD", balance: 2500, rate: "", limit: 0, include: true },
  { id: "sav", label: "Savings account", name: "Cash Advantage Solution", category: "savings", currency: "CAD", balance: 5000, rate: "3.00% promo", limit: 0, include: true },
  { id: "crd", label: "Credit card account", name: "Allure® Mastercard®", category: "credit", currency: "CAD", balance: 0, rate: "20.99%", limit: 12000, include: true },
  { id: "inv", label: "Investment account", name: "Tax-Free Savings Account (TFSA)", category: "investment", currency: "CAD", balance: 0, rate: "+7.4% YTD", limit: 0, include: false },
];

const initialNewClient = (): NewClientInput => ({
  segment: "personal",
  fullName: "",
  email: "",
  password: "",
  phone: "",
  address: "",
  city: "",
  province: "QC",
  postalCode: "",
  dateOfBirth: "",
  sin: "",
  businessNumber: "",
  branchName: BRANCHES[0],
  advisorName: ADVISORS[0],
  notes: "",
  accounts: emptyAccounts(),
  card: CARD_TEMPLATES[0],
  goal: { title: "Home down payment", target: 20000 },
});

export default function AdminClients({ ops, selectedKey, onSelectKey, onOpenTab, autoCreate }: AdminPanelProps) {
  const [query, setQuery] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<"all" | "personal" | "business" | "wealth">("all");
  const [creating, setCreating] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState<NewClientInput>(initialNewClient);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (autoCreate) {
      setCreating(true);
      setEditingKey(null);
    }
  }, [autoCreate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ops.users.filter((u) => {
      const kind = u.profile.accountKind ?? (u.profile.id === "business" ? "business" : u.profile.id === "wealth" ? "wealth" : "personal");
      if (segmentFilter !== "all" && kind !== segmentFilter) return false;
      if (!q) return true;
      return (
        u.profile.fullName.toLowerCase().includes(q) ||
        u.profile.email.toLowerCase().includes(q) ||
        u.key.toLowerCase().includes(q)
      );
    });
  }, [ops.users, query, segmentFilter]);

  const totalsFor = (p: BankUserProfile) => {
    let assets = 0;
    let debts = 0;
    for (const a of p.accounts) {
      const fx = a.currency === "USD" ? 1.36 : 1;
      if (a.category === "credit" || a.category === "loan") debts += a.balance * fx;
      else assets += a.balance * fx;
    }
    return { assets, debts };
  };

  const patch = <K extends keyof NewClientInput>(key: K, value: NewClientInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  /** Swap the default account set when the administrator changes segment. */
  const applySegmentDefaults = (segment: "personal" | "business" | "wealth") => {
    setForm((f) => {
      const products = ACCOUNT_PRODUCTS.filter((p) => p.segment === segment);
      const accounts: NewClientAccountInput[] = products.map((p) => ({
        id: p.id,
        label: p.label,
        name: p.name,
        category: p.category,
        currency: p.currency,
        balance: p.category === "credit" || p.category === "loan" ? 0 : 5000,
        rate: p.rate ?? "",
        limit: p.limit ?? 0,
        include: segment === "business" ? p.category !== "loan" : p.category !== "investment",
      }));
      return {
        ...f,
        segment,
        accounts,
        card:
          segment === "business"
            ? CARD_TEMPLATES.find((c) => c.label.includes("Business")) ?? CARD_TEMPLATES[0]
            : CARD_TEMPLATES[0],
      };
    });
  };

  const patchAccount = (id: string, changes: Partial<NewClientAccountInput>) =>
    setForm((f) => ({ ...f, accounts: f.accounts.map((a) => (a.id === id ? { ...a, ...changes } : a)) }));

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!form.fullName.trim() || !form.email.trim()) {
      setFormError("A legal name and a unique email address are required.");
      return;
    }
    if (ops.users.some((u) => u.profile.email.toLowerCase() === form.email.trim().toLowerCase())) {
      setFormError("That email is already used by another client profile.");
      return;
    }
    if (!form.accounts.some((a) => a.include)) {
      setFormError("Include at least one account so the client can sign in to a usable profile.");
      return;
    }
    const profile = buildManagedProfile(form);
    ops.onCreateUser(profile);
    ops.notify(`${profile.fullName} created with ${profile.accounts.length} account(s).`);
    setCreating(false);
    setForm(initialNewClient());
    onSelectKey(profile.email);
  };

  const editing = ops.users.find((u) => u.key === editingKey);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold text-nbc-navy sm:text-[24px]">Client profiles</h2>
          <p className="mt-0.5 text-[13.5px] text-[#565656]">
            {ops.users.length} profiles · create, edit, freeze, or open a client session
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              downloadFile(
                `nbc-clients-${todayIso()}.csv`,
                [
                  "Name,Email,Segment,Status,Accounts,Assets,Debts,Branch,Advisor",
                  ...ops.users.map((u) => {
                    const t = totalsFor(u.profile);
                    return [
                      `"${u.profile.fullName}"`,
                      u.profile.email,
                      u.profile.accountKind ?? u.profile.id,
                      u.profile.status ?? "active",
                      u.profile.accounts.length,
                      t.assets.toFixed(2),
                      t.debts.toFixed(2),
                      `"${u.profile.branchName}"`,
                      `"${u.profile.advisorName}"`,
                    ].join(",");
                  }),
                ].join("\n")
              )
            }
            className="rounded-full border border-[#c9c3b6] bg-white px-4 py-2 text-[13px] font-semibold text-nbc-navy transition hover:border-nbc-navy"
          >
            Export client list
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating((v) => !v);
              setEditingKey(null);
            }}
            className="rounded-full bg-nbc-red px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-nbc-red-dark"
          >
            {creating ? "Close form" : "+ New client"}
          </button>
        </div>
      </div>

      {/* Create client */}
      {creating && (
        <form onSubmit={handleCreate} className="overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white">
          <div className="border-b border-[#ece8df] bg-[#fcfbf8] px-5 py-4">
            <h3 className="text-[19px] font-bold text-nbc-navy">Open a new client profile manually</h3>
            <p className="text-[13px] text-[#565656]">
              The client can immediately sign in with the email and password set here.
            </p>
          </div>

          <div className="grid gap-6 p-5 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-7">
              <div className="grid gap-3 sm:grid-cols-3">
                {(["personal", "business", "wealth"] as const).map((seg) => (
                  <button
                    key={seg}
                    type="button"
                    onClick={() => applySegmentDefaults(seg)}
                    className={`rounded-[6px] border p-3 text-left text-[13.5px] font-semibold transition ${
                      form.segment === seg ? "border-nbc-red bg-[#fffafa] text-nbc-navy" : "border-[#dcd8ce] text-[#565656] hover:border-nbc-navy"
                    }`}
                  >
                    {seg === "personal" ? "Personal" : seg === "business" ? "Business (SME)" : "Private Banking 1859"}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={form.segment === "business" ? "Legal business name *" : "Full legal name *"}>
                  <input className={inputCls} value={form.fullName} onChange={(e) => patch("fullName", e.target.value)} placeholder="e.g., Jordan Martin" required />
                </Field>
                <Field label="Email (sign-in ID) *">
                  <input className={inputCls} type="email" value={form.email} onChange={(e) => patch("email", e.target.value)} placeholder="client@example.ca" required />
                </Field>
                <Field label="Temporary password">
                  <input className={inputCls} value={form.password} onChange={(e) => patch("password", e.target.value)} />
                </Field>
                <Field label="Phone">
                  <input className={inputCls} value={form.phone} onChange={(e) => patch("phone", e.target.value)} placeholder="514-555-0142" />
                </Field>
                <Field label="Date of birth">
                  <input className={inputCls} type="date" value={form.dateOfBirth} onChange={(e) => patch("dateOfBirth", e.target.value)} />
                </Field>
                <Field label="Social insurance number (masked in lists)">
                  <input className={inputCls} value={form.sin} onChange={(e) => patch("sin", e.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="123456789" />
                </Field>
                <Field label="Street address">
                  <input className={inputCls} value={form.address} onChange={(e) => patch("address", e.target.value)} placeholder="1200 Rue Sainte-Catherine" />
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="City">
                    <input className={inputCls} value={form.city} onChange={(e) => patch("city", e.target.value)} placeholder="Montréal" />
                  </Field>
                  <Field label="Prov.">
                    <select className={inputCls} value={form.province} onChange={(e) => patch("province", e.target.value)}>
                      {PROVINCES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Postal code">
                    <input className={inputCls} value={form.postalCode} onChange={(e) => patch("postalCode", e.target.value)} placeholder="H3B 1A7" />
                  </Field>
                </div>
                {form.segment === "business" && (
                  <Field label="Business number (BN)">
                    <input className={inputCls} value={form.businessNumber} onChange={(e) => patch("businessNumber", e.target.value)} placeholder="BN 84920-1142 RC0001" />
                  </Field>
                )}
                <Field label="Home branch">
                  <select className={inputCls} value={form.branchName} onChange={(e) => patch("branchName", e.target.value)}>
                    {BRANCHES.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Assigned advisor">
                  <select className={inputCls} value={form.advisorName} onChange={(e) => patch("advisorName", e.target.value)}>
                    {ADVISORS.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Internal notes (visible to administration only)">
                <textarea className={`${inputCls} min-h-[64px]`} value={form.notes} onChange={(e) => patch("notes", e.target.value)} placeholder="KYC verified in branch; source of funds documented." />
              </Field>
            </div>

            <div className="space-y-4 lg:col-span-5">
              <div className="rounded-[6px] border border-[#e5e2da] p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[15px] font-bold text-nbc-navy">Accounts to open</h4>
                  <span className="text-[12px] text-[#565656]">Include / name / balance</span>
                </div>
                <div className="mt-3 space-y-2.5">
                  {form.accounts.map((acc) => (
                    <div key={acc.id} className={`rounded-[6px] border p-2.5 ${acc.include ? "border-[#cfc9bc] bg-[#fcfbf8]" : "border-[#ececec] opacity-70"}`}>
                      <label className="flex items-center gap-2 text-[13px] font-semibold text-nbc-navy">
                        <input type="checkbox" checked={acc.include} onChange={(e) => patchAccount(acc.id, { include: e.target.checked })} className="h-4 w-4 accent-[#e41c23]" />
                        {acc.label}
                      </label>
                      {acc.include && (
                        <div className="mt-2 space-y-2">
                          <input className={inputCls} value={acc.name} onChange={(e) => patchAccount(acc.id, { name: e.target.value })} placeholder="Account name" />
                          <div className="grid grid-cols-3 gap-2">
                            <select className={inputCls} value={acc.currency} onChange={(e) => patchAccount(acc.id, { currency: e.target.value as "CAD" | "USD" })}>
                              <option value="CAD">CAD</option>
                              <option value="USD">USD</option>
                            </select>
                            <input className={`${inputCls} col-span-2`} type="number" min="0" step="0.01" value={acc.balance} onChange={(e) => patchAccount(acc.id, { balance: Number(e.target.value) })} placeholder="Opening balance" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input className={inputCls} value={acc.rate ?? ""} onChange={(e) => patchAccount(acc.id, { rate: e.target.value })} placeholder="Rate label" />
                            {(acc.category === "credit" || acc.category === "loan") && (
                              <input className={inputCls} type="number" min="0" value={acc.limit ?? 0} onChange={(e) => patchAccount(acc.id, { limit: Number(e.target.value) })} placeholder="Limit" />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      accounts: [
                        ...f.accounts,
                        {
                          id: `acc-${Date.now()}`,
                          label: "Additional account",
                          name: "Additional account",
                          category: "savings" as AccountCategory,
                          currency: "CAD",
                          balance: 0,
                          rate: "",
                          limit: 0,
                          include: true,
                        },
                      ],
                    }))
                  }
                  className="mt-3 text-[13px] font-semibold text-[#1572C5] underline decoration-1 underline-offset-2"
                >
                  + Add another account
                </button>
              </div>

              <div className="rounded-[6px] border border-[#e5e2da] p-4">
                <label className="flex items-center gap-2 text-[13.5px] font-semibold text-nbc-navy">
                  <input
                    type="checkbox"
                    checked={Boolean(form.card)}
                    onChange={(e) => patch("card", e.target.checked ? CARD_TEMPLATES[0] : null)}
                    className="h-4 w-4 accent-[#e41c23]"
                  />
                  Issue a card at opening
                </label>
                {form.card && (
                  <select
                    className={`${inputCls} mt-2`}
                    value={form.card.label}
                    onChange={(e) => patch("card", CARD_TEMPLATES.find((c) => c.label === e.target.value) ?? CARD_TEMPLATES[0])}
                  >
                    {CARD_TEMPLATES.map((c) => (
                      <option key={c.label} value={c.label}>
                        {c.label} — {formatMoney(c.limit)} limit
                      </option>
                    ))}
                  </select>
                )}
                <label className="mt-3 flex items-center gap-2 text-[13.5px] font-semibold text-nbc-navy">
                  <input
                    type="checkbox"
                    checked={Boolean(form.goal)}
                    onChange={(e) => patch("goal", e.target.checked ? { title: "Home down payment", target: 20000 } : null)}
                    className="h-4 w-4 accent-[#e41c23]"
                  />
                  Create a savings goal
                </label>
              </div>
            </div>
          </div>

          {formError && (
            <p className="mx-5 mb-3 rounded-[6px] border border-[#f5c2c7] bg-[#fff5f5] px-3 py-2 text-[13px] text-[#842029]">{formError}</p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#ececec] px-5 py-3.5">
            <button type="button" onClick={() => setCreating(false)} className="nbc-btn nbc-btn-ghost py-2.5 text-[13.5px]">
              Cancel
            </button>
            <button type="submit" className="nbc-btn nbc-btn-primary py-2.5 text-[13.5px]">
              Create client profile
            </button>
          </div>
        </form>
      )}

      {/* Edit profile */}
      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget as HTMLFormElement);
            const get = (k: string) => String(data.get(k) ?? "").trim();
            ops.onUpdateUser(
              editing.key,
              (prev) => ({
                ...prev,
                fullName: get("fullName") || prev.fullName,
                email: get("email") || prev.email,
                phone: get("phone"),
                address: get("address"),
                city: get("city"),
                province: get("province"),
                postalCode: get("postalCode"),
                dateOfBirth: get("dateOfBirth"),
                sin: get("sin").replace(/\D/g, "").slice(0, 9),
                branchName: get("branchName") || prev.branchName,
                advisorName: get("advisorName") || prev.advisorName,
                password: get("password") || prev.password,
                notes: get("notes"),
                businessNumber: get("businessNumber") || prev.businessNumber,
              }),
              "CLIENT_UPDATED",
              `Updated contact and profile details for ${editing.profile.fullName}`
            );
            ops.notify(`${editing.profile.fullName} updated.`);
            setEditingKey(null);
          }}
          className="rounded-[6px] border border-[#e5e2da] bg-white p-5"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-[18px] font-bold text-nbc-navy">Edit profile — {editing.profile.fullName}</h3>
            <button type="button" onClick={() => setEditingKey(null)} className="text-[13px] font-semibold text-[#565656] underline">
              Close
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Full name"><input name="fullName" className={inputCls} defaultValue={editing.profile.fullName} /></Field>
            <Field label="Email"><input name="email" type="email" className={inputCls} defaultValue={editing.profile.email} /></Field>
            <Field label="Reset password">
              <input name="password" className={inputCls} defaultValue="" placeholder="Leave blank to keep current" autoComplete="new-password" />
            </Field>
            <Field label="Phone"><input name="phone" className={inputCls} defaultValue={editing.profile.phone ?? ""} /></Field>
            <Field label="Street address"><input name="address" className={inputCls} defaultValue={editing.profile.address ?? ""} /></Field>
            <Field label="City"><input name="city" className={inputCls} defaultValue={editing.profile.city ?? ""} /></Field>
            <Field label="Province">
              <select name="province" className={inputCls} defaultValue={editing.profile.province ?? "QC"}>
                {PROVINCES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Postal code"><input name="postalCode" className={inputCls} defaultValue={editing.profile.postalCode ?? ""} /></Field>
            <Field label="Date of birth"><input name="dateOfBirth" type="date" className={inputCls} defaultValue={editing.profile.dateOfBirth ?? ""} /></Field>
            <Field label="SIN"><input name="sin" className={inputCls} defaultValue={editing.profile.sin ?? ""} /></Field>
            <Field label="Business number"><input name="businessNumber" className={inputCls} defaultValue={editing.profile.businessNumber ?? ""} /></Field>
            <Field label="Branch">
              <select name="branchName" className={inputCls} defaultValue={editing.profile.branchName}>
                {BRANCHES.map((b) => <option key={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Advisor">
              <select name="advisorName" className={inputCls} defaultValue={editing.profile.advisorName}>
                {ADVISORS.map((a) => <option key={a}>{a}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Internal notes"><textarea name="notes" className={`${inputCls} min-h-[60px]`} defaultValue={editing.profile.notes ?? ""} /></Field>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" className="nbc-btn nbc-btn-primary py-2.5 text-[13.5px]">Save profile changes</button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-[6px] border border-[#e5e2da] bg-white p-3.5">
        <div className="relative min-w-[200px] flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or sign-in ID…"
            className="w-full rounded-[6px] border border-[#c9c3b6] py-2 pl-9 pr-3 text-[13.5px] text-nbc-navy"
          />
        </div>
        {(["all", "personal", "business", "wealth"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSegmentFilter(s)}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
              segmentFilter === s ? "bg-nbc-navy text-white" : "bg-[#f4f1ea] text-nbc-navy hover:bg-[#e8e3d8]"
            }`}
          >
            {s === "all" ? "All segments" : s === "business" ? "Business" : s === "wealth" ? "Wealth 1859" : "Personal"}
          </button>
        ))}
      </div>

      {/* Client list */}
      <div className="overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white">
        <div className="hidden border-b border-[#e5e2da] bg-[#fcfbf8] px-4 py-3 text-[11.5px] font-semibold uppercase tracking-wide text-[#565656] md:grid md:grid-cols-12 md:gap-3">
          <span className="md:col-span-4">Client</span>
          <span className="md:col-span-2">Segment</span>
          <span className="md:col-span-2 text-right">Assets</span>
          <span className="md:col-span-2 text-right">Balances owed</span>
          <span className="md:col-span-2 text-right">Actions</span>
        </div>
        <ul className="divide-y divide-[#efefef]">
          {filtered.map((u) => {
            const t = totalsFor(u.profile);
            const isFrozen = u.profile.status === "frozen";
            return (
              <li
                key={u.key}
                className={`grid gap-3 px-4 py-3.5 md:grid-cols-12 md:items-center ${selectedKey === u.key ? "bg-[#faf8f3]" : ""}`}
              >
                <div className="min-w-0 md:col-span-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => onSelectKey(u.key)} className="text-left text-[15px] font-bold text-[#1572C5] underline decoration-1 underline-offset-2 hover:text-[#105797] hover:no-underline">
                      {u.profile.fullName}
                    </button>
                    {isFrozen && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10.5px] font-bold text-rose-700">FROZEN</span>}
                  </div>
                  <p className="truncate text-[12.5px] text-[#565656]">{u.profile.email}</p>
                  <p className="truncate text-[12px] text-[#777]">
                    {u.profile.advisorName} · {u.profile.accounts.length} accounts
                  </p>
                </div>
                <div className="text-[13px] text-[#444] md:col-span-2">
                  {u.profile.roleLabel.replace(" Banking", "")}
                  <p className="text-[11.5px] text-[#777]">SIN {maskSin(u.profile.sin)}</p>
                </div>
                <div className="text-[14px] font-semibold tabular-nums text-[#121212] md:col-span-2 md:text-right">
                  {formatMoney(t.assets)}
                </div>
                <div className="text-[14px] font-semibold tabular-nums text-[#121212] md:col-span-2 md:text-right">
                  {formatMoney(t.debts)}
                </div>
                <div className="flex flex-wrap gap-1.5 md:col-span-2 md:justify-end">
                  <button type="button" onClick={() => onOpenTab("accounts", u.key)} className="rounded-full border border-[#c9c3b6] px-2.5 py-1 text-[11.5px] font-semibold text-nbc-navy hover:border-nbc-navy">
                    Accounts
                  </button>
                  <button type="button" onClick={() => setEditingKey(u.key)} className="rounded-full border border-[#c9c3b6] px-2.5 py-1 text-[11.5px] font-semibold text-nbc-navy hover:border-nbc-navy">
                    Edit
                  </button>
                  <button type="button" onClick={() => ops.onImpersonateUser(u.key)} className="rounded-full bg-nbc-navy px-2.5 py-1 text-[11.5px] font-semibold text-white hover:bg-nbc-red">
                    Sign in as
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      ops.onUpdateUser(
                        u.key,
                        (prev) => ({ ...prev, status: isFrozen ? "active" : "frozen" }),
                        isFrozen ? "CLIENT_UNFROZEN" : "CLIENT_FROZEN",
                        `${isFrozen ? "Removed hold on" : "Placed a hold on"} ${u.profile.fullName}`,
                        isFrozen ? "info" : "critical"
                      );
                      ops.notify(isFrozen ? "Account hold removed." : "Account placed on hold.");
                    }}
                    className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${isFrozen ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}
                  >
                    {isFrozen ? "Unfreeze" : "Freeze"}
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadFile(`statement-${u.profile.email}-${todayIso()}.csv`, statementCsv(u.profile))}
                    className="rounded-full border border-[#c9c3b6] px-2.5 py-1 text-[11.5px] font-semibold text-nbc-navy hover:border-nbc-navy"
                  >
                    Statement
                  </button>
                  {!u.builtIn && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete the profile for ${u.profile.fullName}? This cannot be undone.`)) {
                          ops.onDeleteCustomUser(u.profile.email);
                          ops.notify("Client profile deleted.");
                        }
                      }}
                      className="rounded-full bg-rose-100 px-2.5 py-1 text-[11.5px] font-semibold text-rose-700 hover:bg-rose-200"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-10 text-center text-[13.5px] text-[#565656]">No client profiles match your search.</li>
          )}
        </ul>
      </div>

      {/* Selected client detail */}
      {selectedKey && (
        <SelectedClientDetails ops={ops} selectedKey={selectedKey} onOpenTab={onOpenTab} />
      )}
    </div>
  );
}

function SelectedClientDetails({
  ops,
  selectedKey,
  onOpenTab,
}: Pick<AdminPanelProps, "ops" | "selectedKey" | "onOpenTab">) {
  const entry = ops.users.find((u) => u.key === selectedKey);
  if (!entry) return null;
  const p = entry.profile;
  return (
    <div className="rounded-[6px] border border-[#e5e2da] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ece8df] bg-[#fcfbf8] px-5 py-4">
        <div>
          <h3 className="text-[18px] font-bold text-nbc-navy">{p.fullName}</h3>
          <p className="text-[12.5px] text-[#565656]">
            {p.email} · {p.branchName}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => onOpenTab("transactions", entry.key)} className="rounded-full bg-nbc-red px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-nbc-red-dark">
            Post transaction
          </button>
          <button type="button" onClick={() => onOpenTab("accounts", entry.key)} className="rounded-full border border-[#c9c3b6] px-3.5 py-1.5 text-[12.5px] font-semibold text-nbc-navy hover:border-nbc-navy">
            Manage accounts
          </button>
        </div>
      </div>
      <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <DetailBlock title="Identity">
          <p>Phone: {p.phone || "—"}</p>
          <p>Date of birth: {p.dateOfBirth || "—"}</p>
          <p>SIN: {maskSin(p.sin)}</p>
          <p>Client since: {p.memberSince}</p>
        </DetailBlock>
        <DetailBlock title="Address">
          <p>{p.address || "—"}</p>
          <p>{[p.city, p.province, p.postalCode].filter(Boolean).join(", ") || "—"}</p>
          <p className="mt-1">Advisor: {p.advisorName}</p>
        </DetailBlock>
        <DetailBlock title="Products">
          <p>{p.accounts.length} accounts</p>
          <p>{p.cards.length} card(s)</p>
          <p>{p.payees.length} payees · {p.recipients.length} e-Transfer recipients</p>
          <p>{p.goals.length} savings goal(s)</p>
        </DetailBlock>
        <DetailBlock title="Access & notes">
          <p>Status: {p.status ?? "active"}</p>
          <p>Password: {p.password ? "Set" : "Not set"}</p>
          <p className="mt-1 italic text-[#666]">{p.notes || "No internal notes."}</p>
        </DetailBlock>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-[#ececec] px-5 py-3.5 text-[12px]">
        <LockIcon className="h-3.5 w-3.5 text-[#565656]" />
        <span className="text-[#565656]">Quick links:</span>
        <button type="button" onClick={() => onOpenTab("cards", entry.key)} className="font-semibold text-[#1572C5] underline decoration-1 underline-offset-2">
          Cards & limits
        </button>
        <ArrowRight className="h-3 w-3 text-[#999]" />
        <button type="button" onClick={() => onOpenTab("transactions", entry.key)} className="font-semibold text-[#1572C5] underline decoration-1 underline-offset-2">
          Full ledger
        </button>
        <button type="button" onClick={() => downloadFile(`statement-${p.email}-${todayIso()}.csv`, statementCsv(p))} className="ml-auto font-semibold text-[#1572C5] underline decoration-1 underline-offset-2">
          Download full statement
        </button>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-[#121212]">{label}</span>
      {children}
    </label>
  );
}

export function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="text-[12.5px] leading-[19px] text-[#444]">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#565656]">{title}</p>
      {children}
    </div>
  );
}

export const inputCls =
  "w-full rounded-[6px] border border-[#c9c3b6] bg-white px-2.5 py-2 text-[13px] text-nbc-navy focus:border-nbc-navy focus:outline-none";
