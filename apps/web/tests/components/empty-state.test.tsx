import { renderWithProviders, screen, within } from "@tests/test-utils";
import { Wrench } from "lucide-react";
import { expect, it } from "vitest";
import { EmptyState } from "@/components/empty-state";

it("announces the title and description as a status", () => {
  renderWithProviders(
    <EmptyState
      description="Saved work orders will appear here."
      icon={Wrench}
      title="No work orders yet"
    />
  );
  const status = screen.getByRole("status");
  within(status).getByText("No work orders yet");
  within(status).getByText("Saved work orders will appear here.");
  expect(within(status).queryByRole("button")).toBeNull();
});

it("renders the create action when one is given", () => {
  renderWithProviders(
    <EmptyState
      action={<button type="button">New work order</button>}
      title="No work orders yet"
    />
  );
  within(screen.getByRole("status")).getByRole("button", {
    name: "New work order",
  });
});
