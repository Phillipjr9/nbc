import { useEffect, useState } from "react";
import {
  logoCdic,
  pictoBullesClavardage,
  pictoInsuranceTheft,
  pictoPointInterrogation,
  statusAttention,
} from "../assets/nbcAssets";
import { PageRoute, SupportSection } from "../banking/bankingTypes";
import { CalendarIcon, ChevronDown, PinIcon } from "./icons";
import { SUPPORT_EMAIL, SUPPORT_EMAIL_HREF } from "../banking/supportChat";

type Props = {
  section?: SupportSection;
  onNavigate: (route: PageRoute) => void;
  onOpenChat: () => void;
};

const BRANCHES = [
  {
    name: "Place Ville Marie Main Branch",
    city: "Montreal, QC",
    address: "600 De La Gauchetière St W, Montreal, QC H3B 4L2",
    hours: "Mon–Fri 8:30 AM – 5:00 PM · ABM 24/7",
    services: ["Personal & Business", "Mortgage Specialists", "Foreign Currency ABM"],
  },
  {
    name: "Toronto Financial District Branch",
    city: "Toronto, ON",
    address: "130 King St W, Suite 100, Toronto, ON M5X 1J9",
    hours: "Mon–Fri 9:00 AM – 5:00 PM · ABM 24/7",
    services: ["Personal & Commercial", "Private Banking 1859", "Wealth Management"],
  },
  {
    name: "Sainte-Foy Laurier Branch",
    city: "Quebec City, QC",
    address: "2700 Laurier Blvd, Quebec City, QC G1V 2L8",
    hours: "Mon–Fri 9:00 AM – 4:30 PM · Thu until 7:00 PM",
    services: ["Personal Banking", "Safe Deposit Boxes", "ABM 24/7"],
  },
  {
    name: "Ottawa Sparks Street Branch",
    city: "Ottawa, ON",
    address: "50 O'Connor St, Ottawa, ON K1P 6L2",
    hours: "Mon–Fri 9:00 AM – 5:00 PM · ABM 24/7",
    services: ["Personal & SME", "Newcomer Advisory", "Bilingual Service"],
  },
  {
    name: "Vancouver Burrard Branch",
    city: "Vancouver, BC",
    address: "475 Howe St, Vancouver, BC V6C 2B3",
    hours: "Mon–Fri 9:00 AM – 5:00 PM · ABM 24/7",
    services: ["Personal & Commercial", "NBF Wealth Advisory", "Mortgage Hub"],
  },
  {
    name: "Calgary Stephen Avenue Branch",
    city: "Calgary, AB",
    address: "311 6 Ave SW, Calgary, AB T2P 3H2",
    hours: "Mon–Fri 9:00 AM – 4:30 PM · ABM 24/7",
    services: ["Commercial Energy & SME", "Personal Banking", "ABM 24/7"],
  },
];

const FAQS = [
  {
    q: "How do I open an account or sign in on this website?",
    a: "Click 'Become a client' at the top of any page to create your own login credentials and choose a Personal or Business package, or sign in with your existing credentials.",
  },
  {
    q: "How does the 3.00% Cash Advantage promotional rate work?",
    a: "Interest is calculated daily on every dollar in your Cash Advantage Solution and paid monthly, with zero lock-in so you can transfer funds to your chequing account anytime.",
  },
  {
    q: "How do I lock a lost or stolen Mastercard® or Debit card?",
    a: "Sign in to your Online Bank Dashboard, open the 'Cards & Rewards' tab, and toggle 'Temporarily lock card' for instant protection.",
  },
  {
    q: "What has changed for Laurentian Bank personal and SME clients?",
    a: "Laurentian Bank personal and SME accounts have transitioned to National Bank's digital platform, giving you full access to Online Bank, Interac e-Transfer®, and coast-to-coast branches.",
  },
];

export default function SupportPages({ section = "help", onNavigate, onOpenChat }: Props) {
  const [activeTab, setActiveTab] = useState<SupportSection>(section);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [cityQuery, setCityQuery] = useState("");

  // Appointment booking state
  const [apptTopic, setApptTopic] = useState("Mortgage Pre-Approval & Home Buying");
  const [apptFormat, setApptFormat] = useState<"Video Call" | "Phone" | "In Branch">("Video Call");
  const [apptDate, setApptDate] = useState("2026-05-20");
  const [apptTime, setApptTime] = useState("10:30 AM");
  const [apptName, setApptName] = useState("");
  const [apptEmail, setApptEmail] = useState("");
  const [apptConfirmed, setApptConfirmed] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(section);
  }, [section]);

  const filteredBranches = BRANCHES.filter(
    (b) =>
      !cityQuery.trim() ||
      b.city.toLowerCase().includes(cityQuery.toLowerCase()) ||
      b.name.toLowerCase().includes(cityQuery.toLowerCase()) ||
      b.address.toLowerCase().includes(cityQuery.toLowerCase())
  );

  const handleBookAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    const code = `APT-${Math.floor(10000 + Math.random() * 89999)}`;
    setApptConfirmed(
      `Confirmed (${code}): ${apptFormat} session for "${apptTopic}" on ${apptDate} at ${apptTime}.`
    );
  };

  return (
    <div className="min-h-[calc(100vh-160px)] bg-[#f8f6f1] pb-16">
      <section className="bg-nbc-navy py-11 text-white">
        <div className="nbc-container">
          <button
            type="button"
            onClick={() => onNavigate({ kind: "home" })}
            className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/80 hover:text-white"
          >
            ← Back to Homepage
          </button>
          <h1 className="text-[32px] font-bold text-white sm:text-[42px]">
            Help Centre, Branches & Important Notices
          </h1>
          <p className="mt-2 max-w-[660px] text-[15.5px] text-white/85">
            Find answers, book an appointment with an advisor, locate a branch, or review security and deposit protection details.
          </p>

          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13.5px] text-white/90">
            <span>
              Email us:{" "}
              <a
                href={SUPPORT_EMAIL_HREF}
                className="font-semibold text-white underline decoration-1 underline-offset-2 hover:text-white/80"
              >
                {SUPPORT_EMAIL}
              </a>
            </span>
            <span className="hidden text-white/40 sm:inline">·</span>
            <span>
              Client Services 24/7:{" "}
              <a href="tel:+18888356281" className="font-semibold text-white underline decoration-1 underline-offset-2 hover:text-white/80">
                1-888-835-6281
              </a>
            </span>
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {(
              [
                ["help", "Help Centre & FAQ"],
                ["appointment", "Make an Appointment"],
                ["branches", "Find a Branch / ABM"],
                ["notices", "Important Notices & Migration"],
                ["security", "Security & Lost Card"],
                ["cdic", "CDIC Deposit Insurance"],
              ] as [SupportSection, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${
                  activeTab === id
                    ? "bg-nbc-red text-white shadow-sm"
                    : "bg-white/15 text-white hover:bg-white/25"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="nbc-container pt-10">
        {activeTab === "help" && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-3 lg:col-span-8">
              <h2 className="mb-4 text-[24px] font-bold text-nbc-navy">Frequently Asked Questions</h2>
              {FAQS.map((item, i) => (
                <div key={item.q} className="rounded-[6px] bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left text-[16px] font-semibold text-nbc-navy"
                  >
                    <span>{item.q}</span>
                    <ChevronDown className={`h-3.5 w-3.5 flex-none transition ${openFaq === i ? "rotate-180" : ""}`} />
                  </button>
                  {openFaq === i && (
                    <div className="border-t border-[#f0f0f0] px-5 pb-5 pt-3 text-[14.5px] leading-[22px] text-nbc-ink">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-4 lg:col-span-4">
              <div className="rounded-[6px] bg-white p-6 shadow-sm">
                <img src={pictoBullesClavardage} alt="" aria-hidden className="h-14 w-14 object-contain" />
                <h3 className="mt-3 text-[19px] font-bold text-nbc-navy">24/7 Support chat</h3>
                <p className="mt-1.5 text-[14px] text-nbc-ink">
                  Ask about rates, cards, accounts or transfers right on this site — sign in and we can look
                  at your own file.
                </p>
                <button type="button" onClick={onOpenChat} className="nbc-btn nbc-btn-primary mt-4 w-full">
                  Open Support chat
                </button>
              </div>

              <div className="rounded-[6px] bg-white p-6 shadow-sm">
                <img src={pictoPointInterrogation} alt="" aria-hidden className="h-14 w-14 object-contain" />
                <h3 className="mt-3 text-[19px] font-bold text-nbc-navy">Ready to bank online?</h3>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate({ kind: "login" })}
                    className="nbc-btn nbc-btn-ghost w-full"
                  >
                    Sign in to Online Bank
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate({ kind: "signup" })}
                    className="text-center text-[13.5px] font-semibold text-[#1572c5] underline underline-offset-2 pt-1"
                  >
                    Become a client →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "appointment" && (
          <div className="max-w-[720px] rounded-[8px] bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-2.5 text-nbc-red">
              <CalendarIcon className="h-5 w-5" />
              <span className="text-[12px] font-bold uppercase tracking-[0.14em]">Advisor Scheduling</span>
            </div>
            <h2 className="mt-1 text-[25px] font-bold text-nbc-navy">Book an Appointment with an Advisor</h2>
            <p className="mt-1 text-[14px] text-nbc-ink">
              Meet by video, phone, or in branch at a time that works for you.
            </p>

            {apptConfirmed && (
              <div className="mt-5 rounded-[6px] border border-[#b7ebc6] bg-[#f0fdf4] p-4 text-[14px] font-semibold text-[#14532d]">
                ✓ {apptConfirmed}
              </div>
            )}

            <form onSubmit={handleBookAppointment} className="mt-6 space-y-4">
              <div>
                <label htmlFor="ap-topic" className="block text-[13px] font-semibold text-nbc-navy">
                  What would you like to discuss?
                </label>
                <select
                  id="ap-topic"
                  value={apptTopic}
                  onChange={(e) => setApptTopic(e.target.value)}
                  className="mt-1 w-full rounded-[6px] border border-[#cfc9bc] bg-white px-3.5 py-2.5 text-[14.5px] text-nbc-navy"
                >
                  <option>Mortgage Pre-Approval & Home Buying</option>
                  <option>Savings, TFSA, RRSP & 3% Cash Advantage</option>
                  <option>Opening a Personal or Newcomer Account</option>
                  <option>Business (SME) Financing & Cash Management</option>
                  <option>Debt Consolidation & Personal Flex Line®</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {(["Video Call", "Phone", "In Branch"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setApptFormat(fmt)}
                    className={`rounded-[6px] border py-2.5 text-[13.5px] font-semibold transition ${
                      apptFormat === fmt
                        ? "border-nbc-red bg-[#fff5f5] text-nbc-red"
                        : "border-[#dcd7cc] text-nbc-navy"
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ap-date" className="block text-[13px] font-semibold text-nbc-navy">
                    Preferred Date
                  </label>
                  <input
                    id="ap-date"
                    type="date"
                    value={apptDate}
                    onChange={(e) => setApptDate(e.target.value)}
                    required
                    className="mt-1 w-full rounded-[6px] border border-[#cfc9bc] px-3.5 py-2.5 text-[14px] text-nbc-navy"
                  />
                </div>
                <div>
                  <label htmlFor="ap-time" className="block text-[13px] font-semibold text-nbc-navy">
                    Preferred Time
                  </label>
                  <select
                    id="ap-time"
                    value={apptTime}
                    onChange={(e) => setApptTime(e.target.value)}
                    className="mt-1 w-full rounded-[6px] border border-[#cfc9bc] bg-white px-3.5 py-2.5 text-[14px] text-nbc-navy"
                  >
                    <option>9:30 AM</option>
                    <option>10:30 AM</option>
                    <option>1:30 PM</option>
                    <option>3:00 PM</option>
                    <option>4:30 PM</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ap-name" className="block text-[13px] font-semibold text-nbc-navy">
                    Your Name
                  </label>
                  <input
                    id="ap-name"
                    type="text"
                    value={apptName}
                    onChange={(e) => setApptName(e.target.value)}
                    placeholder="Alex Tremblay"
                    required
                    className="mt-1 w-full rounded-[6px] border border-[#cfc9bc] px-3.5 py-2.5 text-[14px] text-nbc-navy"
                  />
                </div>
                <div>
                  <label htmlFor="ap-email" className="block text-[13px] font-semibold text-nbc-navy">
                    Confirmation Email
                  </label>
                  <input
                    id="ap-email"
                    type="email"
                    value={apptEmail}
                    onChange={(e) => setApptEmail(e.target.value)}
                    placeholder="alex@example.ca"
                    required
                    className="mt-1 w-full rounded-[6px] border border-[#cfc9bc] px-3.5 py-2.5 text-[14px] text-nbc-navy"
                  />
                </div>
              </div>

              <button type="submit" className="nbc-btn nbc-btn-primary">
                Confirm Appointment
              </button>
            </form>
          </div>
        )}

        {activeTab === "branches" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[6px] bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-[22px] font-bold text-nbc-navy">Branch & 24/7 ABM Locator</h2>
                <p className="text-[13.5px] text-nbc-ink">Search across major Canadian centres.</p>
              </div>
              <input
                type="text"
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                placeholder="Filter by city (Montreal, Toronto, Vancouver…)"
                className="w-full max-w-[340px] rounded-full border border-[#cfc9bc] px-4 py-2 text-[14px] text-nbc-navy"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredBranches.map((b) => (
                <div key={b.name} className="flex flex-col rounded-[6px] bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2 text-[12px] font-bold uppercase text-nbc-red">
                    <PinIcon className="h-3.5 w-3.5" /> {b.city}
                  </div>
                  <h3 className="mt-1 text-[18px] font-bold text-nbc-navy">{b.name}</h3>
                  <p className="mt-1.5 text-[13.5px] text-nbc-ink">{b.address}</p>
                  <p className="mt-2 text-[12.5px] font-medium text-[#105797]">{b.hours}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {b.services.map((s) => (
                      <span key={s} className="rounded-full bg-[#f4f1ea] px-2.5 py-0.5 text-[11.5px] text-nbc-navy">
                        {s}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("appointment")}
                    className="mt-auto pt-4 text-left text-[13.5px] font-semibold text-[#1572c5] underline underline-offset-2"
                  >
                    Book at this branch →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "notices" && (
          <div className="space-y-6">
            <div className="rounded-[6px] border border-[#efe3a6] bg-[#FFF8C7] p-6">
              <div className="flex items-start gap-3">
                <img src={statusAttention} alt="Warning" className="mt-0.5 h-6 w-6 flex-none" />
                <div>
                  <h2 className="text-[20px] font-bold text-[#121212]">Canada Post Service Disruption — Digital Alternatives</h2>
                  <p className="mt-2 text-[14.5px] leading-[22px] text-[#2b2b2b]">
                    Paper statements and mailed cheques may experience delays. Switch to paperless e-Statements, send payments via Interac e-Transfer®, and pay utility bills directly inside your Online Bank Dashboard.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate({ kind: "login" })}
                    className="nbc-btn nbc-btn-primary mt-4"
                  >
                    Sign in to Manage e-Statements
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[6px] bg-white p-6 shadow-sm">
              <span className="rounded-full bg-[#eef6fb] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#105797]">
                Migration Information Hub
              </span>
              <h2 className="mt-3 text-[22px] font-bold text-nbc-navy">
                Welcome Laurentian Bank Personal & SME Clients
              </h2>
              <p className="mt-2 text-[14.5px] leading-[23px] text-nbc-ink">
                Laurentian Bank personal and SME accounts are now part of National Bank of Canada. Enjoy seamless access to our full branch network, The Exchange® & National Bank ABMs, 3.00% Cash Advantage promotions, and online banking tools.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate({ kind: "login" })}
                  className="nbc-btn nbc-btn-primary"
                >
                  Access Online Bank
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate({ kind: "signup" })}
                  className="nbc-btn nbc-btn-ghost"
                >
                  Set Up New Online Credentials
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "security" && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-[6px] bg-white p-6 shadow-sm">
              <img src={pictoInsuranceTheft} alt="" aria-hidden className="h-14 w-14 object-contain" />
              <h2 className="mt-3 text-[22px] font-bold text-nbc-navy">ABCs of Security & Fraud Prevention</h2>
              <ul className="mt-4 space-y-2.5 text-[14px] leading-[22px] text-nbc-ink">
                <li>• National Bank will never ask for your password, PIN, or one-time verification code by text or phone.</li>
                <li>• Review your real-time transaction feed and enable contactless/international card toggles inside your dashboard.</li>
                <li>• Always verify recipient details before sending an Interac e-Transfer®.</li>
              </ul>
            </div>
            <div className="rounded-[6px] bg-white p-6 shadow-sm">
              <h2 className="text-[22px] font-bold text-nbc-navy">Lost or Stolen Card?</h2>
              <p className="mt-2 text-[14.5px] leading-[22px] text-nbc-ink">
                You can lock your Allure®, World Elite®, Business Platinum, or Debit Mastercard® immediately inside Online Bank to block new transactions while keeping recurring pre-authorized payments safe.
              </p>
              <button
                type="button"
                onClick={() => onNavigate({ kind: "login" })}
                className="nbc-btn nbc-btn-primary mt-5"
              >
                Sign in to Lock / Unlock Card
              </button>
            </div>
          </div>
        )}

        {activeTab === "cdic" && (
          <div className="rounded-[6px] bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ececec] pb-5">
              <div>
                <h2 className="text-[24px] font-bold text-nbc-navy">
                  Member of Canada Deposit Insurance Corporation (CDIC)
                </h2>
                <p className="mt-1 text-[14px] text-nbc-ink">
                  Eligible deposits held at National Bank of Canada are protected up to $100,000 per insured category.
                </p>
              </div>
              <img src={logoCdic} alt="CDIC logo" className="h-12 w-auto object-contain" />
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3 text-[14px]">
              {[
                ["Deposits in One Name", "Chequing, Cash Advantage Savings & GICs held individually."],
                ["Registered Tax-Free (TFSA)", "Separate $100,000 protection coverage for eligible TFSA deposits."],
                ["Registered Retirement (RRSP / RRIF)", "Separate $100,000 protection coverage per registered category."],
              ].map(([t, d]) => (
                <div key={t} className="rounded-[6px] bg-[#f8f6f1] p-4">
                  <p className="font-bold text-nbc-navy">{t}</p>
                  <p className="mt-1 text-[13px] text-nbc-ink">{d}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
