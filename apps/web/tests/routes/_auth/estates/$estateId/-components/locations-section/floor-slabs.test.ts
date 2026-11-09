import { describe, expect, it } from "vitest";
import type { LocationNode } from "@/lib/locations";
import {
  type FloorSlab,
  floorSlabs,
} from "@/routes/_auth/estates/$estateId/-components/locations-section/floor-slabs";

const at = "2026-09-27T00:00:00Z";
function level(n: number, areas = 0): LocationNode {
  let name = n > 0 ? `L${n}` : `B${-n}`;
  if (n === 0) {
    name = "G";
  }
  return {
    id: `l${n}`,
    type: "LEVEL",
    name,
    path: [name],
    sortOrder: n,
    createdAt: at,
    updatedAt: at,
    children: Array.from({ length: areas }, (_, i) => ({
      id: `a${n}-${i}`,
      type: "COMMON_AREA" as const,
      name: `Area ${i}`,
      path: [name, `Area ${i}`],
      createdAt: at,
      updatedAt: at,
      children: [],
    })),
  };
}
/** Highest first, as the tree orders them. */
function levels(top: number, bottom: number, withAreas: number[] = []) {
  const out: LocationNode[] = [];
  for (let n = top; n >= bottom; n -= 1) {
    out.push(level(n, withAreas.includes(n) ? 1 : 0));
  }
  return out;
}
/** Ranges as "near-ground-end-far-end": L41-L45, B1-B5. */
function describeSlabs(slabs: FloorSlab[]): string[] {
  return slabs.map((slab) => {
    if (slab.kind === "level") {
      return slab.level.name;
    }
    const [top] = slab.levels;
    const bottom = slab.levels.at(-1);
    return (top.sortOrder ?? 0) > 0
      ? `${bottom?.name}-${top.name}`
      : `${top.name}-${bottom?.name}`;
  });
}

describe("floorSlabs", () => {
  it("pins ends and common-area levels, banding the rest by five", () => {
    expect(describeSlabs(floorSlabs(levels(44, 1, [22])))).toEqual([
      "L44",
      "L41-L43",
      "L36-L40",
      "L31-L35",
      "L26-L30",
      "L23-L25",
      "L22",
      "L21",
      "L16-L20",
      "L11-L15",
      "L6-L10",
      "L2-L5",
      "L1",
    ]);
  });

  it("draws a group of one as a plain level", () => {
    expect(describeSlabs(floorSlabs(levels(11, 1)))).toEqual([
      "L11",
      "L6-L10",
      "L2-L5",
      "L1",
    ]);
  });

  it("pins the ends of the basements too", () => {
    expect(describeSlabs(floorSlabs(levels(-1, -2)))).toEqual(["B1", "B2"]);
    expect(describeSlabs(floorSlabs(levels(-1, -7)))).toEqual([
      "B1",
      "B2-B5",
      "B6",
      "B7",
    ]);
  });

  it("bands each side of ground separately, with G on its own", () => {
    expect(describeSlabs(floorSlabs(levels(7, -3)))).toEqual([
      "L7",
      "L6",
      "L2-L5",
      "L1",
      "G",
      "B1-B2",
      "B3",
    ]);
  });

  it("bands by floor number across gaps", () => {
    const gappy = [level(12), level(9), level(7), level(5), level(2), level(1)];
    expect(describeSlabs(floorSlabs(gappy))).toEqual([
      "L12",
      "L7-L9",
      "L2-L5",
      "L1",
    ]);
  });

  it("leaves small blocks as plain levels", () => {
    expect(describeSlabs(floorSlabs(levels(1, 1)))).toEqual(["L1"]);
    expect(describeSlabs(floorSlabs(levels(2, 1)))).toEqual(["L2", "L1"]);
  });
});
