import { describe, expect, it, vi } from "vitest";

describe("authentication session transitions", () => {
  it("requests authentication when a session refresh fails", async () => {
    vi.resetModules();
    const { reauthenticateAfterRefreshFailure } = await import(
      "@/lib/auth-session"
    );
    const signIn = vi.fn().mockResolvedValue(undefined);

    reauthenticateAfterRefreshFailure(signIn, "/account");

    expect(signIn).toHaveBeenCalledWith({
      state: { returnTo: "/account" },
    });
  });

  it("does not restart authentication while signing out", async () => {
    vi.resetModules();
    const { reauthenticateAfterRefreshFailure, startSignOut } = await import(
      "@/lib/auth-session"
    );
    const signOut = vi.fn();
    const signIn = vi.fn().mockResolvedValue(undefined);

    startSignOut(signOut, "http://localhost:3001");
    reauthenticateAfterRefreshFailure(signIn, "/account");

    expect(signOut).toHaveBeenCalledWith({
      returnTo: "http://localhost:3001",
    });
    expect(signIn).not.toHaveBeenCalled();
  });
});
