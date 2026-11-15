import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SupportChat from "../components/SupportChat";
import { INITIAL_PROFILES } from "../banking/bankingTypes";
import { appendSupportMessage, startSpecialistHandoff } from "../banking/supportChat";
import { ensureProfileShape } from "../lib/profileNormalize";
import type { BankUserProfile } from "../banking/bankingTypes";

function clientProfile(): BankUserProfile {
  let profile = ensureProfileShape({
    ...INITIAL_PROFILES.personal,
    email: "client@nbc.test",
    supportThread: [],
  } as BankUserProfile);
  profile = appendSupportMessage(profile, "client", "There is fraud on my card", { awaitingDesk: true });
  profile = appendSupportMessage(profile, "support", "I've marked it urgent for our Support team.", {
    automated: true,
  });
  return profile;
}

describe("SupportChat widget", () => {
  it("renders one floating launcher, labelled Support", () => {
    const markup = renderToStaticMarkup(<SupportChat profile={clientProfile()} />);

    expect(markup).toContain("Support");
    // A single entry point: one <button> launcher, and no second widget.
    expect(markup.match(/aria-label="Open National Bank Support chat/g)).toHaveLength(1);
    expect(markup).not.toMatch(/Ask a question/);
    expect(markup).not.toMatch(/virtual assistant/i);
  });

  it("shows the unread count on the launcher for a client", () => {
    const markup = renderToStaticMarkup(<SupportChat profile={clientProfile()} />);
    // One escalated client message the client has not opened yet, so 1 > 9 ? no.
    expect(markup).toMatch(/Open National Bank Support chat, 1 unread message/);
  });

  it("renders the signed-in conversation without leaking back-office identity", () => {
    const markup = renderToStaticMarkup(<SupportChat profile={clientProfile()} defaultOpen />);

    expect(markup).toContain("National Bank Support");
    expect(markup).toContain("There is fraud on my card");
    expect(markup).not.toMatch(/administrator|back ?office|admin\b/i);
    expect(markup).not.toMatch(/\bbot\b/i);
    // Read ticks are rendered for the client's own message.
    expect(markup).toMatch(/✓/);
  });

  it("offers public answers and shortcuts when nobody is signed in", () => {
    const markup = renderToStaticMarkup(<SupportChat profile={null} defaultOpen />);

    expect(markup).toContain("National Bank Support");
    expect(markup).toContain("Today&#x27;s rates");
    expect(markup).toContain("Book an appointment");
    expect(markup).toContain("Open an account");
    expect(markup).toContain("Write a message");
    // No unread badge and no account-specific promise when signed out.
    expect(markup).not.toContain("unread message");
    expect(markup).not.toMatch(/administrator|back ?office|admin\b/i);
  });
});

describe("talking to Support directly", () => {
  it("offers the direct route in an open conversation", () => {
    const markup = renderToStaticMarkup(<SupportChat profile={clientProfile()} defaultOpen />);
    expect(markup).toContain("Talk to a person now");
  });

  it("swaps it for a status line once the client is with a specialist", () => {
    const markup = renderToStaticMarkup(
      <SupportChat profile={startSpecialistHandoff(clientProfile())} defaultOpen />
    );
    expect(markup).not.toContain("Talk to a person now");
    expect(markup).toMatch(/with a specialist/);
  });
});
