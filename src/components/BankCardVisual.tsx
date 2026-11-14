import { useState } from "react";
import { logoBnMark } from "../assets/nbcAssets";
import { BankCard } from "../banking/bankingTypes";
import { LockIcon } from "./icons";

type Props = {
  card: BankCard;
  holderName: string;
  compact?: boolean;
};

const TIER_STYLES: Record<
  BankCard["accent"],
  {
    bg: string;
    rim: string;
    tierTag: string;
    chipGold: boolean;
    binPrefix: string;
    patternOpacity: string;
  }
> = {
  allure: {
    bg: "bg-[radial-gradient(ellipse_at_18%_12%,#d62856_0%,#8e1135_48%,#4a071d_100%)]",
    rim: "ring-1 ring-inset ring-rose-200/30",
    tierTag: "ALLURE® CAUSE REWARDS",
    chipGold: true,
    binPrefix: "5412 8824 6190",
    patternOpacity: "opacity-[0.14]",
  },
  "world-elite": {
    bg: "bg-[radial-gradient(ellipse_at_20%_0%,#384252_0%,#171d26_52%,#080b10_100%)]",
    rim: "ring-1 ring-inset ring-slate-200/25",
    tierTag: "WORLD ELITE® METAL",
    chipGold: false,
    binPrefix: "5458 9210 3418",
    patternOpacity: "opacity-[0.12]",
  },
  business: {
    bg: "bg-[radial-gradient(ellipse_at_85%_10%,#104a70_0%,#032842_50%,#011524_100%)]",
    rim: "ring-1 ring-inset ring-amber-200/30",
    tierTag: "COMMERCIAL PLATINUM",
    chipGold: true,
    binPrefix: "5524 6610 8094",
    patternOpacity: "opacity-[0.15]",
  },
  debit: {
    bg: "bg-[radial-gradient(ellipse_at_15%_15%,#ef2d34_0%,#c9121a_52%,#7f090f_100%)]",
    rim: "ring-1 ring-inset ring-white/30",
    tierTag: "CLIENT DEBIT MASTERCARD",
    chipGold: false,
    binPrefix: "5191 4028 7315",
    patternOpacity: "opacity-[0.16]",
  },
};

function EmvChip({ gold }: { gold: boolean }) {
  return (
    <svg viewBox="0 0 54 40" className="h-[34px] w-[46px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" aria-hidden="true">
      <defs>
        <linearGradient id={gold ? "chipGoldGrad" : "chipSilverGrad"} x1="0%" y1="0%" x2="100%" y2="100%">
          {gold ? (
            <>
              <stop offset="0%" stopColor="#f8e3a1" />
              <stop offset="45%" stopColor="#d9ad4e" />
              <stop offset="100%" stopColor="#a77b24" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#f3f5f8" />
              <stop offset="48%" stopColor="#c4ccd6" />
              <stop offset="100%" stopColor="#8994a2" />
            </>
          )}
        </linearGradient>
      </defs>
      <rect
        x="1"
        y="1"
        width="52"
        height="38"
        rx="6"
        fill={`url(#${gold ? "chipGoldGrad" : "chipSilverGrad"})`}
        stroke="rgba(0,0,0,0.28)"
        strokeWidth="1"
      />
      <path
        d="M1 14h15m22 0h15M1 26h15m22 0h15M18 1v38M36 1v38M18 14h18M18 26h18"
        stroke="rgba(45,35,15,0.34)"
        strokeWidth="1.15"
        fill="none"
      />
      <rect x="22" y="14" width="10" height="12" rx="2" fill="none" stroke="rgba(45,35,15,0.34)" strokeWidth="1.1" />
    </svg>
  );
}

function ContactlessWaves({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      className={`h-5 w-5 transition-opacity ${active ? "text-white/90" : "text-white/25"}`}
      aria-hidden="true"
    >
      <path d="M9.5 10.5a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M13.5 7.5a9 9 0 0 1 0 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M17.5 4.5a13 13 0 0 1 0 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MastercardCircles() {
  return (
    <div className="flex items-center" aria-label="Mastercard">
      <svg viewBox="0 0 44 28" className="h-7 w-11 drop-shadow-sm" aria-hidden="true">
        <circle cx="15" cy="14" r="11" fill="#EB001B" />
        <circle cx="29" cy="14" r="11" fill="#F79E1B" fillOpacity="0.92" />
        <path
          d="M22 5.4a11 11 0 0 0 0 17.2 11 11 0 0 0 0-17.2Z"
          fill="#FF5F00"
        />
      </svg>
    </div>
  );
}

export default function BankCardVisual({ card, holderName, compact = false }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [revealNumber, setRevealNumber] = useState(false);
  const [copied, setCopied] = useState(false);

  const style = TIER_STYLES[card.accent];
  const displayName = card.cardholderName || holderName;
  const normalizedCardNumber = card.number?.replace(/\D/g, "") ?? "";
  const fullNumber = normalizedCardNumber ? normalizedCardNumber.replace(/(.{4})/g, "$1 ").trim() : `${style.binPrefix} ${card.last4}`;
  const maskedNumber = normalizedCardNumber ? normalizedCardNumber.replace(/.(?=.{4})/g, "•").replace(/(.{4})/g, "$1 ").trim() : `${style.binPrefix.slice(0, 4)}  ••••  ••••  ${card.last4}`;
  const cvv = card.cvv || "742";

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard?.writeText(fullNumber.replace(/\s+/g, ""));
    } catch {
      // ignore clipboard restrictions
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-2.5">
      {/* Tactile ISO Credit Card Surface — capped width so it never dominates wide screens */}
      <div
        className={`group relative aspect-[1.586/1] w-full overflow-hidden rounded-[16px] ${style.bg} ${style.rim} text-white shadow-[0_16px_32px_-12px_rgba(0,22,38,0.45)] transition-transform duration-300 hover:-translate-y-0.5 ${
          compact ? "max-w-[312px]" : "max-w-[352px]"
        }`}
      >
        {/* Subtle National Bank angular ribbon watermark & brushed metallic sheen */}
        <svg
          viewBox="0 0 420 265"
          fill="none"
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 h-full w-full ${style.patternOpacity}`}
        >
          <path
            d="M250 -20 L395 -20 L310 135 L395 285 L250 285 L165 135 Z"
            fill="url(#cardRibbonSheen)"
          />
          <circle cx="375" cy="35" r="140" stroke="white" strokeOpacity="0.25" strokeWidth="1" />
          <circle cx="375" cy="35" r="185" stroke="white" strokeOpacity="0.16" strokeWidth="1" />
          <defs>
            <linearGradient id="cardRibbonSheen" x1="165" y1="0" x2="395" y2="285">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
            </linearGradient>
          </defs>
        </svg>

        {/* Diagonal glass gloss highlight */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-10 -top-24 h-44 -rotate-12 bg-gradient-to-b from-white/18 to-transparent blur-md transition-opacity duration-300 group-hover:opacity-90"
        />

        {!flipped ? (
          /* FRONT FACE */
          <div className={`relative flex h-full flex-col justify-between ${compact ? "p-4" : "p-5 sm:p-6"}`}>
            {/* Top Row: Brand Mark + Tier Badge + Status */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-8 w-8 flex-none place-items-center rounded-[7px] bg-white p-1.5 shadow-sm">
                  <img src={logoBnMark} alt="National Bank" className="h-full w-full object-contain" />
                </span>
                <div className="min-w-0 leading-tight">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/75 sm:text-[11px] sm:tracking-[0.18em]">
                    National Bank
                  </p>
                  <p
                    className={`font-semibold leading-[15px] text-white ${
                      compact ? "text-[12px]" : "text-[12.5px] sm:text-[13.5px]"
                    }`}
                  >
                    {card.label}
                  </p>
                  <p className="text-[8.5px] font-semibold uppercase tracking-[0.12em] text-white/60">
                    {style.tierTag}
                  </p>
                </div>
              </div>

            </div>

            {/* Middle Row: EMV Chip + Contactless + Card Number */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <EmvChip gold={style.chipGold} />
                  <ContactlessWaves active={card.contactless} />
                </div>
                {card.monthlyLimit && (
                  <span className="hidden rounded bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white/85 sm:inline">
                    Limit ${card.monthlyLimit.toLocaleString()}/mo
                  </span>
                )}
              </div>

              <p
                className={`whitespace-nowrap font-mono font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] ${
                  compact
                    ? "text-[13px] tracking-[0.1em] sm:text-[15px] sm:tracking-[0.17em]"
                    : "text-[14px] tracking-[0.1em] sm:text-[16px] sm:tracking-[0.14em] lg:text-[18px]"
                }`}
              >
                {revealNumber ? fullNumber : maskedNumber}
              </p>
            </div>

            {/* Bottom Row: Cardholder + Valid Thru + Network Logo */}
            <div className="flex items-end justify-between gap-3">
              <div className="flex items-end gap-6 min-w-0">
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/60">
                    Cardholder
                  </p>
                  <p className="truncate text-[12.5px] font-bold uppercase tracking-[0.08em] text-white">
                    {displayName}
                  </p>
                </div>
                <div className="flex-none">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/60">
                    Valid Thru
                  </p>
                  <p className="font-mono text-[12.5px] font-bold tracking-wider text-white">
                    {card.expiry}
                  </p>
                </div>
              </div>

              {card.network === "Mastercard" ? (
                <MastercardCircles />
              ) : (
                <div className="flex flex-col items-end">
                  <MastercardCircles />
                  <span className="mt-0.5 text-[8.5px] font-bold uppercase tracking-[0.2em] text-white/85">
                    DEBIT
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* BACK FACE (Magnetic stripe, Signature panel & CVV) */
          <div className="relative flex h-full flex-col justify-between py-4">
            <div className="px-5 text-[9px] uppercase tracking-[0.14em] text-white/65 flex justify-between">
              <span>24/7 Lost or Stolen Card: 1-888-835-6281</span>
              <span>nbc.ca</span>
            </div>

            {/* Magnetic Stripe */}
            <div className="h-10 w-full bg-[#0a0c10]/90 shadow-inner" />

            {/* Signature & CVV Strip */}
            <div className="px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 flex-1 items-center rounded-[4px] bg-white/90 px-3 font-serif italic text-[13px] text-[#333]">
                  {displayName}
                </div>
                <div className="flex h-9 w-20 flex-col items-center justify-center rounded-[4px] bg-white px-2 text-nbc-navy">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-[#777]">CVC / CVV</span>
                  <span className="font-mono text-[13px] font-bold tracking-widest">
                    {revealNumber ? cvv : "•••"}
                  </span>
                </div>
              </div>
              <p className="mt-2.5 text-[9.5px] leading-[13px] text-white/65">
                Authorized use subject to the National Bank Cardholder Agreement. Property of National Bank of Canada.
              </p>
            </div>

            <div className="flex items-center justify-between px-5">
              <span className="text-[10px] font-semibold text-white/80">
                CDIC / Zero Liability Protected
              </span>
              <MastercardCircles />
            </div>
          </div>
        )}

        {/* Frozen / Locked Glass Overlay */}
        {card.locked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#001726]/72 backdrop-blur-[3px] animate-fade-in">
            <div className="flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-400/20 px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-amber-200 shadow-lg">
              <LockIcon className="h-3.5 w-3.5" />
              Card Temporarily Locked
            </div>
            <p className="mt-1.5 text-[11.5px] text-white/80">
              New purchases blocked · Unlock anytime below
            </p>
          </div>
        )}
      </div>

      {/* Interactive Card Action Strip (Reveal / Copy / Flip Back) */}
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-[#e7e3d8] bg-[#faf8f3] px-3.5 py-2 text-[12px]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRevealNumber((v) => !v)}
              className="rounded-full bg-white px-3 py-1 font-semibold text-nbc-navy shadow-xs ring-1 ring-[#dedad0] transition hover:text-nbc-red"
            >
              {revealNumber ? "Hide Details" : "Reveal Number & CVV"}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-full bg-white px-3 py-1 font-semibold text-nbc-navy shadow-xs ring-1 ring-[#dedad0] transition hover:text-nbc-red"
            >
              {copied ? "✓ Copied!" : "Copy #"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setFlipped((v) => !v)}
            className="font-semibold text-[#1572c5] hover:underline"
          >
            {flipped ? "← Show Front" : "Flip for CVV →"}
          </button>
        </div>
      )}
    </div>
  );
}
