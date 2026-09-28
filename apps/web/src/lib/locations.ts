import type { components } from "@proj/api/schema";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { estateError, useEstateSession } from "@/lib/estates";

export type Location = components["schemas"]["LocationResponse"];
export type LocationType = Location["type"];

export interface LocationNode extends Location {
  children: LocationNode[];
  /** Names from the block down to this node, for breadcrumbs. */
  path: string[];
}

export const locationTypeLabel: Record<LocationType, string> = {
  BLOCK: "Block",
  LEVEL: "Level",
  COMMON_AREA: "Common area",
};

export function locationsQueryKey(
  userId: string | undefined,
  estateId: string
) {
  return ["estates", userId, "locations", estateId] as const;
}

export function useLocations(estateId: string) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: locationsQueryKey(userId, estateId),
    enabled: ready,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/estates/{estateId}/locations",
        { params: { path: { estateId } } }
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
 * (levels by position, everything else by name), so it is kept as-is.
 */
export function buildLocationTree(locations: Location[]): LocationNode[] {
  const children = new Map<string | undefined, Location[]>();
  for (const location of locations) {
    const key = location.parentId ?? undefined;
    children.set(key, [...(children.get(key) ?? []), location]);
  }
  const build = (parentId: string | undefined, path: string[]) =>
    (children.get(parentId) ?? []).map((location): LocationNode => {
      const nodePath = [...path, location.name];
      return {
        ...location,
        path: nodePath,
        children: build(location.id, nodePath),
      };
    });
  return build(undefined, []);
}

function flatten(nodes: LocationNode[]): LocationNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

/** Every location, depth-first in display order, each with its path. */
export function flattenLocations(locations: Location[]): LocationNode[] {
  return flatten(buildLocationTree(locations));
}

export function searchLocations(
  locations: Location[],
  query: string
): LocationNode[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [];
  }
  return flattenLocations(locations).filter((node) =>
    node.name.toLowerCase().includes(needle)
  );
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
