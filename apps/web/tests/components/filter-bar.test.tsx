import { renderWithProviders, screen, within } from "@tests/test-utils";
import { it } from "vitest";
import { FilterBar } from "@/components/filter-bar";

it("groups search, filters and actions in a labelled search landmark", () => {
  renderWithProviders(
    <FilterBar
      actions={<button type="button">Clear filters</button>}
      label="Filter work orders"
      search={<input aria-label="Search" />}
    >
      <select aria-label="Status" />
    </FilterBar>
  );
  const bar = screen.getByRole("search", { name: "Filter work orders" });
  within(bar).getByRole("textbox", { name: "Search" });
  within(bar).getByRole("combobox", { name: "Status" });
  within(bar).getByRole("button", { name: "Clear filters" });
});
