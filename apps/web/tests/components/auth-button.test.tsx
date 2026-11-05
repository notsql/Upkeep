import { fireEvent } from "@testing-library/react";
import { workspaceAccess } from "@tests/fixtures/access";
import { renderWithProviders, screen } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthButton } from "@/components/auth-button";

const { state } = vi.hoisted(() => ({ state: { admin: false } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({
    loading: false,
    user: { id: "u", email: "user@example.com" },
  }),
}));
vi.mock("@/lib/api", () => ({
  api: {
    GET: async () => ({
      data: { ...workspaceAccess, canAccessPlatformAdmin: state.admin },
      response: new Response(),
    }),
  },
}));

async function openMenu() {
  renderWithProviders(<AuthButton />);
  fireEvent.click(screen.getByRole("button", { name: "Open account menu" }));
  return await screen.findByRole("menuitem", { name: "Sign out" });
}

describe("AuthButton", () => {
  beforeEach(() => {
    state.admin = false;
  });
  it("offers only Account settings and Sign out to ordinary users", async () => {
    const signOut = await openMenu();
    screen.getByText("user@example.com");
    expect(signOut.getAttribute("href")).toBe("/logout");
    expect(
      screen
        .getByRole("menuitem", { name: "Account settings" })
        .getAttribute("href")
    ).toBe("/account");
    expect(screen.getAllByRole("menuitem")).toHaveLength(2);
  });
  it("adds Admin users for platform admins", async () => {
    state.admin = true;
    await openMenu();
    const admin = await screen.findByRole("menuitem", { name: "Admin users" });
    expect(admin.getAttribute("href")).toBe("/admin/users");
    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
  });
});
