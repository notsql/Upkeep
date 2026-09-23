import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RegistrationPage } from "@/routes/register";

describe("Registration password", () => {
  it.each([
    ["", false],
    ["Aa1!aaa", false],
    ["aa1!aaaa", false],
    ["AA1!AAAA", false],
    ["Aa!aaaaa", false],
    ["Aa1aaaaa", false],
    ["Aa1 aaaa", false],
    ["Aa1!aaaa", true],
  ])("validates password complexity for %j", (value, valid) => {
    render(<RegistrationPage />);
    const password = screen.getByLabelText<HTMLInputElement>("Password");

    fireEvent.change(password, { target: { value } });

    expect(password.checkValidity()).toBe(valid);
  });

  it("updates the requirements as the password changes", () => {
    render(<RegistrationPage />);
    const password = screen.getByLabelText("Password");

    fireEvent.change(password, { target: { value: "Aa1!aaaa" } });
    expect(screen.getByRole("status").textContent).toContain(
      "Password meets all requirements."
    );

    fireEvent.change(password, { target: { value: "weak" } });
    expect(screen.getByRole("status").textContent).toContain(
      "Password does not meet all requirements."
    );
  });
});
