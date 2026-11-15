/**
 * Date helpers for the ledger.
 *
 * Ledger dates are "calendar dates" (YYYY-MM-DD) with no time component. They
 * must be derived from the *local* calendar, not from UTC: `Date#toISOString()`
 * shifts the day for every timezone that is not UTC+0, which made a transaction
 * posted in Lagos / Auckland at 00:30 look like it happened "yesterday", and made
 * the Americas render a 14 May entry as 13 May.
 *
 * Keep every YYYY-MM-DD conversion in the app going through these helpers.
 */

/** Formats a Date using its local calendar day (YYYY-MM-DD). */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Today's calendar date in the user's own timezone (YYYY-MM-DD). */
export function todayIso(): string {
  return toIsoDate(new Date());
}

/** Parses a YYYY-MM-DD value as local midnight (avoids the UTC off-by-one day). */
export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map((part) => Number(part));
  if (!year || !month || !day) return new Date(Number.NaN);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/** Adds whole days to a YYYY-MM-DD value without drifting across timezones. */
export function addDaysIso(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  if (Number.isNaN(date.getTime())) return iso;
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** True when a value looks like a YYYY-MM-DD ledger date. */
export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Normalises anything that reaches a ledger date field into YYYY-MM-DD.
 * Legacy rows can hold "May 14, 2026" or an ISO timestamp; comparing those as
 * strings silently breaks every date filter, so coerce them once on read.
 */
export function normalizeIsoDate(value: unknown): string {
  if (isIsoDate(value)) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return toIsoDate(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return toIsoDate(parsed);
  }
  return "";
}

/** Formats a YYYY-MM-DD ledger date for display, using the locale's own day. */
export function formatIsoDate(
  iso: string,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "2-digit" },
  locale = "en-CA"
): string {
  const date = parseIsoDate(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(locale, options);
}
