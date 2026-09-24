import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/components/auth-provider";

const { auth } = vi.hoisted(() => ({
  auth: {
    getAccessToken: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn(),
    user: { email: "user@example.com" } as { email: string } | null,
  },
}));

vi.mock("@proj/env/web", () => ({
  env: {
    VITE_AUTH_IDLE_TIMEOUT_MINUTES: 30,
    VITE_WORKOS_CLIENT_ID: "client_test",
    VITE_WORKOS_REDIRECT_URI: "http://localhost:3001",
  },
}));

vi.mock("@workos-inc/authkit-react", () => ({
  AuthKitProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => auth,
}));

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    auth.signOut.mockReset();
    auth.user = { email: "user@example.com" };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("times out a signed-in session while viewing a public page", async () => {
    render(
      <AuthProvider>
        <p>Public home page</p>
      </AuthProvider>
    );

    screen.getByText("Public home page");
    await vi.advanceTimersByTimeAsync(29 * 60 * 1000);
    fireEvent.keyDown(window, { key: "Tab" });
    await vi.advanceTimersByTimeAsync(29 * 60 * 1000);
    expect(auth.signOut).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60 * 1000);

    expect(auth.signOut).toHaveBeenCalledWith({
      returnTo: `${window.location.origin}/login`,
    });
  });

  it("does not start an inactivity timer for signed-out visitors", async () => {
    auth.user = null;

    render(
      <AuthProvider>
        <p>Public home page</p>
      </AuthProvider>
    );

    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);

    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
