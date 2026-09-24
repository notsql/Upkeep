import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Header from "@/components/header";

const { auth } = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    user: null as { email: string } | null,
  },
}));

vi.mock("@proj/env/web", () => ({
  env: { VITE_WORKOS_CLIENT_ID: "client_test" },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@workos-inc/authkit-react", () => ({
  useAuth: () => auth,
}));

describe("Header", () => {
  beforeEach(() => {
    auth.isLoading = false;
    auth.signIn.mockReset();
    auth.signOut.mockReset();
    auth.user = null;
  });

  it("offers registration and login only to signed-out users", () => {
    render(<Header />);

    screen.getByRole("link", { name: "Register" });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(auth.signIn).toHaveBeenCalledOnce();
    expect(screen.queryByRole("link", { name: "Account" })).toBeNull();
  });

  it("offers account access and logout only to signed-in users", () => {
    auth.user = { email: "user@example.com" };

    render(<Header />);

    screen.getByRole("link", { name: "Account" });
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(auth.signOut).toHaveBeenCalledWith({
      returnTo: window.location.origin,
    });
    expect(screen.queryByRole("link", { name: "Register" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Log in" })).toBeNull();
  });
});
