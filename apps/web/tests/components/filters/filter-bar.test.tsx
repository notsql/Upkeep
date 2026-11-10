import { fireEvent } from "@testing-library/react";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilterBar, useFilterPanel } from "@/components/filters/filter-bar";
import { FilterToggle } from "@/components/filters/filter-toggle";

const ACTIVE_COUNT = /active$/u;

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

it("sections the filters under a Filters label with an active count and Clear action", () => {
  const onClear = vi.fn();
  renderWithProviders(
    <FilterBar activeCount={2} label="Filter work orders" onClear={onClear}>
      <select aria-label="Status" />
    </FilterBar>
  );
  const bar = screen.getByRole("search", { name: "Filter work orders" });
  within(bar).getByText("Filters");
  within(bar).getByText("2 active");
  fireEvent.click(within(bar).getByRole("button", { name: "Clear filters" }));
  expect(onClear).toHaveBeenCalledOnce();
});

it("hides the count and Clear action while no filter is active", () => {
  renderWithProviders(
    <FilterBar activeCount={0} label="Filter" onClear={vi.fn()}>
      <select aria-label="Status" />
    </FilterBar>
  );
  expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  expect(screen.queryByText(ACTIVE_COUNT)).toBeNull();
});

function CollapsibleFilters({ activeCount }: { activeCount: number }) {
  const panel = useFilterPanel(activeCount);
  return (
    <>
      <FilterToggle activeCount={activeCount} {...panel.toggleProps} />
      <FilterBar
        activeCount={activeCount}
        label="Filter work orders"
        {...panel.barProps}
      >
        <select aria-label="Status" />
      </FilterBar>
    </>
  );
}

it("starts collapsed when no filter is active and expands on toggle", async () => {
  renderWithProviders(<CollapsibleFilters activeCount={0} />);
  const toggle = screen.getByRole("button", { name: "Filters" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("search")).toBeNull();
  fireEvent.click(toggle);
  const bar = await screen.findByRole("search", { name: "Filter work orders" });
  expect(toggle.getAttribute("aria-controls")).toBe(bar.closest("[id]")?.id);
});

it("starts expanded when filters are active on load", () => {
  renderWithProviders(<CollapsibleFilters activeCount={1} />);
  expect(
    screen
      .getByRole("button", { name: "Filters, 1 active" })
      .getAttribute("aria-expanded")
  ).toBe("true");
  screen.getByRole("search", { name: "Filter work orders" });
});

describe("on mobile", () => {
  const desktopWidth = window.innerWidth;
  afterEach(() => {
    window.innerWidth = desktopWidth;
  });

  it("opens the filters in a bottom sheet titled Filters and closes it again", async () => {
    window.innerWidth = 375;
    renderWithProviders(<CollapsibleFilters activeCount={0} />);
    const toggle = screen.getByRole("button", { name: "Filters" });
    fireEvent.click(toggle);
    const sheet = await screen.findByRole("dialog", { name: "Filters" });
    expect(sheet.dataset.side).toBe("bottom");
    within(sheet).getByRole("search", { name: "Filter work orders" });
    within(sheet).getByRole("combobox", { name: "Status" });
    fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps the sheet shut on load even when filters are active", () => {
    window.innerWidth = 375;
    renderWithProviders(<CollapsibleFilters activeCount={1} />);
    screen.getByRole("button", { name: "Filters, 1 active" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
