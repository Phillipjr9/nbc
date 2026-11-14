import { useEffect, useRef, useState } from "react";
import { logoNbc, pictoBullesClavardage, statusAttention } from "../assets/nbcAssets";
import { GlobalBankConfig, PageRoute } from "../banking/bankingTypes";
import { resolveInternalRoute } from "../banking/routeMapper";
import { becomeClientOptions, navItems, signInOptions } from "../data";
import {
  ArrowRight,
  CalendarIcon,
  ChevronDown,
  ChevronRight,
  CloseIcon,
  GlobeIcon,
  HelpIcon,
  LockIcon,
  MenuIcon,
  PinIcon,
  SearchIcon,
} from "./icons";

type HeaderProps = {
  route: PageRoute;
  bankConfig: GlobalBankConfig;
  signedInName?: string | null;
  dashboardRoute?: PageRoute;
  onNavigate: (route: PageRoute) => void;
  onOpenSearch: () => void;
  onOpenChat: () => void;
};

export default function Header({
  route,
  bankConfig,
  signedInName,
  dashboardRoute = { kind: "personal-dashboard" },
  onNavigate,
  onOpenSearch,
  onOpenChat,
}: HeaderProps) {
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<number | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(true);
  const [elevated, setElevated] = useState(false);
  const [lang, setLang] = useState<"EN" | "FR">("EN");
  const signInRef = useRef<HTMLLIElement>(null);
  const clientRef = useRef<HTMLLIElement>(null);
  const megaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setElevated(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveMenu(null);
        setSignInOpen(false);
        setClientOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (signInRef.current && !signInRef.current.contains(e.target as Node)) setSignInOpen(false);
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) setClientOpen(false);
      if (megaRef.current && !megaRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-nav-item]")) setActiveMenu(null);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    if (mobileOpen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const go = (next: PageRoute) => {
    setActiveMenu(null);
    setSignInOpen(false);
    setClientOpen(false);
    setMobileOpen(false);
    onNavigate(next);
  };

  const current = activeMenu !== null ? navItems[activeMenu] : null;

  const isPersonalSegment =
    route.kind === "home" ||
    route.kind === "category" ||
    route.kind === "login" ||
    route.kind === "signup" ||
    route.kind === "support";

  return (
    <>
      {/* Quick action top bar */}
      <header className="relative z-50 bg-nbc-topbar text-white">
        <div className="nbc-container flex h-[54px] items-center justify-between gap-2 md:h-[62px]">
          <nav aria-label="Links to other National Bank webpages" className="hidden md:block">
            <ul className="flex items-center">
              {(
                [
                  { label: "Personal", target: { kind: "home" } as PageRoute, active: isPersonalSegment },
                  {
                    label: "Business",
                    target: { kind: "segment", segment: "business" } as PageRoute,
                    active: route.kind === "segment" && route.segment === "business",
                  },
                  {
                    label: "Wealth Management",
                    target: { kind: "segment", segment: "wealth" } as PageRoute,
                    active: route.kind === "segment" && route.segment === "wealth",
                  },
                  {
                    label: "About Us",
                    target: { kind: "segment", segment: "about" } as PageRoute,
                    active: route.kind === "segment" && route.segment === "about",
                  },
                ]
              ).map((link) => (
                <li key={link.label} className="flex h-[62px] items-stretch">
                  <button
                    type="button"
                    onClick={() => go(link.target)}
                    aria-current={link.active ? "page" : undefined}
                    className={`flex items-center px-3.5 text-[14px] leading-[18px] transition lg:px-4 ${
                      link.active
                        ? "bg-white/15 font-medium text-white"
                        : "text-white/95 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <button
            type="button"
            onClick={() => go({ kind: "home" })}
            className="text-[14px] font-semibold text-white md:hidden"
          >
            National Bank
          </button>

          <nav aria-label="Quick actions">
            <ul className="flex items-center gap-0.5 md:gap-1">
              <li>
                <button
                  type="button"
                  onClick={onOpenSearch}
                  className="flex h-9 items-center gap-2 rounded-sm px-2.5 text-[13.5px] font-medium text-white transition hover:bg-white/10 lg:px-3"
                >
                  <SearchIcon className="h-4 w-4" />
                  <span className="hidden lg:inline">Search</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => go({ kind: "support", section: "help" })}
                  className="flex h-9 items-center gap-2 rounded-sm px-2.5 text-[13.5px] font-medium text-white transition hover:bg-white/10 lg:px-3"
                >
                  <HelpIcon className="h-4 w-4" />
                  <span className="hidden lg:inline">Help</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setLang((prev) => (prev === "EN" ? "FR" : "EN"))}
                  aria-label="Toggle language"
                  className="flex h-9 items-center gap-1.5 rounded-sm px-2 text-[13.5px] font-medium text-white transition hover:bg-white/10 lg:px-3"
                >
                  <GlobeIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">{lang === "EN" ? "Fr" : "En"}</span>
                </button>
              </li>

              {/* Become a client (In-App Sign Up) */}
              <li className="relative hidden sm:block" ref={clientRef}>
                <button
                  type="button"
                  onClick={() => {
                    setClientOpen((v) => !v);
                    setSignInOpen(false);
                  }}
                  aria-expanded={clientOpen}
                  aria-haspopup="true"
                  className="flex h-9 items-center gap-1.5 rounded-full border border-white/75 px-3.5 text-[13.5px] font-medium text-white transition hover:bg-white/15"
                >
                  Become a client
                  <ChevronDown className={`h-3 w-3 transition ${clientOpen ? "rotate-180" : ""}`} />
                </button>
                {clientOpen && (
                  <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[230px] animate-fade-up overflow-hidden rounded-md border border-[#e3e3e3] bg-white shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                    <div className="border-b border-nbc-line bg-[#fafafa] px-4 py-2.5">
                      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-nbc-ink/70">
                        Sign up online
                      </p>
                    </div>
                    <ul className="py-1.5">
                      {becomeClientOptions.map((opt) => (
                        <li key={opt.label}>
                          <button
                            type="button"
                            onClick={() =>
                              go({
                                kind: "signup",
                                segment: opt.label === "Business" ? "business" : "personal",
                              })
                            }
                            className="group flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-[14px] font-medium text-nbc-navy transition hover:bg-nbc-beige-soft hover:text-nbc-red"
                          >
                            <span>{opt.label}</span>
                            <ChevronRight className="h-3 w-3 text-[#a0a0a0] transition group-hover:text-nbc-red" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>

              {/* Sign In / Online Bank button */}
              <li className="relative ml-1.5" ref={signInRef}>
                {signedInName ? (
                  <div className="flex items-center gap-2">
                    <div className="hidden items-center gap-2 rounded-full border border-white/70 bg-white/10 px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-white/90 sm:flex">
                      <span className="uppercase">Authenticated</span>
                      <span className="text-white">{signedInName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => go(dashboardRoute)}
                      className="flex h-9 items-center gap-2 rounded-full border border-white bg-nbc-red px-3.5 text-[13.5px] font-semibold text-white transition hover:bg-nbc-red-dark sm:px-4"
                    >
                      <LockIcon className="h-3.5 w-3.5" />
                      Online Bank
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setSignInOpen((v) => !v);
                        setClientOpen(false);
                      }}
                      aria-expanded={signInOpen}
                      aria-haspopup="true"
                      className="flex h-9 items-center gap-2 rounded-full border border-white bg-nbc-red px-3.5 text-[13.5px] font-semibold text-white transition hover:bg-nbc-red-dark sm:px-4"
                    >
                      <LockIcon className="h-3.5 w-3.5" />
                      Sign in
                      <ChevronDown className={`h-3 w-3 transition ${signInOpen ? "rotate-180" : ""}`} />
                    </button>
                    {signInOpen && (
                      <div
                        data-testid="signin-popover"
                        className="absolute right-0 top-[calc(100%+10px)] z-50 w-[290px] animate-fade-up overflow-hidden rounded-md border border-[#e3e3e3] bg-white shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
                      >
                        <div className="border-b border-nbc-line bg-[#fafafa] px-4 py-3">
                          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-nbc-ink/70">
                            Online transactions
                          </p>
                        </div>
                        <ul className="py-1.5">
                          {signInOptions.map((opt, idx) => (
                            <li
                              key={opt.label}
                              className={idx === 2 ? "mt-1 border-t border-nbc-line pt-1" : undefined}
                            >
                              <button
                                type="button"
                                onClick={() => go(resolveInternalRoute(opt.href, opt.label))}
                                className="group flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-nbc-beige-soft"
                              >
                                <span>
                                  <span
                                    className={`block text-[13.5px] group-hover:text-nbc-red ${
                                      opt.primary ? "font-semibold text-nbc-navy" : "font-normal text-[#444]"
                                    }`}
                                  >
                                    {opt.label}
                                  </span>
                                  {opt.desc && <span className="block text-[11px] text-nbc-ink">{opt.desc}</span>}
                                </span>
                                {opt.primary && (
                                  <ChevronRight className="h-3 w-3 text-[#a0a0a0] transition group-hover:text-nbc-red" />
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                        <div className="space-y-1.5 border-t border-nbc-line bg-[#fafafa] px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() => go({ kind: "signup", segment: "personal" })}
                            className="block text-[12.5px] font-medium text-[#1572c5] underline underline-offset-2 hover:text-nbc-navy"
                          >
                            Become a client →
                          </button>
                          <button
                            type="button"
                            onClick={() => go({ kind: "admin-login" })}
                            className="flex items-center gap-1.5 text-[12px] font-medium text-[#565656] underline underline-offset-2 hover:text-nbc-navy"
                          >
                            <LockIcon className="h-3 w-3" />
                            Employee administration
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </li>
            </ul>
          </nav>
        </div>
      </header>

      {/* Main navigation (sticky) */}
      <div
        ref={megaRef}
        onMouseLeave={() => setActiveMenu(null)}
        className={`sticky top-0 z-40 bg-white transition-shadow ${
          elevated ? "shadow-[0_4px_18px_rgba(0,0,0,0.12)]" : "border-b border-[#ececec]"
        }`}
      >
        <div className="nbc-container flex h-[68px] items-center justify-between gap-4 lg:h-[80px]">
          <button
            type="button"
            onClick={() => go({ kind: "home" })}
            aria-label="Back to Home Page"
            className="flex flex-none items-center py-2"
          >
            <img
              src={logoNbc}
              alt="National Bank"
              width={155}
              height={50}
              className="h-[40px] w-auto lg:h-[48px]"
            />
          </button>

          <nav aria-label="Main menu" className="hidden lg:block">
            <ul className="flex items-center">
              {navItems.map((item, i) => {
                const isOpen = activeMenu === i;
                return (
                  <li key={item.label} data-nav-item className="relative">
                    <button
                      type="button"
                      onClick={() => go(resolveInternalRoute(item.href, item.label))}
                      onMouseEnter={() => setActiveMenu(i)}
                      onFocus={() => setActiveMenu(i)}
                      aria-expanded={isOpen}
                      aria-haspopup="true"
                      className={`group flex items-center gap-1 border-b-[3px] px-[8px] py-[27px] text-[14px] leading-[20px] transition xl:px-[10px] ${
                        isOpen
                          ? "border-nbc-red font-semibold text-nbc-navy"
                          : "border-transparent text-[#565656] hover:text-nbc-navy hover:underline hover:decoration-nbc-navy hover:underline-offset-4"
                      }`}
                    >
                      {item.label}
                      <ChevronDown
                        className={`h-2.5 w-2.5 text-[#7c7c7c] transition ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-1.5 lg:hidden">
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Search"
              className="grid h-10 w-10 place-items-center rounded-full text-nbc-navy transition hover:bg-nbc-grey"
            >
              <SearchIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open main menu"
              aria-expanded={mobileOpen}
              className="flex h-10 items-center gap-2 rounded-full border border-[#d6d6d6] px-3.5 text-[13px] font-semibold text-nbc-navy transition hover:border-nbc-navy"
            >
              <MenuIcon className="h-4 w-4" />
              Menu
            </button>
          </div>
        </div>

        {/* Mega menu */}
        {current && (
          <div
            className="absolute left-0 right-0 top-full hidden animate-fade-in border-t border-[#ececec] bg-white shadow-[0_18px_30px_rgba(0,0,0,0.16)] lg:block"
            onMouseLeave={() => setActiveMenu(null)}
          >
            <div className="nbc-container grid grid-cols-12 gap-8 py-8">
              <div className="col-span-8 grid grid-cols-2 gap-x-8 gap-y-6">
                {current.groups.map((group) => (
                  <div key={group.title}>
                    <p className="mb-2.5 font-semibold text-[11px] uppercase tracking-[0.16em] text-nbc-ink/70">
                      {group.title}
                    </p>
                    <ul className="space-y-0.5">
                      {group.links.map((link) => (
                        <li key={link.label}>
                          <button
                            type="button"
                            onClick={() => go(resolveInternalRoute(link.href, link.label))}
                            className="group flex w-full items-center justify-between gap-4 border-b border-[#f2f2f2] py-2 text-left text-[14.5px] text-nbc-navy transition hover:text-nbc-red"
                          >
                            <span>{link.label}</span>
                            <ArrowRight className="h-3 w-3 flex-none text-[#b5b5b5] opacity-0 transition group-hover:translate-x-0.5 group-hover:text-nbc-red group-hover:opacity-100" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {current.promo && (
                <div className="col-span-4">
                  <div className="flex h-full flex-col rounded-[6px] bg-nbc-beige p-6">
                    <p className="font-semibold text-[10.5px] uppercase tracking-[0.16em] text-nbc-red">
                      {current.promo.eyebrow}
                    </p>
                    <p className="mt-2 text-[21px] font-semibold leading-[27px] text-nbc-navy">
                      {current.promo.title}
                    </p>
                    <p className="mt-2 text-[13.5px] leading-[21px] text-nbc-ink">{current.promo.text}</p>
                    <button
                      type="button"
                      onClick={() => go(resolveInternalRoute(current.promo!.href, current.promo!.cta))}
                      className="mt-auto inline-flex items-center gap-2 pt-5 text-left text-[13.5px] font-semibold text-nbc-navy underline decoration-nbc-navy/60 underline-offset-4 transition hover:text-nbc-red hover:decoration-nbc-red"
                    >
                      {current.promo.cta}
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
              <div className="col-span-12 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[#efefef] pt-4 text-[12.5px] text-nbc-ink">
                <span className="font-semibold text-nbc-navy">Need a hand?</span>
                <button
                  type="button"
                  onClick={() => go({ kind: "support", section: "branches" })}
                  className="flex items-center gap-1.5 hover:text-nbc-red"
                >
                  <PinIcon className="h-3 w-3" /> Find a branch
                </button>
                <button
                  type="button"
                  onClick={() => go({ kind: "support", section: "appointment" })}
                  className="flex items-center gap-1.5 hover:text-nbc-red"
                >
                  <CalendarIcon className="h-3 w-3" /> Make an appointment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenu(null);
                    onOpenChat();
                  }}
                  className="flex items-center gap-1.5 hover:text-nbc-red"
                >
                  <img src={pictoBullesClavardage} alt="" aria-hidden className="h-4 w-4 object-contain" />
                  Chat with our virtual assistant
                </button>
                <button
                  type="button"
                  onClick={() => go(resolveInternalRoute(current.href, current.label))}
                  className="ml-auto font-semibold text-nbc-link hover:underline"
                >
                  See all {current.label.toLowerCase()}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Optional Global System Maintenance Banner (Admin CMS controlled) */}
      {bankConfig.maintenanceBannerEnabled && (
        <div className="bg-[#9b1c1c] text-white">
          <div className="nbc-container py-2.5 text-center text-[13px] font-semibold">
            ⚠ {bankConfig.maintenanceBannerText}
          </div>
        </div>
      )}

      {/* Service alert yellow warning banner (Admin CMS controlled) */}
      {noticeOpen && bankConfig.alertBannerEnabled && (
        <div className="border-b border-[#efe3a6] bg-[#FFF8C7] text-[#1a1a1a]">
          <div className="nbc-container flex items-center gap-3 py-3.5 text-[14px] leading-[21px]">
            <img
              src={statusAttention}
              alt="Warning"
              width={24}
              height={24}
              className="h-6 w-6 flex-none object-contain"
            />
            <p className="min-w-0 flex-1">
              <strong className="font-semibold text-[#121212]">{bankConfig.alertBannerTitle}</strong>:{" "}
              {bankConfig.alertBannerBody} Consult our{" "}
              <button
                type="button"
                onClick={() => go({ kind: "support", section: "notices" })}
                className="font-medium text-[#105797] underline decoration-1 underline-offset-2 hover:no-underline"
              >
                important notices page
              </button>{" "}
              to discover alternative solutions.
            </p>
            <button
              type="button"
              onClick={() => setNoticeOpen(false)}
              aria-label="Dismiss notice"
              className="grid h-7 w-7 flex-none place-items-center rounded-full text-[#565656] transition hover:bg-black/5 hover:text-nbc-navy"
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Main menu">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-[#001e2e]/50"
          />
          <div className="absolute right-0 top-0 flex h-full w-[min(92vw,400px)] animate-slide-in flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-nbc-line px-5 py-4">
              <button type="button" onClick={() => go({ kind: "home" })}>
                <img src={logoNbc} alt="National Bank" width={120} height={39} className="h-[34px] w-auto" />
              </button>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="grid h-10 w-10 place-items-center rounded-full text-nbc-navy transition hover:bg-nbc-grey"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="nice-scroll flex-1 overflow-y-auto">
              <div className="flex gap-2 border-b border-nbc-line px-5 py-3">
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    onOpenSearch();
                  }}
                  className="flex flex-1 items-center gap-2 rounded-full border border-[#d8d8d8] px-4 py-2.5 text-sm text-nbc-ink"
                >
                  <SearchIcon className="h-4 w-4" /> Search on the site
                </button>
              </div>
              <ul className="px-2 py-2">
                {navItems.map((item, i) => (
                  <li key={item.label} className="border-b border-[#f1f1f1]">
                    <button
                      type="button"
                      onClick={() => setMobileSection(mobileSection === i ? null : i)}
                      aria-expanded={mobileSection === i}
                      className="flex w-full items-center justify-between gap-3 px-3 py-3.5 text-left text-[15px] font-medium text-nbc-navy"
                    >
                      {item.label}
                      <ChevronDown
                        className={`h-3 w-3 flex-none text-[#8a8a8a] transition ${
                          mobileSection === i ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {mobileSection === i && (
                      <div className="animate-fade-in pb-3 pl-3 pr-2">
                        {item.groups.map((group) => (
                          <div key={group.title} className="mb-2">
                            <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-nbc-ink/60">
                              {group.title}
                            </p>
                            {group.links.map((link) => (
                              <button
                                key={link.label}
                                type="button"
                                onClick={() => go(resolveInternalRoute(link.href, link.label))}
                                className="flex w-full items-center justify-between px-2 py-2 text-left text-[14px] text-[#444]"
                              >
                                {link.label}
                                <ChevronRight className="h-2.5 w-2.5 text-[#b0b0b0]" />
                              </button>
                            ))}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => go(resolveInternalRoute(item.href, item.label))}
                          className="mx-2 mt-1 inline-flex text-[13.5px] font-semibold text-nbc-link"
                        >
                          See all {item.label.toLowerCase()}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <div className="border-t border-nbc-line px-5 py-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-nbc-ink/60">Sections</p>
                <div className="grid grid-cols-2 gap-y-2 text-[14px] text-nbc-navy">
                  <button type="button" className="text-left" onClick={() => go({ kind: "home" })}>
                    Personal
                  </button>
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => go({ kind: "segment", segment: "business" })}
                  >
                    Business
                  </button>
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => go({ kind: "segment", segment: "wealth" })}
                  >
                    Wealth Management
                  </button>
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => go({ kind: "segment", segment: "about" })}
                  >
                    About Us
                  </button>
                </div>
              </div>
              <div className="space-y-2 border-t border-nbc-line px-5 py-4">
                <button
                  type="button"
                  onClick={() => go(signedInName ? dashboardRoute : { kind: "login" })}
                  className="nbc-btn nbc-btn-primary w-full"
                >
                  <LockIcon className="h-4 w-4" /> {signedInName ? "Online Bank" : "Sign in"}
                </button>
                <button
                  type="button"
                  onClick={() => go({ kind: "signup", segment: "personal" })}
                  className="nbc-btn nbc-btn-ghost w-full"
                >
                  Become a client
                </button>
                <div className="flex items-center justify-between pt-2 text-[13px] text-nbc-ink">
                  <button
                    type="button"
                    onClick={() => go({ kind: "support", section: "help" })}
                    className="flex items-center gap-2"
                  >
                    <HelpIcon className="h-4 w-4" /> Help
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang((prev) => (prev === "EN" ? "FR" : "EN"))}
                    className="flex items-center gap-2"
                  >
                    <GlobeIcon className="h-4 w-4" /> {lang === "EN" ? "Français" : "English"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
