# Why a refresh kept landing on `#/dashboard/business?tab=cards`

## Symptom

A signed-in business client browsed Cash position → Statements → Wires & tax
remittances, then pressed reload and was put back on **Corporate cards**, with
the address bar showing:

```
https://nbcbank.vercel.app/#/dashboard/business?tab=cards
```

## Cause

The app has one source of truth for "where am I": the hash in the address bar.

- `App.tsx` reads the hash once at mount (`hashToRoute`) and again on every
  `hashchange`, and keeps the route in React state.
- `navigate()` writes a new hash with `history.pushState` **only when the target
  hash differs from the current one**.
- `BusinessDashboard` held its active tab in local state only:
  `const [tab, setTab] = useState(initialTab)`. Clicking a tab changed the React
  state and nothing else.

So the dashboard could move between pages while the address stayed frozen on the
tab it was entered with — `cards`, because `openDashboardForProfile` opened every
business profile on Corporate cards. Reloading re-read that stale hash and
faithfully restored Cards. Nothing was redirecting: the URL had simply never
been updated to where the client actually was.

## Fix

The address now follows the tab, and the tab follows the address.

| Piece | File | Role |
| --- | --- | --- |
| `BUSINESS_PAGE_TO_ROUTE_TAB` | `src/banking/routeMapper.ts` | tab → URL tab (`treasury` ↔ `cash-position`, the rest 1:1) |
| `businessPageTabForRoute()` | `src/banking/routeMapper.ts` | URL tab → tab, used when the address drives the dashboard (`undefined` → Cash position) |
| `onSelectTab` prop | `src/components/BusinessDashboard.tsx` | every tab switch reports the routed tab to `App` |
| `setTab` wrapper | `src/components/BusinessDashboard.tsx` | updates state *and* the address |
| `initialTab` sync effect | `src/components/BusinessDashboard.tsx` | back/forward and external links move the visible tab |
| `navigate({ kind: "business-dashboard", tab })` | `src/App.tsx` | writes `#/dashboard/business?tab=…` |

Two related decisions:

- **Sign-in lands on Cash position**, not Corporate cards
  (`openDashboardForProfile`). The address records the tab now, so the tab the
  client sees has to be the one the address names.
- **`account` (a single account opened from Cash position) writes no hash.** It
  is a drill-down, not a page; `hashToRoute` maps `?tab=account` back to Cash
  position, so a refresh on the drill-down is safe rather than broken.

Back and forward now walk through the tabs that were visited, because each tab
switch is a `pushState` entry.

## Regression test

`src/__tests__/businessTabRouting.test.ts` pins the contract: every tab has a
distinct address, `tab → address → tab` round-trips, the default is Cash
position, `account` has no address, and the legacy `?tab=cards` link still
resolves.
