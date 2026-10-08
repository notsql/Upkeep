import { describe, expect, it } from "vitest";
import {
  buildLocationTree,
  filterLocationTree,
  type Location,
  nextLevelPosition,
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
      "B1",
      "Level 1",
      "Level 2",
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
