import { fireEvent } from "@testing-library/react";
import {
  ownerEstateAccess,
  residentAccess,
  workspaceAccess,
} from "@tests/fixtures/access";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/shell/app-shell";

const { state } = vi.hoisted(() => ({
  state: {
    pathname: "/estates/e/assets",
    hash: "",
    role: "user",
    resident: false,
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
      data: state.resident
        ? residentAccess
        : {
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

async function sidebar() {
  return within(await screen.findByRole("navigation", { name: "Sidebar" }));
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
  state.resident = false;
  state.estate = {
    name: "Maple Estate",
    owned: true,
    canInviteMembers: true,
    canManageInvitationPermissions: true,
  };
});

function renderShell() {
  renderWithProviders(
    <AppShell>
      <main>Content</main>
    </AppShell>
  );
}

describe("app shell", () => {
  it("replaces the sidebar with a bottom bar on mobile", async () => {
    window.innerWidth = 375;
    renderShell();
    const bar = within(
      await screen.findByRole("navigation", { name: "Estate sections" })
    );
    await bar.findByRole("link", { name: "Assets" });
    expect(screen.queryByRole("navigation", { name: "Sidebar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Toggle Sidebar" })).toBeNull();
    expect(screen.getAllByRole("link", { name: "UpKeep" })).toHaveLength(1);
  });
  it("shows the estate sidebar and header switcher inside an estate", async () => {
    renderShell();
    const nav = await sidebar();
    expect(
      (await nav.findByRole("link", { name: "Assets" })).getAttribute(
        "aria-current"
      )
    ).toBe("page");
    await screen.findByRole("button", { name: SWITCH_ESTATE });
    expect(screen.queryByRole("button", { name: "Toggle Sidebar" })).toBeNull();
  });
  it("shows the UpKeep brand once, at the top of the sidebar", async () => {
    renderShell();
    await sidebar();
    const brands = screen.getAllByRole("link", { name: "UpKeep" });
    expect(brands).toHaveLength(1);
    expect(brands[0]?.closest('[data-slot="sidebar-header"]')).not.toBeNull();
  });
  it("shows the resident sidebar on /reports", async () => {
    state.pathname = "/reports";
    state.resident = true;
    renderShell();
    const nav = await sidebar();
    await nav.findByRole("link", { name: "My reports" });
  });
  it("shows the resident sidebar on / for a resident-only account", async () => {
    state.pathname = "/";
    state.resident = true;
    renderShell();
    const nav = await sidebar();
    await nav.findByRole("link", { name: "Dashboard" });
  });
  it.each([
    "/",
    "/estates",
    "/estates/new",
    "/account",
    "/admin/users",
    "/invitations",
  ])(
    "renders %s full width with only account links in the account menu",
    async (pathname) => {
      state.pathname = pathname;
      state.role = "admin";
      renderShell();
      screen.getByRole("main");
      expect(
        screen.queryByRole("button", { name: "Toggle Sidebar" })
      ).toBeNull();
      expect(screen.queryByRole("navigation", { name: "Sidebar" })).toBeNull();
      await screen.findByRole("button", { name: SWITCH_ESTATE });
      fireEvent.click(
        screen.getByRole("button", { name: "Open account menu" })
      );
      await screen.findByRole("menuitem", { name: "Admin users" });
      screen.getByRole("menuitem", { name: "Account settings" });
      screen.getByRole("menuitem", { name: "Sign out" });
      expect(screen.getAllByRole("menuitem")).toHaveLength(3);
    }
  );
  it("puts the skip link first in the tab order, pointing at the main content", async () => {
    renderShell();
    await sidebar();
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
  it("keeps the public header for signed-out visitors", () => {
    state.user = null;
    renderShell();
    expect(screen.queryByRole("navigation", { name: "Sidebar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Toggle Sidebar" })).toBeNull();
    screen.getByRole("link", { name: "Sign in" });
  });
});
