import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import { expect, it, vi } from "vitest";
import { ErrorState } from "@/components/states/error-state";

it("announces the failure and retries", () => {
  const onRetry = vi.fn();
  renderWithProviders(
    <ErrorState message="Unable to load work orders" onRetry={onRetry} />
  );
  const alert = screen.getByRole("alert");
  within(alert).getByText("Unable to load work orders");
  fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
  expect(onRetry).toHaveBeenCalledOnce();
});

it("takes a specific retry label", () => {
  renderWithProviders(
    <ErrorState message="x" onRetry={vi.fn()} retryLabel="Retry documents" />
  );
  screen.getByRole("button", { name: "Retry documents" });
});

it("takes a specific accessible name for retry", () => {
  renderWithProviders(
    <ErrorState
      message="x"
      onRetry={vi.fn()}
      retryAriaLabel="Retry asset link for a.pdf"
    />
  );
  screen.getByRole("button", { name: "Retry asset link for a.pdf" });
});
