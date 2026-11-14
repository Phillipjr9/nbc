import { useEffect, useRef, useState } from "react";
import { logoBnMark, pictoBullesClavardage } from "../assets/nbcAssets";
import { PageRoute } from "../banking/bankingTypes";
import { resolveInternalRoute } from "../banking/routeMapper";
import { ArrowRight, CloseIcon } from "./icons";

type Link = { label: string; href: string };
type Message = { id: number; role: "bot" | "user"; text: string; links?: Link[]; time: string };

const quickReplies = ["Today's rates", "Book an appointment", "Lost or stolen card", "Open an account"];

const now = () =>
  new Date().toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", hour12: true });

function replyFor(raw: string): { text: string; links?: Link[] } {
  const q = raw.toLowerCase();

  if (/(rate|interest|prime|mortgage rate|saving rate)/.test(q)) {
    return {
      text:
        "Here are our current reference rates:\n• Prime rate: 4.70%\n• 5-year fixed mortgage: 5.14%\n• Cash Advantage Solution: 3% promotional rate\n\nRates are subject to change. Would you like to compare our savings solutions?",
      links: [
        { label: "See all rates", href: "https://www.nbc.ca/rates.html" },
        { label: "Cash Advantage Solution", href: "https://www.nbc.ca/personal/savings-investments/solutions/cash-solution.html" },
      ],
    };
  }
  if (/(appointment|advisor|meet|book|branch|in person)/.test(q)) {
    return {
      text:
        "I can help you book time with an advisor. Appointments are available by phone, video or in branch, usually within 2 business days.",
      links: [
        { label: "Make an appointment", href: "https://www.nbc.ca/contact-us.html" },
        { label: "Find a branch", href: "https://www.nbc.ca/contact-us.html" },
      ],
    };
  }
  if (/(lost|stolen|card.*(block|freeze)|fraud|scam|phishing)/.test(q)) {
    return {
      text:
        "Let's protect your account right away. Lock your card in the National Bank app, or call us 24/7 at 1-888-835-6281 (Canada/U.S.) or 1-514-394-5000 (elsewhere).\n\nNever share your password or verification codes — we will never ask for them.",
      links: [
        { label: "Fraud prevention tips", href: "https://www.nbc.ca/personal/advice/security.html" },
        { label: "Report a lost or stolen card", href: "https://www.nbc.ca/contact-us.html" },
      ],
    };
  }
  if (/(open|account|switch|new client|newcomer|join)/.test(q)) {
    return {
      text:
        "Great — opening an account takes about 10 minutes online. You'll need a piece of government-issued ID and your contact details. Newcomers to Canada can also open an account before arriving.",
      links: [
        { label: "Choose an account", href: "https://www.nbc.ca/personal/accounts.html" },
        { label: "Become a client", href: "https://www.nbc.ca/personal/switch-national-bank.html" },
        { label: "Newcomers to Canada", href: "https://www.nbc.ca/personal/newcomers.html" },
      ],
    };
  }
  if (/(mortgage|home|pre-?approv|house|property)/.test(q)) {
    return {
      text:
        "A mortgage pre-approval gives you a clear budget and a rate hold for up to 120 days. Our mobile mortgage specialists can meet you wherever suits you.",
      links: [
        { label: "Get pre-approved", href: "https://www.nbc.ca/personal/mortgages/pre-approval.html" },
        { label: "Mortgage calculator", href: "https://www.nbc.ca/personal/tools/calculators.html" },
      ],
    };
  }
  if (/(credit card|mastercard|allure|cashback)/.test(q)) {
    return {
      text:
        "We offer Mastercard options for everyday rewards, travel and students. The Allure Mastercard also supports breast cancer research with every purchase.",
      links: [
        { label: "Compare credit cards", href: "https://www.nbc.ca/personal/mastercard-credit-cards.html" },
        { label: "Allure Mastercard", href: "https://www.nbc.ca/personal/mastercard-credit-cards/allure.html" },
      ],
    };
  }
  if (/(sign ?in|login|online bank|password|access)/.test(q)) {
    return {
      text:
        "You can sign in to your personal or business online bank from the top of every page. If you've forgotten your password, use the “Forgot password” link on the sign-in screen.",
      links: [
        { label: "Sign in to online bank", href: "https://app.bnc.ca/?lang=en" },
        { label: "Help centre", href: "https://www.nbc.ca/help.html" },
      ],
    };
  }
  if (/(thanks|thank you|perfect|great|merci)/.test(q)) {
    return {
      text: "You're welcome! Is there anything else I can help you with today?",
    };
  }

  return {
    text:
      "I'm not sure I understood that one. I can help with accounts, mortgages, savings and rates, credit cards, fraud prevention or booking an advisor. You can also reach a person 7 days a week.",
    links: [
      { label: "Visit the Help centre", href: "https://www.nbc.ca/help.html" },
      { label: "Contact us", href: "https://www.nbc.ca/contact-us.html" },
    ],
  };
}

export default function Chatbot({
  open,
  onOpen,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onNavigate: (route: PageRoute) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "bot",
      text:
        "Hi! I'm the National Bank virtual assistant. Ask me about accounts, mortgages, rates or fraud prevention — 24/7.",
      time: now(),
      links: [{ label: "Browse our banking services", href: "#services-title" }],
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing, open]);

  const send = (text: string) => {
    const clean = text.trim();
    if (!clean || typing) return;
    setMessages((prev) => [...prev, { id: Date.now(), role: "user", text: clean, time: now() }]);
    setInput("");
    setTyping(true);
    window.setTimeout(() => {
      const reply = replyFor(clean);
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "bot", text: reply.text, links: reply.links, time: now() },
      ]);
      setTyping(false);
    }, 750);
  };

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        aria-label="Message our virtual assistant"
        aria-hidden={open}
        tabIndex={open ? -1 : 0}
        className={`fixed bottom-5 right-4 z-[60] flex items-center gap-2.5 rounded-full border border-[#e3dfd6] bg-white py-2.5 pl-3 pr-5 font-semibold text-nbc-navy shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition hover:border-nbc-red hover:shadow-[0_10px_28px_rgba(0,0,0,0.22)] sm:bottom-6 sm:right-6 ${
          open ? "pointer-events-none scale-90 opacity-0" : "scale-100 opacity-100"
        }`}
      >
        <img
          src={pictoBullesClavardage}
          alt=""
          aria-hidden
          width={32}
          height={32}
          className="h-8 w-8 object-contain"
        />
        <span className="hidden text-[13.5px] sm:block">Ask a question</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="chat-title"
          className="fixed inset-x-0 bottom-0 z-[80] flex h-[86vh] animate-fade-up flex-col overflow-hidden rounded-t-[14px] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.28)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[600px] sm:max-h-[calc(100vh-48px)] sm:w-[392px] sm:rounded-[10px]"
        >
          <div className="flex items-center justify-between gap-3 bg-nbc-navy px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <span className="relative grid h-10 w-10 place-items-center rounded-full bg-white p-2">
                <img src={logoBnMark} alt="National Bank" className="h-full w-full object-contain" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-nbc-navy bg-[#01b64b]" />
              </span>
              <div>
                <p id="chat-title" className="text-[14.5px] font-semibold leading-[19px]">
                  Virtual assistant
                </p>
                <p className="text-[11.5px] text-white/75">Online · answers 24/7</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close chat"
              className="grid h-9 w-9 place-items-center rounded-full text-white/85 transition hover:bg-white/15 hover:text-white"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="nice-scroll flex-1 space-y-4 overflow-y-auto bg-[#f7f6f2] px-4 py-5">
            <p className="text-center text-[10.5px] uppercase tracking-[0.12em] text-[#8c8c8c]">Today</p>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[86%] whitespace-pre-line rounded-[10px] px-4 py-3 text-[13.5px] leading-[21px] shadow-sm ${
                    msg.role === "user"
                      ? "rounded-br-[3px] bg-nbc-red text-white"
                      : "rounded-bl-[3px] border border-[#e7e3d9] bg-white text-[#333]"
                  }`}
                >
                  {msg.text}
                  {msg.links && (
                    <div className="mt-3 flex flex-col items-start gap-1.5 border-t border-[#efefef] pt-2.5">
                      {msg.links.map((link) => (
                        <button
                          key={link.label}
                          type="button"
                          onClick={() => {
                            onClose();
                            if (link.href.startsWith("#")) {
                              onNavigate({ kind: "home" });
                              window.setTimeout(() => {
                                document
                                  .getElementById(link.href.slice(1))
                                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
                              }, 80);
                            } else {
                              onNavigate(resolveInternalRoute(link.href, link.label));
                            }
                          }}
                          className="inline-flex items-center gap-1.5 text-left text-[12.5px] font-semibold text-nbc-link hover:underline"
                        >
                          {link.label}
                          <ArrowRight className="h-2.5 w-2.5" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span className="mt-1 px-1 text-[10px] text-[#9a9a9a]">{msg.time}</span>
              </div>
            ))}
            {typing && (
              <div className="flex w-fit items-center gap-1.5 rounded-[10px] rounded-bl-[3px] border border-[#e7e3d9] bg-white px-4 py-3.5 shadow-sm">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#a8a8a8]"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
                <span className="sr-only">Assistant is typing</span>
              </div>
            )}
          </div>

          <div className="border-t border-[#e5e1d7] bg-white px-4 pb-3 pt-3">
            <div className="nice-scroll mb-2.5 flex gap-2 overflow-x-auto pb-0.5">
              {quickReplies.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="flex-none rounded-full border border-[#d9d4c9] bg-[#fbfaf6] px-3 py-1.5 text-[12px] font-medium text-nbc-navy transition hover:border-nbc-red hover:text-nbc-red"
                >
                  {q}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2 rounded-full border border-[#d6d2c8] bg-white py-1.5 pl-4 pr-1.5 focus-within:border-nbc-navy"
            >
              <label htmlFor="chat-input" className="sr-only">
                Write a message
              </label>
              <input
                id="chat-input"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Write a message…"
                className="min-w-0 flex-1 bg-transparent text-[13.5px] text-[#333] outline-none placeholder:text-[#9b9b9b]"
                autoComplete="off"
              />
              <button
                type="submit"
                aria-label="Send message"
                disabled={!input.trim()}
                className="grid h-9 w-9 flex-none place-items-center rounded-full bg-nbc-red text-white transition hover:bg-nbc-red-dark disabled:cursor-not-allowed disabled:bg-[#d6d2c8]"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
            <p className="mt-2 text-center text-[10px] leading-[14px] text-[#9a9a9a]">
              Virtual assistant · For account-specific help, sign in or call 1-888-835-6281.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
