import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AdminDashboard from "../components/AdminDashboard";
import ClientWorkspace, { CLIENT_TABS } from "../components/admin/ClientWorkspace";
import { INITIAL_PROFILES, INITIAL_BANK_CONFIG } from "../banking/bankingTypes";
import type { GlobalBankConfig } from "../banking/bankingTypes";
import type { AdminOps, ManagedUserEntry } from "../banking/adminOps";
import { ensureProfileShape } from "../lib/profileNormalize";

/**
 * Navigation is the feature here: an administrator must be able to tell, at a
 * glance, which client they are looking at. These tests pin the shape of that
 * console down — one file per client, and no global page where two clients'
 * ledgers can be confused.
 */

const users: ManagedUserEntry[] = [
  {
    key: "personal",
    builtIn: true,
    profile: ensureProfileShape({
      ...INITIAL_PROFILES.personal,
      supportThread: [
        {
          id: "m1",
          side: "client",
          body: "My card was declined this morning.",
          createdAt: "2026-11-15T09:00:00.000Z",
          readByClient: true,
          readBySupport: false,
          awaitingDesk: true,
        },
      ],
    }),
  },
  { key: "business", builtIn: true, profile: ensureProfileShape({ ...INITIAL_PROFILES.business }) },
  { key: "wealth", builtIn: true, profile: ensureProfileShape({ ...INITIAL_PROFILES.wealth }) },
];

const ops: AdminOps = {
  users,
  identity: { name: "Test Admin", email: "admin@nbc.ca", role: "superadmin" },
  approvals: [],
  onUpdateUser: vi.fn(),
  onCreateUser: vi.fn(),
  onDeleteCustomUser: vi.fn(),
  onImpersonateUser: vi.fn(),
  onRequestApproval: vi.fn(),
  onDecideApproval: vi.fn(),
  onRestoreBackup: vi.fn(),
  onSetIdentity: vi.fn(),
  notify: vi.fn(),
};

const dashboardProps = {
  users,
  identity: ops.identity,
  approvals: [],
  bankConfig: INITIAL_BANK_CONFIG as GlobalBankConfig,
  auditLogs: [],
  onUpdateUser: vi.fn(),
  onCreateUser: vi.fn(),
  onDeleteCustomUser: vi.fn(),
  onImpersonateUser: vi.fn(),
  onRequestApproval: vi.fn(),
  onDecideApproval: vi.fn(),
  onRestoreBackup: vi.fn(),
  onSetIdentity: vi.fn(),
  onUpdateBankConfig: vi.fn(),
  onFactoryReset: vi.fn(),
  onGoPublicSite: vi.fn(),
  onSignOut: vi.fn(),
};

describe("back-office navigation", () => {
  it("offers client-owned pages only inside a client file", () => {
    const markup = renderToStaticMarkup(<AdminDashboard {...dashboardProps} />);

    // Top-level sections.
    expect(markup).toContain("Support inbox");
    expect(markup).toContain("Approvals");
    expect(markup).toContain("Audit log");

    // The old global pages are gone: no section may show another client's ledger.
    const nav = markup.slice(markup.indexOf("Administration section"), markup.indexOf("</aside>"));
    expect(nav).not.toContain(">Transactions<");
    expect(nav).not.toContain(">Accounts<");
    expect(nav).not.toContain(">Cards<");
  });

  it("shows every client-owned page as a tab inside their file", () => {
    expect(CLIENT_TABS.map((tab) => tab.label)).toEqual([
      "Overview",
      "Transactions",
      "Accounts",
      "Cards",
      "Support",
    ]);
  });

  it("renders one client's file at a time", () => {
    const markup = renderToStaticMarkup(
      <ClientWorkspace
        ops={ops}
        clientKey="personal"
        clientTab="overview"
        onSelectClient={vi.fn()}
        onSelectTab={vi.fn()}
        directoryOpen={false}
        onDirectoryChange={vi.fn()}
        onOpenTab={vi.fn()}
      />
    );

    expect(markup).toContain(INITIAL_PROFILES.personal.fullName);
    expect(markup).toContain(INITIAL_PROFILES.personal.email);
    // The client rail lists everyone to switch to…
    expect(markup).toContain(INITIAL_PROFILES.business.fullName);
    // …but the file itself only carries this client's numbers.
    expect(markup).toContain("Recent transactions");
    expect(markup).toContain("Open conversation");
  });

  it("opens the client's own support thread, not the whole inbox", () => {
    const markup = renderToStaticMarkup(
      <ClientWorkspace
        ops={ops}
        clientKey="personal"
        clientTab="support"
        onSelectClient={vi.fn()}
        onSelectTab={vi.fn()}
        directoryOpen={false}
        onDirectoryChange={vi.fn()}
        onOpenTab={vi.fn()}
      />
    );

    expect(markup).toContain("Support conversation");
    expect(markup).toContain("My card was declined this morning.");
    // The inbox list and its counters are not part of a single client's file.
    expect(markup).not.toContain("Support inbox");
    // Still branded "Support" for the customer.
    expect(markup).toContain("National Bank Support");
  });

  it("can show the full directory when the admin asks for it", () => {
    const markup = renderToStaticMarkup(
      <ClientWorkspace
        ops={ops}
        clientKey="personal"
        clientTab="overview"
        onSelectClient={vi.fn()}
        onSelectTab={vi.fn()}
        directoryOpen
        onDirectoryChange={vi.fn()}
        onOpenTab={vi.fn()}
      />
    );

    expect(markup).toContain("Client directory");
    expect(markup).not.toContain("Recent transactions");
  });
});
