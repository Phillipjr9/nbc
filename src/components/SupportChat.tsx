import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BankUserProfile } from "../banking/bankingTypes";
import {
  SUPPORT_AUTO_ACK,
  SUPPORT_BRAND,
  SUPPORT_PRESENCE,
  SUPPORT_SHORT_NAME,
  appendSupportMessage,
  formatSupportDay,
  formatSupportTime,
  markSupportThreadRead,
  supportThreadOf,
  unreadSupportCount,
} from "../banking/supportChat";
import { ArrowRight, CloseIcon } from "./icons";

type Props = {
  profile: BankUserProfile;
  onUpdateProfile: (updater: (prev: BankUserProfile) => BankUserProfile) => void;
  /** Open the conversation immediately (used by deep links and tests). */
  defaultOpen?: boolean;
};

const quickStarts = [
  "I have a question about a transaction",
  "My card was declined",
  "I need help with a transfer",
];

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
 * Customer-facing support conversation.
 *
 * Deliberately written from the customer's point of view: the correspondent is
 * always shown as "Support". No administrator name, role, back-office label or
 * internal note is rendered here — see `supportChat.ts` for the same rule on the
 * data side.
 */
export default function SupportChat({ profile, onUpdateProfile, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const autoAckSent = useRef(false);

  const thread = useMemo(() => supportThreadOf(profile), [profile]);
  const unread = unreadSupportCount(profile, "client");

  /** Clears the customer's unread badge once the conversation is on screen. */
  const markRead = useCallback(() => {
    onUpdateProfile((prev) => {
      const result = markSupportThreadRead(prev, "client");
      return result.changed ? result.profile : prev;
    });
  }, [onUpdateProfile]);

  useEffect(() => {
    if (open) markRead();
  }, [open, thread.length, markRead]);

  // Keep the newest message in view.
  useEffect(() => {
    if (!open) return;
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [open, thread.length]);

  // Escape closes the panel, like the other overlays in the app.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const send = (raw?: string) => {
    const body = (raw ?? draft).trim();
    if (!body || sending) return;

    const hasSupportReply = thread.some((message) => message.side === "support");
    onUpdateProfile((prev) => appendSupportMessage(prev, "client", body));
    setDraft("");
    setSending(true);
    window.setTimeout(() => setSending(false), 400);

    // First contact gets an immediate, clearly-support acknowledgement so the
    // customer knows the message landed — no mention of who is on the other end.
    if (!hasSupportReply && !autoAckSent.current) {
      autoAckSent.current = true;
      window.setTimeout(() => {
        onUpdateProfile((prev) => {
          if (supportThreadOf(prev).some((message) => message.side === "support")) return prev;
          return appendSupportMessage(prev, "support", SUPPORT_AUTO_ACK, { automated: true });
        });
      }, 900);
    }
  };

  const lastSupportMessage = [...thread].reverse().find((message) => message.side === "support");

  return (
    <>
      {/* Launcher */}
      {!open && (
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
      {open && (
        <section
          role="dialog"
          aria-modal="false"
          aria-label={`${SUPPORT_BRAND} conversation`}
          className="fixed inset-x-0 bottom-0 z-[60] flex h-[86vh] flex-col overflow-hidden rounded-t-[14px] border border-[#e0dcd2] bg-white shadow-[0_18px_50px_rgba(0,49,77,0.3)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[600px] sm:w-[392px] sm:rounded-[14px]"
        >
          <header className="flex items-center gap-3 bg-nbc-navy px-4 py-3.5 text-white">
            <SupportAvatar size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-bold leading-tight">{SUPPORT_BRAND}</p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11.5px] text-white/80">
                <span className="inline-block h-1.5 w-1.5 flex-none rounded-full bg-[#4ade80]" />
                {SUPPORT_PRESENCE}
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

          <div
            ref={listRef}
            className="flex-1 space-y-3 overflow-y-auto bg-[#f5f3ee] px-3.5 py-4"
            aria-live="polite"
          >
            <p className="mx-auto max-w-[280px] rounded-[6px] bg-white/80 px-3 py-2 text-center text-[11px] leading-[16px] text-[#6b6b6b]">
              This is a private conversation with {SUPPORT_BRAND}. We never ask for your password, PIN or
              verification codes.
            </p>

            {thread.length === 0 && (
              <div className="rounded-[8px] bg-white p-3.5 shadow-sm">
                <p className="text-[13px] font-semibold text-nbc-navy">Hi {profile.fullName.split(" ")[0]},</p>
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
                </div>
              </div>
            )}

            {thread.map((message, index) => {
              const previous = thread[index - 1];
              const showDay =
                !previous || formatSupportDay(previous.createdAt) !== formatSupportDay(message.createdAt);
              const mine = message.side === "client";

              return (
                <div key={message.id}>
                  {showDay && (
                    <p className="my-3 text-center text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8a8a8a]">
                      {formatSupportDay(message.createdAt)}
                    </p>
                  )}
                  <div className={`flex ${mine ? "justify-end" : "justify-start"} gap-2`}>
                    {!mine && <SupportAvatar size={24} />}
                    <div
                      className={`max-w-[78%] rounded-[10px] px-3 py-2 shadow-sm ${
                        mine
                          ? "rounded-br-[3px] bg-[#d9fdd3] text-[#0b2e13]"
                          : "rounded-bl-[3px] bg-white text-[#1a1a1a]"
                      }`}
                    >
                      {!mine && (
                        <p className="mb-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-nbc-red">
                          {SUPPORT_SHORT_NAME}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words text-[13px] leading-[19px]">{message.body}</p>
                      <p
                        className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                          mine ? "text-[#4a7c54]" : "text-[#8a8a8a]"
                        }`}
                      >
                        <span className="tabular-nums">{formatSupportTime(message.createdAt)}</span>
                        {mine && (
                          <span
                            aria-label={message.readBySupport ? "Read" : "Sent"}
                            title={message.readBySupport ? "Read" : "Sent"}
                            className={message.readBySupport ? "text-[#1572C5]" : "text-[#4a7c54]"}
                          >
                            {message.readBySupport ? "✓✓" : "✓"}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {sending && (
              <p className="pl-8 text-[10.5px] italic text-[#8a8a8a]">{SUPPORT_SHORT_NAME} is receiving your message…</p>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
            className="border-t border-[#e7e3d9] bg-white px-3 py-2.5"
          >
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
            <p className="mt-1.5 px-1 text-[10.5px] text-[#8a8a8a]">
              {lastSupportMessage
                ? `${SUPPORT_SHORT_NAME} usually replies within a few minutes. This conversation is saved to your profile.`
                : "Messages are saved to your profile so you can pick up where you left off on any device."}
            </p>
          </form>
        </section>
      )}
    </>
  );
}
