import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Header from "@/components/header";

const { auth } = vi.hoisted(() => ({
  auth: {
    loading: false,
    user: null as { email: string } | null,
  },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => auth,
}));

describe("Header", () => {
  beforeEach(() => {
    auth.loading = false;
    auth.user = null;
  });

  it("offers registration and login only to signed-out users", () => {
    render(<Header />);

    screen.getByRole("link", { name: "Register" });
    expect(
      screen.getByRole<HTMLAnchorElement>("link", { name: "Log in" }).href
    ).toContain("/api/auth/sign-in");
    expect(screen.queryByRole("link", { name: "Account" })).toBeNull();
  });

  it("offers account access and logout only to signed-in users", () => {
    auth.user = { email: "user@example.com" };

    render(<Header />);

    screen.getByRole("link", { name: "Account" });
    expect(
      screen.getByRole<HTMLAnchorElement>("link", { name: "Sign out" }).href
    ).toContain("/logout");
    expect(screen.queryByRole("link", { name: "Register" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
  });
});
