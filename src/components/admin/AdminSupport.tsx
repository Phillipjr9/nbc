import { useEffect, useMemo, useRef, useState } from "react";
import type { AdminPanelProps } from "../../banking/adminOps";
import {
  appendSupportMessage,
  formatSupportAge,
  formatSupportDay,
  formatSupportTime,
  markSupportThreadRead,
  needsSupportReply,
  supportThreadOf,
  unreadSupportCount,
} from "../../banking/supportChat";
import { draftDeskAssist } from "../../banking/supportAssistant";
import { playSupportSentCue } from "../../lib/notificationSound";
import { ArrowRight, SearchIcon } from "../icons";

const replyTemplates = [
  "Thanks for confirming — I've applied the correction to your account and it will appear shortly.",
  "I can help with that. Could you confirm the account and the amount involved?",
  "That fee has been reversed as a goodwill gesture. It will post within 1–2 business days.",
  "Your card has been unlocked. Please let us know if the transaction still declines.",
];

/**
 * Back-office side of the client support conversation.
 *
 * Replies are written to the client's own profile as `side: "support"`, so the
 * customer only ever sees "Support". Nothing entered here is exposed to the
 * client except the message body.
 */
export default function AdminSupport({ ops, selectedKey, onSelectKey }: AdminPanelProps) {
  const [search, setSearch] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [draft, setDraft] = useState("");
  const [assistOpen, setAssistOpen] = useState(true);
  const listRef = useRef<HTMLDivElement | null>(null);

  const rows = useMemo(
    () =>
      ops.users
        .map((entry) => {
          const thread = supportThreadOf(entry.profile);
          return {
            key: entry.key,
            profile: entry.profile,
            name: entry.profile.fullName || entry.profile.email,
            email: entry.profile.email,
            role: entry.profile.roleLabel,
            status: entry.profile.status,
            thread,
            last: thread.length > 0 ? thread[thread.length - 1] : null,
            unread: unreadSupportCount(entry.profile, "support"),
            awaiting: needsSupportReply(entry.profile),
          };
        })
        .sort((a, b) => {
          // Waiting clients first, then most recent activity, then name.
          if (a.awaiting !== b.awaiting) return a.awaiting ? -1 : 1;
          const aTime = a.last?.createdAt ?? "";
          const bTime = b.last?.createdAt ?? "";
          if (aTime !== bTime) return aTime < bTime ? 1 : -1;
          return a.name.localeCompare(b.name);
        }),
    [ops.users]
  );

  const filtered = rows.filter((row) => {
    if (onlyUnread && row.unread === 0) return false;
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return (
      row.name.toLowerCase().includes(needle) ||
      row.email.toLowerCase().includes(needle) ||
      (row.last?.body ?? "").toLowerCase().includes(needle)
    );
  });

  const activeKey = filtered.some((row) => row.key === selectedKey) ? selectedKey : filtered[0]?.key ?? "";
  const active = rows.find((row) => row.key === activeKey) ?? null;
  const totalUnread = rows.reduce((sum, row) => sum + row.unread, 0);
  const awaitingCount = rows.filter((row) => row.awaiting).length;

  // Opening a conversation clears the desk's unread counter for that client.
  useEffect(() => {
    if (!active || active.unread === 0) return;
    ops.onUpdateUser(
      active.key,
      (prev) => {
        const result = markSupportThreadRead(prev, "support");
        return result.changed ? result.profile : prev;
      },
      "SUPPORT_THREAD_READ",
      `Opened the support conversation with ${active.name}`
    );
  }, [active?.key, active?.unread]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [active?.key, active?.thread.length]);

  const assistant = useMemo(
    () => (active ? draftDeskAssist(active.profile) : null),
    [active?.key, active?.thread.length] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const send = (body: string) => {
    const text = body.trim();
    if (!text || !active) return;
    ops.onUpdateUser(
      active.key,
      (prev) => appendSupportMessage(prev, "support", text),
      "SUPPORT_REPLY",
      `Support replied to ${active.name}`
    );
    setDraft("");
    playSupportSentCue();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[25px] font-bold text-nbc-navy sm:text-[28px]">Support inbox</h1>
          <p className="mt-1 text-[13.5px] text-[#565656]">
            Private conversations with clients. They see these messages as “National Bank Support”.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-nbc-navy ring-1 ring-[#e5e2da]">
            {totalUnread} unread · {awaitingCount} waiting
          </span>
          <button
            type="button"
            onClick={() => setOnlyUnread((prev) => !prev)}
            aria-pressed={onlyUnread}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
              onlyUnread ? "bg-nbc-navy text-white" : "border border-[#c9c3b6] bg-white text-nbc-navy hover:border-nbc-navy"
            }`}
          >
            {onlyUnread ? "Showing unread" : "Only unread"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Thread list */}
        <div className="overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white lg:col-span-4">
          <div className="border-b border-[#efefef] p-3">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999]" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search client or message…"
                aria-label="Search support conversations"
                className="w-full rounded-[6px] border border-[#d8d3c7] py-2 pl-9 pr-3 text-[13px] text-nbc-navy outline-none focus:border-nbc-navy"
              />
            </div>
          </div>
          <ul className="max-h-[520px] divide-y divide-[#f1efe9] overflow-y-auto">
            {filtered.length === 0 && (
              <li className="px-4 py-8 text-center text-[12.5px] text-[#777]">No conversations match.</li>
            )}
            {filtered.map((row) => {
              const isActive = row.key === activeKey;
              return (
                <li key={row.key}>
                  <button
                    type="button"
                    onClick={() => onSelectKey(row.key)}
                    className={`flex w-full items-start gap-2.5 px-3.5 py-3 text-left transition ${
                      isActive ? "bg-[#f4f1ea]" : "hover:bg-[#faf8f3]"
                    }`}
                  >
                    <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-nbc-navy text-[12px] font-bold text-white">
                      {(row.name || "?").slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[13px] font-semibold text-nbc-navy">{row.name}</span>
                        <span className="flex-none text-[10.5px] text-[#8a8a8a]">
                          {row.last ? formatSupportAge(row.last.createdAt) : "—"}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <span className="truncate text-[11.5px] text-[#6b6b6b]">
                          {row.last
                            ? `${row.last.side === "support" ? "You: " : ""}${row.last.body}`
                            : "No messages yet"}
                        </span>
                        {row.unread > 0 && (
                          <span className="flex h-4 min-w-4 flex-none items-center justify-center rounded-full bg-nbc-red px-1 text-[10px] font-bold text-white">
                            {row.unread}
                          </span>
                        )}
                      </span>
                      {row.awaiting && (
                        <span className="mt-1 inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-amber-900">
                          Needs reply
                        </span>
                      )}
                      {!row.awaiting && row.last?.side === "support" && row.last.automated && (
                        <span className="mt-1 inline-block rounded-full bg-sky-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-sky-800">
                          Handled by assistant
                        </span>
                      )}
                      {row.status === "frozen" && (
                        <span className="ml-1 mt-1 inline-block rounded-full bg-rose-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-rose-700">
                          On hold
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Conversation */}
        <div className="flex min-h-[520px] flex-col overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white lg:col-span-8">
          {!active ? (
            <p className="m-auto p-8 text-center text-[13px] text-[#777]">Select a client to open their conversation.</p>
          ) : (
            <>
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#efefef] px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-nbc-navy">{active.name}</p>
                  <p className="truncate text-[11.5px] text-[#777]">
                    {active.email} · {active.role}
                  </p>
                </div>
                <div className="flex flex-none items-center gap-2 text-[11px]">
                  <span className="rounded-full bg-[#f4f1ea] px-2.5 py-1 font-semibold text-[#565656]">
                    Client sees “National Bank Support”
                  </span>
                </div>
              </header>

              <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-[#faf8f3] px-4 py-4">
                {active.thread.length === 0 && (
                  <p className="mx-auto max-w-[330px] rounded-[6px] bg-white px-3 py-2.5 text-center text-[12px] leading-[18px] text-[#6b6b6b]">
                    No messages yet. Anything you send here appears in {active.name}&apos;s Support chat
                    immediately.
                  </p>
                )}

                {active.thread.map((message, index) => {
                  const previous = active.thread[index - 1];
                  const showDay =
                    !previous || formatSupportDay(previous.createdAt) !== formatSupportDay(message.createdAt);
                  const fromDesk = message.side === "support";

                  return (
                    <div key={message.id}>
                      {showDay && (
                        <p className="my-3 text-center text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8a8a8a]">
                          {formatSupportDay(message.createdAt)}
                        </p>
                      )}
                      <div className={`flex ${fromDesk ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[76%] rounded-[10px] px-3 py-2 shadow-sm ${
                            fromDesk
                              ? "rounded-br-[3px] bg-nbc-navy text-white"
                              : "rounded-bl-[3px] bg-white text-[#1a1a1a]"
                          }`}
                        >
                          <p
                            className={`mb-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${
                              fromDesk ? "text-white/70" : "text-nbc-red"
                            }`}
                          >
                            {fromDesk ? "You · Support" : active.name}
                            {message.automated && (
                              <span className="ml-1.5 rounded bg-white/20 px-1 py-0.5 text-[9px] font-semibold normal-case tracking-normal">
                                auto
                              </span>
                            )}
                          </p>
                          <p className="whitespace-pre-wrap break-words text-[12.5px] leading-[18px]">{message.body}</p>
                          <p
                            className={`mt-1 text-right text-[10px] tabular-nums ${
                              fromDesk ? "text-white/60" : "text-[#8a8a8a]"
                            }`}
                          >
                            {formatSupportTime(message.createdAt)}
                            {fromDesk && (
                              <span className="ml-1.5">{message.readByClient ? "· Read" : "· Delivered"}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-[#efefef] px-3 pb-3 pt-2">
                {assistant && (
                  <div className="mb-2 rounded-[6px] border border-[#dbe6f0] bg-[#f6f9fc] p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[#1572C5]">
                        <span aria-hidden="true">✨</span> Assistant briefing
                        <span className="rounded bg-white px-1.5 py-0.5 text-[9.5px] font-semibold normal-case tracking-normal text-[#565656]">
                          {assistant.intent} · {Math.round(assistant.confidence * 100)}% confident
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setAssistOpen((prev) => !prev)}
                        className="text-[11px] font-semibold text-[#1572C5] hover:underline"
                      >
                        {assistOpen ? "Hide" : "Show"}
                      </button>
                    </div>

                    {assistOpen && (
                      <>
                        <p className="mt-1.5 text-[11.5px] leading-[17px] text-[#334]">{assistant.summary}</p>

                        {assistant.tags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {assistant.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-white px-1.5 py-0.5 text-[9.5px] font-semibold text-[#565656] ring-1 ring-[#dbe6f0]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <p className="mt-2 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8a8a8a]">
                          Suggested reply
                        </p>
                        <p className="mt-1 whitespace-pre-wrap rounded-[4px] border border-[#e3edf6] bg-white px-2.5 py-2 text-[12px] leading-[18px] text-[#1a1a1a]">
                          {assistant.suggestedReply}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDraft(assistant.suggestedReply)}
                            className="rounded-full bg-nbc-navy px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-nbc-red"
                          >
                            Insert draft
                          </button>
                          <button
                            type="button"
                            onClick={() => send(assistant.suggestedReply)}
                            className="rounded-full border border-[#1572C5] px-2.5 py-1 text-[11px] font-semibold text-[#1572C5] transition hover:bg-[#eaf2fa]"
                          >
                            Send as-is
                          </button>
                          <button
                            type="button"
                            onClick={() => setAssistOpen(false)}
                            className="rounded-full border border-[#d8d3c7] px-2.5 py-1 text-[11px] font-semibold text-[#565656] transition hover:border-nbc-navy"
                          >
                            Discard
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="mb-2 flex flex-wrap gap-1.5">
                  {replyTemplates.map((template, index) => (
                    <button
                      key={template}
                      type="button"
                      onClick={() => setDraft(template)}
                      className="rounded-full border border-[#d8d3c7] px-2.5 py-1 text-[11px] text-[#565656] transition hover:border-nbc-navy hover:text-nbc-navy"
                    >
                      Template {index + 1}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    send(draft);
                  }}
                  className="flex items-end gap-2"
                >
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        send(draft);
                      }
                    }}
                    rows={2}
                    placeholder={`Reply to ${active.name.split(" ")[0]} as Support…`}
                    aria-label="Reply as support"
                    className="max-h-32 min-h-[46px] flex-1 resize-none rounded-[6px] border border-[#d8d3c7] px-3 py-2 text-[13px] text-nbc-navy outline-none focus:border-nbc-navy"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim()}
                    className="flex h-[46px] flex-none items-center gap-1.5 rounded-[6px] bg-nbc-red px-4 text-[13px] font-semibold text-white transition enabled:hover:bg-nbc-red-dark disabled:opacity-40"
                  >
                    Send
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </form>
                <p className="mt-1.5 text-[10.5px] text-[#8a8a8a]">
                  Enter sends · Shift+Enter adds a line. The client never sees your name, role or these notes.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
