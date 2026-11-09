import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import { describe, expect, it, vi } from "vitest";
import { buildLocationTree, type Location } from "@/lib/locations";
import { BlockBuilding } from "@/routes/_auth/estates/$estateId/-components/locations-section/block-building";
import { locationSummaries } from "@/routes/_auth/estates/$estateId/-components/locations-section/location-tree";

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
const LONG = "Block with an exceptionally long name that will not fit";
const items: Location[] = [
  location("b1", "BLOCK", "Blk 101"),
  location("b2", "BLOCK", LONG),
  location("l1", "LEVEL", "L1", "b1", 1),
  location("l5", "LEVEL", "L5", "b1", 5),
  location("bm", "LEVEL", "B1", "b1", -1),
  location("g0", "LEVEL", "G", "b1", 0),
  location("a1", "COMMON_AREA", "Lift lobby", "l1"),
  location("a2", "COMMON_AREA", "Bin centre", "l1"),
  location("y1", "COMMON_AREA", "Playground", "b1"),
];
const tree = buildLocationTree(items);
const summaries = locationSummaries(tree);
const all = {
  canCreate: true,
  canCreateFloors: true,
  canDeactivate: true,
  canEdit: true,
};

/** The slabs only, not the chips nested inside them. */
function slabNames(list: HTMLElement): (string | null)[] {
  return [...list.children].map((item) => item.getAttribute("aria-label"));
}

function draw(
  index: number,
  permissions: Partial<typeof all> = all,
  onPanel = vi.fn()
) {
  renderWithProviders(
    <BlockBuilding
      {...all}
      {...permissions}
      node={tree[index]}
      onPanel={onPanel}
      summaries={summaries}
    />
  );
  return onPanel;
}

describe("block building", () => {
  it("draws floors above ground highest first and basements below", () => {
    draw(0);
    const floors = screen.getByRole("list", { name: "Blk 101 floors" });
    expect(slabNames(floors)).toEqual(["L5", "L1"]);
    const basements = screen.getByRole("list", { name: "Blk 101 basements" });
    expect(slabNames(basements)).toEqual(["G", "B1"]);
    screen.getByText("Ground");
  });

  it("shows the roof summary, level chips and block grounds", () => {
    draw(0);
    screen.getByText("4 levels · 3 common areas");
    const l1 = screen.getByRole("listitem", { name: "L1" });
    within(l1).getByText("Lift lobby");
    within(l1).getByText("Bin centre");
    const l5 = screen.getByRole("listitem", { name: "L5" });
    expect(within(l5).queryByText("Lift lobby")).toBeNull();
    const grounds = screen.getByRole("list", { name: "Blk 101 grounds" });
    within(grounds).getByText("Playground");
  });

  it("opens the same panels from block and level actions", async () => {
    const onPanel = draw(0);
    fireEvent.click(screen.getByRole("button", { name: "Actions for L5" }));
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Add common area to L5" })
    );
    expect(onPanel).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "create", type: "COMMON_AREA" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Actions for Blk 101" })
    );
    await screen.findByRole("menuitem", { name: "Add levels to Blk 101" });
  });

  it("hides level actions without edit or create permission", () => {
    draw(0, { canCreate: false, canCreateFloors: false, canEdit: false });
    expect(screen.queryByRole("button", { name: "Actions for L5" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Actions for Blk 101" })
    ).toBeNull();
  });

  it("draws an empty plot and keeps long names in a title", () => {
    draw(1);
    screen.getByText("No levels yet");
    expect(screen.getByText(LONG).getAttribute("title")).toBe(LONG);
    expect(screen.queryByText("Ground")).toBeNull();
  });
});

describe("block building floor ranges", () => {
  const tall: Location[] = [location("t", "BLOCK", "Blk 200")];
  for (let n = 1; n <= 46; n += 1) {
    tall.push(location(`t${n}`, "LEVEL", `L${n}`, "t", n));
  }
  tall.push(location("sky", "COMMON_AREA", "Sky Terrace", "t22"));
  const tallTree = buildLocationTree(tall);

  function drawTall() {
    renderWithProviders(
      <BlockBuilding
        {...all}
        node={tallTree[0]}
        onPanel={vi.fn()}
        summaries={locationSummaries(tallTree)}
      />
    );
  }

  it("draws plain runs as collapsed range buttons", () => {
    drawTall();
    const range = screen.getByRole("button", { name: "Show L41 to L45" });
    expect(range.getAttribute("aria-expanded")).toBe("false");
    within(range).getByText("L41 – L45");
    within(range).getByText("5 levels");
    screen.getByRole("button", { name: "Show L2 to L5" });
    screen.getByRole("listitem", { name: "L46" });
    screen.getByRole("listitem", { name: "L1" });
    expect(screen.queryByRole("listitem", { name: "L43" })).toBeNull();
  });

  it("expands a range into its floors and hides it again", async () => {
    drawTall();
    fireEvent.click(screen.getByRole("button", { name: "Show L41 to L45" }));
    for (const name of ["L45", "L44", "L43", "L42", "L41"]) {
      screen.getByRole("listitem", { name });
    }
    fireEvent.click(screen.getByRole("button", { name: "Actions for L43" }));
    await screen.findByRole("menuitem", { name: "Add common area to L43" });
    const hide = screen.getByRole("button", { name: "Hide L41 to L45" });
    expect(hide.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(hide);
    expect(screen.queryByRole("listitem", { name: "L43" })).toBeNull();
    screen.getByRole("button", { name: "Show L41 to L45" });
  });

  it("keeps several ranges open at once", () => {
    drawTall();
    fireEvent.click(screen.getByRole("button", { name: "Show L41 to L45" }));
    fireEvent.click(screen.getByRole("button", { name: "Show L6 to L10" }));
    screen.getByRole("listitem", { name: "L43" });
    screen.getByRole("listitem", { name: "L8" });
    screen.getByRole("button", { name: "Hide L41 to L45" });
    screen.getByRole("button", { name: "Hide L6 to L10" });
  });

  it("draws a level with common areas as its own slab, splitting its band", () => {
    drawTall();
    const sky = screen.getByRole("listitem", { name: "L22" });
    within(sky).getByText("Sky Terrace");
    screen.getByRole("button", { name: "Show L23 to L25" });
    screen.getByRole("listitem", { name: "L21" });
  });
});
