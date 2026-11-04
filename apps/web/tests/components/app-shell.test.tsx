import { fireEvent } from "@testing-library/react";
import { ownerEstateAccess, workspaceAccess } from "@tests/fixtures/access";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";

const { state } = vi.hoisted(() => ({
  state: {
    pathname: "/estates/e/assets",
    hash: "",
    role: "user",
    user: { id: "owner", email: "owner@example.com" } as {
      id: string;
      email: string;
    } | null,
    estate: {
      name: "Maple Estate",
      owned: true,
      canInviteMembers: true,
      canManageInvitationPermissions: true,
    },
  },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    hash,
    activeOptions: _activeOptions,
    ...props
  }: {
    children: ReactNode;
    to: string;
    params?: { estateId: string };
    hash?: string;
    activeOptions?: unknown;
  }) => (
    <a
      href={
        to.replace("$estateId", params?.estateId ?? "") +
        (hash ? `#${hash}` : "")
      }
      {...props}
    >
      {children}
    </a>
  ),
  useRouterState: ({ select }: { select: (value: unknown) => unknown }) =>
    select({
      location: { pathname: state.pathname, hash: state.hash, search: {} },
    }),
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: state.user, role: state.role, loading: false }),
}));
vi.mock("@/lib/estates", () => ({
  useEstate: () => ({ data: state.estate }),
  useEstateList: () => ({ data: [], isSuccess: true }),
}));
vi.mock("@/lib/api", () => ({
  api: {
    GET: async () => ({
      data: {
        ...workspaceAccess,
        canAccessPlatformAdmin: state.role === "admin",
        estates: [
          {
            ...ownerEstateAccess,
            estateId: "e",
            role: state.estate.owned ? "OWNER" : "COUNCIL",
            canManageEstate: state.estate.owned,
            canViewAssets: state.estate.owned,
            canViewInspectionResults: state.estate.owned,
            canCreateInspectionResults: state.estate.owned,
            canInviteMembers: state.estate.canInviteMembers,
            canManageInvitationPermissions:
              state.estate.canManageInvitationPermissions,
          },
        ],
      },
      response: new Response(),
    }),
  },
}));

async function desktopNavigation() {
  const nav = within(
    await screen.findByRole("navigation", { name: "Workspace navigation" })
  );
  await nav.findByRole("link", { name: "Home" });
  return nav;
}

const SWITCH_ESTATE = /Switch estate/u;
const desktopWidth = window.innerWidth;
afterEach(() => {
  window.innerWidth = desktopWidth;
});

beforeEach(() => {
  state.pathname = "/estates/e/assets";
  state.hash = "";
  state.user = { id: "owner", email: "owner@example.com" };
  state.role = "user";
  state.estate = {
    name: "Maple Estate",
    owned: true,
    canInviteMembers: true,
    canManageInvitationPermissions: true,
  };
});

describe("dashboard navigation", () => {
  it("opens the sidebar as a sheet on mobile with Home, Estates and Settings", async () => {
    window.innerWidth = 375;
    renderWithProviders(
      <AppShell>
        <main>Content</main>
      </AppShell>
    );
    expect(
      screen.queryByRole("navigation", { name: "Workspace navigation" })
    ).toBeNull();
    screen.getByRole("button", { name: "Open account menu" });
    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
    const mobile = await desktopNavigation();
    expect(mobile.queryByRole("link", { name: "Account" })).toBeNull();
    mobile.getByRole("link", { name: "Home" });
    mobile.getByRole("link", { name: "Estates" });
    mobile.getByRole("link", { name: "Settings" });
  });
  it("renders the estate directory full width with global links in the account menu", async () => {
    state.pathname = "/estates";
    state.role = "admin";
    renderWithProviders(
      <AppShell>
        <main>Content</main>
      </AppShell>
    );
    screen.getByRole("main");
    expect(screen.queryByRole("button", { name: "Toggle Sidebar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open account menu" }));
    const estates = await screen.findByRole<HTMLAnchorElement>("menuitem", {
      name: "Estates",
    });
    expect(estates.getAttribute("aria-current")).toBe("page");
    screen.getByRole("menuitem", { name: "Home" });
    expect(screen.queryByRole("menuitem", { name: "Invitations" })).toBeNull();
    screen.getByRole("menuitem", { name: "Admin users" });
    screen.getByRole("menuitem", { name: "Sign out" });
    expect(
      screen.queryByRole("navigation", { name: "Workspace navigation" })
    ).toBeNull();
  });
  it("offers All estates and Create estate from the estate switcher", async () => {
    renderWithProviders(
      <AppShell>
        <main>Content</main>
      </AppShell>
    );
    const nav = await desktopNavigation();
    fireEvent.click(await nav.findByRole("button", { name: SWITCH_ESTATE }));
    const menu = within(
      await screen.findByRole("menu", { name: "Switch estate" })
    );
    expect(
      menu.getByRole("menuitem", { name: "All estates" }).getAttribute("href")
    ).toBe("/estates");
    expect(
      menu.getByRole("menuitem", { name: "Create estate" }).getAttribute("href")
    ).toBe("/estates/new");
  });
  it("puts the skip link first in the tab order, pointing at the main content", async () => {
    renderWithProviders(
      <AppShell>
        <main>Content</main>
      </AppShell>
    );
    await desktopNavigation();
    const first = document.body.querySelector(
      "a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    const skip = screen.getByRole<HTMLAnchorElement>("link", {
      name: "Skip to content",
    });
    expect(first).toBe(skip);
    expect(skip.getAttribute("href")).toBe("#main-content");
    expect(document.querySelector("#main-content")?.textContent).toContain(
      "Content"
    );
  });
  it("marks the asset destination current and supplies estate-specific links", async () => {
    const originalMedia = window.matchMedia;
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      ...originalMedia(query),
      matches: query === "(max-width: 767px)",
    }));
    renderWithProviders(
      <AppShell>
        <main>Content</main>
      </AppShell>
    );
    const nav = await desktopNavigation();
    expect(
      nav.getByRole("link", { name: "Assets" }).getAttribute("aria-current")
    ).toBe("page");
    expect(
      nav.getByRole<HTMLAnchorElement>("link", { name: "Estate members" }).href
    ).toContain("/estates/e/council");
    screen.getByRole("link", { name: "Skip to content" });
    nav.getByRole("link", { name: "Estates" });
    nav.getByRole("link", { name: "Home" });
    expect(
      screen.queryByRole("navigation", { name: "Mobile navigation" })
    ).toBeNull();
    const context = within(
      screen.getByRole("navigation", { name: "Estate navigation" })
    );
    fireEvent.click(
      context.getByRole("button", { name: "Estate section: Assets" })
    );
    const sections = within(
      await screen.findByRole("menu", { name: "Estate sections" })
    );
    expect(
      sections.getByRole("menuitem", { name: "Overview" }).getAttribute("href")
    ).toBe("/estates/e");
    sections.getByRole("menuitem", { name: "Assets", current: "page" });
  });
  it.each([
    "/",
    "/account",
    "/invitations",
    "/admin/users",
    "/reports",
    "/reports/new",
    "/estates/new",
  ])(
    "renders %s full width with global links in the account menu",
    async (pathname) => {
      state.pathname = pathname;
      renderWithProviders(
        <AppShell>
          <main>Content</main>
        </AppShell>
      );
      screen.getByRole("main");
      expect(
        screen.queryByRole("button", { name: "Toggle Sidebar" })
      ).toBeNull();
      expect(
        screen.queryByRole("navigation", { name: "Workspace navigation" })
      ).toBeNull();
      fireEvent.click(
        screen.getByRole("button", { name: "Open account menu" })
      );
      await screen.findByRole("menuitem", { name: "Home" });
      screen.getByRole("menuitem", { name: "Estates" });
      expect(
        screen.getAllByRole("menuitem", { name: "Settings" })
      ).toHaveLength(1);
      expect(screen.queryByRole("menuitem", { name: "Assets" })).toBeNull();
      expect(
        screen.queryByRole("menuitem", { name: "Admin users" })
      ).toBeNull();
    }
  );
  it.each([
    [
      "Work orders",
      "Choose an estate for work orders",
      "/estates/e/work-orders",
    ],
    [
      "Respond to faults",
      "Choose an estate for fault reports",
      "/estates/e/reports",
    ],
  ])(
    "opens the estate chooser from the account menu's %s item",
    async (label, title, href) => {
      state.pathname = "/account";
      renderWithProviders(
        <AppShell>
          <main>Content</main>
        </AppShell>
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Open account menu" })
      );
      fireEvent.click(await screen.findByRole("menuitem", { name: label }));
      const dialog = within(await screen.findByRole("dialog", { name: title }));
      expect(
        dialog.getByRole("link", { name: "Pine Estate" }).getAttribute("href")
      ).toBe(href);
    }
  );
  it("keeps the account menu free of sidebar links inside an estate", async () => {
    renderWithProviders(
      <AppShell>
        <main>Content</main>
      </AppShell>
    );
    await desktopNavigation();
    fireEvent.click(screen.getByRole("button", { name: "Open account menu" }));
    await screen.findByRole("menuitem", { name: "Sign out" });
    expect(screen.queryByRole("menuitem", { name: "Home" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Estates" })).toBeNull();
  });
  it("preserves member and delegate permission boundaries", async () => {
    state.estate = {
      ...state.estate,
      owned: false,
      canInviteMembers: true,
      canManageInvitationPermissions: false,
    };
    renderWithProviders(
      <AppShell>
        <main>Content</main>
      </AppShell>
    );
    const nav = await desktopNavigation();
    expect(nav.queryByRole("link", { name: "Assets" })).toBeNull();
    nav.getByRole("link", { name: "Estate members" });
  });
  it("keeps Settings in the sidebar without duplicating the Locations section", async () => {
    renderWithProviders(
      <AppShell>
        <main>Content</main>
      </AppShell>
    );
    const nav = await desktopNavigation();
    nav.getByRole("link", { name: "Settings" });
    expect(nav.queryByRole("link", { name: "Locations" })).toBeNull();
  });
  it("keeps the public header for signed-out visitors", () => {
    state.user = null;
    renderWithProviders(
      <AppShell>
        <main>Content</main>
      </AppShell>
    );
    expect(
      screen.queryByRole("navigation", { name: "Workspace navigation" })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Toggle Sidebar" })).toBeNull();
    screen.getByRole("link", { name: "Sign in" });
  });
});
