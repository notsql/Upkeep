import { Button } from "@proj/ui/components/button";
import { MapPin, SearchX } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import type { LocationNode } from "@/lib/locations";
import { LocationItem } from "@/routes/_auth/estates/$estateId/-components/locations-section/location-item";
import type { Panel } from "@/routes/_auth/estates/$estateId/-components/locations-section/location-panel";

/** "2 levels · 3 common areas" per node, counted across each block. */
export function locationSummaries(tree: LocationNode[]): Map<string, string> {
  const summaries = new Map<string, string>();
  const visit = (node: LocationNode): number => {
    const areas = node.children.reduce(
      (count, child) => count + visit(child),
      0
    );
    const areaLabel = `${areas} common ${areas === 1 ? "area" : "areas"}`;
    if (node.type === "BLOCK") {
      const levels = node.children.filter(
        (child) => child.type === "LEVEL"
      ).length;
      summaries.set(
        node.id,
        `${levels} ${levels === 1 ? "level" : "levels"} · ${areaLabel}`
      );
    } else {
      summaries.set(node.id, node.type === "LEVEL" ? areaLabel : "Common area");
    }
    return node.type === "COMMON_AREA" ? 1 : areas;
  };
  for (const node of tree) {
    visit(node);
  }
  return summaries;
}

export function LocationTree({
  tree,
  canCreate,
  canCreateFloors,
  canDeactivate,
  canEdit,
  onPanel,
  summaries,
  expandedIds,
  onToggle,
  searching,
  query,
  onClear,
}: {
  onClear: () => void;
  tree: LocationNode[];
  canCreate: boolean;
  canCreateFloors: boolean;
  canDeactivate: boolean;
  canEdit: boolean;
  onPanel: (panel: Panel) => void;
  summaries: Map<string, string>;
  expandedIds: string[];
  onToggle: (id: string) => void;
  searching: boolean;
  query: string;
}) {
  if (!tree.length) {
    return (
      <div className="mt-4">
        {searching ? (
          <EmptyState
            action={
              <Button onClick={onClear} variant="outline">
                Clear filters
              </Button>
            }
            description={`Nothing matches “${query.trim()}”`}
            icon={SearchX}
            title="No matching locations"
          />
        ) : (
          <EmptyState
            description={
              canCreate
                ? "Use Create to add the first block"
                : "Added blocks and levels appear here"
            }
            icon={MapPin}
            title="No locations yet"
          />
        )}
      </div>
    );
  }
  return (
    <ul
      aria-label={searching ? "Search results" : "Location hierarchy"}
      className="mt-4 grid gap-2"
    >
      {tree.map((node) => (
        <LocationItem
          canCreate={canCreate}
          canCreateFloors={canCreateFloors}
          canDeactivate={canDeactivate}
          canEdit={canEdit}
          expandedIds={expandedIds}
          key={node.id}
          node={node}
          onPanel={onPanel}
          onToggle={onToggle}
          searching={searching}
          summaries={summaries}
        />
      ))}
    </ul>
  );
}
