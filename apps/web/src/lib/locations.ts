import type { components } from "@proj/api/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { estateError, useEstateSession } from "@/lib/estates";

export type Location = components["schemas"]["LocationResponse"];
export type LocationType = Location["type"];

export function useCreateLocation(
  estateId: string,
  onCreated: () => Promise<void>
) {
  return useMutation({
    mutationFn: async (
      body: components["schemas"]["CreateLocationRequest"]
    ) => {
      const { data, error, response } = await api.POST(
        "/estates/{estateId}/locations",
        {
          params: { path: { estateId } },
          body,
        }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
    onSuccess: onCreated,
  });
}

export interface LocationNode extends Location {
  children: LocationNode[];
  /** Names from the block down to this node, for breadcrumbs. */
  path: string[];
}

export function locationsQueryKey(
  userId: string | undefined,
  estateId: string
) {
  return ["estates", userId, "locations", estateId] as const;
}

export function useLocations(estateId: string, includeInactive = false) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: includeInactive
      ? [...locationsQueryKey(userId, estateId), "all"]
      : locationsQueryKey(userId, estateId),
    enabled: ready,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/locations",
        {
          params: {
            path: { estateId },
            ...(includeInactive ? { query: { includeInactive: true } } : {}),
          },
        }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

/**
 * Nests the flat list the API returns. Sibling order is the server's
 * (everything but levels by name), except that levels are shown highest first.
 */
export function buildLocationTree(locations: Location[]): LocationNode[] {
  const children = new Map<string | undefined, Location[]>();
  for (const location of locations) {
    const key = location.parentId ?? undefined;
    const siblings = children.get(key);
    if (siblings) {
      siblings.push(location);
    } else {
      children.set(key, [location]);
    }
  }
  const build = (parentId: string | undefined, path: string[]) =>
    levelsHighestFirst(children.get(parentId) ?? []).map(
      (location): LocationNode => {
        const nodePath = [...path, location.name];
        return {
          ...location,
          path: nodePath,
          children: build(location.id, nodePath),
        };
      }
    );
  return build(undefined, []);
}

/**
 * Levels read top to bottom, like a building: … L2, L1, B1, B2 …. The server
 * lists them lowest first; other siblings keep the server's order.
 */
function levelsHighestFirst(siblings: Location[]): Location[] {
  const levels = siblings
    .filter((location) => location.type === "LEVEL")
    .sort((a, b) => (b.sortOrder ?? 0) - (a.sortOrder ?? 0));
  const others = siblings.filter((location) => location.type !== "LEVEL");
  return [...levels, ...others];
}

/** Floors per bulk request (ID-99). Most condo and HDB blocks have 50 storeys or fewer. */
export const MAX_FLOORS = 50;

const FLOOR = /^[LB]?\d+$/;
const FLOOR_LETTER = /^[LB]/;

/** "L25" or "25" is 25, "B2" is -2. Floor 0 and anything else is undefined. */
export function parseFloor(text: string): number | undefined {
  const value = text.trim().toUpperCase();
  if (!FLOOR.test(value)) {
    return;
  }
  const number = Number(value.replace(FLOOR_LETTER, ""));
  if (number === 0 || !Number.isSafeInteger(number)) {
    return;
  }
  return value.startsWith("B") ? -number : number;
}

/** L1, L2, … above ground; B1, B2, … below. */
export function floorName(floor: number): string {
  return floor > 0 ? `L${floor}` : `B${-floor}`;
}

/** Highest to lowest without floor 0; undefined when the range exceeds the limit. */
export function floorRange(
  lowest: number,
  highest: number
): number[] | undefined {
  const count = highest - lowest + 1 - (lowest <= 0 && highest >= 0 ? 1 : 0);
  if (count > MAX_FLOORS) {
    return;
  }
  const floors: number[] = [];
  for (let floor = highest; floor >= lowest; floor -= 1) {
    if (floor !== 0) {
      floors.push(floor);
    }
  }
  return floors;
}

function flatten(nodes: LocationNode[]): LocationNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

/** Every location, depth-first in display order, each with its path. */
export function flattenLocations(locations: Location[]): LocationNode[] {
  return flatten(buildLocationTree(locations));
}

/** Reveal matching locations with their ancestors; matching parents keep their subtree. */
export function filterLocationTree(
  tree: LocationNode[],
  query: string
): LocationNode[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return tree;
  }
  const filter = (nodes: LocationNode[]): LocationNode[] =>
    nodes.flatMap((node) => {
      if (node.name.toLowerCase().includes(needle)) {
        return [node];
      }
      const children = filter(node.children);
      return children.length ? [{ ...node, children }] : [];
    });
  return filter(tree);
}

/** Levels are usually added bottom-up, so suggest one above the highest. */
export function nextLevelPosition(
  locations: Location[],
  blockId: string
): number {
  const positions = locations
    .filter((location) => location.parentId === blockId)
    .map((location) => location.sortOrder)
    .filter((position): position is number => typeof position === "number");
  return positions.length ? Math.max(...positions) + 1 : 1;
}
