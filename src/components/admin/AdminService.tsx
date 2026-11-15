import { useMemo, useState } from "react";
import {
  AdminOps,
  AdminPanelProps,
  applyCardApprovalDecision,
  can,
  checkCardExpiry,
  generateCardNumber,
  parseBackup,
  CARD_TEMPLATES,
  downloadFile,
  newId,
  randomDigits,
  todayIso,
} from "../../banking/adminOps";
import { CardDeliveryStatus, GlobalBankConfig, PendingCard, formatMoney } from "../../banking/bankingTypes";
import BankCardVisual from "../BankCardVisual";
import { Field, inputCls } from "./AdminClients";

function deliveryBadge(status: CardDeliveryStatus | undefined): string {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function ApprovalPend({ pendingCard, onApprove, onReject }: {
  pendingCard: PendingCard;
  onApprove: (pc: PendingCard) => void;
  onReject: (pc: PendingCard) => void;
}) {
  return (
    <div className="rounded-[6px] border-2 border-dashed border-amber-300 bg-amber-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase text-amber-800">Awaiting approval</p>
        <span className="text-[10px] font-mono text-amber-700">{pendingCard.approvalRequestId}</span>
      </div>
      <p className="mt-1 text-[12px] font-semibold text-nbc-navy">{pendingCard.card.label}</p>
      <p className="text-[11px] text-[#565656]">
        {pendingCard.card.number ? pendingCard.card.number.replace(/(.{4})/g, "$1 ").trim() : `•••• ${pendingCard.card.last4}`}
      </p>
      <p className="text-[11px] text-[#565656]">{pendingCard.card.cardholderName}</p>
      <div className="mt-2 flex gap-1.5">
        <button type="button" onClick={() => onApprove(pendingCard)} className="rounded-full bg-[#017a33] py-1 text-[11px] font-semibold text-white hover:bg-[#015c27]">Approve</button>
        <button type="button" onClick={() => onReject(pendingCard)} className="rounded-full bg-rose-100 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-200">Reject</button>
      </div>
    </div>
  );
}

export function AdminCards({ ops, selectedKey, onSelectKey }: AdminPanelProps) {
  const [targetKey, setTargetKey] = useState(selectedKey);
  const entry = ops.users.find((u) => u.key === targetKey) ?? ops.users.find((u) => u.key === selectedKey) ?? ops.users[0];
  const [templateIdx, setTemplateIdx] = useState(0);
  const [label, setLabel] = useState(CARD_TEMPLATES[0].label);
  const [cardNumber, setCardNumber] = useState(randomDigits(16));
  const [cardExpiry, setCardExpiry] = useState("05/30");
  const [cardCvv, setCardCvv] = useState(randomDigits(3));
  const [billingAddress, setBillingAddress] = useState(entry?.profile.address ?? "");
  const [points, setPoints] = useState(String(CARD_TEMPLATES[0].points));
  const [filterKey, setFilterKey] = useState("all");
  const [expiryResult, setExpiryResult] = useState<{ name: string; cardLabel: string; last4: string; expiry: string }[] | null>(null);

  // Collect pending cards from all users
  const pendingCards = useMemo(
    () =>
      ops.users.flatMap((u) =>
        (u.profile.pendingCards ?? []).map((pc) => ({ userKey: u.key, pendingCard: pc }))
      ),
    [ops.users]
  );

  // Collect issued cards from all users
  const issued = useMemo(
    () =>
      ops.users.flatMap((u) =>
        u.profile.cards.map((card) => ({ userKey: u.key, holder: u.profile.fullName, card }))
      ).filter((r) => filterKey === "all" || r.userKey === filterKey),
    [ops.users, filterKey]
  );

  const approvePending = (pendingCard: PendingCard) => {
    const targetKey = pendingCard.card.linkedAccountId;
    ops.onRequestApproval({
      requestedBy: ops.identity?.name ?? "Administration",
      action: "card.issue",
      label: `Approve card ${pendingCard.card.label}`,
      detail: `Approve ${pendingCard.card.label} ${pendingCard.card.number?.replace(/\s/g, "") ?? pendingCard.card.last4}`,
      targetKey: targetKey,
      payload: { pendingCards: [(pendingCard)] },
    });
    // Directly apply for instant effect (admin is the decider)
    ops.onUpdateUser(targetKey, (prev) => applyCardApprovalDecision(prev, pendingCard, "approved", ops.identity?.name ?? "Administration"), "CARD_APPROVED", `Card ${pendingCard.card.label} approved`);
    ops.notify(`Card ${pendingCard.card.label} approved and issued.`);
  };

  const rejectPending = (pendingCard: PendingCard) => {
    const targetKey = pendingCard.card.linkedAccountId;
    ops.onUpdateUser(targetKey, (prev) => {
      const remaining = prev.pendingCards?.filter((pc) => pc.approvalRequestId !== pendingCard.approvalRequestId) ?? [];
      return { ...prev, pendingCards: remaining };
    }, "CARD_REJECTED", `Card ${pendingCard.card.label} rejected`);
    ops.notify(`Card ${pendingCard.card.label} rejected.`);
  };

  const issue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;
    const template = CARD_TEMPLATES[templateIdx];
    const linked = entry.profile.accounts.find((a) => a.category === "credit") ?? entry.profile.accounts[0];
    const fullCardNumber = cardNumber.replace(/\D/g, "").slice(0, 19);
    const normalizedLast4 = fullCardNumber.slice(-4) || randomDigits(4);
    const pendingCard: PendingCard = {
      approvalRequestId: `CARDPEND-${randomDigits(8)}`,
      card: {
        id: newId("card-pend"),
        label: label.trim() || template.label,
        network: template.network,
        number: fullCardNumber || generateCardNumber(template.accent),
        last4: normalizedLast4,
        expiry: cardExpiry || "05/30",
        cvv: cardCvv || randomDigits(3),
        cardholderName: entry.profile.fullName.toUpperCase().slice(0, 28),
        billingAddress: billingAddress.trim() || entry.profile.address || "Not provided",
        linkedAccountId: linked?.id ?? "",
        locked: false,
        contactless: true,
        international: true,
        onlinePurchases: true,
        rewardsPoints: Math.max(0, Math.round(Number(points) || 0)),
        cashbackRate: template.perks,
        accent: template.accent,
        deliveryStatus: "ordered",
      },
      requestedAt: todayIso(),
      requestedBy: ops.identity?.name ?? "Administration",
    };
    // Store in profile pendingCards
    ops.onUpdateUser(entry.key, (prev) => ({
      ...prev,
      pendingCards: [...(prev.pendingCards ?? []), pendingCard],
    }), "CARD_PENDING", `Card ${pendingCard.card.label} submitted for approval`);
    // Also submit via approval queue
    ops.onRequestApproval({
      requestedBy: ops.identity?.name ?? "Administration",
      action: "card.issue",
      label: `Issue ${pendingCard.card.label} to ${entry.profile.fullName}`,
      detail: `${pendingCard.card.label} •••• ${pendingCard.card.last4} — limit ${formatMoney(pendingCard.card.monthlyLimit ?? 0)}`,
      targetKey: entry.key,
      payload: { pendingCards: [pendingCard] },
    });
    ops.notify(`${pendingCard.card.label} submitted for approval.`);
  };

  const runExpiryCheck = () => {
    const result = checkCardExpiry(ops.users);
    setExpiryResult(result);
    if (result.length > 0) {
      ops.notify(`${result.length} card(s) expiring within 60 days.`);
    } else {
      ops.notify("No cards expiring within 60 days.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[22px] font-bold text-nbc-navy sm:text-[24px]">Card management</h2>
        <p className="mt-0.5 text-[13.5px] text-[#565656]">
          Issue cards (pending approval), grant rewards points, freeze or revoke.
        </p>
      </div>

      {/* Expiry check bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-[6px] border border-[#e5e2da] bg-white p-3">
        <button type="button" onClick={runExpiryCheck} className="rounded-full bg-nbc-navy px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#105797]">
          Check expiring cards
        </button>
        {expiryResult && expiryResult.length > 0 && (
          <span className="text-[12px] text-[#8a6d3b]">
            {expiryResult.length} card(s) expiring within 60 days:
            {expiryResult.map((r) => ` ${r.cardLabel} ${r.last4} (${r.expiry})`).join("")}
          </span>
        )}
      </div>

      {/* Issue card form */}
      <form onSubmit={issue} className="grid gap-3 rounded-[6px] border border-[#e5e2da] bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
        <Field label="Client">
          <select className={inputCls} value={entry?.key ?? ""} onChange={(e) => { setTargetKey(e.target.value); onSelectKey(e.target.value); }}>
            {ops.users.map((u) => (
              <option key={u.key} value={u.key}>{u.profile.fullName}</option>
            ))}
          </select>
        </Field>
        <Field label="Card product">
          <select
            className={inputCls}
            value={templateIdx}
            onChange={(e) => {
              const i = Number(e.target.value);
              setTemplateIdx(i);
              setLabel(CARD_TEMPLATES[i].label);
              setPoints(String(CARD_TEMPLATES[i].points));
            }}
          >
            {CARD_TEMPLATES.map((c, i) => (
              <option key={c.label} value={i}>{c.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Cardholder label"><input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
        <Field label="Card number"><input className={inputCls} value={cardNumber} onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, "").slice(0, 19))} /></Field>
        <Field label="Expiry"><input className={inputCls} value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} placeholder="05/30" /></Field>
        <Field label="CVV"><input className={inputCls} value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} /></Field>
        <Field label="Billing address"><input className={inputCls} value={billingAddress ?? ""} onChange={(e) => setBillingAddress(e.target.value)} placeholder="1200 Rue Sainte-Catherine" /></Field>
        <Field label="Opening points"><input className={inputCls} type="number" min="0" value={points} onChange={(e) => setPoints(e.target.value)} /></Field>
        <div className="flex items-end">
          <button type="submit" className="w-full rounded-[6px] bg-nbc-red py-2.5 text-[13px] font-semibold text-white hover:bg-nbc-red-dark">Issue card (pending approval)</button>
        </div>
      </form>

      {/* Pending approvals */}
      {pendingCards.length > 0 && (
        <div className="rounded-[6px] border border-amber-300 bg-amber-50/40 p-4">
          <h3 className="text-[14px] font-bold uppercase tracking-wide text-amber-800">Pending card approvals ({pendingCards.length})</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pendingCards.map(({ pendingCard }) => (
              <ApprovalPend
                key={pendingCard.approvalRequestId}
                pendingCard={pendingCard}
                onApprove={approvePending}
                onReject={rejectPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${inputCls} max-w-[260px]`} value={filterKey} onChange={(e) => setFilterKey(e.target.value)}>
          <option value="all">All cards ({issued.length})</option>
          {ops.users.map((u) => (
            <option key={u.key} value={u.key}>{u.profile.fullName}</option>
          ))}
        </select>
        <span className="text-[12.5px] text-[#565656]">
          {issued.filter((r) => r.card.locked).length} frozen · {issued.length} total
        </span>
      </div>

      {/* Cards grid */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {issued.map(({ userKey, holder, card }) => {
          const user = ops.users.find((u) => u.key === userKey);
          const linked = user?.profile.accounts.find((a) => a.id === card.linkedAccountId);
          return (
            <div key={`${userKey}-${card.id}`} className="rounded-[6px] border border-[#e5e2da] bg-white p-4">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-bold text-nbc-navy">{holder}</p>
                  <p className="truncate text-[11px] text-[#777]">{linked?.name ?? "No linked account"}</p>
                </div>
                <span className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${card.locked ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>
                  {card.locked ? "Frozen" : "Active"}
                </span>
              </div>
              <BankCardVisual card={card} holderName={holder} compact />
              {/* Delivery status */}
              {card.deliveryStatus && (
                <div className="mt-2 flex items-center gap-2 text-[11px]">
                  <span className="rounded-full bg-[#f4f1ea] px-2 py-0.5 text-[#565656]">
                    Delivery: {deliveryBadge(card.deliveryStatus)}
                  </span>
                  {card.deliveredAt && <span className="text-[#777]">· Delivered {card.deliveredAt}</span>}
                </div>
              )}
              <div className="mt-3 space-y-1.5 text-[11.5px] text-[#565656]">
                <p><strong className="text-[#121212]">Cardholder name:</strong> {card.cardholderName || "—"}</p>
                <p><strong className="text-[#121212]">Card number:</strong> {card.number ? card.number.replace(/(.{4})/g, "$1 ").trim() : `•••• •••• •••• ${card.last4}`}</p>
                <p><strong className="text-[#121212]">Expiry:</strong> {card.expiry}</p>
                <p><strong className="text-[#121212]">CVV:</strong> {card.cvv ?? "—"}</p>
                <p><strong className="text-[#121212]">Billing address:</strong> {card.billingAddress || "—"}</p>
                {card.deliveryStatus && <p><strong className="text-[#121212]">Delivery:</strong> {deliveryBadge(card.deliveryStatus)}{card.deliveredAt ? ` (${card.deliveredAt})` : ""}</p>}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    ops.onUpdateUser(
                      userKey,
                      (prev) => ({ ...prev, cards: prev.cards.map((c) => (c.id === card.id ? { ...c, locked: !c.locked } : c)) }),
                      card.locked ? "CARD_UNLOCKED" : "CARD_FROZEN",
                      `${card.locked ? "Unfroze" : "Froze"} ${card.label} •••• ${card.last4} (${holder})`,
                      "warning"
                    )
                  }
                  className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${card.locked ? "bg-emerald-600 text-white" : "bg-amber-100 text-amber-900"}`}
                >
                  {card.locked ? "Unfreeze" : "Freeze"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    ops.onUpdateUser(
                      userKey,
                      (prev) => ({ ...prev, cards: prev.cards.map((c) => (c.id === card.id ? { ...c, rewardsPoints: (c.rewardsPoints ?? 0) + 10000 } : c)) }),
                      "REWARDS_GRANTED",
                      `Granted 10,000 points on ${card.label} •••• ${card.last4}`
                    )
                  }
                  className="rounded-full border border-[#c9c3b6] px-2.5 py-1 text-[11.5px] font-semibold text-nbc-navy hover:border-nbc-navy"
                >
                  +10,000 pts
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const address = window.prompt("Billing address for this card", card.billingAddress ?? "");
                    if (address === null) return;
                    ops.onUpdateUser(
                      userKey,
                      (prev) => ({ ...prev, cards: prev.cards.map((c) => (c.id === card.id ? { ...c, billingAddress: address.trim() || "Not provided" } : c)) }),
                      "CARD_ADDRESS_UPDATED",
                      `Updated billing address for ${card.label} •••• ${card.last4}`
                    );
                    ops.notify("Card billing address updated.");
                  }}
                  className="rounded-full border border-[#c9c3b6] px-2.5 py-1 text-[11.5px] font-semibold text-nbc-navy hover:border-nbc-navy"
                >
                  Billing address
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm(`Revoke card ending ${card.last4}?`)) return;
                    ops.onUpdateUser(
                      userKey,
                      (prev) => ({ ...prev, cards: prev.cards.filter((c) => c.id !== card.id) }),
                      "CARD_REVOKED",
                      `Revoked ${card.label} •••• ${card.last4} from ${holder}`,
                      "critical"
                    );
                    ops.notify("Card revoked.");
                  }}
                  className="rounded-full bg-rose-100 px-2.5 py-1 text-[11.5px] font-semibold text-rose-700 hover:bg-rose-200"
                >
                  Revoke
                </button>
              </div>
              {card.rewardsPoints !== undefined && (
                <p className="mt-2 text-[11.5px] text-[#565656]">Rewards balance: <strong className="tabular-nums">{card.rewardsPoints.toLocaleString()} pts</strong></p>
              )}
            </div>
          );
        })}
        {issued.length === 0 && <p className="text-[13px] text-[#565656]">No cards match this filter.</p>}
      </div>
    </div>
  );
}

export function AdminConfig({
  bankConfig,
  onUpdateBankConfig,
  onFactoryReset,
  ops,
}: {
  bankConfig: GlobalBankConfig;
  onUpdateBankConfig: (next: GlobalBankConfig, detail: string) => void;
  onFactoryReset: () => void;
  ops: AdminOps;
}) {
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSummary, setRestoreSummary] = useState<string | null>(null);
  const [draft, setDraft] = useState<GlobalBankConfig>(bankConfig);
  const patch = <K extends keyof GlobalBankConfig>(key: K, value: GlobalBankConfig[K]) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!can(ops.identity, "config.publish")) {
            ops.onRequestApproval({
              requestedBy: ops.identity?.name ?? "Administration",
              action: "config.publish",
              label: "Publish rates & site banners",
              detail: `Prime ${draft.primeRate}%, promo ${draft.promoSavingsRate}%, mortgage ${draft.fiveYearMortgageRate}%`,
              targetKey: "system",
              payload: { config: draft },
            });
            ops.notify("Configuration change submitted for second authorisation.");
            return;
          }
          onUpdateBankConfig(draft, `Published rates (prime ${draft.primeRate}%, promo ${draft.promoSavingsRate}%) and site banners`);
          ops.notify("Live site configuration published.");
        }}
        className="space-y-5 rounded-[6px] border border-[#e5e2da] bg-white p-5 lg:col-span-8"
      >
        <div>
          <h2 className="text-[21px] font-bold text-nbc-navy">Interest rates & site banners</h2>
          <p className="text-[13px] text-[#565656]">Published values update the homepage promotions and rate pages.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Prime rate (%)"><input className={inputCls} type="number" step="0.05" value={draft.primeRate} onChange={(e) => patch("primeRate", Number(e.target.value))} /></Field>
          <Field label="Cash Advantage promo (%)"><input className={inputCls} type="number" step="0.05" value={draft.promoSavingsRate} onChange={(e) => patch("promoSavingsRate", Number(e.target.value))} /></Field>
          <Field label="5-year fixed mortgage (%)"><input className={inputCls} type="number" step="0.05" value={draft.fiveYearMortgageRate} onChange={(e) => patch("fiveYearMortgageRate", Number(e.target.value))} /></Field>
        </div>

        <div className="space-y-2 rounded-[6px] border border-[#e6d99c] bg-[#FFF8C7] p-3.5">
          <label className="flex items-center justify-between gap-2 text-[13px] font-bold text-nbc-navy">
            Service alert banner
            <input type="checkbox" checked={draft.alertBannerEnabled} onChange={(e) => patch("alertBannerEnabled", e.target.checked)} className="h-4 w-4 accent-[#e41c23]" />
          </label>
          <input className={inputCls} value={draft.alertBannerTitle} onChange={(e) => patch("alertBannerTitle", e.target.value)} placeholder="Banner headline" />
          <input className={inputCls} value={draft.alertBannerBody} onChange={(e) => patch("alertBannerBody", e.target.value)} placeholder="Banner body" />
        </div>

        <div className="space-y-2 rounded-[6px] border border-[#e5e2da] bg-[#faf8f3] p-3.5">
          <label className="flex items-center justify-between gap-2 text-[13px] font-bold text-nbc-navy">
            Homepage welcome notice
            <input type="checkbox" checked={draft.migrationBannerEnabled} onChange={(e) => patch("migrationBannerEnabled", e.target.checked)} className="h-4 w-4 accent-[#e41c23]" />
          </label>
          <input className={inputCls} value={draft.migrationBannerText} onChange={(e) => patch("migrationBannerText", e.target.value)} />
        </div>

        <div className="space-y-2 rounded-[6px] border border-rose-200 bg-rose-50 p-3.5">
          <label className="flex items-center justify-between gap-2 text-[13px] font-bold text-rose-900">
            System maintenance banner
            <input type="checkbox" checked={draft.maintenanceBannerEnabled} onChange={(e) => patch("maintenanceBannerEnabled", e.target.checked)} className="h-4 w-4 accent-[#e41c23]" />
          </label>
          <input className={inputCls} value={draft.maintenanceBannerText} onChange={(e) => patch("maintenanceBannerText", e.target.value)} />
        </div>

        <button type="submit" className="nbc-btn nbc-btn-primary py-2.5 text-[13.5px]">Publish live changes</button>
      </form>

      <div className="space-y-4 lg:col-span-4">
        <div className="rounded-[6px] border border-[#e5e2da] bg-white p-4">
          <h3 className="text-[16px] font-bold text-nbc-navy">Data & exports</h3>
          <p className="mt-1 text-[12.5px] text-[#565656]">Operating data is held in this browser&apos;s local storage.</p>
          <button
            type="button"
            onClick={() =>
              downloadFile(
                `nbc-admin-backup-${todayIso()}.json`,
                JSON.stringify({ exportedAt: new Date().toISOString(), bankConfig, users: ops.users.map((u) => u.profile) }, null, 2),
                "application/json"
              )
            }
            className="mt-3 w-full rounded-[6px] border border-[#c9c3b6] py-2 text-[12.5px] font-semibold text-nbc-navy hover:border-nbc-navy"
          >
            Export full bank backup (JSON)
          </button>

          <label className="mt-2 block cursor-pointer rounded-[6px] border border-dashed border-[#c9c3b6] px-3 py-3 text-center text-[12.5px] font-semibold text-nbc-navy hover:border-nbc-navy">
            Restore from backup file
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setRestoreError(null);
                setRestoreSummary(null);
                try {
                  const parsed = parseBackup(await file.text());
                  if (!window.confirm(`Restore ${parsed.users.length} client record(s) from this file? Current records will be replaced.`)) return;
                  ops.onRestoreBackup(parsed);
                  setRestoreSummary(`${parsed.users.length} client record(s) restored from ${file.name}.`);
                  ops.notify(`Restored ${parsed.users.length} client record(s).`);
                } catch (err) {
                  setRestoreError(err instanceof Error ? err.message : "That file could not be read as a backup.");
                } finally {
                  e.target.value = "";
                }
              }}
            />
          </label>
          {restoreSummary && <p className="mt-2 text-[11.5px] font-medium text-[#017a33]">{restoreSummary}</p>}
          {restoreError && <p className="mt-2 text-[11.5px] font-medium text-[#842029]">{restoreError}</p>}
          <p className="mt-2 text-[11px] leading-[16px] text-[#777]">
            Backups contain client records and configuration. Store the file securely — it is not encrypted.
          </p>
        </div>

        <div className="rounded-[6px] border border-rose-200 bg-white p-4">
          <h3 className="text-[16px] font-bold text-rose-800">Danger zone</h3>
          <p className="mt-1 text-[12.5px] leading-[18px] text-[#565656]">
            Restores default client records and clears every profile created in this browser.
          </p>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Reset all client records? Profiles created through sign-up will be removed.")) {
                onFactoryReset();
                ops.notify("Factory reset complete.");
              }
            }}
            className="mt-3 w-full rounded-[6px] bg-rose-600 py-2 text-[12.5px] font-semibold text-white hover:bg-rose-700"
          >
            Factory reset
          </button>
        </div>
      </div>
    </div>
  );
}
