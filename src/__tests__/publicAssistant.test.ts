import { describe, expect, it } from "vitest";
import {
  PUBLIC_GREETING,
  PUBLIC_QUICK_STARTS,
  answerPublicQuestion,
  publicGreeting,
} from "../banking/publicAssistant";

describe("answerPublicQuestion", () => {
  it("answers a rates question with rates and action links", () => {
    const answer = answerPublicQuestion("What are today's rates?");
    expect(answer.topic).toBe("rates");
    expect(answer.reply).toMatch(/Prime rate/);
    expect(answer.links?.length).toBeGreaterThan(0);
  });

  it("routes each common visitor question to its own topic", () => {
    const cases: Array<[string, string]> = [
      ["I want to talk to a person", "person"],
      ["I want to book an appointment", "appointment"],
      ["I lost my card", "card_safety"],
      ["How do I open an account?", "open_account"],
      ["Can I get a mortgage pre-approval?", "mortgage"],
      ["Tell me about the credit card options", "credit_card"],
      ["I can't sign in", "sign_in"],
      ["thanks!", "thanks"],
      ["asdkjh qwe zxcv", "fallback"],
    ];

    for (const [message, topic] of cases) {
      const answer = answerPublicQuestion(message);
      expect(answer.topic, message).toBe(topic);
      expect(answer.reply.length, message).toBeGreaterThan(10);
    }
  });

  it("offers a way forward when it does not understand", () => {
    const answer = answerPublicQuestion("asdkjh qwe zxcv");
    expect(answer.links?.map((link) => link.label)).toEqual([
      "Visit the Help centre",
      "Contact us",
    ]);
  });

  it("never names a bot, a model or a back-office person", () => {
    const messages = [
      "Hello",
      "Today's rates",
      "Book an appointment",
      "Lost card",
      "Open an account",
      "Mortgage",
      "Credit card",
      "Sign in",
      "thanks",
      "nonsense input",
      publicGreeting(),
    ];

    for (const message of messages) {
      const { reply } = answerPublicQuestion(message);
      expect(reply).not.toMatch(/\b(bot|chatbot|virtual assistant|A\.?I\.?|model|administrator|admin|staff|agent)\b/i);
    }
  });

  it("keeps the greeting and shortcuts branded as Support", () => {
    expect(PUBLIC_GREETING).toMatch(/Support/);
    expect(publicGreeting()).toBe(PUBLIC_GREETING);
    expect(PUBLIC_QUICK_STARTS.length).toBeGreaterThanOrEqual(3);
    for (const shortcut of PUBLIC_QUICK_STARTS) {
      expect(answerPublicQuestion(shortcut).reply.length).toBeGreaterThan(10);
    }
  });
});

describe("talking to a person from the public site", () => {
  it("gives the real channels instead of a canned answer", () => {
    const answer = answerPublicQuestion("Talk to a person");
    expect(answer.topic).toBe("person");
    expect(answer.reply).toMatch(/1-888-835-6281/);
    expect(answer.reply).toMatch(/Support chat/);
    expect(answer.reply).toMatch(/Talk to a person now/);
    expect(answer.links?.length).toBeGreaterThan(0);
  });

  it("is offered as a first shortcut", () => {
    expect(PUBLIC_QUICK_STARTS[0]).toBe("Talk to a person");
  });
});
