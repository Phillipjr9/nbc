import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  formatIsoDate,
  isIsoDate,
  normalizeIsoDate,
  parseIsoDate,
  toIsoDate,
  todayIso,
} from "../lib/dates";

describe("toIsoDate", () => {
  it("uses the local calendar day, not the UTC day", () => {
    // 00:30 local on 14 May is still 13 May in UTC west of Greenwich.
    expect(toIsoDate(new Date(2026, 4, 14, 0, 30))).toBe("2026-05-14");
    // 23:30 local on 14 May is already 15 May in UTC east of Greenwich.
    expect(toIsoDate(new Date(2026, 4, 14, 23, 30))).toBe("2026-05-14");
  });

  it("zero-pads months and days", () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("todayIso matches the local calendar day", () => {
    expect(todayIso()).toBe(toIsoDate(new Date()));
  });
});

describe("parseIsoDate", () => {
  it("parses as local noon so display never shifts a day", () => {
    const date = parseIsoDate("2026-05-14");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(4);
    expect(date.getDate()).toBe(14);
    expect(date.getHours()).toBe(12);
  });

  it("returns an invalid date for junk", () => {
    expect(Number.isNaN(parseIsoDate("not-a-date").getTime())).toBe(true);
    expect(Number.isNaN(parseIsoDate("").getTime())).toBe(true);
  });
});

describe("addDaysIso", () => {
  it("crosses month and year boundaries", () => {
    expect(addDaysIso("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysIso("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("keeps the same day across a DST change", () => {
    expect(addDaysIso("2026-03-07", 2)).toBe("2026-03-09");
    expect(addDaysIso("2026-10-31", 1)).toBe("2026-11-01");
  });

  it("returns the input unchanged when it cannot be parsed", () => {
    expect(addDaysIso("rubbish", 3)).toBe("rubbish");
  });
});

describe("normalizeIsoDate", () => {
  it("keeps valid ledger dates untouched", () => {
    expect(normalizeIsoDate("2026-05-14")).toBe("2026-05-14");
  });

  it("coerces legacy formats onto the local calendar day", () => {
    expect(normalizeIsoDate("May 14, 2026")).toBe("2026-05-14");
    expect(normalizeIsoDate(new Date(2026, 4, 14, 9))).toBe("2026-05-14");
    expect(normalizeIsoDate("2026-05-14T23:59:00")).toBe("2026-05-14");
  });

  it("returns an empty string for unusable values", () => {
    expect(normalizeIsoDate(null)).toBe("");
    expect(normalizeIsoDate(undefined)).toBe("");
    expect(normalizeIsoDate("")).toBe("");
    expect(normalizeIsoDate("soon")).toBe("");
    expect(normalizeIsoDate(20260514)).toBe("");
  });
});

describe("isIsoDate / formatIsoDate", () => {
  it("recognises ledger dates only", () => {
    expect(isIsoDate("2026-05-14")).toBe(true);
    expect(isIsoDate("2026-5-14")).toBe(false);
    expect(isIsoDate("2026-05-14T00:00:00Z")).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });

  it("formats a ledger date in the requested locale without drifting a day", () => {
    expect(
      formatIsoDate("2026-05-14", { year: "numeric", month: "2-digit", day: "2-digit" }, "en-CA")
    ).toBe("2026-05-14");
    expect(formatIsoDate("2026-05-14", { month: "long", year: "numeric" }, "en-CA")).toBe("May 2026");
  });

  it("echoes junk back instead of throwing", () => {
    expect(formatIsoDate("nope")).toBe("nope");
  });
});
