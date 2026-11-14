import { useEffect, useMemo, useRef, useState } from "react";
import { PageRoute } from "../banking/bankingTypes";
import { resolveInternalRoute } from "../banking/routeMapper";
import { searchIndex } from "../data";
import { ArrowRight, CloseIcon, SearchIcon } from "./icons";

const popular = ["Sign in", "Become a client", "Interest rates", "Mortgage pre-approval", "Cash Advantage Solution – 3%"];

const extraAuthItems = [
  { label: "Sign in to Online Bank", category: "Account Access", href: "app.bnc.ca" },
  { label: "Become a client — Sign up online", category: "Account Opening", href: "switch-national-bank" },
  { label: "Book an advisor appointment", category: "Support", href: "appointment" },
];

export default function SearchDialog({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (route: PageRoute) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  const combinedIndex = useMemo(() => [...extraAuthItems, ...searchIndex], []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return combinedIndex
      .filter((item) => item.label.toLowerCase().includes(q) || item.category.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, combinedIndex]);

  if (!open) return null;

  const pickItem = (href: string, label: string) => {
    onClose();
    onNavigate(resolveInternalRoute(href, label));
  };

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="Search on the site">
      <button
        type="button"
        aria-label="Close search"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-[#001e2e]/55 backdrop-blur-[2px]"
      />
      <div className="relative mx-auto mt-[7vh] w-[calc(100%-32px)] max-w-[820px] animate-fade-up overflow-hidden rounded-md bg-white shadow-2xl">
        <div className="flex items-center gap-4 border-b border-nbc-line px-5 py-4 sm:px-7 sm:py-5">
          <SearchIcon className="h-5 w-5 flex-none text-nbc-navy" />
          <label htmlFor="nbc-search" className="sr-only">
            Search on the site
          </label>
          <input
            id="nbc-search"
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, calculators, sign in, or sign up…"
            className="min-w-0 flex-1 border-0 bg-transparent text-[17px] text-nbc-navy outline-none placeholder:text-[#8b8b8b]"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="grid h-9 w-9 flex-none place-items-center rounded-full text-nbc-ink transition hover:bg-nbc-grey"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="nice-scroll max-h-[62vh] overflow-y-auto px-5 py-6 sm:px-7">
          {!query && (
            <>
              <p className="mb-4 font-semibold text-[11px] uppercase tracking-[0.14em] text-nbc-ink/70">
                Popular actions & searches
              </p>
              <div className="flex flex-wrap gap-2">
                {popular.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setQuery(item.replace(" – ", " "))}
                    className="rounded-full border border-[#d8d4cb] bg-nbc-beige-soft px-4 py-2 text-[13.5px] text-nbc-navy transition hover:border-nbc-red hover:text-nbc-red"
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="mt-7 grid gap-x-6 gap-y-1 border-t border-nbc-line pt-5 sm:grid-cols-2">
                {[...extraAuthItems, ...searchIndex.slice(12, 17)].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => pickItem(item.href, item.label)}
                    className="group flex items-center justify-between gap-3 border-b border-[#f0f0f0] py-2.5 text-left text-[14px] text-nbc-navy"
                  >
                    <span className="truncate">{item.label}</span>
                    <ArrowRight className="h-3 w-3 flex-none text-[#9a9a9a] transition group-hover:translate-x-0.5 group-hover:text-nbc-red" />
                  </button>
                ))}
              </div>
            </>
          )}

          {query && (
            <>
              <p className="mb-3 font-semibold text-[11px] uppercase tracking-[0.14em] text-nbc-ink/70">
                {results.length} result{results.length === 1 ? "" : "s"} for “{query.trim()}”
              </p>
              {results.length === 0 ? (
                <div className="rounded-md bg-nbc-beige-soft px-5 py-8 text-center">
                  <p className="font-semibold text-nbc-navy">No results found</p>
                  <p className="mt-1 text-sm text-nbc-ink">
                    Try “sign in”, “sign up”, “mortgage”, “TFSA” or “credit card”.
                  </p>
                </div>
              ) : (
                <ul>
                  {results.map((item) => (
                    <li key={item.label}>
                      <button
                        type="button"
                        onClick={() => pickItem(item.href, item.label)}
                        className="group flex w-full items-start justify-between gap-4 rounded-sm px-2 py-3 text-left transition hover:bg-nbc-beige-soft"
                      >
                        <span>
                          <span className="block text-[15px] font-medium text-nbc-navy group-hover:text-nbc-red">
                            {item.label}
                          </span>
                          <span className="mt-0.5 block text-xs uppercase tracking-wide text-[#8a8a8a]">
                            {item.category}
                          </span>
                        </span>
                        <ArrowRight className="mt-1 h-3.5 w-3.5 flex-none text-[#9a9a9a] transition group-hover:translate-x-0.5 group-hover:text-nbc-red" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-nbc-line bg-[#fafafa] px-5 py-3 text-xs text-nbc-ink sm:px-7">
          <span>
            In-app search · <span className="font-semibold text-nbc-navy">National Bank Digital Portal</span>
          </span>
          <span className="hidden sm:inline">
            Press <kbd className="rounded border border-[#d5d5d5] bg-white px-1.5 py-0.5 text-[10px]">Esc</kbd> to
            close
          </span>
        </div>
      </div>
    </div>
  );
}
