import { describe, expect, it } from "vitest";
import {
  BUSINESS_PAGE_TO_ROUTE_TAB,
  businessPageTabForRoute,
  hashToRoute,
  routeToHash,
} from "../banking/routeMapper";
import type { BusinessPageTab } from "../banking/routeMapper";

/**
 * A refresh used to feel like a redirect: the business dashboard kept its tab in
 * local state, so the address never left `#/dashboard/business?tab=cards` while
 * the client browsed elsewhere, and reloading the page dutifully restored Cards.
 *
 * The address is the only thing that survives a reload, so every tab the client
 * can reach has to be written to it — and every address has to be readable back
 * into the tab it names.
 */
describe("business dashboard tabs and the address bar", () => {
  const routableTabs = Object.keys(BUSINESS_PAGE_TO_ROUTE_TAB) as BusinessPageTab[];

  it("gives every tab its own address", () => {
    const hashes = routableTabs.map((tab) => routeToHash({ kind: "business-dashboard", tab: BUSINESS_PAGE_TO_ROUTE_TAB[tab] }));
    expect(new Set(hashes).size).toBe(routableTabs.length);
    expect(hashes.every((hash) => hash.startsWith("#/dashboard/business?tab="))).toBe(true);
  });

  it("round-trips tab → address → tab, so a refresh lands where the client was", () => {
    for (const tab of routableTabs) {
      const routed = BUSINESS_PAGE_TO_ROUTE_TAB[tab];
      const hash = routeToHash({ kind: "business-dashboard", tab: routed });
      const parsed = hashToRoute(hash);
      expect(parsed.kind).toBe("business-dashboard");
      if (parsed.kind !== "business-dashboard") continue;
      expect(businessPageTabForRoute(parsed.tab)).toBe(tab);
    }
  });

  it("opens a freshly signed-in business client on Cash position, not Corporate cards", () => {
    const route = hashToRoute(routeToHash({ kind: "business-dashboard" }));
    expect(route).toEqual({ kind: "business-dashboard", tab: "cash-position" });
    expect(businessPageTabForRoute(route.kind === "business-dashboard" ? route.tab : undefined)).toBe("treasury");
  });

  it("keeps the account drill-down off the address", () => {
    // `account` is reached from Cash position and has no page of its own; giving
    // it a hash would let a refresh land on a tab that does not exist.
    expect(BUSINESS_PAGE_TO_ROUTE_TAB.account).toBeUndefined();
    expect(hashToRoute("#/dashboard/business?tab=account")).toEqual({
      kind: "business-dashboard",
      tab: "cash-position",
    });
  });

  it("still reads the old cards address that the bug used to pin", () => {
    expect(hashToRoute("#/dashboard/business?tab=cards")).toEqual({
      kind: "business-dashboard",
      tab: "cards",
    });
  });
});
