import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoginPage } from "@/routes/login";

describe("LoginPage", () => {
  it("links to hosted sign-in while preserving the protected destination", () => {
    render(<LoginPage returnTo="/account" />);

    const link = screen.getByRole<HTMLAnchorElement>("link", {
      name: "Continue to secure sign in",
    });
    expect(link.getAttribute("href")).toBe(
      "/api/auth/sign-in?returnPathname=%2Faccount"
    );
  });

  it("shows a retryable message after an authentication callback failure", () => {
    render(<LoginPage error="auth_failed" returnTo="/account" />);

    expect(screen.getByRole("alert").textContent).toContain(
      "Authentication failed or expired"
    );
    screen.getByRole("link", { name: "Continue to secure sign in" });
  });
});
