/**
 * Public (signed-out) answers for the single Support widget.
 *
 * The marketing site and the signed-in dashboards now share one conversation
 * surface. When nobody is signed in there is no profile to quote, so the widget
 * answers general questions here — rates, appointments, cards, opening an
 * account — and hands the visitor the same action links the old
 * "Ask a question" panel offered.
 *
 * Same anonymity rule as the signed-in path: the visitor is talking to
 * "Support". Nothing here may name a back-office person, a bot or a model.
 */

export type PublicLink = { label: string; href: string };

export type PublicTopic =
  | "person"
  | "rates"
  | "appointment"
  | "card_safety"
  | "open_account"
  | "mortgage"
  | "credit_card"
  | "sign_in"
  | "thanks"
  | "fallback";

export type PublicAnswer = {
  reply: string;
  links?: PublicLink[];
  topic: PublicTopic;
};

/** Shortcuts offered in an empty conversation with a signed-out visitor. */
export const PUBLIC_QUICK_STARTS = [
  "Talk to a person",
  "Today's rates",
  "Book an appointment",
  "Lost or stolen card",
  "Open an account",
];

export const PUBLIC_GREETING =
  "Hi! You're chatting with National Bank Support. Ask us about accounts, mortgages, rates, cards or fraud prevention — we're here 24/7, and a specialist can step in at any time.";

export function publicGreeting(): string {
  return PUBLIC_GREETING;
}

/** Answers a general question from a visitor who is not signed in. */
export function answerPublicQuestion(raw: string): PublicAnswer {
  const q = raw.toLowerCase();

  // Explicit request for a person: give the real channels, before anything else.
  if (/(person|human|agent|representative|specialist|someone|talk to|speak to|call me)/.test(q)) {
    return {
      topic: "person",
      reply:
        "Happy to put you through. The quickest ways to reach a person:\n• Call 1-888-835-6281 (Canada/U.S.) or 1-514-394-5000 (elsewhere) — 24/7\n• Sign in and open Support chat, then choose “Talk to a person now”: a specialist joins the conversation and replies there.\n• Book an appointment in branch, by phone or by video.",
      links: [
        { label: "Contact us", href: "https://www.nbc.ca/contact-us.html" },
        { label: "Sign in to chat with Support", href: "https://app.bnc.ca/?lang=en" },
      ],
    };
  }

  if (/(rate|interest|prime|mortgage rate|saving rate)/.test(q)) {
    return {
      topic: "rates",
      reply:
        "Here are our current reference rates:\n• Prime rate: 4.70%\n• 5-year fixed mortgage: 5.14%\n• Cash Advantage Solution: 3% promotional rate\n\nRates are subject to change. Would you like to compare our savings solutions?",
      links: [
        { label: "See all rates", href: "https://www.nbc.ca/rates.html" },
        {
          label: "Cash Advantage Solution",
          href: "https://www.nbc.ca/personal/savings-investments/solutions/cash-solution.html",
        },
      ],
    };
  }

  if (/(appointment|advisor|meet|book|branch|in person)/.test(q)) {
    return {
      topic: "appointment",
      reply:
        "We can book time with an advisor. Appointments are available by phone, video or in branch, usually within 2 business days.",
      links: [
        { label: "Make an appointment", href: "https://www.nbc.ca/contact-us.html" },
        { label: "Find a branch", href: "https://www.nbc.ca/contact-us.html" },
      ],
    };
  }

  if (/(lost|stolen|card.*(block|freeze)|fraud|scam|phishing)/.test(q)) {
    return {
      topic: "card_safety",
      reply:
        "Let's protect your account right away. Lock your card in the National Bank app, or call us 24/7 at 1-888-835-6281 (Canada/U.S.) or 1-514-394-5000 (elsewhere).\n\nNever share your password or verification codes — we will never ask for them.",
      links: [
        { label: "Fraud prevention tips", href: "https://www.nbc.ca/personal/advice/security.html" },
        { label: "Report a lost or stolen card", href: "https://www.nbc.ca/contact-us.html" },
      ],
    };
  }

  if (/(open|account|switch|new client|newcomer|join)/.test(q)) {
    return {
      topic: "open_account",
      reply:
        "Opening an account takes about 10 minutes online. You'll need a piece of government-issued ID and your contact details. Newcomers to Canada can also open an account before arriving.",
      links: [
        { label: "Choose an account", href: "https://www.nbc.ca/personal/accounts.html" },
        { label: "Become a client", href: "https://www.nbc.ca/personal/switch-national-bank.html" },
        { label: "Newcomers to Canada", href: "https://www.nbc.ca/personal/newcomers.html" },
      ],
    };
  }

  if (/(mortgage|home|pre-?approv|house|property)/.test(q)) {
    return {
      topic: "mortgage",
      reply:
        "A mortgage pre-approval gives you a clear budget and a rate hold for up to 120 days. Our mobile mortgage specialists can meet you wherever suits you.",
      links: [
        { label: "Get pre-approved", href: "https://www.nbc.ca/personal/mortgages/pre-approval.html" },
        { label: "Mortgage calculator", href: "https://www.nbc.ca/personal/tools/calculators.html" },
      ],
    };
  }

  if (/(credit card|mastercard|allure|cashback)/.test(q)) {
    return {
      topic: "credit_card",
      reply:
        "We offer Mastercard options for everyday rewards, travel and students. The Allure Mastercard also supports breast cancer research with every purchase.",
      links: [
        { label: "Compare credit cards", href: "https://www.nbc.ca/personal/mastercard-credit-cards.html" },
        { label: "Allure Mastercard", href: "https://www.nbc.ca/personal/mastercard-credit-cards/allure.html" },
      ],
    };
  }

  if (/(sign ?in|login|online bank|password|access)/.test(q)) {
    return {
      topic: "sign_in",
      reply:
        "You can sign in to your personal or business online bank from the top of every page. If you've forgotten your password, use the “Forgot password” link on the sign-in screen.",
      links: [
        { label: "Sign in to online bank", href: "https://app.bnc.ca/?lang=en" },
        { label: "Help centre", href: "https://www.nbc.ca/help.html" },
      ],
    };
  }

  if (/(thanks|thank you|perfect|great|merci)/.test(q)) {
    return {
      topic: "thanks",
      reply: "You're welcome! Is there anything else we can help you with today?",
    };
  }

  return {
    topic: "fallback",
    reply:
      "We can help with accounts, mortgages, savings and rates, credit cards, fraud prevention or booking an advisor. Sign in and ask us about your own file, or reach a person 7 days a week.",
    links: [
      { label: "Visit the Help centre", href: "https://www.nbc.ca/help.html" },
      { label: "Contact us", href: "https://www.nbc.ca/contact-us.html" },
    ],
  };
}
