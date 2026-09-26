import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/components/auth-provider";

const { auth, startServerSignOut } = vi.hoisted(() => ({
  auth: {
    getAccessToken: vi.fn().mockResolvedValue(undefined),
    user: { email: "user@example.com" } as { email: string } | null,
  },
  startServerSignOut: vi.fn(),
}));

vi.mock("@proj/env/web", () => ({
  env: {
    VITE_AUTH_IDLE_TIMEOUT_MINUTES: 30,
  },
}));

vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  AuthKitProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => auth,
  useAccessToken: () => ({ getAccessToken: auth.getAccessToken }),
}));

vi.mock("@/lib/auth-redirect", () => ({
  startServerSignOut,
}));

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startServerSignOut.mockReset();
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
    expect(startServerSignOut).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60 * 1000);

    expect(startServerSignOut).toHaveBeenCalledWith("/login");
  });

  it("does not start an inactivity timer for signed-out visitors", async () => {
    auth.user = null;

    render(
      <AuthProvider>
        <p>Public home page</p>
      </AuthProvider>
    );

    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);

    expect(startServerSignOut).not.toHaveBeenCalled();
  });
});
