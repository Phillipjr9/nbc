/**
 * Deterministic JSON, used to answer one question: "is this profile the same
 * as the one the server gave us?"
 *
 * `JSON.stringify` depends on key insertion order, so two structurally equal
 * profiles built by different code paths (a merge, a normalise, a round-trip
 * through Supabase) stringify differently. That was enough to make the
 * write-back effect believe the server's own copy was a local edit, write it
 * back, receive the realtime echo, and write it again — a loop that produced
 * thousands of row updates and made Support messages arrive late (and appear to
 * vanish and come back). Sorting keys makes the comparison meaningful.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if (source[key] === undefined) continue;
      sorted[key] = sortValue(source[key]);
    }
    return sorted;
  }
  // `NaN`/`Infinity` serialise as `null`; keep them distinguishable from null.
  if (typeof value === "number" && !Number.isFinite(value)) return `__number:${value}`;
  return value;
}
