import { heroLg, heroMd, heroSm, heroXs, logoCdic } from "../assets/nbcAssets";
import { GlobalBankConfig, PageRoute } from "../banking/bankingTypes";
import { resolveInternalRoute } from "../banking/routeMapper";
import { adviceCards, bankingServices, headlineCards, helpCards } from "../data";
import { ArrowRight } from "./icons";

export function Hero({ onNavigate }: { onNavigate: (route: PageRoute) => void }) {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden bg-[#DE161D]">
      {/* Desktop & Tablet (>= 768px) */}
      <div className="relative hidden min-h-[323px] md:block lg:min-h-[375px]">
        <picture>
          <source media="(min-width: 1200px)" srcSet={heroLg} />
          <source media="(min-width: 992px)" srcSet={heroMd} />
          <img
            src={heroSm}
            alt="Photo of a couple bringing their project to life with the help of National Bank"
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        </picture>

        <div className="nbc-container relative flex min-h-[323px] items-center lg:min-h-[375px]">
          <div className="max-w-[440px] py-12 lg:max-w-[520px]">
            <h1
              id="hero-title"
              className="text-[40px] font-semibold leading-[1.1] tracking-[0.2px] text-white lg:text-[50px] lg:leading-[54px]"
            >
              You build the right time.
            </h1>
            <div className="mt-7">
              <button
                type="button"
                onClick={() => onNavigate({ kind: "signup", segment: "personal" })}
                className="group inline-flex items-center gap-2.5 rounded-[58px] bg-white px-7 py-3.5 text-[16px] font-semibold leading-[18px] tracking-[0.3px] text-[#E41C23] shadow-sm transition hover:bg-[#f6f6f6] hover:shadow-[0_4px_12px_rgba(0,0,0,0.16)]"
              >
                Your project starts here
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile (< 768px) */}
      <div className="md:hidden">
        <div className="nbc-container pb-8 pt-10">
          <h1 className="text-[36px] font-semibold leading-[40px] tracking-[0.2px] text-white">
            You build the right time.
          </h1>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => onNavigate({ kind: "signup", segment: "personal" })}
              className="group inline-flex items-center gap-2.5 rounded-[58px] bg-white px-6 py-3 text-[15px] font-semibold leading-[18px] text-[#E41C23] shadow-sm transition hover:bg-[#f6f6f6]"
            >
              Your project starts here
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
        <img
          src={heroXs}
          alt="Photo of a couple bringing their project to life with the help of National Bank"
          width={767}
          height={512}
          fetchPriority="high"
          className="block w-full object-cover"
        />
      </div>
    </section>
  );
}

export function PromoSection({
  onNavigate,
  bankConfig,
}: {
  onNavigate: (route: PageRoute) => void;
  bankConfig?: GlobalBankConfig;
}) {
  const promoRateDisplay = bankConfig ? `${bankConfig.promoSavingsRate}%` : "3%";
  const showMigration = bankConfig ? bankConfig.migrationBannerEnabled : true;
  const migrationText =
    bankConfig?.migrationBannerText ??
    "Laurentian Bank personal and business (SME) clients have officially joined National Bank.";

  return (
    <section aria-label="Promotions and migration information" className="bg-[#f8f6f1] pb-4 pt-8">
      <div className="nbc-container">
        {/* Laurentian Bank migration notice (Admin CMS controlled) */}
        {showMigration && (
          <div className="rounded-[6px] bg-white px-6 py-7 shadow-[0_1px_4px_rgba(0,0,0,0.04)] sm:px-10 sm:py-8">
            <p className="text-[16px] leading-[24px] text-[#333333]">
              {migrationText} Visit our{" "}
              <button
                type="button"
                onClick={() => onNavigate({ kind: "support", section: "notices" })}
                className="font-medium text-[#105797] underline decoration-1 underline-offset-2 hover:no-underline"
              >
                migration information hub
              </button>{" "}
              to learn more about this migration.
            </p>
          </div>
        )}

        {/* 3 Promotional vignette cards */}
        <ul className="mt-7 grid gap-5 md:grid-cols-3">
          {headlineCards.map((card, idx) => (
            <li key={card.title} className="relative h-full">
              {card.promoBadge && (
                <img
                  src={card.promoBadge}
                  alt="Promo"
                  width={56}
                  height={39}
                  className="pointer-events-none absolute -top-4 right-5 z-10 h-[39px] w-[56px] drop-shadow-sm"
                />
              )}
              <button
                type="button"
                onClick={() => onNavigate(resolveInternalRoute(card.href, card.title))}
                className="group flex h-full w-full flex-col rounded-[6px] bg-white p-6 text-left shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.1)]"
              >
                <div className="flex flex-1 items-start justify-between gap-4">
                  <div className="flex h-full min-w-0 flex-1 flex-col">
                    <h2 className="text-[22px] font-semibold leading-[28px] text-[#121212] sm:text-[24px] sm:leading-[30px]">
                      {idx === 0 ? `Enjoy a promotional rate of ${promoRateDisplay}` : card.title}
                    </h2>
                    <p className="mt-3 text-[15.5px] leading-[23px] text-[#333333]">{card.text}</p>
                    <span className="mt-auto pt-5 text-[15.5px] font-medium text-[#1572C5] underline decoration-1 underline-offset-2 transition group-hover:text-[#105797] group-hover:no-underline">
                      {card.cta}
                    </span>
                  </div>
                  <img
                    src={card.icon}
                    alt=""
                    aria-hidden
                    width={77}
                    height={77}
                    className="mt-1 h-[64px] w-[64px] flex-none object-contain transition duration-200 group-hover:scale-105 sm:h-[72px] sm:w-[72px]"
                  />
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ServicesSection({ onNavigate }: { onNavigate: (route: PageRoute) => void }) {
  return (
    <section aria-labelledby="services-title" className="bg-[#f8f6f1] py-10 sm:py-12">
      <div className="nbc-container">
        <h2
          id="services-title"
          className="text-[30px] font-bold leading-[36px] text-nbc-navy sm:text-[38px] sm:leading-[44px]"
        >
          Choose your banking services
        </h2>

        <div className="mt-6 rounded-[6px] bg-white px-4 py-7 shadow-[0_1px_4px_rgba(0,0,0,0.04)] sm:px-8 sm:py-8">
          <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {bankingServices.map((service) => (
              <li key={service.label}>
                <button
                  type="button"
                  onClick={() => onNavigate(resolveInternalRoute(service.href, service.label))}
                  className="group flex h-full w-full flex-col items-center justify-start gap-3.5 rounded-[6px] px-3 py-4 text-center transition hover:bg-[#faf8f3]"
                >
                  <img
                    src={service.icon}
                    alt=""
                    aria-hidden
                    width={71}
                    height={70}
                    className="h-[68px] w-[68px] object-contain transition duration-200 group-hover:-translate-y-0.5"
                  />
                  <span className="text-[16px] font-medium leading-[22px] text-[#1572C5] underline decoration-transparent underline-offset-2 transition group-hover:text-[#105797] group-hover:decoration-current">
                    {service.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function AdviceSection({ onNavigate }: { onNavigate: (route: PageRoute) => void }) {
  return (
    <section aria-labelledby="advice-title" className="bg-[#f8f6f1] pb-16 pt-6 sm:pb-20 sm:pt-8">
      <div className="nbc-container">
        <div className="max-w-[760px]">
          <h2
            id="advice-title"
            className="text-[30px] font-bold leading-[36px] text-nbc-navy sm:text-[38px] sm:leading-[44px]"
          >
            Advice to take control of your finances
          </h2>
          <p className="mt-3.5 text-[16px] leading-[25px] text-[#333333]">
            Big goals often start with small steps. Browse our advice and discover simple ways to make progress, no
            matter what you're working toward.
          </p>
        </div>

        <ul className="mt-8 grid gap-6 md:grid-cols-3">
          {adviceCards.map((card) => (
            <li key={card.title} className="h-full">
              <article className="group flex h-full flex-col overflow-hidden rounded-[6px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(0,0,0,0.1)]">
                <div className="overflow-hidden bg-[#f4f1ea]">
                  <img
                    src={card.image}
                    alt=""
                    aria-hidden
                    width={380}
                    height={240}
                    className="block h-[210px] w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="text-[21px] font-semibold leading-[27px] text-nbc-navy">{card.title}</h3>
                  <p className="mt-3 text-[15.5px] leading-[23px] text-[#444444]">{card.text}</p>
                  <button
                    type="button"
                    onClick={() => onNavigate({ kind: "category", slug: "advice" })}
                    className="mt-auto inline-flex w-fit items-center gap-2 pt-5 text-left text-[15.5px] font-medium text-[#1572C5] underline decoration-1 underline-offset-2 transition hover:text-[#105797] hover:no-underline"
                  >
                    {card.cta}
                  </button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function HelpSection({
  onOpenChat,
  onNavigate,
}: {
  onOpenChat: () => void;
  onNavigate: (route: PageRoute) => void;
}) {
  return (
    <section aria-labelledby="help-title" className="bg-white pt-14 sm:pt-16">
      <div className="nbc-container">
        <h2
          id="help-title"
          className="text-[30px] font-bold leading-[36px] text-nbc-navy sm:text-[38px] sm:leading-[44px]"
        >
          Find answers to your questions
        </h2>

        <ul className="mt-9 grid gap-8 pb-14 md:grid-cols-3">
          {helpCards.map((card) => {
            const inner = (
              <div className="flex items-start gap-5">
                <img
                  src={card.icon}
                  alt=""
                  aria-hidden
                  width={100}
                  height={100}
                  className="h-[74px] w-[74px] flex-none object-contain transition duration-200 group-hover:scale-105"
                />
                <div className="min-w-0">
                  <h3 className="text-[20px] font-semibold leading-[26px] text-nbc-navy">{card.title}</h3>
                  <p className="mt-2 text-[15px] leading-[22px] text-[#565656]">{card.text}</p>
                  <span className="mt-3.5 inline-flex items-center gap-1.5 text-[15.5px] font-medium text-[#1572C5] underline decoration-1 underline-offset-2 transition group-hover:text-[#105797] group-hover:no-underline">
                    {card.cta}
                  </span>
                </div>
              </div>
            );

            return (
              <li key={card.title} className="h-full">
                <button
                  type="button"
                  onClick={() => {
                    if (card.action === "chat") {
                      onOpenChat();
                    } else {
                      onNavigate(resolveInternalRoute(card.href, card.cta));
                    }
                  }}
                  className="group block h-full w-full rounded-[6px] p-3 text-left transition hover:bg-[#faf8f3]"
                >
                  {inner}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Official CDIC strip */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-[#d2d2d2] py-8 sm:flex-row">
          <button
            type="button"
            onClick={() => onNavigate({ kind: "support", section: "cdic" })}
            className="text-left text-[16px] font-medium text-nbc-navy underline decoration-1 underline-offset-2 transition hover:text-[#105797] hover:no-underline"
          >
            Member of Canada Deposit Insurance Corporation (CDIC)
          </button>
          <button
            type="button"
            onClick={() => onNavigate({ kind: "support", section: "cdic" })}
            aria-label="Canada Deposit Insurance Corporation (CDIC)"
            className="flex-none transition hover:opacity-85"
          >
            <img
              src={logoCdic}
              alt="CDIC logo"
              width={132}
              height={60}
              className="h-[52px] w-auto object-contain"
            />
          </button>
        </div>
      </div>
    </section>
  );
}
