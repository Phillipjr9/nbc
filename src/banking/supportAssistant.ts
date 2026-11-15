import type { BankUserProfile, SupportMessage, Transaction } from "./bankingTypes";
import { formatMoney } from "./bankingTypes";
import { SUPPORT_EMAIL, formatSupportDay, isWithSpecialist, supportThreadOf } from "./supportChat";

/**
 * Support assistant ("AI support").
 *
 * Every client message is answered here *before* it reaches the live Support
 * desk. The assistant is deterministic and runs entirely on the device: it reads
 * the client's own profile (accounts, ledger, cards, scheduled transfers) so its
 * answers quote real numbers, and it decides whether the conversation must be
 * handed to a human specialist.
 *
 * `generateSupportReply()` is the single integration point — swapping in a hosted
 * model later means replacing this function's body with an API call and keeping
 * the same return shape.
 */

export type AssistantIntent =
  | "greeting"
  | "balance"
  | "ledger"
  | "duplicate"
  | "card_declined"
  | "card_lost"
  | "transfer"
  | "fees"
  | "loan"
  | "hours"
  | "fraud"
  | "human"
  | "fallback";

export type AssistantResult = {
  /** Text shown to the client as a Support message. */
  reply: string;
  intent: AssistantIntent;
  /** 0–1. Below `ESCALATION_THRESHOLD` the desk takes over. */
  confidence: number;
  /** True when a human specialist must continue the conversation. */
  escalate: boolean;
  /** Internal triage tags — never rendered to the client. */
  tags: string[];
};

const ESCALATION_THRESHOLD = 0.6;

/** Intents that always need a person, regardless of confidence. */
const HUMAN_REQUIRED: AssistantIntent[] = ["fraud", "human", "card_lost", "card_declined", "duplicate", "fallback"];

const normalise = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const firstName = (profile: BankUserProfile) => (profile.fullName || "there").trim().split(/\s+/)[0];

const STOP_WORDS = new Set([
  "the", "and", "for", "you", "your", "with", "this", "that", "have", "from", "was", "were", "are", "can",
  "could", "would", "should", "please", "help", "about", "there", "here", "what", "when", "where", "why",
  "how", "not", "but", "charge", "charged", "payment", "payments", "transaction", "transactions", "account",
  "money", "card", "bank", "national", "support", "into", "just", "been", "they", "them", "than", "then",
  "also", "looks", "look", "shows", "show", "month", "today", "yesterday", "week",
]);

/** Words in the client's message that also appear in a ledger description. */
function matchedTransactions(profile: BankUserProfile, message: string): Transaction[] {
  const tokens = normalise(message)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3 && !STOP_WORDS.has(token));

  if (tokens.length === 0) return [];

  return (profile.transactions ?? [])
    .filter((tx) => {
      const description = normalise(tx.description);
      return tokens.some((token) => description.includes(token));
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 4);
}

/** Two identical amounts from the same merchant inside 10 days. */
function findSuspectedDuplicate(profile: BankUserProfile): [Transaction, Transaction] | null {
  const ledger = [...(profile.transactions ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  for (let index = 0; index < ledger.length; index += 1) {
    const first = ledger[index];
    for (let inner = index + 1; inner < Math.min(index + 8, ledger.length); inner += 1) {
      const second = ledger[inner];
      if (first.description !== second.description) continue;
      if (Math.abs(first.amount - second.amount) > 0.009) continue;
      const gap = Math.abs(new Date(first.date).getTime() - new Date(second.date).getTime()) / 86400000;
      if (gap <= 10) return [first, second];
    }
  }
  return null;
}

function accountSummary(profile: BankUserProfile): string {
  const accounts = (profile.accounts ?? []).slice(0, 3);
  if (accounts.length === 0) return "";
  return accounts
    .map((account) => `• ${account.name}: ${formatMoney(account.balance, account.currency)}`)
    .join("\n");
}

function recentLedger(profile: BankUserProfile, limit = 3): string {
  const ledger = [...(profile.transactions ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, limit);
  if (ledger.length === 0) return "";
  return ledger
    .map(
      (tx) =>
        `• ${formatSupportDay(tx.date)} — ${tx.description}: ${tx.amount >= 0 ? "+" : "−"}${formatMoney(
          Math.abs(tx.amount)
        )}`
    )
    .join("\n");
}

const HANDOFF_NOTE =
  "I'm bringing in a Support specialist who can access your file and take care of this with you. You can keep typing here in the meantime.";

/**
 * Answers one client message. Called for every message received from a client.
 */
export function generateSupportReply(
  profile: BankUserProfile,
  message: string,
  history: SupportMessage[] = supportThreadOf(profile)
): AssistantResult {
  const text = normalise(message);
  const tags: string[] = [];
  const clientMessages = history.filter((entry) => entry.side === "client");
  const previousClientText = clientMessages.slice(0, -1).map((entry) => normalise(entry.body)).join(" ");

  const escalateNow = (reply: string, intent: AssistantIntent, confidence: number, extraTags: string[] = []) => ({
    reply,
    intent,
    confidence,
    escalate: true,
    tags: [...tags, intent, ...extraTags, "escalated"],
  });

  // 1. Explicit request for a person.
  if (/(human|person|someone|agent|representative|specialist|supervisor|manager|real people|talk to|speak to|call me|advisor)/.test(text)) {
    return escalateNow(
      `Of course, ${firstName(profile)}. ${HANDOFF_NOTE}`,
      "human",
      0.95,
      ["asked-for-person"]
    );
  }

  // 2. Fraud / unauthorised activity — always a human, immediately.
  if (/(fraud|unauthori[sz]ed|not me|didn'?t (make|do)|suspicious|scam|phishing|stolen)/.test(text)) {
    return escalateNow(
      `${firstName(profile)}, thank you for flagging this right away. I've marked it urgent for our Support team.\n\nIn the meantime: lock the card in Cards → Manage, and call 1-888-835-6281 (24/7) so we can review the movement immediately. We will never ask for your password, PIN or verification codes.`,
      "fraud",
      0.95,
      ["urgent", "fraud-review"]
    );
  }

  // 3. Lost or stolen card.
  if (/(lost|stolen|misplaced|can'?t find).{0,20}(card|mastercard|visa)|card.{0,20}(lost|stolen)/.test(text)) {
    const card = (profile.cards ?? [])[0];
    return escalateNow(
      `I can help with that, ${firstName(profile)}.${
        card ? ` I can see your ${card.label} ending ${card.last4}.` : ""
      } A Support specialist is being asked to block it now — this usually takes under a minute.\n\nIf you need it done instantly, call 1-888-835-6281 (24/7).`,
      "card_lost",
      0.9,
      ["card-block", "urgent"]
    );
  }

  // 4. Suspected duplicate charge.
  if (/(duplicate|twice|double|charged two|two charges|again)/.test(text) || findSuspectedDuplicate(profile) !== null) {
    const duplicate = findSuspectedDuplicate(profile);
    const matched = matchedTransactions(profile, message);
    const detail = duplicate
      ? `I can see two matching entries: ${duplicate[0].description} — ${formatMoney(
          Math.abs(duplicate[0].amount)
        )} on ${formatSupportDay(duplicate[0].date)} and again on ${formatSupportDay(duplicate[1].date)}.`
      : matched.length > 0
        ? `I can see ${matched[0].description} — ${formatMoney(Math.abs(matched[0].amount))} on ${formatSupportDay(
            matched[0].date
          )}.`
        : "";

    return escalateNow(
      `${detail ? `${detail}\n\n` : ""}That looks like it needs a refund review, so I'm handing this to a Support specialist who can open a dispute file for you. Nothing else is needed from you right now.`,
      "duplicate",
      0.88,
      ["dispute", "refund-review"]
    );
  }

  // 5. Declined / blocked card.
  if (/(declin|blocked|not working|won'?t go through|refused|locked)/.test(text)) {
    const card = (profile.cards ?? []).find((entry) => entry.locked) ?? (profile.cards ?? [])[0];
    const lockedNote = card?.locked
      ? `Your ${card.label} ending ${card.last4} is currently locked.`
      : `I've checked your cards and none of them are locked on our side.`;
    return escalateNow(
      `${lockedNote} A decline can also come from a limit or a merchant hold.\n\nA Support specialist is taking over to unlock it or raise the limit for you${
        card ? ` on the card ending ${card.last4}` : ""
      }.`,
      "card_declined",
      0.85,
      ["card-limit"]
    );
  }

  // 6. Balance / accounts.
  if (/(balance|how much|available|solde|funds)/.test(text)) {
    const summary = accountSummary(profile);
    if (summary) {
      return {
        reply: `Here is where things stand right now, ${firstName(profile)}:\n${summary}\n\nAnything else you'd like me to look at?`,
        intent: "balance",
        confidence: 0.92,
        escalate: false,
        tags: ["balance"],
      };
    }
  }

  // 7. Ledger question.
  if (/(transaction|statement|history|ledger|charge|purchase|deposit|posted|show me)/.test(text)) {
    const matched = matchedTransactions(profile, message);
    const listing = matched.length > 0
      ? matched
          .map(
            (tx) =>
              `• ${formatSupportDay(tx.date)} — ${tx.description}: ${tx.amount >= 0 ? "+" : "−"}${formatMoney(
                Math.abs(tx.amount)
              )}`
          )
          .join("\n")
      : recentLedger(profile);

    if (listing) {
      return {
        reply: `Here ${matched.length === 1 ? "is the entry" : "are the entries"} I can see, ${firstName(profile)}:\n${listing}\n\nTap Transactions in your dashboard for the full statement. If one of these doesn't look right, tell me which and I'll have it reviewed.`,
        intent: "ledger",
        confidence: 0.9,
        escalate: false,
        tags: ["ledger"],
      };
    }
  }

  // 8. Transfers / e-transfers / scheduled payments.
  if (/(transfer|e-?transfer|interac|wire|payee|bill|scheduled|automatic)/.test(text)) {
    const scheduled = (profile.scheduled ?? []).filter((entry) => entry.active);
    const listing = scheduled
      .slice(0, 3)
      .map((entry) => `• ${entry.description ?? "Scheduled transfer"} — next ${formatSupportDay(entry.nextDate)}`)
      .join("\n");
    return {
      reply: `Transfers are under Transfers & bills in your dashboard.${
        listing ? `\n\nYour upcoming scheduled items:\n${listing}` : ""
      }\n\nIf you need something cancelled or a transfer traced, say the word and I'll bring in a specialist.`,
      intent: "transfer",
      confidence: 0.82,
      escalate: /(cancel|stop|trace|missing|not received|reverse)/.test(text),
      tags: ["transfers"],
    };
  }

  // 9. Fees.
  if (/(fee|charge for|service charge|interest charge)/.test(text)) {
    return {
      reply: `Banking fees are listed in your account agreement, and any fee on your statement appears as “Service charge”.\n\nIf you'd like a fee reviewed as a goodwill adjustment, I can ask a specialist to look at it — just confirm and I'll hand it over.`,
      intent: "fees",
      confidence: 0.75,
      escalate: false,
      tags: ["fees"],
    };
  }

  // 10. Loans / mortgage rates.
  if (/(mortgage|loan|rate|pre-?approv|amorti)/.test(text)) {
    const loan = (profile.accounts ?? []).find((account) => account.category === "loan" || account.category === "credit");
    return {
      reply: `${
        loan ? `Your ${loan.name} is at ${loan.rate ?? "your contracted rate"} with a balance of ${formatMoney(loan.balance)}.\n\n` : ""
      }For a new rate or a pre-approval I'd bring in a specialist who can run the numbers with you. Would you like that?`,
      intent: "loan",
      confidence: 0.7,
      escalate: false,
      tags: ["lending"],
    };
  }

  // 11. Hours / contact.
  if (/(hours|open|close|phone|contact|reach you|number)/.test(text)) {
    return {
      reply: `We're here 24/7:\n• Phone: 1-888-835-6281 (Canada/U.S.) · 1-514-394-5000 (elsewhere)\n• Email: ${SUPPORT_EMAIL}\n• This chat: replies from a specialist in a few minutes during business hours.\n• Appointments: Help centre → Book an appointment.`,
      intent: "hours",
      confidence: 0.9,
      escalate: false,
      tags: ["contact"],
    };
  }

  // 12. Greeting.
  if (/^(hi|hello|hey|bonjour|salut|allo|good (morning|afternoon|evening))/.test(text) && text.length < 40) {
    return {
      reply: `Hi ${firstName(profile)}! How can we help today?`,
      intent: "greeting",
      confidence: 0.9,
      escalate: false,
      tags: ["greeting"],
    };
  }

  // 13. Nothing matched — hand it to a person rather than guessing.
  const repeat = previousClientText.includes(text.slice(0, 24));
  return escalateNow(
    repeat
      ? "Thanks for the detail — I'll let a Support specialist pick this up from here."
      : `Thanks for the message, ${firstName(profile)}. I'm not certain I have the full picture, so I'm asking a Support specialist to answer you properly rather than guess. You can add anything else here in the meantime.`,
    "fallback",
    0.35,
    repeat ? ["repeat-question"] : ["low-confidence"]
  );
}

/* ------------------------------------------------------------------ *
 * Desk-side assistance
 * ------------------------------------------------------------------ */

/**
 * Decides what happens to one message the client just typed.
 *
 * Two paths:
 *  - the conversation is with the assistant, so it answers first and only
 *    escalates when it cannot resolve the request;
 *  - the client asked to talk to a person (`profile.supportHandoff`), so the
 *    message goes straight to the Support desk and the assistant stays silent.
 */
export type SupportTurnPlan = {
  /** Mark the client message `awaitingDesk` so the desk badge and chime fire. */
  awaitingDesk: boolean;
  /** The assistant reply to show, or null when the message is desk-only. */
  reply: string | null;
  intent: AssistantIntent | "handoff";
  confidence: number;
  tags: string[];
};

export function planSupportTurn(
  profile: BankUserProfile,
  message: string,
  history: SupportMessage[] = supportThreadOf(profile)
): SupportTurnPlan {
  if (isWithSpecialist(profile)) {
    return { awaitingDesk: true, reply: null, intent: "handoff", confidence: 1, tags: ["handoff", "with-specialist"] };
  }

  const answer = generateSupportReply(profile, message, history);
  return {
    awaitingDesk: answer.escalate,
    reply: answer.reply,
    intent: answer.intent,
    confidence: answer.confidence,
    tags: answer.tags,
  };
}

export type DeskAssist = {
  summary: string;
  suggestedReply: string;
  intent: AssistantIntent;
  confidence: number;
  tags: string[];
};

/**
 * Prepares what the specialist needs to continue the conversation: a short
 * summary of the thread, triage tags from the assistant, and a ready-to-send
 * reply drafted from the client's own data.
 */
export function draftDeskAssist(
  profile: BankUserProfile,
  history: SupportMessage[] = supportThreadOf(profile)
): DeskAssist {
  const clientMessages = history.filter((entry) => entry.side === "client");
  const lastClient = clientMessages[clientMessages.length - 1];
  const earlier = clientMessages[0];
  const result = lastClient
    ? generateSupportReply(profile, lastClient.body, history)
    : {
        reply: "",
        intent: "fallback" as AssistantIntent,
        confidence: 1,
        escalate: false,
        tags: [] as string[],
      };

  const opening = earlier && earlier.id !== lastClient?.id ? `First contact: “${truncate(earlier.body, 90)}”. ` : "";
  const summary = lastClient
    ? `${opening}Latest: “${truncate(lastClient.body, 120)}” · intent: ${result.intent} · ${clientMessages.length} message${
        clientMessages.length === 1 ? "" : "s"
      } from the client.`
    : "No client messages yet — this would be a proactive check-in.";

  return {
    summary,
    suggestedReply: buildDeskReply(profile, result.intent, lastClient?.body ?? ""),
    intent: result.intent,
    confidence: result.confidence,
    tags: result.tags,
  };
}

function buildDeskReply(profile: BankUserProfile, intent: AssistantIntent, clientText: string): string {
  const name = firstName(profile);
  const duplicate = findSuspectedDuplicate(profile);
  const matched = clientText ? matchedTransactions(profile, clientText) : [];

  switch (intent) {
    case "duplicate":
      return duplicate
        ? `Hi ${name}, thanks for waiting. I can confirm the duplicate: ${duplicate[0].description} for ${formatMoney(
            Math.abs(duplicate[0].amount)
          )} on ${formatSupportDay(duplicate[0].date)} and again on ${formatSupportDay(
            duplicate[1].date
          )}. I've opened a refund review — the reversal normally posts in 1–2 business days and I'll confirm here as soon as it does.`
        : `Hi ${name}, thanks for waiting. I've opened a review on the charge${
            matched[0] ? ` from ${matched[0].description} on ${formatSupportDay(matched[0].date)}` : ""
          }. You'll see the outcome here within 1–2 business days.`;
    case "card_declined": {
      const card = (profile.cards ?? []).find((entry) => entry.locked);
      return `Hi ${name}, I've checked the card${card ? ` ending ${card.last4}` : ""}. ${
        card ? "It was locked on our side — I've unlocked it now." : "There is no block on our side."
      } Please try the payment again; if it still declines, tell me the merchant and amount and I'll trace the authorization.`;
    }
    case "card_lost": {
      const card = (profile.cards ?? [])[0];
      return `Hi ${name}, I've blocked the card${card ? ` ending ${card.last4}` : ""} and a replacement is on its way — you'll have it in 3–5 business days. Your recurring payments stay linked to the new card automatically. Anything else I can do while I'm here?`;
    }
    case "fraud":
      return `Hi ${name}, I've marked the movement as disputed and flagged the card for monitoring. Please confirm the last two transactions you recognise so I can isolate what to reverse, and keep the card locked until we finish.`;
    case "human":
      return `Hi ${name}, I'm here and have your file open. Tell me what you need and I'll take care of it directly.`;
    case "balance":
      return `Hi ${name}, I can see your balances: ${(profile.accounts ?? [])
        .slice(0, 3)
        .map((account) => `${account.name} ${formatMoney(account.balance, account.currency)}`)
        .join(", ")}. Anything you'd like me to move or review?`;
    case "ledger":
      return `Hi ${name}, I've reviewed your recent activity. ${
        matched[0]
          ? `The entry I see is ${matched[0].description} for ${formatMoney(Math.abs(matched[0].amount))} on ${formatSupportDay(
              matched[0].date
            )}.`
          : "Everything looks as expected."
      } If something doesn't match what you did, tell me which entry and I'll dig into it.`;
    case "transfer":
      return `Hi ${name}, I can see your transfer setup. Tell me which transfer you mean — date, amount or recipient — and I'll check its status and, if needed, recall it.`;
    case "fees":
      return `Hi ${name}, I've reviewed the fee on your account. As a goodwill adjustment I can reverse it — it would post within 1–2 business days. Shall I go ahead?`;
    case "loan":
      return `Hi ${name}, happy to help with your lending question. I have your file in front of me — are you looking at a renewal, an early payout, or a new rate?`;
    default:
      return `Hi ${name}, thanks for your patience — I've read your message and I'm on it. I'll come back with the details in a moment.`;
  }
}

const truncate = (value: string, max: number) => (value.length <= max ? value : `${value.slice(0, max - 1)}…`);

export function assistantNeedsHuman(result: AssistantResult): boolean {
  return result.escalate || HUMAN_REQUIRED.includes(result.intent) || result.confidence < ESCALATION_THRESHOLD;
}
