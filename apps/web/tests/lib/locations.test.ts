import { describe, expect, it } from "vitest";
import {
  buildLocationTree,
  filterLocationTree,
  floorName,
  floorRange,
  type Location,
  nextLevelPosition,
  parseFloor,
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
  it("nests levels and common areas under their parents, levels highest floor first", () => {
    const tree = buildLocationTree(locations);
    expect(tree.map((node) => node.name)).toEqual(["Blk 101", "Blk 102"]);
    expect(tree[0].children.map((node) => node.name)).toEqual([
      "Level 2",
      "Level 1",
      "B1",
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

describe("nextLevelPosition", () => {
  it("suggests the position above the highest level in the block", () => {
    expect(nextLevelPosition(locations, "b1")).toBe(3);
  });

  it("starts an empty block at level 1", () => {
    expect(nextLevelPosition(locations, "b2")).toBe(1);
  });
});

describe("filterLocationTree", () => {
  it("reveals name matches with their ancestors in server order", () => {
    const tree = buildLocationTree(locations);
    const filtered = filterLocationTree(tree, "  LIFT ");
    expect(filtered.map((node) => node.name)).toEqual(["Blk 101"]);
    expect(filtered[0].children.map((node) => node.name)).toEqual([
      "Level 1",
      "Lift",
    ]);
    expect(filtered[0].children[0].children.map((node) => node.path)).toEqual([
      ["Blk 101", "Level 1", "Lift lobby"],
    ]);
    // Filtering must not remove siblings from the full tree used by counts.
    expect(tree[0].children.map((node) => node.name)).toEqual([
      "Level 2",
      "Level 1",
      "B1",
      "Lift",
    ]);
  });
  it("keeps all descendants of a matching block or level", () => {
    const tree = buildLocationTree(locations);
    expect(filterLocationTree(tree, "blk 101")).toEqual([tree[0]]);
    const levelMatch = filterLocationTree(tree, "level 1");
    expect(levelMatch[0].children).toEqual([tree[0].children[1]]);
  });
  it("returns the full hierarchy for a blank search", () => {
    const tree = buildLocationTree(locations);
    expect(filterLocationTree(tree, "   ")).toEqual(tree);
  });
  it("returns no rows for an unmatched search or an empty estate", () => {
    expect(filterLocationTree(buildLocationTree(locations), "carpark")).toEqual(
      []
    );
    expect(filterLocationTree([], "Lift")).toEqual([]);
  });
});

describe("floors", () => {
  it("reads L and B floors, and a bare number as above ground", () => {
    expect(parseFloor("L25")).toBe(25);
    expect(parseFloor(" l3 ")).toBe(3);
    expect(parseFloor("12")).toBe(12);
    expect(parseFloor("B2")).toBe(-2);
    expect(parseFloor("b1")).toBe(-1);
  });

  it("rejects floor 0 and anything that is not a floor", () => {
    for (const text of ["", "L0", "B0", "0", "X", "L-1", "1.5", "L 2"]) {
      expect(parseFloor(text)).toBeUndefined();
    }
  });

  it("names floors L1, L2 above ground and B1, B2 below", () => {
    expect(floorName(1)).toBe("L1");
    expect(floorName(25)).toBe("L25");
    expect(floorName(-1)).toBe("B1");
    expect(floorName(-3)).toBe("B3");
  });

  it("lists a range highest first with no floor 0", () => {
    expect(floorRange(-2, 3)).toEqual([3, 2, 1, -1, -2]);
    expect(floorRange(1, 1)).toEqual([1]);
    expect(floorRange(-25, 25)).toHaveLength(50);
  });
});
