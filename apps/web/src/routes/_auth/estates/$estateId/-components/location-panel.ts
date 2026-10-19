import type { LocationNode, LocationType } from "@/lib/locations";

/** Which location dialog is open, and for which node. */
export type Panel =
  | {
      kind: "create";
      type: Exclude<LocationType, "LEVEL">;
      parent?: LocationNode;
    }
  | { kind: "edit"; node: LocationNode }
  | { kind: "levels"; node: LocationNode }
  | { kind: "deactivate"; node: LocationNode };

const typeNoun: Record<LocationType, string> = {
  BLOCK: "block",
  LEVEL: "level",
  COMMON_AREA: "common area",
};

export function panelTitle(panel?: Panel): string {
  if (!panel) {
    return "Location";
  }
  if (panel.kind === "create") {
    return `Add ${typeNoun[panel.type]}${panel.parent ? ` to ${panel.parent.name}` : ""}`;
  }
  if (panel.kind === "edit") {
    return `Edit ${panel.node.name}`;
  }
  if (panel.kind === "levels") {
    return `Add levels to ${panel.node.name}`;
  }
  return `Deactivate ${panel.node.name}?`;
}

export function dialogDescription(panel?: Panel): string {
  if (panel?.kind === "deactivate") {
    return "Review the effect before confirming.";
  }
  if (panel?.kind === "levels") {
    return "Add a range of floors in one go, or one level with its own name.";
  }
  return "Enter the location details below.";
}
