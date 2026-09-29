import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RegistrationPage } from "@/routes/register";

describe("RegistrationPage", () => {
  it("starts the hosted WorkOS sign-up flow", () => {
    render(<RegistrationPage />);

    expect(
      screen
        .getByRole<HTMLAnchorElement>("link", { name: "Create account" })
        .getAttribute("href")
    ).toBe("/api/auth/sign-up");
  });

  it("does not collect a password before redirecting to WorkOS", () => {
    render(<RegistrationPage />);

    expect(screen.queryByLabelText("Password")).toBeNull();
  });
  it("shows a retryable message when registration cannot start", () => {
    render(<RegistrationPage error="auth_unavailable" />);

    expect(screen.getByRole("alert").textContent).toContain(
      "Registration is temporarily unavailable"
    );
    screen.getByRole("link", { name: "Create account" });
  });
});
