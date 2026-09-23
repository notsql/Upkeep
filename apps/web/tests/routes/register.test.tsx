import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RegistrationPage } from "@/routes/register";

const { signUp } = vi.hoisted(() => ({ signUp: vi.fn() }));
const HOSTED_FIELDS_MESSAGE =
  /workos will securely collect your name and password/i;

vi.mock("@proj/env/web", () => ({
  env: {
    VITE_WORKOS_CLIENT_ID: "client_test",
  },
}));

vi.mock("@workos-inc/authkit-react", () => ({
  useAuth: () => ({ signUp }),
}));

describe("RegistrationPage", () => {
  beforeEach(() => {
    signUp.mockReset();
  });

  it("starts the hosted WorkOS sign-up flow with the entered email", async () => {
    signUp.mockResolvedValue(undefined);
    render(<RegistrationPage />);

    fireEvent.change(screen.getByRole("textbox", { name: "Email address" }), {
      target: { value: "new.user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith({
        loginHint: "new.user@example.com",
      });
    });
  });

  it("does not collect a password before redirecting to WorkOS", () => {
    render(<RegistrationPage />);

    expect(screen.queryByLabelText("Password")).toBeNull();
    screen.getByText(HOSTED_FIELDS_MESSAGE);
  });

  it("shows an error and allows retrying when WorkOS cannot start", async () => {
    signUp.mockRejectedValueOnce(new Error("WorkOS unavailable"));
    render(<RegistrationPage />);

    fireEvent.change(screen.getByRole("textbox", { name: "Email address" }), {
      target: { value: "new.user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Unable to start registration. Please try again."
    );
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Create account" })
        .disabled
    ).toBe(false);
  });
});
