import { afterEach, describe, expect, it, vi } from "vitest";

import { restoreReturnTo, sanitizeReturnTo } from "@/lib/auth-redirect";

afterEach(() => {
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
});

describe("sanitizeReturnTo", () => {
  it("keeps same-origin application paths", () => {
    expect(sanitizeReturnTo("/account?tab=profile#details")).toBe(
      "/account?tab=profile#details"
    );
  });

  it.each([
    "https://attacker.example/account",
    "//attacker.example/account",
    "javascript:alert(1)",
    "not a path",
  ])("rejects unsafe return location %j", (returnTo) => {
    expect(sanitizeReturnTo(returnTo)).toBe("/");
  });
});

describe("restoreReturnTo", () => {
  it("navigates without reloading the authenticated application", () => {
    const popStateListener = vi.fn();
    window.addEventListener("popstate", popStateListener);

    restoreReturnTo("/account?tab=profile");

    expect(window.location.pathname).toBe("/account");
    expect(window.location.search).toBe("?tab=profile");
    expect(popStateListener).toHaveBeenCalledOnce();

    window.removeEventListener("popstate", popStateListener);
  });
});
