import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen } from "@tests/test-utils";
import { describe, it, vi } from "vitest";
import { buildLocationTree, type Location } from "@/lib/locations";
import { locationSummaries } from "@/routes/_auth/estates/$estateId/-components/locations-section/location-tree";
import { LocationsBuildings } from "@/routes/_auth/estates/$estateId/-components/locations-section/locations-buildings";

const at = "2026-09-27T00:00:00Z";
const items: Location[] = [
  { id: "b1", type: "BLOCK", name: "Blk 101", createdAt: at, updatedAt: at },
  {
    id: "l1",
    type: "LEVEL",
    name: "L1",
    parentId: "b1",
    sortOrder: 1,
    createdAt: at,
    updatedAt: at,
  },
];
const tree = buildLocationTree(items);

function draw() {
  renderWithProviders(
    <LocationsBuildings
      canCreate
      canCreateFloors
      canDeactivate
      canEdit
      onPanel={vi.fn()}
      summaries={locationSummaries(tree)}
      tree={tree}
    />
  );
  return screen.getByRole("region", { name: "Estate canvas" });
}

function click(name: string, times = 1) {
  for (let i = 0; i < times; i += 1) {
    fireEvent.click(screen.getByRole("button", { name }));
  }
}

describe("estate canvas", () => {
  it("draws the buildings on a focusable canvas at 100%", () => {
    const canvas = draw();
    screen.getByRole("list", { name: "Blk 101 floors" });
    canvas.focus();
    screen.getByText("100%");
  });

  it("zooms in and out with the controls, clamped to 25%-200%", () => {
    draw();
    click("Zoom in");
    screen.getByText("125%");
    click("Zoom in", 6);
    screen.getByText("200%");
    click("Zoom out", 10);
    screen.getByText("25%");
  });

  it("fits back to the view", () => {
    draw();
    click("Zoom in", 2);
    screen.getByText("150%");
    click("Fit to view");
    screen.getByText("100%");
  });

  it("zooms and fits from the keyboard when the canvas is focused", () => {
    const canvas = draw();
    fireEvent.keyDown(canvas, { key: "+" });
    screen.getByText("125%");
    fireEvent.keyDown(canvas, { key: "=" });
    screen.getByText("150%");
    fireEvent.keyDown(canvas, { key: "-" });
    screen.getByText("125%");
    fireEvent.keyDown(canvas, { key: "0" });
    screen.getByText("100%");
  });

  it("leaves keys alone when a control inside the canvas has focus", () => {
    draw();
    fireEvent.keyDown(screen.getByRole("button", { name: "Zoom in" }), {
      key: "+",
    });
    screen.getByText("100%");
  });
});
