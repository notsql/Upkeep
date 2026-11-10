import { renderWithProviders, screen, within } from "@tests/test-utils";
import { Inbox } from "lucide-react";
import { expect, it } from "vitest";
import { EmptyState } from "@/components/states/empty-state";

it("announces the title and description as a status", () => {
  renderWithProviders(
    <EmptyState
      description="Saved work orders will appear here."
      title="No work orders yet"
    />
  );
  const status = screen.getByRole("status");
  within(status).getByText("No work orders yet");
  within(status).getByText("Saved work orders will appear here.");
  expect(within(status).queryByRole("button")).toBeNull();
});

it("renders a recovery action when one is given", () => {
  renderWithProviders(
    <EmptyState
      action={<button type="button">Clear filters</button>}
      title="No matching work orders"
    />
  );
  within(screen.getByRole("status")).getByRole("button", {
    name: "Clear filters",
  });
});

it("draws no icon", () => {
  renderWithProviders(<EmptyState title="Nothing" />);
  expect(screen.getByRole("status").querySelector("svg")).toBeNull();
});

it("draws an optional icon decoratively, beside the title", () => {
  renderWithProviders(<EmptyState icon={Inbox} title="No reports yet" />);
  const status = screen.getByRole("status");
  const icon = status.querySelector("svg");
  expect(icon?.getAttribute("aria-hidden")).toBe("true");
  expect(status.textContent).toBe("No reports yet");
});

it("stays a bordered panel by default", () => {
  renderWithProviders(<EmptyState title="Nothing" />);
  const status = screen.getByRole("status");
  expect(status.dataset.fill).toBeUndefined();
  expect(status.className).not.toContain("max-md:min-h-");
});

it("fills the remaining mobile screen when it is the page's main content", () => {
  renderWithProviders(<EmptyState fill title="No work orders yet" />);
  const status = screen.getByRole("status");
  expect(status.dataset.fill).toBe("true");
  expect(status.className).toContain("max-md:border-0");
  expect(status.className).toContain("max-md:min-h-");
});
