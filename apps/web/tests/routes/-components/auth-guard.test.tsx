import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthGuard } from "@/routes/-components/auth-guard";

const { auth } = vi.hoisted(() => ({
  auth: {
    isLoading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    user: null as { email: string } | null,
  },
}));

vi.mock("@workos-inc/authkit-react", () => ({
  useAuth: () => auth,
}));

describe("AuthGuard", () => {
  beforeEach(() => {
    auth.isLoading = false;
    auth.user = null;
    auth.signIn.mockReset();
    auth.signOut.mockReset();
  });

  it("does not reveal protected content while authentication loads", () => {
    auth.isLoading = true;

    render(<AuthGuard returnTo="/account">Confidential records</AuthGuard>);

    screen.getByRole("status", { name: "Checking authentication" });
    expect(screen.queryByText("Confidential records")).toBeNull();
  });

  it("starts sign-in instead of revealing protected content", async () => {
    auth.signIn.mockResolvedValue(undefined);

    render(<AuthGuard returnTo="/account">Confidential records</AuthGuard>);

    await waitFor(() => {
      expect(auth.signIn).toHaveBeenCalledWith({
        state: { returnTo: "/account" },
      });
    });
    expect(screen.queryByText("Confidential records")).toBeNull();
  });

  it("renders protected content for an authenticated user", () => {
    auth.user = { email: "user@example.com" };

    render(<AuthGuard returnTo="/account">Confidential records</AuthGuard>);

    screen.getByText("Confidential records");
  });
});
