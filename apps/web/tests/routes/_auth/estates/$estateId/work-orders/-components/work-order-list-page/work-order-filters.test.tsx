import { fireEvent } from "@testing-library/react";
import { chooseOption, renderWithProviders, screen } from "@tests/test-utils";
import { expect, it, vi } from "vitest";
import { WorkOrderFilters } from "@/routes/_auth/estates/$estateId/work-orders/-components/work-order-list-page/work-order-filters";

it("combines status and category with the existing priority and reference filters", async () => {
  const change = vi.fn();
  renderWithProviders(
    <WorkOrderFilters
      filters={{ priority: "HIGH", q: "W0001" }}
      onChange={change}
    />
  );
  screen.getByRole("search", { name: "Filter work orders" });
  screen.getByText("2 active");
  expect(screen.getAllByRole("button", { name: "Clear filters" })).toHaveLength(
    1
  );
  await chooseOption(
    screen.getByRole("combobox", { name: "Status" }),
    "Closed"
  );
  await chooseOption(
    screen.getByRole("combobox", { name: "Category" }),
    "Equipment fault"
  );
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  expect(change).toHaveBeenLastCalledWith({
    priority: "HIGH",
    q: "W0001",
    status: "CLOSED",
    category: "EQUIPMENT_FAULT",
  });
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(change).toHaveBeenLastCalledWith({});
});

it("hides Clear filters when nothing is applied", () => {
  renderWithProviders(<WorkOrderFilters filters={{}} onChange={vi.fn()} />);
  expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
});
