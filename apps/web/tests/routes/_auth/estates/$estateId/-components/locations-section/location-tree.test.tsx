import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import { describe, expect, it, vi } from "vitest";
import {
  buildLocationTree,
  filterLocationTree,
  type Location,
} from "@/lib/locations";
import {
  LocationTree,
  locationSummaries,
} from "@/routes/_auth/estates/$estateId/-components/locations-section/location-tree";

const at = "2026-09-27T00:00:00Z";
function location(
  id: string,
  type: Location["type"],
  name: string,
  parentId?: string,
  sortOrder?: number
): Location {
  return { id, type, name, parentId, sortOrder, createdAt: at, updatedAt: at };
}
const items: Location[] = [location("b", "BLOCK", "Blk 300")];
for (let n = 1; n <= 12; n += 1) {
  items.push(location(`l${n}`, "LEVEL", `L${n}`, "b", n));
}
items.push(location("a8", "COMMON_AREA", "Lift lobby", "l8"));
items.push(location("yard", "COMMON_AREA", "Playground", "b"));
const full = buildLocationTree(items);
const SHOW_RANGE = /^Show /u;

function draw(query = "") {
  const tree = query ? filterLocationTree(full, query) : full;
  renderWithProviders(
    <LocationTree
      canCreate
      canCreateFloors
      canDeactivate
      canEdit
      expandedIds={["b"]}
      onClear={vi.fn()}
      onPanel={vi.fn()}
      onToggle={vi.fn()}
      query={query}
      searching={Boolean(query)}
      summaries={locationSummaries(tree)}
      tree={tree}
    />
  );
}

describe("location tree floor ranges", () => {
  it("pins ends and common-area levels, grouping the rest", () => {
    draw();
    const range = screen.getByRole("button", { name: "Show L9 to L10" });
    expect(range.getAttribute("aria-expanded")).toBe("false");
    within(range).getByText("L9 – L10");
    within(range).getByText("2 levels");
    screen.getByRole("button", { name: "Show L6 to L7" });
    screen.getByRole("button", { name: "Show L2 to L5" });
    for (const name of ["L12", "L11", "L8", "L1", "Playground"]) {
      screen.getByRole("listitem", { name });
    }
    expect(screen.queryByRole("listitem", { name: "L9" })).toBeNull();
  });

  it("expands a range into level rows with actions, and hides it", async () => {
    draw();
    fireEvent.click(screen.getByRole("button", { name: "Show L2 to L5" }));
    for (const name of ["L5", "L4", "L3", "L2"]) {
      screen.getByRole("listitem", { name });
    }
    fireEvent.click(screen.getByRole("button", { name: "Actions for L4" }));
    await screen.findByRole("menuitem", { name: "Add common area to L4" });
    const hide = screen.getByRole("button", { name: "Hide L2 to L5" });
    expect(hide.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(hide);
    expect(screen.queryByRole("listitem", { name: "L4" })).toBeNull();
  });

  it("does not group levels while searching", () => {
    draw("L1");
    expect(screen.queryByRole("button", { name: SHOW_RANGE })).toBeNull();
    screen.getByRole("listitem", { name: "L10" });
  });
});
