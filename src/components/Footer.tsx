import { useState } from "react";
import { logoCdic, logoNbc } from "../assets/nbcAssets";
import { PageRoute } from "../banking/bankingTypes";
import { resolveInternalRoute } from "../banking/routeMapper";
import { footerColumns, legalLinks, socialLinks } from "../data";
import { CalendarIcon, ChevronDown, LockIcon, PinIcon } from "./icons";

export default function Footer({
  onNavigate,
  isSignedIn = false,
  dashboardRoute = { kind: "personal-dashboard" },
}: {
  onNavigate: (route: PageRoute) => void;
  isSignedIn?: boolean;
  dashboardRoute?: PageRoute;
}) {
  const [openMobileCol, setOpenMobileCol] = useState<string | null>(footerColumns[0].title);

  return (
    <footer id="footer" className="mt-auto border-t border-[#dcdcdc] bg-[#efefef] text-[#565656]">
      {/* Top Quick Banking & Support Bar */}
      <div className="border-b border-[#dcdcdc] bg-[#e7e5df]">
        <div className="nbc-container flex flex-wrap items-center justify-between gap-4 py-4 text-[13.5px]">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-semibold text-nbc-navy">
            <button
              type="button"
              onClick={() => onNavigate({ kind: "support", section: "branches" })}
              className="inline-flex items-center gap-2 transition hover:text-nbc-red"
            >
              <PinIcon className="h-4 w-4 text-nbc-red" />
              Find a branch or ABM
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ kind: "support", section: "appointment" })}
              className="inline-flex items-center gap-2 transition hover:text-nbc-red"
            >
              <CalendarIcon className="h-4 w-4 text-nbc-red" />
              Make an appointment
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ kind: "category", slug: "rates" })}
              className="transition hover:text-nbc-red"
            >
              Interest & exchange rates
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isSignedIn ? (
              <button
                type="button"
                onClick={() => onNavigate(dashboardRoute)}
                className="inline-flex items-center gap-1.5 rounded-full bg-nbc-navy px-4 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-nbc-red"
              >
                <LockIcon className="h-3.5 w-3.5" />
                Online Bank
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate({ kind: "signup", segment: "personal" })}
                  className="rounded-full border border-nbc-navy bg-white px-4 py-1.5 text-[12.5px] font-semibold text-nbc-navy transition hover:border-nbc-red hover:text-nbc-red"
                >
                  Become a client
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate({ kind: "login", portal: "personal" })}
                  className="inline-flex items-center gap-1.5 rounded-full bg-nbc-red px-4 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-nbc-red-dark"
                >
                  <LockIcon className="h-3.5 w-3.5" />
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Footer Columns */}
      <div className="nbc-container">
        <div className="grid gap-10 border-b border-[#dcdcdc] py-12 lg:grid-cols-12 lg:gap-8">
          {/* Brand & Social Column */}
          <div className="lg:col-span-3">
            <button
              type="button"
              onClick={() => onNavigate({ kind: "home" })}
              aria-label="National Bank – Home"
            >
              <img src={logoNbc} alt="National Bank" width={155} height={50} className="h-11 w-auto" />
            </button>
            <p className="mt-5 max-w-[240px] text-[22px] font-semibold leading-[28px] text-nbc-navy">
              Build something.
            </p>
            <p className="mt-2 max-w-[260px] text-[13px] leading-[21px] text-[#5c5c5c]">
              A bank that puts its people and its communities first, since 1859.
            </p>

            <ul className="mt-5 flex flex-wrap items-center gap-2.5">
              {socialLinks.map(({ label, icon }) => (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => onNavigate({ kind: "segment", segment: "about" })}
                    aria-label={`National Bank on ${label}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full opacity-80 transition hover:scale-105 hover:opacity-100"
                  >
                    <img src={icon} alt={`${label} logo`} width={32} height={32} className="h-8 w-8 object-contain" />
                  </button>
                </li>
              ))}
            </ul>

            <p className="mt-6 text-[12.5px] text-[#565656]">
              Client Services 24/7:{" "}
              <span className="font-semibold text-nbc-navy">1-888-835-6281</span>
            </p>
          </div>

          {/* 4 Official Link Columns */}
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4 lg:col-span-9">
            {footerColumns.map((column) => {
              const isOpen = openMobileCol === column.title;
              return (
                <div key={column.title} className="border-b border-[#dcdcdc] pb-2 sm:border-0 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setOpenMobileCol(isOpen ? null : column.title)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-2 py-2 text-left text-[13.5px] font-bold text-[#121212] sm:pointer-events-none sm:py-0"
                  >
                    {column.title}
                    <ChevronDown
                      className={`h-3 w-3 text-[#7a7a7a] transition sm:hidden ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  <ul
                    className={`space-y-2 overflow-hidden pl-0.5 text-[13.5px] leading-[20px] text-[#565656] sm:mt-4 sm:block ${
                      isOpen ? "mt-2 block" : "hidden sm:block"
                    }`}
                  >
                    {column.links.map((link) => (
                      <li key={link.label}>
                        <button
                          type="button"
                          onClick={() => onNavigate(resolveInternalRoute(link.href, link.label))}
                          className="inline-block text-left transition hover:text-nbc-link hover:underline hover:underline-offset-2"
                        >
                          {link.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* CDIC + Legal Links + Subtle Administration Portal Link + Back to Top */}
        <div className="flex flex-col gap-4 py-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <button
              type="button"
              onClick={() => onNavigate({ kind: "support", section: "cdic" })}
              aria-label="CDIC Deposit Insurance"
            >
              <img
                src={logoCdic}
                alt="Canada Deposit Insurance Corporation"
                width={110}
                height={32}
                className="h-8 w-auto object-contain"
              />
            </button>
            {legalLinks.map((link) => (
              <button
                key={link.label}
                type="button"
                onClick={() => onNavigate({ kind: "segment", segment: "about" })}
                className="text-[12.5px] text-[#565656] transition hover:text-nbc-navy hover:underline"
              >
                {link.label}
              </button>
            ))}
            <span className="text-[#c5c5c5]" aria-hidden>|</span>
            <button
              type="button"
              onClick={() => onNavigate({ kind: "admin-login" })}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-nbc-navy transition hover:text-nbc-red hover:underline"
            >
              <LockIcon className="h-3 w-3" />
              Administration
            </button>
          </div>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="group flex w-fit items-center gap-2 text-[12.5px] font-semibold text-nbc-navy hover:text-nbc-red"
          >
            Back to top
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white shadow-sm transition group-hover:-translate-y-0.5">
              <ChevronDown className="h-3 w-3 rotate-180" />
            </span>
          </button>
        </div>
      </div>

      {/* Bottom Official Navy Copyright Bar */}
      <div className="bg-nbc-navy">
        <div className="nbc-container py-5">
          <p className="text-center text-[11px] uppercase leading-[18px] tracking-[0.08em] text-white/90">
            © NATIONAL BANK OF CANADA. All rights reserved 2026.
          </p>
          <p className="mx-auto mt-2 max-w-[860px] text-center text-[10.5px] leading-[16px] text-white/65">
            ® NATIONAL BANK, the NATIONAL BANK logo and BUILD SOMETHING. are registered trademarks of National Bank
            of Canada.
          </p>
        </div>
      </div>
    </footer>
  );
}
