import { useEffect } from "react";
import { logoBnMark } from "../assets/nbcAssets";
import { formatMoney } from "../banking/bankingTypes";
import { ArrowRight, CloseIcon, LockIcon } from "./icons";

export type AnimatedTxKind = "transfer" | "etransfer" | "bill" | "deposit" | "goal" | "rewards";
export type AnimatedTxPhase = "verifying" | "sending" | "completed";

export type AnimatedTxPayload = {
  kind: AnimatedTxKind;
  amount: number;
  currency?: "CAD" | "USD";
  fromLabel: string;
  toLabel: string;
  memo?: string;
  reference: string;
  timestamp: string;
  updatedBalanceLabel?: string;
};

type Props = {
  tx: AnimatedTxPayload | null;
  phase: AnimatedTxPhase;
  onClose: () => void;
  onViewActivity: () => void;
};

const COPY_BY_KIND: Record<
  AnimatedTxKind,
  {
    verifying: string;
    sending: string;
    doneTitle: string;
    badge: string;
  }
> = {
  transfer: {
    verifying: "Verifying account balances & security…",
    sending: "Transferring funds between your accounts…",
    doneTitle: "Transfer Completed",
    badge: "Instant Internal Transfer",
  },
  etransfer: {
    verifying: "Encrypting Interac e-Transfer® & verifying recipient…",
    sending: "Dispatching Interac e-Transfer® notification…",
    doneTitle: "Interac e-Transfer® Sent",
    badge: "Interac e-Transfer® · $0 Fee",
  },
  bill: {
    verifying: "Validating biller reference & available funds…",
    sending: "Transmitting payment to registered payee…",
    doneTitle: "Bill Payment Submitted",
    badge: "Electronic Bill Payment",
  },
  deposit: {
    verifying: "Scanning cheque MICR line & endorsement…",
    sending: "Clearing cheque & crediting your account…",
    doneTitle: "Cheque Deposited",
    badge: "Mobile Cheque Capture",
  },
  goal: {
    verifying: "Preparing savings project allocation…",
    sending: "Moving funds into your savings goal…",
    doneTitle: "Savings Goal Funded",
    badge: "Project Contribution",
  },
  rewards: {
    verifying: "Calculating rewards points conversion…",
    sending: "Applying statement credit to your card…",
    doneTitle: "Rewards Credit Applied",
    badge: "Mastercard® Rewards",
  },
};

export default function TransactionSendOverlay({ tx, phase, onClose, onViewActivity }: Props) {
  useEffect(() => {
    if (!tx) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase === "completed") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tx, phase, onClose]);

  if (!tx) return null;

  const copy = COPY_BY_KIND[tx.kind];
  const progressPct = phase === "verifying" ? 36 : phase === "sending" ? 88 : 100;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      aria-label="Transaction status"
    >
      {/* Backdrop */}
      <div
        onClick={phase === "completed" ? onClose : undefined}
        className="absolute inset-0 bg-[#001e2e]/65 backdrop-blur-[3px] animate-fade-in"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-[490px] overflow-hidden rounded-[12px] bg-white shadow-[0_26px_70px_rgba(0,0,0,0.35)] animate-fade-up">
        {/* Top Navy Header Strip */}
        <div className="flex items-center justify-between bg-nbc-navy px-5 py-3.5 text-white">
          <div className="flex items-center gap-2.5">
            <span className="grid h-6 w-6 place-items-center rounded bg-white p-1">
              <img src={logoBnMark} alt="" aria-hidden className="h-full w-full object-contain" />
            </span>
            <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/90">
              {copy.badge}
            </span>
          </div>

          {phase === "completed" ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close receipt"
              className="grid h-7 w-7 place-items-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-white/80">
              <LockIcon className="h-3 w-3" /> 256-bit TLS
            </span>
          )}
        </div>

        {/* Animated Progress Bar */}
        <div className="h-1.5 w-full overflow-hidden bg-[#ece9e0]">
          <div
            className={`h-full transition-all duration-500 ease-out ${
              phase === "completed" ? "bg-[#018a39]" : "bg-nbc-red"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="nice-scroll max-h-[calc(100vh-96px)] overflow-y-auto p-5 sm:p-7">
          {phase !== "completed" ? (
            /* SENDING & FLIGHT STREAM ANIMATION */
            <div className="py-3 text-center">
              <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-nbc-red">
                {phase === "verifying" ? "Step 1 of 2 · Security Check" : "Step 2 of 2 · Sending Funds"}
              </p>
              <p className="mt-2 break-words text-[28px] font-bold tracking-tight text-nbc-navy sm:text-[32px]">
                {formatMoney(tx.amount, tx.currency ?? "CAD")}
              </p>
              <p className="mt-1.5 text-[14px] font-medium text-nbc-ink">
                {phase === "verifying" ? copy.verifying : copy.sending}
              </p>

              {/* Visual Source -> Animated Stream -> Destination Rail */}
              <div className="mt-7 flex items-center justify-between gap-2 rounded-[10px] border border-[#e7e3d8] bg-[#faf8f3] px-3 py-5 sm:px-4">
                {/* Source Node */}
                <div className="w-[88px] flex-none text-left sm:w-[125px]">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-nbc-navy text-[13px] font-bold text-white shadow-sm">
                    FROM
                  </div>
                  <p className="mt-2 truncate text-[12.5px] font-bold text-nbc-navy" title={tx.fromLabel}>
                    {tx.fromLabel}
                  </p>
                </div>

                {/* Animated Money Stream Track */}
                <div className="relative flex-1 px-2">
                  <div className="h-[3px] w-full rounded-full bg-[#ded9ce]" />
                  {/* Animated glowing transfer capsule #1 */}
                  <span
                    aria-hidden
                    className="animate-tx-packet absolute top-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-nbc-red text-white shadow-[0_0_14px_rgba(228,28,35,0.65)]"
                  >
                    <ArrowRight className="h-3 w-3" />
                  </span>
                  {/* Secondary trailing pulse */}
                  <span
                    aria-hidden
                    style={{ animationDelay: "380ms" }}
                    className="animate-tx-packet absolute top-1/2 h-3 w-3 rounded-full bg-nbc-navy"
                  />
                </div>

                {/* Destination Node */}
                <div className="w-[88px] flex-none text-right sm:w-[125px]">
                  <div
                    className={`ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-bold text-white shadow-sm transition-colors duration-300 ${
                      phase === "sending" ? "bg-nbc-red scale-105" : "bg-[#7a8b99]"
                    }`}
                  >
                    TO
                  </div>
                  <p className="mt-2 truncate text-[12.5px] font-bold text-nbc-navy" title={tx.toLabel}>
                    {tx.toLabel}
                  </p>
                </div>
              </div>

              {/* Subtle step pills */}
              <div className="mt-6 flex items-center justify-center gap-2 text-[12px] text-nbc-ink">
                <span className="h-2 w-2 animate-ping rounded-full bg-nbc-red" />
                <span>Do not close — finalizing instant ledger posting…</span>
              </div>
            </div>
          ) : (
            /* COMPLETED CHECKMARK BURST + INTERACTIVE RECEIPT */
            <div className="text-center">
              <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
                <span
                  aria-hidden
                  className="animate-ring-burst absolute inset-0 rounded-full border-4 border-[#018a39]"
                />
                <span className="animate-pop-in relative flex h-16 w-16 items-center justify-center rounded-full bg-[#018a39] text-white shadow-[0_8px_22px_rgba(1,138,57,0.35)]">
                  <svg
                    viewBox="0 0 52 52"
                    fill="none"
                    className="h-9 w-9"
                    aria-hidden="true"
                  >
                    <path
                      d="M14 27.5L22.5 36L38.5 18.5"
                      stroke="currentColor"
                      strokeWidth="4.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="animate-check-draw"
                    />
                  </svg>
                </span>
              </div>

              <p className="mt-4 text-[11.5px] font-bold uppercase tracking-[0.16em] text-[#018a39]">
                Posted · Reference #{tx.reference}
              </p>
              <h3 className="mt-1 text-[23px] font-bold text-nbc-navy">{copy.doneTitle}</h3>
              <p className="mt-1 break-words text-[28px] font-bold leading-tight text-nbc-navy sm:text-[34px]">
                {formatMoney(tx.amount, tx.currency ?? "CAD")}
              </p>

              {/* Official Receipt Breakdown */}
              <div className="mt-5 divide-y divide-[#ece8de] rounded-[8px] border border-[#e6e1d6] bg-[#faf8f3] px-4 py-1 text-left text-[13.5px]">
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-nbc-ink">From</span>
                  <span className="font-semibold text-nbc-navy text-right">{tx.fromLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-nbc-ink">To</span>
                  <span className="font-semibold text-nbc-navy text-right">{tx.toLabel}</span>
                </div>
                {tx.memo && (
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-nbc-ink">Note / Message</span>
                    <span className="font-medium text-nbc-navy text-right">“{tx.memo}”</span>
                  </div>
                )}
                {tx.updatedBalanceLabel && (
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-nbc-ink">Updated Balance</span>
                    <span className="font-bold text-[#105797] text-right">{tx.updatedBalanceLabel}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 py-2.5 text-[12px]">
                  <span className="text-nbc-ink">Date & Confirmation</span>
                  <span className="font-mono font-semibold text-nbc-navy">
                    {tx.timestamp} · {tx.reference}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                <button
                  type="button"
                  onClick={onViewActivity}
                  className="nbc-btn nbc-btn-ghost flex-1 py-3 text-[14px]"
                >
                  View in Activity
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="nbc-btn nbc-btn-primary flex-1 py-3 text-[14px]"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
