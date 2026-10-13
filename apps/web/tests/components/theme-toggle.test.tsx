import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import { beforeEach, expect, it } from "vitest";
import { ThemeToggle } from "@/components/theme-toggle";

beforeEach(() => localStorage.clear());
it("switches modes and saves the selected preference", async () => {
  renderWithProviders(<ThemeToggle />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Switch to light mode" })
  );
  await waitFor(() => expect(localStorage.getItem("theme")).toBe("light"));
  fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
  await waitFor(() => expect(localStorage.getItem("theme")).toBe("dark"));
});
