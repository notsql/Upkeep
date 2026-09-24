import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginPage } from "@/routes/login";

const { signIn } = vi.hoisted(() => ({ signIn: vi.fn() }));

vi.mock("@proj/env/web", () => ({
  env: {
    VITE_WORKOS_CLIENT_ID: "client_test",
  },
}));

vi.mock("@workos-inc/authkit-react", () => ({
  useAuth: () => ({ signIn }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    signIn.mockReset();
  });

  it("starts hosted sign-in and preserves the protected destination", async () => {
    signIn.mockResolvedValue(undefined);

    render(<LoginPage returnTo="/account" />);

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith({
        state: { returnTo: "/account" },
      });
    });
    screen.getByRole("status", { name: "Redirecting to sign in" });
  });

  it("shows an error and allows retrying when sign-in cannot start", async () => {
    signIn
      .mockRejectedValueOnce(new Error("WorkOS unavailable"))
      .mockResolvedValueOnce(undefined);

    render(<LoginPage returnTo="/account" />);

    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledTimes(2);
    });
  });
});
