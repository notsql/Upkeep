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
 * (levels by position, everything else by name), so it is kept as-is.
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
