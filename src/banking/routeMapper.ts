import { PageRoute } from "./bankingTypes";

export function routeToHash(route: PageRoute): string {
  switch (route.kind) {
    case "home":
      return "#/";
    case "login":
      return route.portal && route.portal !== "personal" ? `#/login/${route.portal}` : "#/login";
    case "signup":
      return route.segment === "business" ? "#/signup/business" : "#/signup";
    case "personal-dashboard":
      return "#/dashboard";
    case "business-dashboard":
      return "#/dashboard/business";
    case "admin-login":
      return "#/admin-login";
    case "admin":
      return "#/admin";
    case "segment":
      return `#/${route.segment}`;
    case "category":
      return `#/products/${route.slug}`;
    case "support":
      return `#/support/${route.section ?? "help"}`;
  }
}

export function hashToRoute(hash: string): PageRoute {
  const clean = hash.replace(/^#\/?/, "").trim().toLowerCase();
  if (!clean) return { kind: "home" };
  if (clean === "dashboard" || clean === "dashboard/personal") return { kind: "personal-dashboard" };
  if (clean === "dashboard/business") return { kind: "business-dashboard" };
  if (clean === "personal-banking") return { kind: "personal-dashboard" };
  if (clean === "business-banking") return { kind: "business-dashboard" };
  if (clean === "admin-login") return { kind: "admin-login" };
  if (clean === "admin") return { kind: "admin" };
  if (clean === "login") return { kind: "login", portal: "personal" };
  if (clean === "login/business" || clean === "business-login") return { kind: "login", portal: "business" };
  if (clean === "login/wealth") return { kind: "login", portal: "wealth" };
  if (clean === "login/brokerage") return { kind: "login", portal: "brokerage" };
  if (clean === "signup") return { kind: "signup", segment: "personal" };
  if (clean === "signup/business" || clean === "business-signup") return { kind: "signup", segment: "business" };
  if (clean === "business" || clean === "wealth" || clean === "about") {
    return { kind: "segment", segment: clean };
  }
  if (clean.startsWith("products/")) {
    const slug = clean.slice("products/".length) as Extract<PageRoute, { kind: "category" }>["slug"];
    const valid = ["accounts", "cards", "borrowing", "mortgages", "savings", "insurance", "advice", "offers", "rates"];
    if (valid.includes(slug)) return { kind: "category", slug };
  }
  if (clean.startsWith("support/")) {
    const section = clean.slice("support/".length) as Extract<PageRoute, { kind: "support" }>["section"];
    const valid = ["help", "appointment", "branches", "notices", "security", "cdic"];
    if (section && valid.includes(section)) return { kind: "support", section };
  }
  return { kind: "home" };
}

export function resolveInternalRoute(href: string, label = ""): PageRoute {
  const h = href.toLowerCase();
  const l = label.toLowerCase();

  if (h.includes("admin") || l.includes("admin portal")) {
    return { kind: "admin-login" };
  }

  // Sign-in portals
  if (h.includes("commercial.bnc.ca") || (h.includes("login") && l.includes("business"))) {
    return { kind: "login", portal: "business" };
  }
  if (h.includes("nbdb/login") || l.includes("direct brokerage")) {
    return { kind: "login", portal: "brokerage" };
  }
  if (h.includes("pb1859") || h.includes("nbfwm/login") || l.includes("1859") || l.includes("national bank financial")) {
    return { kind: "login", portal: "wealth" };
  }
  if (h.includes("app.bnc.ca") || h.includes("signin") || h.includes("login") || l === "sign in") {
    return { kind: "login", portal: "personal" };
  }

  // Sign-up / Become a client
  if (h.includes("switch-national-bank")) {
    if (h.includes("entrepreneur")) return { kind: "signup", segment: "business" };
    return { kind: "signup", segment: "personal" };
  }

  // Support, Notices, Branches, Appointments, Security & CDIC
  if (l.includes("appointment") || h.includes("appointment")) {
    return { kind: "support", section: "appointment" };
  }
  if (l.includes("branch") || h.includes("branch")) {
    return { kind: "support", section: "branches" };
  }
  if (h.includes("notice") || h.includes("welcome/lbc") || l.includes("migration") || l.includes("notices")) {
    return { kind: "support", section: "notices" };
  }
  if (h.includes("cdic") || h.includes("deposit-insurance")) {
    return { kind: "support", section: "cdic" };
  }
  if (h.includes("security") || l.includes("fraud") || l.includes("stolen") || l.includes("privacy") || l.includes("wrongdoing")) {
    return { kind: "support", section: "security" };
  }
  if (h.includes("help") || h.includes("contact-us") || l.includes("complaint") || l.includes("address")) {
    return { kind: "support", section: "help" };
  }

  // Top-level segments
  if (h.endsWith("/business.html") || h.includes("/business/")) {
    return { kind: "segment", segment: "business" };
  }
  if (
    h.includes("wealth-management") ||
    h.includes("private-banking") ||
    h.includes("nbfwm") ||
    h.includes("nbim") ||
    h.includes("trust.html") ||
    h.includes("nbin")
  ) {
    return { kind: "segment", segment: "wealth" };
  }
  if (h.includes("about-us") || h.includes("careers") || h.includes("terms-of-use") || h.includes("accessibility")) {
    return { kind: "segment", segment: "about" };
  }

  // Product & Calculator Categories
  if (h.includes("rates")) return { kind: "category", slug: "rates" };
  if (h.includes("mastercard") || h.includes("credit-cards")) return { kind: "category", slug: "cards" };
  if (h.includes("mortgages")) return { kind: "category", slug: "mortgages" };
  if (
    h.includes("savings-investments") ||
    h.includes("cash-solution") ||
    h.includes("nbdb.ca")
  ) {
    return { kind: "category", slug: "savings" };
  }
  if (h.includes("borrowing") || h.includes("calculators")) return { kind: "category", slug: "borrowing" };
  if (h.includes("insurance")) return { kind: "category", slug: "insurance" };
  if (h.includes("advice")) return { kind: "category", slug: "advice" };
  if (h.includes("offers") || h.includes("students") || h.includes("newcomers")) {
    return { kind: "category", slug: "offers" };
  }
  if (h.includes("accounts")) return { kind: "category", slug: "accounts" };

  return { kind: "home" };
}
