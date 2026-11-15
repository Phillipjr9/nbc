import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BankUserProfile, PageRoute } from "../banking/bankingTypes";
import { resolveInternalRoute } from "../banking/routeMapper";
import {
  SUPPORT_BRAND,
  SUPPORT_PRESENCE,
  SUPPORT_SHORT_NAME,
  appendSupportMessage,
  formatSupportDay,
  formatSupportTime,
  isWithSpecialist,
  markSupportThreadRead,
  startSpecialistHandoff,
  supportThreadOf,
  unreadSupportCount,
} from "../banking/supportChat";
import { planSupportTurn } from "../banking/supportAssistant";
import {
  PUBLIC_QUICK_STARTS,
  answerPublicQuestion,
  publicGreeting,
  type PublicLink,
} from "../banking/publicAssistant";
import { ArrowRight, CloseIcon } from "./icons";

type Props = {
  /** The signed-in client, or `null` on the public site. */
  profile?: BankUserProfile | null;
  onUpdateProfile?: (updater: (prev: BankUserProfile) => BankUserProfile) => void;
  onNavigate?: (route: PageRoute) => void;
  /** Controlled open state (the header, footer and help pages all open this). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Open the conversation immediately (used by deep links and tests). */
  defaultOpen?: boolean;
};

const clientQuickStarts = [
  "I have a question about a transaction",
  "My card was declined",
  "I need help with a transfer",
];

type GuestMessage = {
  id: string;
  side: "client" | "support";
  body: string;
  createdAt: string;
  links?: PublicLink[];
};

type ChatItem = {
  id: string;
  mine: boolean;
  body: string;
  createdAt: string;
  read?: boolean;
  links?: PublicLink[];
};

const newId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const nowIso = () => new Date().toISOString();

/** Headset icon used by the "talk to a person" control. */
function SpecialistIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 13v-1a8 8 0 0 1 16 0v1M4 13a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2v-2Zm16 0a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2v-2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M17 18a4 4 0 0 1-4 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function SupportAvatar({ size = 36 }: { size?: number }) {
  return (
    <span
      className="flex flex-none items-center justify-center rounded-full bg-nbc-navy text-white"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-[58%] w-[58%]">
        <path
          d="M4 13v-1a8 8 0 1 1 16 0v1M4 13a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2v-2Zm16 0a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2v-2Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M17 18a4 4 0 0 1-4 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/**
 * The single Support conversation surface.
 *
 * It replaces the old pair of floating widgets ("Ask a question" plus
 * "Support"), which sat on top of each other in the bottom-right corner. There
 * is now one launcher, one panel and one place to type:
 *
 * - **Signed out** — answers general questions (rates, appointments, opening an
 *   account, card safety) and offers the relevant action links. Nothing is
 *   stored because there is no profile to store it on.
 * - **Signed in** — the message is answered from the client's own accounts and
 *   ledger first, then only escalated to the Support desk when it needs a human
 *   (see `supportAssistant.ts`). The thread lives on the profile, so it follows
 *   the client across devices.
 *
 * In both modes the correspondent is only ever "Support": no administrator
 * name, role, back-office label, bot or model is ever rendered or stored.
 */
export default function SupportChat({
  profile = null,
  onUpdateProfile,
  onNavigate,
  open,
  onOpenChange,
  defaultOpen = false,
}: Props) {
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const isOpen = open ?? innerOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      setInnerOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange]
  );

  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [guestMessages, setGuestMessages] = useState<GuestMessage[]>([]);
  const seededGuest = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    },
    []
  );

  const thread = useMemo(() => (profile ? supportThreadOf(profile) : []), [profile]);
  const unread = profile ? unreadSupportCount(profile, "client") : 0;
  /** True once the client asked for a person: the assistant stops answering. */
  const withSpecialist = isWithSpecialist(profile);
  const items: ChatItem[] = useMemo(() => {
    if (profile) {
      return thread.map((message) => ({
        id: message.id,
        mine: message.side === "client",
        body: message.body,
        createdAt: message.createdAt,
        read: message.readBySupport,
      }));
    }
    return guestMessages.map((message) => ({
      id: message.id,
      mine: message.side === "client",
      body: message.body,
      createdAt: message.createdAt,
      links: message.links,
    }));
  }, [profile, thread, guestMessages]);

  /** Opens the conversation with a greeting for signed-out visitors. */
  useEffect(() => {
    if (!isOpen || profile || seededGuest.current) return;
    seededGuest.current = true;
    setGuestMessages([
      { id: "guest-greeting", side: "support", body: publicGreeting(), createdAt: nowIso() },
    ]);
  }, [isOpen, profile]);

  /** Clears the customer's unread badge once the conversation is on screen. */
  const markRead = useCallback(() => {
    if (!onUpdateProfile) return;
    onUpdateProfile((prev) => {
      const result = markSupportThreadRead(prev, "client");
      return result.changed ? result.profile : prev;
    });
  }, [onUpdateProfile]);

  useEffect(() => {
    if (isOpen && profile) markRead();
  }, [isOpen, profile, items.length, markRead]);

  // Keep the newest message in view.
  useEffect(() => {
    if (!isOpen) return;
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [isOpen, items.length, typing]);

  // Escape closes the panel, like the other overlays in the app.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, setOpen]);

  /** Opens an action link from an answer (internal route or in-page anchor). */
  const followLink = (link: PublicLink) => {
    setOpen(false);
    if (link.href.startsWith("#")) {
      onNavigate?.({ kind: "home" });
      const target = link.href.slice(1);
      window.setTimeout(() => {
        document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
      return;
    }
    onNavigate?.(resolveInternalRoute(link.href, link.label));
  };

  /**
   * Sends a message.
   *
   * Signed in: the support assistant answers first, from the client's own data,
   * and marks the message `awaitingDesk` only when it cannot resolve it — that
   * flag is what raises the desk badge and the notification chime.
   * Signed out: the public answers in `publicAssistant.ts` reply instead.
   */
  const send = (raw?: string) => {
    const body = (raw ?? draft).trim();
    // A second message is never blocked by the assistant's "typing" beat: people
    // type faster than a canned reply, and holding their words back felt like
    // the conversation had stalled.
    if (!body) return;

    if (!profile) {
      const answer = answerPublicQuestion(body);
      setGuestMessages((prev) => [
        ...prev,
        { id: newId(), side: "client", body, createdAt: nowIso() },
      ]);
      setDraft("");
      setTyping(true);

      const delay = 550 + Math.min(700, body.length * 8);
      const timer = window.setTimeout(() => {
        setGuestMessages((prev) => [
          ...prev,
          {
            id: newId(),
            side: "support",
            body: answer.reply,
            links: answer.links,
            createdAt: nowIso(),
          },
        ]);
        setTyping(false);
      }, delay);
      timers.current.push(timer);
      return;
    }

    if (!onUpdateProfile) return;

    const plan = planSupportTurn(profile, body, thread);
    onUpdateProfile((prev) => appendSupportMessage(prev, "client", body, { awaitingDesk: plan.awaitingDesk }));
    setDraft("");

    // Straight to the desk: no assistant beat, no invented reply.
    if (!plan.reply) return;

    setTyping(true);

    // A short "typing" beat keeps the conversation feeling live. If the client
    // is already mid-conversation the reply lands right away instead of queueing
    // another beat on top of the first.
    const delay = typing ? 120 : 700 + Math.min(900, body.length * 12);
    const timer = window.setTimeout(() => {
      onUpdateProfile((prev) => appendSupportMessage(prev, "support", plan.reply as string, { automated: true }));
      setTyping(false);
    }, delay);
    timers.current.push(timer);
  };

  /**
   * Hands the conversation to a person: the request is stored as a client
   * message that needs the desk, and every later message skips the assistant.
   */
  const talkToSpecialist = () => {
    if (!onUpdateProfile) return;
    onUpdateProfile((prev) => startSpecialistHandoff(prev));
    window.setTimeout(() => inputRef.current?.focus(), 80);
  };

  const quickStarts = profile ? clientQuickStarts : PUBLIC_QUICK_STARTS;
  const presence = profile ? SUPPORT_PRESENCE : "Online · answers 24/7";

  return (
    <>
      {/* Launcher — the only floating entry point in the app */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            window.setTimeout(() => inputRef.current?.focus(), 120);
          }}
          aria-label={`Open ${SUPPORT_BRAND} chat${unread > 0 ? `, ${unread} unread message` : ""}`}
          className="fixed bottom-5 right-4 z-[60] flex items-center gap-2.5 rounded-full bg-nbc-navy py-3 pl-3 pr-4 text-white shadow-[0_10px_30px_rgba(0,49,77,0.28)] transition hover:bg-nbc-red sm:bottom-6 sm:right-6"
        >
          <span className="relative">
            <SupportAvatar size={32} />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-nbc-red px-1 text-[10px] font-bold ring-2 ring-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </span>
          <span className="text-[13.5px] font-semibold">{SUPPORT_SHORT_NAME}</span>
        </button>
      )}

      {/* Conversation */}
      {isOpen && (
        <section
          role="dialog"
          aria-modal="false"
          aria-label={`${SUPPORT_BRAND} conversation`}
          className="fixed inset-x-0 bottom-0 z-[70] flex h-[86vh] flex-col overflow-hidden rounded-t-[14px] border border-[#e0dcd2] bg-white shadow-[0_18px_50px_rgba(0,49,77,0.3)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[600px] sm:w-[392px] sm:rounded-[14px]"
        >
          <header className="flex items-center gap-3 bg-nbc-navy px-4 py-3.5 text-white">
            <SupportAvatar size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-bold leading-tight">{SUPPORT_BRAND}</p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11.5px] text-white/80">
                <span className="inline-block h-1.5 w-1.5 flex-none rounded-full bg-[#4ade80]" />
                {presence}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close support chat"
              className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </header>

          {profile &&
            (withSpecialist ? (
              <p className="flex items-center justify-center gap-1.5 border-b border-[#dcefdf] bg-[#f1fbf3] px-3 py-2 text-[11px] font-semibold text-[#1d6b37]">
                <span className="h-1.5 w-1.5 flex-none rounded-full bg-[#22c55e]" />
                You&rsquo;re with a specialist &mdash; replies can take a few minutes
              </p>
            ) : (
              <button
                type="button"
                onClick={talkToSpecialist}
                className="flex w-full items-center justify-center gap-2 border-b border-[#ece8df] bg-[#fdfbf6] px-3 py-2 text-[11.5px] font-semibold text-nbc-navy transition hover:bg-[#f5f0e5]"
              >
                <SpecialistIcon />
                Talk to a person now
              </button>
            ))}

          <div
            ref={listRef}
            className="flex-1 space-y-3 overflow-y-auto bg-[#f5f3ee] px-3.5 py-4"
            aria-live="polite"
          >
            <p className="mx-auto max-w-[280px] rounded-[6px] bg-white/80 px-3 py-2 text-center text-[11px] leading-[16px] text-[#6b6b6b]">
              This is a private conversation with {SUPPORT_BRAND}. We never ask for your password, PIN or
              verification codes.
            </p>

            {profile && thread.length === 0 && (
              <div className="rounded-[8px] bg-white p-3.5 shadow-sm">
                <p className="text-[13px] font-semibold text-nbc-navy">
                  Hi {profile.fullName.split(" ")[0]},
                </p>
                <p className="mt-1 text-[12.5px] leading-[19px] text-[#565656]">
                  How can we help today? Tell us what is happening and our Support team will take it from
                  there.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {quickStarts.map((start) => (
                    <button
                      key={start}
                      type="button"
                      onClick={() => send(start)}
                      className="rounded-full border border-[#cfc9bc] px-2.5 py-1 text-[11.5px] font-medium text-nbc-navy transition hover:border-nbc-navy hover:bg-[#fcfbf8]"
                    >
                      {start}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={talkToSpecialist}
                    className="inline-flex items-center gap-1.5 rounded-full border border-nbc-navy px-2.5 py-1 text-[11.5px] font-semibold text-nbc-navy transition hover:bg-nbc-navy hover:text-white"
                  >
                    <SpecialistIcon className="h-3 w-3" />
                    Talk to a person
                  </button>
                </div>
              </div>
            )}

            {items.map((item, index) => {
              const previous = items[index - 1];
              const showDay =
                !previous || formatSupportDay(previous.createdAt) !== formatSupportDay(item.createdAt);

              return (
                <div key={item.id}>
                  {showDay && (
                    <p className="my-3 text-center text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8a8a8a]">
                      {formatSupportDay(item.createdAt)}
                    </p>
                  )}
                  <div className={`flex ${item.mine ? "justify-end" : "justify-start"} gap-2`}>
                    {!item.mine && <SupportAvatar size={24} />}
                    <div
                      className={`max-w-[78%] rounded-[10px] px-3 py-2 shadow-sm ${
                        item.mine
                          ? "rounded-br-[3px] bg-[#d9fdd3] text-[#0b2e13]"
                          : "rounded-bl-[3px] bg-white text-[#1a1a1a]"
                      }`}
                    >
                      {!item.mine && (
                        <p className="mb-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-nbc-red">
                          {SUPPORT_SHORT_NAME}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words text-[13px] leading-[19px]">{item.body}</p>

                      {item.links && item.links.length > 0 && (
                        <div className="mt-2 flex flex-col items-start gap-1.5 border-t border-black/10 pt-2">
                          {item.links.map((link) => (
                            <button
                              key={link.label}
                              type="button"
                              onClick={() => followLink(link)}
                              className="inline-flex items-center gap-1.5 text-left text-[12px] font-semibold text-nbc-link hover:underline"
                            >
                              {link.label}
                              <ArrowRight className="h-2.5 w-2.5" />
                            </button>
                          ))}
                        </div>
                      )}

                      <p
                        className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                          item.mine ? "text-[#4a7c54]" : "text-[#8a8a8a]"
                        }`}
                      >
                        <span className="tabular-nums">{formatSupportTime(item.createdAt)}</span>
                        {item.mine && (
                          <span
                            aria-label={item.read ? "Read" : "Sent"}
                            title={item.read ? "Read" : "Sent"}
                            className={item.read ? "text-[#1572C5]" : "text-[#4a7c54]"}
                          >
                            {item.read ? "✓✓" : "✓"}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {typing && (
              <div className="flex items-center gap-2 pl-1" aria-live="polite">
                <SupportAvatar size={24} />
                <span className="flex items-center gap-1 rounded-[10px] rounded-bl-[3px] bg-white px-3 py-2 shadow-sm">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#b9b3a7]"
                      style={{ animationDelay: `${dot * 120}ms` }}
                    />
                  ))}
                  <span className="ml-1 text-[10.5px] text-[#8a8a8a]">{SUPPORT_SHORT_NAME} is typing…</span>
                </span>
              </div>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
            className="border-t border-[#e7e3d9] bg-white px-3 py-2.5"
          >
            {/* Signed-out visitors get the topic shortcuts inline; signed-in
                clients get them in the empty-state card above. */}
            {!profile && (
              <div className="nice-scroll mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
                {quickStarts.map((start) => (
                  <button
                    key={start}
                    type="button"
                    onClick={() => send(start)}
                    className="flex-none rounded-full border border-[#d9d4c9] bg-[#fbfaf6] px-2.5 py-1 text-[11.5px] font-medium text-nbc-navy transition hover:border-nbc-red hover:text-nbc-red"
                  >
                    {start}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Write a message…"
                aria-label="Message to support"
                className="max-h-28 min-h-[42px] flex-1 resize-none rounded-[20px] border border-[#d8d3c7] px-3.5 py-2.5 text-[13px] text-[#121212] outline-none transition focus:border-nbc-navy"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="Send message"
                className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full bg-nbc-red text-white transition enabled:hover:bg-nbc-red-dark disabled:opacity-40"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 px-1 text-[10.5px] leading-[15px] text-[#8a8a8a]">
              {profile && withSpecialist ? (
                <>
                  You&rsquo;re chatting with a specialist. Messages are saved to your profile so you can pick
                  up on any device.
                </>
              ) : (
                <>
                  {profile
                    ? `${SUPPORT_SHORT_NAME} replies instantly and can bring in a specialist at any time. Saved to your profile.`
                    : `${SUPPORT_SHORT_NAME} answers 24/7. Sign in and we can look at your own file.`}{" "}
                  <span className="whitespace-nowrap">Automated assistance may be used.</span>
                </>
              )}
            </p>
          </form>
        </section>
      )}
    </>
  );
}
