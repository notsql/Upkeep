import type { LocationNode } from "@/lib/locations";

export type FloorSlab =
  | { kind: "level"; level: LocationNode }
  | { kind: "range"; levels: LocationNode[] };

const BAND_SIZE = 5;

/** Fixed bands of five aligned to floor numbers: L1-L5, L6-L10, G, B1-B5. */
function band(level: LocationNode): string {
  const position = level.sortOrder ?? 0;
  if (position > 0) {
    return `L${Math.ceil(position / BAND_SIZE)}`;
  }
  return position < 0 ? `B${Math.ceil(-position / BAND_SIZE)}` : "G";
}

function hasAreas(level: LocationNode): boolean {
  return level.children.some((child) => child.type === "COMMON_AREA");
}

/** One side of the ground line, highest first. */
function sideSlabs(levels: LocationNode[]): FloorSlab[] {
  const groups: LocationNode[][] = [];
  let current: string | undefined;
  for (const [index, level] of levels.entries()) {
    const pinned =
      index === 0 || index === levels.length - 1 || hasAreas(level);
    const key = pinned ? undefined : band(level);
    if (key && key === current) {
      groups.at(-1)?.push(level);
    } else {
      groups.push([level]);
    }
    current = key;
  }
  return groups.map((group) =>
    group.length === 1
      ? { kind: "level", level: group[0] }
      : { kind: "range", levels: group }
  );
}

/**
 * Groups a block's levels (highest first) into slabs. The highest and lowest
 * level on each side of ground and every level with common areas stand alone;
 * the rest fall into fixed bands of five, split by those pinned levels. A
 * group of two or more is a range, a group of one stays a level.
 */
export function floorSlabs(levels: LocationNode[]): FloorSlab[] {
  const above = levels.filter((level) => (level.sortOrder ?? 0) > 0);
  const below = levels.filter((level) => (level.sortOrder ?? 0) <= 0);
  return [...sideSlabs(above), ...sideSlabs(below)];
}

/** A range's label ends, nearest ground first: ["L41", "L45"], ["B1", "B5"]. */
export function rangeEnds(levels: LocationNode[]): [string, string] {
  const [top] = levels;
  const bottom = levels.at(-1) ?? top;
  return (top.sortOrder ?? 0) > 0
    ? [bottom.name, top.name]
    : [top.name, bottom.name];
}
