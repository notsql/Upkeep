import { renderWithProviders, screen } from "@tests/test-utils";
import { expect, it } from "vitest";
import { LoadingState } from "@/components/states/loading-state";

it("announces what is loading as a busy status", () => {
  renderWithProviders(<LoadingState label="Loading work orders…" />);
  const status = screen.getByRole("status", { name: "Loading work orders…" });
  expect(status.getAttribute("aria-busy")).toBe("true");
});

it("renders the requested number of placeholder rows for each variant", () => {
  for (const variant of ["list", "table", "cards"] as const) {
    const { container, unmount } = renderWithProviders(
      <LoadingState label="Loading" rows={4} variant={variant} />
    );
    expect(container.querySelectorAll("[data-slot=loading-row]").length).toBe(
      4
    );
    unmount();
  }
});
