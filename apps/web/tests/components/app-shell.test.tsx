import { fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";
import { renderWithProviders, screen, within } from "../test-utils";

const { state } = vi.hoisted(() => ({
  state: {
    pathname: "/estates/e/assets",
    hash: "",
    role: "user",
    user: { email: "owner@example.com" } as { email: string } | null,
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
    select({ location: { pathname: state.pathname, hash: state.hash } }),
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: state.user, role: state.role, loading: false }),
}));
vi.mock("@/lib/estates", () => ({ useEstate: () => ({ data: state.estate }) }));
vi.mock("@/components/estates/estate-switcher", () => ({
  EstateSwitcher: () => <span>Current estate: Maple Estate</span>,
}));
beforeEach(() => {
  state.pathname = "/estates/e/assets";
  state.hash = "";
  state.user = { email: "owner@example.com" };
  state.role = "user";
  state.estate = {
    name: "Maple Estate",
    owned: true,
    canInviteMembers: true,
    canManageInvitationPermissions: true,
  };
});
describe("dashboard navigation", () => {
  it("moves desktop account access to the profile menu while retaining mobile Account", () => {
    state.pathname = "/estates";
    renderWithProviders(
      <AppShell>
        <main>Content</main>
      </AppShell>
    );
    expect(
      within(
        screen.getByRole("navigation", { name: "Desktop navigation" })
      ).queryByRole("link", { name: "Account" })
    ).toBeNull();
    within(
      screen.getByRole("navigation", { name: "Mobile navigation" })
    ).getByRole("link", { name: "Account" });
    screen.getByRole("button", { name: "Open account menu" });
  });
  it("marks the asset destination current and supplies estate-specific links", () => {
    renderWithProviders(
      <AppShell>
        <main>Content</main>
      </AppShell>
    );
    const nav = within(
      screen.getByRole("navigation", { name: "Desktop navigation" })
    );
    expect(
      nav.getByRole("link", { name: "Assets" }).getAttribute("aria-current")
    ).toBe("page");
    expect(
      nav.getByRole<HTMLAnchorElement>("link", { name: "Council" }).href
    ).toContain("/estates/e/council");
    screen.getByRole("link", { name: "Skip to content" });
    const mobile = within(
      screen.getByRole("navigation", { name: "Mobile navigation" })
    );
    mobile.getByRole("link", { name: "Estates" });
    mobile.getByRole("link", { name: "Overview" });
    mobile.getByRole("link", { name: "Assets" });
    mobile.getByRole("button", { name: "More navigation" });
  });
  it("hides estate features outside an estate and admin features from ordinary users", () => {
    state.pathname = "/estates";
    renderWithProviders(
      <AppShell>
        <main>Content</main>
      </AppShell>
    );
    const nav = within(
      screen.getByRole("navigation", { name: "Desktop navigation" })
    );
    expect(nav.queryByRole("link", { name: "Assets" })).toBeNull();
    expect(nav.queryByRole("link", { name: "Council" })).toBeNull();
    expect(nav.queryByRole("link", { name: "Admin users" })).toBeNull();
  });
  it("preserves member and delegate permission boundaries", () => {
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
    const nav = within(
      screen.getByRole("navigation", { name: "Desktop navigation" })
    );
    expect(nav.queryByRole("link", { name: "Assets" })).toBeNull();
    nav.getByRole("link", { name: "Council" });
  });
  it("keeps Account in mobile More without duplicating the Locations section", async () => {
    renderWithProviders(
      <AppShell>
        <main>Content</main>
      </AppShell>
    );
    fireEvent.click(
      within(
        screen.getByRole("navigation", { name: "Mobile navigation" })
      ).getByRole("button", { name: "More navigation" })
    );
    await screen.findByRole("menuitem", { name: "Account" });
    expect(screen.queryByRole("menuitem", { name: "Locations" })).toBeNull();
  });
  it("keeps the public header for signed-out visitors", () => {
    state.user = null;
    renderWithProviders(
      <AppShell>
        <main>Content</main>
      </AppShell>
    );
    expect(
      screen.queryByRole("navigation", { name: "Desktop navigation" })
    ).toBeNull();
    screen.getByRole("link", { name: "Sign in" });
  });
});
