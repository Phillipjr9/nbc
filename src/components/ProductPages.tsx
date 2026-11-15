import { useMemo, useState } from "react";
import {
  imgAdviceDebt,
  imgAdviceFinance,
  imgAdviceSavings,
  pictoBreastCancer,
  pictoCarteCreditRed,
  pictoComptesRed,
  pictoEmpruntsRed,
  pictoEpargnePlacementsRed,
  pictoInsuranceTheft,
  pictoMainSacDollar,
  pictoMortgageRed,
  pictoPromo,
} from "../assets/nbcAssets";
import { formatMoney, FX_RATES, PageRoute } from "../banking/bankingTypes";
import { ArrowRight } from "./icons";

type Props = {
  route: Extract<PageRoute, { kind: "segment" } | { kind: "category" }>;
  onNavigate: (route: PageRoute) => void;
  onOpenAuth: (mode: "signin" | "onboarding", persona?: "personal" | "business" | "wealth") => void;
};

export default function ProductPages({ route, onNavigate, onOpenAuth }: Props) {
  // Mortgage calculator state
  const [homePrice, setHomePrice] = useState(525000);
  const [downPct, setDownPct] = useState(20);
  const [mtgRate, setMtgRate] = useState(4.89);
  const [amortYears, setAmortYears] = useState(25);

  // Savings 3% calculator state
  const [initSavings, setInitSavings] = useState(15000);
  const [monthlySave, setMonthlySave] = useState(450);
  const [saveYears, setSaveYears] = useState(3);
  const [saveRate, setSaveRate] = useState(3.0);

  // Loan calculator state
  const [loanAmount, setLoanAmount] = useState(18000);
  const [loanMonths, setLoanMonths] = useState(48);
  const [loanApr, setLoanApr] = useState(6.95);

  // Rewards spend calculator
  const [monthlyCardSpend, setMonthlyCardSpend] = useState(2200);

  // Budget 50/30/20 calculator
  const [netMonthlyIncome, setNetMonthlyIncome] = useState(5400);

  // FX converter
  const [fxAmount, setFxAmount] = useState(1000);
  const [fxCode, setFxCode] = useState<keyof typeof FX_RATES>("USD");
  const [fxDirection, setFxDirection] = useState<"foreignToCad" | "cadToForeign">("cadToForeign");

  const mortgageCalc = useMemo(() => {
    const down = (homePrice * downPct) / 100;
    const principal = Math.max(homePrice - down, 0);
    const monthlyRate = mtgRate / 100 / 12;
    const n = amortYears * 12;
    const monthly =
      monthlyRate === 0
        ? principal / n
        : (principal * (monthlyRate * Math.pow(1 + monthlyRate, n))) / (Math.pow(1 + monthlyRate, n) - 1);
    return { down, principal, monthly, totalPaid: monthly * n };
  }, [homePrice, downPct, mtgRate, amortYears]);

  const savingsCalc = useMemo(() => {
    const months = saveYears * 12;
    const r = saveRate / 100 / 12;
    let balance = initSavings;
    for (let i = 0; i < months; i++) {
      balance = balance * (1 + r) + monthlySave;
    }
    const contributed = initSavings + monthlySave * months;
    return { futureValue: balance, interestEarned: balance - contributed, contributed };
  }, [initSavings, monthlySave, saveYears, saveRate]);

  const loanCalc = useMemo(() => {
    const r = loanApr / 100 / 12;
    const monthly =
      r === 0
        ? loanAmount / loanMonths
        : (loanAmount * (r * Math.pow(1 + r, loanMonths))) / (Math.pow(1 + r, loanMonths) - 1);
    return { monthly, totalInterest: monthly * loanMonths - loanAmount };
  }, [loanAmount, loanMonths, loanApr]);

  const Breadcrumb = ({ label }: { label: string }) => (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-[13px] text-white/85">
      <button type="button" onClick={() => onNavigate({ kind: "home" })} className="underline underline-offset-2 hover:text-white">
        Home
      </button>
      <span>/</span>
      <span className="font-semibold text-white">{label}</span>
    </nav>
  );

  // SEGMENT PAGES (Business / Wealth / About)
  if (route.kind === "segment") {
    if (route.segment === "business") {
      return (
        <div className="bg-[#f8f6f1]">
          <section className="bg-nbc-navy py-14 text-white">
            <div className="nbc-container">
              <Breadcrumb label="Business Banking" />
              <div className="grid items-center gap-8 lg:grid-cols-12">
                <div className="lg:col-span-7">
                  <span className="inline-block rounded-full bg-nbc-red px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
                    Commercial & SME Solutions
                  </span>
                  <h1 className="mt-3 text-[36px] font-bold leading-[42px] text-white sm:text-[46px] sm:leading-[52px]">
                    Powering Canadian entrepreneurs from startup to scale.
                  </h1>
                  <p className="mt-4 max-w-[580px] text-[16px] leading-[25px] text-white/85">
                    Operating accounts in CAD & USD, Business Investment Accounts up to 2.65%, commercial lines of credit, and up to $1,313/year in personal banking savings for business owners.
                  </p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => onOpenAuth("signin", "business")}
                      className="nbc-btn nbc-btn-primary"
                    >
                      Open a business account
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenAuth("onboarding", "business")}
                      className="rounded-full border border-white/80 px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-white/15"
                    >
                      Open a Business Account
                    </button>
                  </div>
                </div>
                <div className="rounded-[8px] bg-white p-6 text-nbc-navy shadow-xl lg:col-span-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-nbc-red">
                    Offer for Entrepreneurs
                  </p>
                  <h2 className="mt-1 text-[24px] font-bold">Save up to $1,313 a year</h2>
                  <ul className="mt-4 space-y-2.5 text-[14px] text-[#333]">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-nbc-red">✓</span> Up to 3 personal bank accounts with $0 fixed monthly fees
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-nbc-red">✓</span> Personal Flex Line® at Prime + 0.75% (5.45%)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-nbc-red">✓</span> Dedicated Commercial Account Manager & cash management tools
                    </li>
                  </ul>
                  <button
                    type="button"
                    onClick={() => onOpenAuth("signin", "business")}
                    className="mt-6 w-full rounded-full bg-nbc-navy py-3 text-[14px] font-semibold text-white transition hover:bg-nbc-red"
                  >
                    See business solutions →
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="nbc-container py-12">
            <h2 className="text-[28px] font-bold text-nbc-navy">Business Banking Packages & Treasury Rates</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {[
                {
                  title: "Digital Business Package",
                  price: "$20 / month",
                  desc: "Designed for digital-first SMEs with unlimited electronic deposits, bill payments, and Interac e-Transfer®.",
                },
                {
                  title: "Business Investment Account",
                  price: "Up to 2.65% CAD",
                  desc: "Earn tiered daily interest plus monthly minimum-balance rate bonus with 100% liquidity.",
                },
                {
                  title: "Operating Line & Equipment Financing",
                  price: "From Prime + 0.75%",
                  desc: "Flexible revolving credit and term loans to finance inventory, receivables, and new machinery.",
                },
              ].map((c) => (
                <div key={c.title} className="flex flex-col rounded-[6px] bg-white p-6 shadow-sm">
                  <p className="text-[13px] font-bold text-nbc-red">{c.price}</p>
                  <h3 className="mt-1 text-[20px] font-bold text-nbc-navy">{c.title}</h3>
                  <p className="mt-2.5 flex-1 text-[14.5px] leading-[22px] text-nbc-ink">{c.desc}</p>
                  <button
                    type="button"
                    onClick={() => onOpenAuth("onboarding", "business")}
                    className="mt-5 w-fit text-[14px] font-semibold text-[#1572c5] underline underline-offset-2 hover:text-nbc-navy"
                  >
                    Select this solution
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      );
    }

    if (route.segment === "wealth") {
      return (
        <div className="bg-[#f8f6f1]">
          <section className="bg-[#002236] py-14 text-white">
            <div className="nbc-container">
              <Breadcrumb label="Wealth Management" />
              <div className="grid items-center gap-8 lg:grid-cols-12">
                <div className="lg:col-span-7">
                  <span className="inline-block rounded-full bg-[#8a7b64] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                    National Bank Financial · Private Banking 1859
                  </span>
                  <h1 className="mt-3 text-[36px] font-bold leading-[42px] text-white sm:text-[46px] sm:leading-[52px]">
                    Tailored wealth architecture for every generation.
                  </h1>
                  <p className="mt-4 max-w-[580px] text-[16px] leading-[25px] text-white/85">
                    Combine discretionary portfolio management, estate & tax planning through Private Banking 1859, and $0-commission self-directed trading on National Bank Direct Brokerage.
                  </p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => onOpenAuth("signin", "wealth")}
                      className="nbc-btn nbc-btn-primary"
                    >
                      Speak to a Private Banker
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate({ kind: "category", slug: "savings" })}
                      className="rounded-full border border-white/80 px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-white/15"
                    >
                      Try Investment Calculator
                    </button>
                  </div>
                </div>
                <div className="rounded-[8px] border border-white/15 bg-white/10 p-6 backdrop-blur lg:col-span-5">
                  <p className="text-[12px] uppercase tracking-[0.16em] text-[#dfd5c5]">Direct Brokerage Highlight</p>
                  <p className="mt-2 text-[34px] font-bold text-white">$0 Commission</p>
                  <p className="mt-2 text-[14.5px] leading-[22px] text-white/85">
                    Trade Canadian and U.S. stocks and ETFs online with $0 trading commissions, real-time research from National Bank Financial analysts, and instant transfers from your bank account.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="nbc-container py-12">
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  title: "Private Banking 1859",
                  desc: "Bespoke wealth planning, family office advisory, succession structuring, and premier credit solutions.",
                },
                {
                  title: "National Bank Financial",
                  desc: "Dedicated Investment Advisors crafting personalized retirement, income, and tax-aware portfolios.",
                },
                {
                  title: "National Bank Direct Brokerage",
                  desc: "Intuitive self-directed TFSA, RRSP, FHSA, and Margin accounts with $0 equity & ETF commissions.",
                },
              ].map((w) => (
                <div key={w.title} className="rounded-[6px] bg-white p-6 shadow-sm">
                  <h3 className="text-[20px] font-bold text-nbc-navy">{w.title}</h3>
                  <p className="mt-2.5 text-[14.5px] leading-[22px] text-nbc-ink">{w.desc}</p>
                  <button
                    type="button"
                    onClick={() => onOpenAuth("signin", "wealth")}
                    className="mt-5 text-[14px] font-semibold text-[#1572c5] underline underline-offset-2"
                  >
                    Learn about Private Banking 1859 →
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      );
    }

    // About Us
    return (
      <div className="bg-[#f8f6f1]">
        <section className="bg-nbc-navy py-14 text-white">
          <div className="nbc-container">
            <Breadcrumb label="About National Bank" />
            <h1 className="text-[36px] font-bold text-white sm:text-[46px]">Built with people and communities since 1859.</h1>
            <p className="mt-4 max-w-[680px] text-[16px] leading-[25px] text-white/85">
              Headquartered in Montreal, National Bank of Canada is one of Canada’s six systemically important banks, serving over 2.8 million personal clients, SMEs, and institutional partners coast to coast.
            </p>
          </div>
        </section>
        <section className="nbc-container py-12">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { stat: "1859", label: "Founded in Quebec & serving all of Canada" },
              { stat: "2.8M+", label: "Personal & commercial banking clients" },
              { stat: "CDIC", label: "Eligible deposits protected under federal insurance" },
              { stat: "24/7", label: "Digital banking, fraud monitoring & Support chat" },
            ].map((s) => (
              <div key={s.stat} className="rounded-[6px] bg-white p-6 shadow-sm">
                <p className="text-[32px] font-bold text-nbc-red">{s.stat}</p>
                <p className="mt-2 text-[14px] text-nbc-ink">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-[6px] bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-[21px] font-bold text-nbc-navy">Check Today’s Prime, Mortgage & Foreign Exchange Rates</h2>
              <p className="mt-1 text-[14.5px] text-nbc-ink">
                Prime Rate: 4.70% · U.S. Base Rate: 7.50% · Cash Advantage Promo: 3.00%
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate({ kind: "category", slug: "rates" })}
              className="nbc-btn nbc-btn-primary"
            >
              Open Rates & FX Converter
            </button>
          </div>
        </section>
      </div>
    );
  }

  // CATEGORY & CALCULATOR PAGES
  const metaMap = {
    accounts: {
      title: "Bank accounts",
      subtitle: "Everyday chequing, student & newcomer packages, and high-interest savings built around your projects.",
      icon: pictoComptesRed,
    },
    cards: {
      title: "Mastercard® credit cards",
      subtitle: "Compare cashback, travel perks, low-rate options, and cause-driven cards like Allure® Mastercard®.",
      icon: pictoCarteCreditRed,
    },
    borrowing: {
      title: "Borrowing & lines of credit",
      subtitle: "Personal loans, Personal Flex Line® and All-In-One™ financing with transparent monthly payments.",
      icon: pictoEmpruntsRed,
    },
    mortgages: {
      title: "Mortgages & home financing",
      subtitle: "Calculate your mortgage payments, lock in a 120-day rate hold, and plan your home purchase with confidence.",
      icon: pictoMortgageRed,
    },
    savings: {
      title: "Savings and investments",
      subtitle: "Grow your money with our 3.00% Cash Advantage Solution, TFSA, RRSP, FHSA, and GICs.",
      icon: pictoEpargnePlacementsRed,
    },
    insurance: {
      title: "Insurance & fraud protection",
      subtitle: "Protect your family, travel plans, credit balances, and digital accounts with proactive security.",
      icon: pictoInsuranceTheft,
    },
    advice: {
      title: "Advice to take control of your finances",
      subtitle: "Interactive 50/30/20 budget planner and step-by-step guides for debt management and investing.",
      icon: pictoMainSacDollar,
    },
    offers: {
      title: "Current offers & promotions",
      subtitle: "Take advantage of limited-time rates, welcome bonuses, and fee waivers across personal and business banking.",
      icon: pictoPromo,
    },
    rates: {
      title: "Interest rates & foreign exchange",
      subtitle: "Reference prime rates, GIC & mortgage rates, plus our live foreign currency exchange calculator.",
      icon: pictoMainSacDollar,
    },
  };

  const info = metaMap[route.slug];

  return (
    <div className="bg-[#f8f6f1] pb-16">
      {/* Category Hero */}
      <section className="bg-[#DE161D] py-12 text-white">
        <div className="nbc-container">
          <Breadcrumb label={info.title} />
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-[680px]">
              <h1 className="text-[34px] font-bold leading-[40px] text-white sm:text-[44px] sm:leading-[50px]">
                {info.title}
              </h1>
              <p className="mt-3 text-[16px] leading-[24px] text-white/90">{info.subtitle}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onOpenAuth("onboarding")}
                  className="rounded-full bg-white px-6 py-3 text-[15px] font-semibold text-[#E41C23] shadow-sm transition hover:bg-[#f6f6f6]"
                >
                  Open an account
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth("signin")}
                  className="rounded-full border border-white/80 px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-white/15"
                >
                  Sign in to Online Bank
                </button>
              </div>
            </div>
            <div className="hidden h-24 w-24 place-items-center rounded-2xl bg-white p-4 shadow-lg md:grid">
              <img src={info.icon} alt="" aria-hidden className="h-16 w-16 object-contain" />
            </div>
          </div>
        </div>
      </section>

      <div className="nbc-container pt-10">
        {route.slug === "accounts" && (
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                name: "Total Chequing Account",
                fee: "$15.95 / month",
                waiver: "$0 monthly fee with $4,500 minimum balance or eligible Mastercard®",
                perks: ["Unlimited electronic debit & bill transactions", "Free Interac e-Transfer®", "Up to $150 annual card fee rebate"],
              },
              {
                name: "Connected Chequing Account",
                fee: "$10.95 / month",
                waiver: "$0 monthly fee for students & youth under 25",
                perks: ["Unlimited digital transactions", "Free mobile cheque deposit", "Real-time balance & spend alerts"],
              },
              {
                name: "Cash Advantage Solution",
                fee: "$0 / month",
                waiver: "3.00% promotional interest rate",
                perks: ["No lock-in — access funds anytime", "No minimum balance required", "CDIC-eligible deposit protection"],
              },
            ].map((acc) => (
              <div key={acc.name} className="flex flex-col rounded-[6px] bg-white p-6 shadow-sm">
                <p className="text-[13px] font-bold text-nbc-red">{acc.fee}</p>
                <h2 className="mt-1 text-[21px] font-bold text-nbc-navy">{acc.name}</h2>
                <p className="mt-1.5 text-[13px] font-medium text-[#105797]">{acc.waiver}</p>
                <ul className="mt-4 flex-1 space-y-2 text-[14px] text-nbc-ink">
                  {acc.perks.map((p) => (
                    <li key={p} className="flex items-start gap-2">
                      <span className="font-bold text-nbc-red">•</span> {p}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => onOpenAuth("onboarding")}
                  className="nbc-btn nbc-btn-primary mt-6 w-full"
                >
                  Open this account
                </button>
              </div>
            ))}
          </div>
        )}

        {route.slug === "cards" && (
          <div className="space-y-8">
            <div className="rounded-[6px] bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-[22px] font-bold text-nbc-navy">Estimate Your Annual Rewards</h2>
                  <p className="text-[14px] text-nbc-ink">Adjust your monthly everyday card spend to compare annual value.</p>
                </div>
                <div className="text-right">
                  <span className="text-[12px] uppercase tracking-wider text-nbc-ink">Monthly Spend</span>
                  <p className="text-[26px] font-bold text-nbc-red">{formatMoney(monthlyCardSpend)}</p>
                </div>
              </div>
              <input
                type="range"
                min={300}
                max={8000}
                step={100}
                value={monthlyCardSpend}
                onChange={(e) => setMonthlyCardSpend(Number(e.target.value))}
                className="mt-4 w-full accent-[#e41c23]"
              />
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  name: "Allure® Mastercard®",
                  rate: "20.99% purchases",
                  annualFee: "$0 with Total Package (reg. $70)",
                  mult: 0.0175,
                  cause: true,
                  desc: "Earn valuable rewards on groceries, restaurants & recurring bills while supporting breast cancer research.",
                },
                {
                  name: "World Elite® Mastercard®",
                  rate: "20.99% purchases",
                  annualFee: "$150 / year (up to $150 travel credits)",
                  mult: 0.022,
                  cause: false,
                  desc: "Up to 2 points per $1, comprehensive 60-day travel medical insurance, and Montreal Trudeau lounge access.",
                },
                {
                  name: "Cashback World Mastercard®",
                  rate: "20.99% purchases",
                  annualFee: "$0 first year ($85 thereafter)",
                  mult: 0.0185,
                  cause: false,
                  desc: "Automatic statement cashback on groceries, gas, EV charging, and recurring subscriptions.",
                },
              ].map((card) => {
                const estAnnual = Math.round(monthlyCardSpend * 12 * card.mult);
                return (
                  <div key={card.name} className="flex flex-col rounded-[6px] bg-white p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-[20px] font-bold text-nbc-navy">{card.name}</h3>
                        <p className="mt-0.5 text-[12.5px] text-nbc-ink">{card.annualFee}</p>
                      </div>
                      {card.cause && <img src={pictoBreastCancer} alt="" aria-hidden className="h-11 w-11 object-contain" />}
                    </div>
                    <p className="mt-3 flex-1 text-[14px] leading-[21px] text-nbc-ink">{card.desc}</p>
                    <div className="mt-4 rounded-[6px] bg-[#f8f6f1] p-3.5">
                      <span className="text-[11.5px] uppercase tracking-wider text-nbc-ink">Estimated Annual Value</span>
                      <p className="text-[22px] font-bold text-[#105797]">{formatMoney(estAnnual)} / yr</p>
                      <span className="text-[12px] text-nbc-ink">{card.rate}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenAuth("signin", "personal")}
                      className="nbc-btn nbc-btn-primary mt-5 w-full"
                    >
                      Compare cards
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {route.slug === "mortgages" && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="rounded-[6px] bg-white p-6 shadow-sm lg:col-span-7">
              <h2 className="text-[24px] font-bold text-nbc-navy">Mortgage Payment Calculator</h2>
              <p className="mt-1 text-[14px] text-nbc-ink">
                Estimate your monthly principal & interest payments in seconds.
              </p>

              <div className="mt-6 space-y-5">
                <div>
                  <div className="flex justify-between text-[13.5px] font-semibold text-nbc-navy">
                    <label htmlFor="hp">Property Purchase Price</label>
                    <span className="font-bold text-nbc-red">{formatMoney(homePrice)}</span>
                  </div>
                  <input
                    id="hp"
                    type="range"
                    min={150000}
                    max={1500000}
                    step={10000}
                    value={homePrice}
                    onChange={(e) => setHomePrice(Number(e.target.value))}
                    className="mt-2 w-full accent-[#e41c23]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[13.5px] font-semibold text-nbc-navy">
                    <label htmlFor="dp">Down Payment ({downPct}%)</label>
                    <span className="font-bold text-nbc-navy">{formatMoney(mortgageCalc.down)}</span>
                  </div>
                  <input
                    id="dp"
                    type="range"
                    min={5}
                    max={50}
                    step={1}
                    value={downPct}
                    onChange={(e) => setDownPct(Number(e.target.value))}
                    className="mt-2 w-full accent-[#e41c23]"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="mrate" className="block text-[13px] font-semibold text-nbc-navy">
                      Interest Rate (%)
                    </label>
                    <select
                      id="mrate"
                      value={mtgRate}
                      onChange={(e) => setMtgRate(Number(e.target.value))}
                      className="mt-1 w-full rounded-[6px] border border-[#cfc9bc] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                    >
                      <option value={4.69}>3-Year Fixed — 4.69%</option>
                      <option value={4.89}>5-Year Fixed Special — 4.89%</option>
                      <option value={4.95}>5-Year Variable — 4.95%</option>
                      <option value={5.34}>2-Year Fixed — 5.34%</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="amort" className="block text-[13px] font-semibold text-nbc-navy">
                      Amortization Period
                    </label>
                    <select
                      id="amort"
                      value={amortYears}
                      onChange={(e) => setAmortYears(Number(e.target.value))}
                      className="mt-1 w-full rounded-[6px] border border-[#cfc9bc] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                    >
                      {[15, 20, 25, 30].map((y) => (
                        <option key={y} value={y}>
                          {y} years
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-[6px] bg-nbc-navy p-6 text-white shadow-sm lg:col-span-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/75">Estimated Monthly Payment</p>
                <p className="mt-2 break-words text-[32px] font-bold leading-none text-white sm:text-[40px]">
                  {formatMoney(mortgageCalc.monthly)}
                  <span className="text-[16px] font-normal text-white/75"> / mo</span>
                </p>
                <div className="mt-6 space-y-2.5 border-t border-white/15 pt-4 text-[14px]">
                  <div className="flex justify-between">
                    <span className="text-white/75">Mortgage Principal</span>
                    <span className="font-semibold">{formatMoney(mortgageCalc.principal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/75">Down Payment ({downPct}%)</span>
                    <span className="font-semibold">{formatMoney(mortgageCalc.down)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/75">Rate Hold Guarantee</span>
                    <span className="font-semibold">Up to 120 days</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenAuth("signin", "personal")}
                className="nbc-btn nbc-btn-primary mt-6 w-full"
              >
                Talk to a mortgage specialist
              </button>
            </div>
          </div>
        )}

        {route.slug === "savings" && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="rounded-[6px] bg-white p-6 shadow-sm lg:col-span-7">
              <div className="flex items-center gap-3">
                <img src={pictoPromo} alt="Promo" className="h-9 w-auto" />
                <h2 className="text-[24px] font-bold text-nbc-navy">3.00% Cash Advantage & Investment Projections</h2>
              </div>
              <div className="mt-6 space-y-5">
                <div>
                  <div className="flex justify-between text-[13.5px] font-semibold text-nbc-navy">
                    <label htmlFor="isav">Initial Deposit</label>
                    <span className="font-bold text-nbc-red">{formatMoney(initSavings)}</span>
                  </div>
                  <input
                    id="isav"
                    type="range"
                    min={1000}
                    max={150000}
                    step={1000}
                    value={initSavings}
                    onChange={(e) => setInitSavings(Number(e.target.value))}
                    className="mt-2 w-full accent-[#e41c23]"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[13.5px] font-semibold text-nbc-navy">
                    <label htmlFor="msav">Monthly Contribution</label>
                    <span className="font-bold text-nbc-navy">{formatMoney(monthlySave)} / mo</span>
                  </div>
                  <input
                    id="msav"
                    type="range"
                    min={0}
                    max={3000}
                    step={50}
                    value={monthlySave}
                    onChange={(e) => setMonthlySave(Number(e.target.value))}
                    className="mt-2 w-full accent-[#e41c23]"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="sprod" className="block text-[13px] font-semibold text-nbc-navy">
                      Solution & Expected Return
                    </label>
                    <select
                      id="sprod"
                      value={saveRate}
                      onChange={(e) => setSaveRate(Number(e.target.value))}
                      className="mt-1 w-full rounded-[6px] border border-[#cfc9bc] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                    >
                      <option value={3.0}>Cash Advantage Solution — 3.00% promo</option>
                      <option value={4.15}>1-Year Non-Redeemable GIC — 4.15%</option>
                      <option value={6.5}>Balanced TFSA / RRSP Portfolio — 6.50% est.</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="syears" className="block text-[13px] font-semibold text-nbc-navy">
                      Time Horizon ({saveYears} {saveYears === 1 ? "year" : "years"})
                    </label>
                    <input
                      id="syears"
                      type="range"
                      min={1}
                      max={15}
                      value={saveYears}
                      onChange={(e) => setSaveYears(Number(e.target.value))}
                      className="mt-3 w-full accent-[#e41c23]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-[6px] bg-nbc-navy p-6 text-white shadow-sm lg:col-span-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/75">Projected Ending Balance</p>
                <p className="mt-2 break-words text-[30px] font-bold text-white sm:text-[38px]">{formatMoney(savingsCalc.futureValue)}</p>
                <div className="mt-5 space-y-2 border-t border-white/15 pt-4 text-[14px]">
                  <div className="flex justify-between">
                    <span className="text-white/75">Total Contributions</span>
                    <span className="font-semibold">{formatMoney(savingsCalc.contributed)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/75">Projected Interest / Growth</span>
                    <span className="font-bold text-[#6ee7b7]">+{formatMoney(savingsCalc.interestEarned)}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenAuth("onboarding")}
                className="nbc-btn nbc-btn-primary mt-6 w-full"
              >
                Open a Cash Advantage account
              </button>
            </div>
          </div>
        )}

        {route.slug === "borrowing" && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="rounded-[6px] bg-white p-6 shadow-sm lg:col-span-7">
              <h2 className="text-[24px] font-bold text-nbc-navy">Personal Loan & Flex Line® Calculator</h2>
              <div className="mt-5 space-y-5">
                <div>
                  <div className="flex justify-between text-[13.5px] font-semibold text-nbc-navy">
                    <label htmlFor="lamt">Borrowing Amount</label>
                    <span className="font-bold text-nbc-red">{formatMoney(loanAmount)}</span>
                  </div>
                  <input
                    id="lamt"
                    type="range"
                    min={2500}
                    max={75000}
                    step={500}
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(Number(e.target.value))}
                    className="mt-2 w-full accent-[#e41c23]"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="lterm" className="block text-[13px] font-semibold text-nbc-navy">
                      Repayment Term
                    </label>
                    <select
                      id="lterm"
                      value={loanMonths}
                      onChange={(e) => setLoanMonths(Number(e.target.value))}
                      className="mt-1 w-full rounded-[6px] border border-[#cfc9bc] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                    >
                      {[12, 24, 36, 48, 60].map((m) => (
                        <option key={m} value={m}>
                          {m} months ({m / 12} yr)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="lapr" className="block text-[13px] font-semibold text-nbc-navy">
                      Financing Type
                    </label>
                    <select
                      id="lapr"
                      value={loanApr}
                      onChange={(e) => setLoanApr(Number(e.target.value))}
                      className="mt-1 w-full rounded-[6px] border border-[#cfc9bc] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                    >
                      <option value={5.2}>All-In-One™ HELOC — 5.20%</option>
                      <option value={6.95}>Fixed Personal Loan — 6.95%</option>
                      <option value={8.7}>Personal Flex Line® — 8.70%</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-between rounded-[6px] bg-nbc-navy p-6 text-white lg:col-span-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/75">Monthly Payment</p>
                <p className="mt-2 break-words text-[30px] font-bold sm:text-[38px]">{formatMoney(loanCalc.monthly)}</p>
                <p className="mt-3 text-[13.5px] text-white/80">
                  Total borrowing cost over {loanMonths} months: {formatMoney(loanCalc.totalInterest)}
                </p>
              </div>
              <button type="button" onClick={() => onOpenAuth("signin")} className="nbc-btn nbc-btn-primary mt-6 w-full">
                Get pre-qualified
              </button>
            </div>
          </div>
        )}

        {route.slug === "insurance" && (
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Fraud Prevention & Cybersecurity",
                desc: "24/7 unusual transaction alerts, instant card lock inside your Online Bank dashboard, and zero-liability protection on unauthorized digital transactions.",
              },
              {
                title: "Travel & Medical Insurance",
                desc: "Up to 60 days of emergency out-of-province medical, trip cancellation, and baggage delay coverage included on eligible Mastercard® cards.",
              },
              {
                title: "Home, Auto & Loan Protection",
                desc: "Protect your mortgage and Personal Flex Line® payments against unexpected life events, disability, or job loss.",
              },
            ].map((ins) => (
              <div key={ins.title} className="rounded-[6px] bg-white p-6 shadow-sm">
                <h2 className="text-[20px] font-bold text-nbc-navy">{ins.title}</h2>
                <p className="mt-3 text-[14.5px] leading-[22px] text-nbc-ink">{ins.desc}</p>
                <button
                  type="button"
                  onClick={() => onOpenAuth("signin")}
                  className="mt-5 text-[14px] font-semibold text-[#1572c5] underline underline-offset-2"
                >
                  Manage security controls in Dashboard →
                </button>
              </div>
            ))}
          </div>
        )}

        {route.slug === "advice" && (
          <div className="space-y-8">
            <div className="rounded-[6px] bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-[23px] font-bold text-nbc-navy">Interactive 50 / 30 / 20 Monthly Budget Planner</h2>
                  <p className="text-[14px] text-nbc-ink">Enter your after-tax monthly income to balance essentials, lifestyle, and savings goals.</p>
                </div>
                <div className="text-right">
                  <span className="text-[12px] uppercase text-nbc-ink">After-Tax Monthly Income</span>
                  <p className="text-[26px] font-bold text-nbc-red">{formatMoney(netMonthlyIncome)}</p>
                </div>
              </div>
              <input
                type="range"
                min={1800}
                max={15000}
                step={100}
                value={netMonthlyIncome}
                onChange={(e) => setNetMonthlyIncome(Number(e.target.value))}
                className="mt-4 w-full accent-[#e41c23]"
              />
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-[6px] bg-[#f8f6f1] p-4">
                  <span className="text-[12px] font-bold uppercase text-nbc-navy">50% Essentials</span>
                  <p className="mt-1 text-[22px] font-bold text-nbc-navy">{formatMoney(netMonthlyIncome * 0.5)}</p>
                  <p className="mt-1 text-[12.5px] text-nbc-ink">Housing, groceries, utilities & transit</p>
                </div>
                <div className="rounded-[6px] bg-[#f8f6f1] p-4">
                  <span className="text-[12px] font-bold uppercase text-[#105797]">30% Lifestyle</span>
                  <p className="mt-1 text-[22px] font-bold text-[#105797]">{formatMoney(netMonthlyIncome * 0.3)}</p>
                  <p className="mt-1 text-[12.5px] text-nbc-ink">Dining, travel, hobbies & subscriptions</p>
                </div>
                <div className="rounded-[6px] bg-[#fff5f5] p-4">
                  <span className="text-[12px] font-bold uppercase text-nbc-red">20% Savings & Debt Payoff</span>
                  <p className="mt-1 text-[22px] font-bold text-nbc-red">{formatMoney(netMonthlyIncome * 0.2)}</p>
                  <p className="mt-1 text-[12.5px] text-nbc-ink">TFSA, RRSP, 3% Cash Advantage & extra principal</p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                { img: imgAdviceFinance, title: "Understanding your financial situation", text: "Map your net worth, recurring commitments, and cash buffer in minutes." },
                { img: imgAdviceDebt, title: "Prioritize & consolidate high-interest debt", text: "Use the avalanche method or a lower-rate Flex Line® to pay down balances faster." },
                { img: imgAdviceSavings, title: "Automate your savings goals", text: "Schedule automatic payday transfers to turn big milestones into effortless habits." },
              ].map((g) => (
                <div key={g.title} className="overflow-hidden rounded-[6px] bg-white shadow-sm">
                  <img src={g.img} alt="" aria-hidden className="h-44 w-full bg-[#f4f1ea] object-cover" />
                  <div className="p-5">
                    <h3 className="text-[18px] font-bold text-nbc-navy">{g.title}</h3>
                    <p className="mt-2 text-[14px] text-nbc-ink">{g.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {route.slug === "offers" && (
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                badge: "Savings Promo",
                title: "3.00% Cash Advantage Solution",
                desc: "Boost your emergency fund or project reserve with a 3% promotional interest rate and instant liquidity.",
                persona: "personal" as const,
              },
              {
                badge: "Entrepreneurs",
                title: "Save up to $1,313 / year",
                desc: "Business owners with an eligible commercial account receive waived monthly fees on up to 3 personal accounts.",
                persona: "business" as const,
              },
              {
                badge: "Newcomers & Students",
                title: "$0 MonthlyChequing Fee Offer",
                desc: "Enjoy no fixed monthly account fees, unlimited electronic transactions, and tailored credit options.",
                persona: "personal" as const,
              },
            ].map((o) => (
              <div key={o.title} className="flex flex-col rounded-[6px] bg-white p-6 shadow-sm">
                <span className="w-fit rounded-full bg-[#fff0f0] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-nbc-red">
                  {o.badge}
                </span>
                <h2 className="mt-3 text-[21px] font-bold text-nbc-navy">{o.title}</h2>
                <p className="mt-2.5 flex-1 text-[14.5px] leading-[22px] text-nbc-ink">{o.desc}</p>
                <button
                  type="button"
                  onClick={() => onOpenAuth("onboarding", o.persona)}
                  className="nbc-btn nbc-btn-primary mt-6 w-full"
                >
                  Apply for this offer
                </button>
              </div>
            ))}
          </div>
        )}

        {route.slug === "rates" && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="rounded-[6px] bg-white p-6 shadow-sm lg:col-span-6">
              <h2 className="text-[22px] font-bold text-nbc-navy">Reference & Product Rates</h2>
              <div className="mt-4 divide-y divide-[#ececec] text-[14.5px]">
                {[
                  ["National Bank Prime Rate", "4.700%"],
                  ["U.S. Prime Rate (Commercial)", "7.000%"],
                  ["U.S. Base Rate", "7.500%"],
                  ["Cash Advantage Solution (Promotional)", "3.000%"],
                  ["1-Year Non-Redeemable GIC", "4.150%"],
                  ["5-Year Fixed Closed Mortgage (Special)", "4.890%"],
                ].map(([label, val]) => (
                  <div key={label} className="flex items-center justify-between py-3">
                    <span className="text-[#333]">{label}</span>
                    <span className="font-bold text-nbc-navy">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[6px] bg-white p-6 shadow-sm lg:col-span-6">
              <h2 className="text-[22px] font-bold text-nbc-navy">Foreign Exchange Converter</h2>
              <p className="mt-1 text-[13.5px] text-nbc-ink">Indicative non-cash electronic exchange rates.</p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="fxc" className="block text-[12.5px] font-semibold text-nbc-navy">
                    Currency
                  </label>
                  <select
                    id="fxc"
                    value={fxCode}
                    onChange={(e) => setFxCode(e.target.value as keyof typeof FX_RATES)}
                    className="mt-1 w-full rounded-[6px] border border-[#cfc9bc] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                  >
                    {Object.entries(FX_RATES).map(([code, r]) => (
                      <option key={code} value={code}>
                        {r.flag} {code} — {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="fxd" className="block text-[12.5px] font-semibold text-nbc-navy">
                    Direction
                  </label>
                  <select
                    id="fxd"
                    value={fxDirection}
                    onChange={(e) => setFxDirection(e.target.value as "foreignToCad" | "cadToForeign")}
                    className="mt-1 w-full rounded-[6px] border border-[#cfc9bc] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                  >
                    <option value="cadToForeign">CAD → {fxCode} (Client buys {fxCode})</option>
                    <option value="foreignToCad">{fxCode} → CAD (Client sells {fxCode})</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="fxa" className="block text-[12.5px] font-semibold text-nbc-navy">
                  Amount ({fxDirection === "cadToForeign" ? "CAD" : fxCode})
                </label>
                <input
                  id="fxa"
                  type="number"
                  min={1}
                  value={fxAmount}
                  onChange={(e) => setFxAmount(Math.max(0, Number(e.target.value)))}
                  className="mt-1 w-full rounded-[6px] border border-[#cfc9bc] px-3.5 py-2.5 text-[16px] font-semibold text-nbc-navy"
                />
              </div>

              <div className="mt-5 rounded-[6px] bg-nbc-beige p-4">
                <span className="text-[12px] font-semibold uppercase tracking-wider text-nbc-ink">Converted Amount</span>
                <p className="mt-1 text-[28px] font-bold text-nbc-navy">
                  {fxDirection === "cadToForeign"
                    ? `${(fxAmount / FX_RATES[fxCode].sellCad).toFixed(2)} ${fxCode}`
                    : `${(fxAmount * FX_RATES[fxCode].buyCad).toFixed(2)} CAD`}
                </p>
                <p className="mt-1 text-[12px] text-nbc-ink">
                  Rate applied: 1 {fxCode} ={" "}
                  {fxDirection === "cadToForeign" ? FX_RATES[fxCode].sellCad : FX_RATES[fxCode].buyCad} CAD
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
