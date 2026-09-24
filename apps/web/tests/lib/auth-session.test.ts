import { describe, expect, it, vi } from "vitest";

describe("authentication session transitions", () => {
  it("requests authentication when a session refresh fails", async () => {
    vi.resetModules();
    const { reauthenticateAfterRefreshFailure } = await import(
      "@/lib/auth-session"
    );
    const signIn = vi.fn().mockResolvedValue(undefined);

    await reauthenticateAfterRefreshFailure(signIn, "/account", vi.fn());

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
    await reauthenticateAfterRefreshFailure(signIn, "/account", vi.fn());

    expect(signOut).toHaveBeenCalledWith({
      returnTo: "http://localhost:3001",
    });
    expect(signIn).not.toHaveBeenCalled();
  });

  it("reports a failure to restart authentication", async () => {
    vi.resetModules();
    const { reauthenticateAfterRefreshFailure } = await import(
      "@/lib/auth-session"
    );
    const error = new Error("WorkOS unavailable");
    const signIn = vi.fn().mockRejectedValue(error);
    const onFailure = vi.fn();

    await reauthenticateAfterRefreshFailure(signIn, "/account", onFailure);

    expect(onFailure).toHaveBeenCalledWith(error);
  });
});
