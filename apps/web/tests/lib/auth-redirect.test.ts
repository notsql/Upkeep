import { describe, expect, it } from "vitest";

import {
  buildSignInPath,
  buildSignOutPath,
  sanitizeReturnTo,
} from "@/lib/auth-redirect";

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

describe("buildSignInPath", () => {
  it("preserves a safe protected destination", () => {
    expect(buildSignInPath("/account?tab=profile")).toBe(
      "/api/auth/sign-in?returnPathname=%2Faccount%3Ftab%3Dprofile"
    );
  });

  it("replaces an external destination with the application home page", () => {
    expect(buildSignInPath("https://attacker.example/account")).toBe(
      "/api/auth/sign-in?returnPathname=%2F"
    );
  });
});

describe("buildSignOutPath", () => {
  it("sends inactivity logout to the login page", () => {
    expect(buildSignOutPath("/login")).toBe("/logout?returnTo=%2Flogin");
  });

  it("rejects an external post-logout destination", () => {
    expect(buildSignOutPath("https://attacker.example")).toBe(
      "/logout?returnTo=%2F"
    );
  });
});
