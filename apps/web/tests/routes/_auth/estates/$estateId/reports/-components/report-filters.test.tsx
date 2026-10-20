import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import { expect, it, vi } from "vitest";
import type { Location } from "@/lib/locations";
import { ReportFilters } from "@/routes/_auth/estates/$estateId/reports/-components/report-filters";

const locationData: Omit<Location, "createdAt" | "updatedAt">[] = [
  { id: "a", name: "Block A", type: "BLOCK" },
  { id: "b", name: "Block B", type: "BLOCK" },
  {
    id: "basement",
    name: "Basement",
    type: "LEVEL",
    parentId: "a",
    sortOrder: -1,
  },
  { id: "ground", name: "Ground", type: "LEVEL", parentId: "a", sortOrder: 0 },
  { id: "four", name: "Level 99", type: "LEVEL", parentId: "a", sortOrder: 4 },
  {
    id: "duplicate",
    name: "Fourth",
    type: "LEVEL",
    parentId: "b",
    sortOrder: 4,
  },
  { id: "other", name: "Second", type: "LEVEL", parentId: "b", sortOrder: 2 },
];
const locations: Location[] = locationData.map((location) => ({
  ...location,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
}));

async function selectPosition(name: string, position: string) {
  const input = screen.getByRole("combobox", { name });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  const option = await screen.findByRole("option", {
    name: position,
  });
  await waitFor(() => {
    fireEvent.click(option);
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });
}

it("offers searchable block and level range dropdowns and applies selected bounds", async () => {
  const onChange = vi.fn();
  renderWithProviders(
    <ReportFilters
      filters={{ blockId: "a" }}
      locations={locations}
      onChange={onChange}
    />
  );
  screen.getByRole("combobox", { name: "Block" });
  await selectPosition("Minimum position", "-1");
  await selectPosition("Maximum position", "4");
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  expect(onChange).toHaveBeenCalledWith({
    blockId: "a",
    minLevelPosition: -1,
    maxLevelPosition: 4,
  });
});

it("lists unique numeric level positions in order across all blocks", async () => {
  renderWithProviders(
    <ReportFilters filters={{}} locations={locations} onChange={vi.fn()} />
  );
  fireEvent.keyDown(
    screen.getByRole("combobox", { name: "Minimum position" }),
    { key: "ArrowDown" }
  );
  await screen.findByRole("option", { name: "No minimum" });
  expect(
    screen.getAllByRole("option").map((option) => option.textContent)
  ).toEqual(["No minimum", "-1", "0", "2", "4"]);
});

it("searches positions from the selected block using sort order rather than level names", async () => {
  renderWithProviders(
    <ReportFilters
      filters={{ blockId: "a" }}
      locations={locations}
      onChange={vi.fn()}
    />
  );
  const input = screen.getByRole("combobox", { name: "Minimum position" });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  await screen.findByRole("option", { name: "0" });
  expect(screen.queryByRole("option", { name: "2" })).toBeNull();
  fireEvent.change(input, { target: { value: "4" } });
  await screen.findByRole("option", { name: "4" });
  expect(screen.queryByRole("option", { name: "0" })).toBeNull();
  expect(screen.queryByRole("option", { name: "Level 99" })).toBeNull();
});

it("preserves a typed bound outside the suggestions on blur and supports open bounds", () => {
  const onChange = vi.fn();
  renderWithProviders(
    <ReportFilters filters={{}} locations={locations} onChange={onChange} />
  );
  const input = screen.getByRole("combobox", { name: "Minimum position" });
  fireEvent.change(input, { target: { value: "-3" } });
  fireEvent.blur(input);
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  expect(onChange).toHaveBeenCalledWith({ minLevelPosition: -3 });
});

it("can remove a range bound using the dropdown", async () => {
  const onChange = vi.fn();
  renderWithProviders(
    <ReportFilters
      filters={{ minLevelPosition: 0, maxLevelPosition: 4 }}
      locations={locations}
      onChange={onChange}
    />
  );
  await selectPosition("Minimum position", "No minimum");
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  expect(onChange).toHaveBeenCalledWith({ maxLevelPosition: 4 });
});

it.each(["invalid", "1.5", "2147483648"])(
  "rejects an invalid typed level position: %s",
  (value) => {
    const onChange = vi.fn();
    renderWithProviders(
      <ReportFilters filters={{}} locations={locations} onChange={onChange} />
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "Minimum position" }),
      { target: { value } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    screen.getByRole("alert");
    expect(onChange).not.toHaveBeenCalled();
  }
);
