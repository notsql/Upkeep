import { fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Header from "@/components/header";
import { renderWithProviders, screen } from "../test-utils";

const { auth } = vi.hoisted(() => ({
  auth: {
    loading: false,
    user: null as { email: string } | null,
  },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => auth,
}));

// The switcher fetches estates; it has its own tests.
vi.mock("@/components/estates/estate-switcher", () => ({
  EstateSwitcher: () => null,
}));

describe("Header", () => {
  beforeEach(() => {
    auth.loading = false;
    auth.user = null;
  });

  it("uses Sign in in the public header without duplicating home registration", () => {
    renderWithProviders(<Header />);

    expect(screen.queryByRole("link", { name: "Register" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Create account" })).toBeNull();
    expect(
      screen.getByRole<HTMLAnchorElement>("link", { name: "Sign in" }).href
    ).toContain("/api/auth/sign-in");
    expect(screen.queryByRole("link", { name: "Account" })).toBeNull();
  });

  it("offers settings and logout through the signed-in profile menu", async () => {
    auth.user = { email: "user@example.com" };

    renderWithProviders(<Header />);

    expect(screen.queryByRole("link", { name: "Account" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Sign out" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open account menu" }));
    expect(
      (
        await screen.findByRole<HTMLAnchorElement>("menuitem", {
          name: "Settings",
        })
      ).href
    ).toContain("/account");
    screen.getByText("user@example.com");
    expect(
      screen.getByRole<HTMLAnchorElement>("menuitem", { name: "Sign out" }).href
    ).toContain("/logout");
    expect(screen.queryByRole("link", { name: "Register" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });
});
