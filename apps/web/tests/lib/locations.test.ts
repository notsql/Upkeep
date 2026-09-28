import { describe, expect, it } from "vitest";
import {
  buildLocationTree,
  type Location,
  nextLevelPosition,
  searchLocations,
} from "@/lib/locations";

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

// Server order: levels by position, everything else by name.
const locations: Location[] = [
  location("b1", "BLOCK", "Blk 101"),
  location("b2", "BLOCK", "Blk 102"),
  location("l1", "LEVEL", "B1", "b1", -1),
  location("l2", "LEVEL", "Level 1", "b1", 1),
  location("l3", "LEVEL", "Level 2", "b1", 2),
  location("a1", "COMMON_AREA", "Lift", "b1"),
  location("a2", "COMMON_AREA", "Lift lobby", "l2"),
];

describe("buildLocationTree", () => {
  it("nests levels and common areas under their parents, keeping sibling order", () => {
    const tree = buildLocationTree(locations);
    expect(tree.map((node) => node.name)).toEqual(["Blk 101", "Blk 102"]);
    expect(tree[0].children.map((node) => node.name)).toEqual([
      "B1",
      "Level 1",
      "Level 2",
      "Lift",
    ]);
    expect(tree[0].children[1].children.map((node) => node.name)).toEqual([
      "Lift lobby",
    ]);
  });

  it("gives every node its path from the block down", () => {
    const tree = buildLocationTree(locations);
    expect(tree[0].children[1].children[0].path).toEqual([
      "Blk 101",
      "Level 1",
      "Lift lobby",
    ]);
  });
});

describe("searchLocations", () => {
  it("matches names case-insensitively, in tree order, showing where each sits", () => {
    expect(
      searchLocations(locations, "  LIFT ").map((match) =>
        match.path.join(" › ")
      )
    ).toEqual(["Blk 101 › Level 1 › Lift lobby", "Blk 101 › Lift"]);
  });

  it("finds nothing for a blank query or a name that does not exist", () => {
    expect(searchLocations(locations, "   ")).toEqual([]);
    expect(searchLocations(locations, "carpark")).toEqual([]);
  });
});

describe("nextLevelPosition", () => {
  it("suggests the position above the highest level in the block", () => {
    expect(nextLevelPosition(locations, "b1")).toBe(3);
  });

  it("starts an empty block at level 1", () => {
    expect(nextLevelPosition(locations, "b2")).toBe(1);
  });
});
