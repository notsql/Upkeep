import { fireEvent } from "@testing-library/react";
import { ownerEstateAccess, workspaceAccess } from "@tests/fixtures/access";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Header from "@/components/shell/header";

const ESTATE_NAME = /estate/iu;
const THEME_MODE = /Switch to .* mode/u;
const { auth, state } = vi.hoisted(() => ({
  auth: {
    loading: false,
    user: null as { id: string; email: string } | null,
  },
  state: { pathname: "/estates/pine", canCreateEstate: true },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    activeOptions: _activeOptions,
    ...props
  }: {
    children: ReactNode;
    to: string;
    params?: { estateId: string };
    activeOptions?: unknown;
  }) => (
    <a href={to.replace("$estateId", params?.estateId ?? "")} {...props}>
      {children}
    </a>
  ),
  useRouterState: ({ select }: { select: (value: unknown) => unknown }) =>
    select({ location: { pathname: state.pathname, search: {} } }),
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => auth,
}));
vi.mock("@/lib/estates", () => ({
  useEstate: () => ({ data: undefined }),
}));
vi.mock("@/lib/api", () => ({
  api: {
    GET: async () => ({
      data: { ...workspaceAccess, canCreateEstate: state.canCreateEstate },
      response: new Response(),
    }),
  },
}));
describe("Header", () => {
  beforeEach(() => {
    auth.loading = false;
    auth.user = null;
    state.pathname = "/estates/pine";
    state.canCreateEstate = true;
  });
  it("uses Sign in in the public header without duplicating home registration", () => {
    renderWithProviders(<Header />);
    expect(screen.queryByRole("link", { name: "Register" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Create account" })).toBeNull();
    expect(
      screen.getByRole<HTMLAnchorElement>("link", { name: "Sign in" }).href
    ).toContain("/api/auth/sign-in");
    expect(screen.queryByRole("button", { name: ESTATE_NAME })).toBeNull();
  });
  it("offers account settings and logout through the signed-in profile menu", async () => {
    auth.user = { id: "owner", email: "user@example.com" };
    renderWithProviders(<Header />);
    screen.getByRole("button", { name: THEME_MODE });
    fireEvent.click(screen.getByRole("button", { name: "Open account menu" }));
    expect(
      (
        await screen.findByRole<HTMLAnchorElement>("menuitem", {
          name: "Account settings",
        })
      ).href
    ).toContain("/account");
    expect(
      screen.getByRole<HTMLAnchorElement>("menuitem", { name: "Sign out" }).href
    ).toContain("/logout");
  });
  it("shows the current estate and role in the switcher", async () => {
    auth.user = { id: "owner", email: "user@example.com" };
    renderWithProviders(<Header />);
    const trigger = await screen.findByRole("button", {
      name: `Switch estate: ${ownerEstateAccess.estateName}`,
    });
    within(trigger).getByText("Manager");
    fireEvent.click(trigger);
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
  it.each(["/estates", "/estates/new", "/account", "/admin/users"])(
    "reads Select estate outside an estate on %s",
    async (pathname) => {
      state.pathname = pathname;
      auth.user = { id: "owner", email: "user@example.com" };
      renderWithProviders(<Header />);
      await screen.findByRole("button", {
        name: "Switch estate: Select estate",
      });
    }
  );
  it("hides Create estate without the capability", async () => {
    state.canCreateEstate = false;
    auth.user = { id: "owner", email: "user@example.com" };
    renderWithProviders(<Header />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: `Switch estate: ${ownerEstateAccess.estateName}`,
      })
    );
    const menu = within(
      await screen.findByRole("menu", { name: "Switch estate" })
    );
    menu.getByRole("menuitem", { name: "All estates" });
    expect(menu.queryByRole("menuitem", { name: "Create estate" })).toBeNull();
  });
});
