import { Card } from "@proj/ui/components/card";
import { ToggleGroup, ToggleGroupItem } from "@proj/ui/components/toggle-group";
import { type ComponentProps, type ReactNode, useCallback } from "react";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { LocationTree } from "@/routes/_auth/estates/$estateId/-components/locations-section/location-tree";
import { LocationsBuildings } from "@/routes/_auth/estates/$estateId/-components/locations-section/locations-buildings";
import type { LocationsView } from "@/routes/_auth/estates/$estateId/-components/locations-section/use-locations-section";

export function LocationsTreeCard({
  pending,
  error,
  onRetry,
  tree,
  dialog,
  view,
  viewLocked,
  onViewChange,
}: {
  pending: boolean;
  error: Error | null;
  onRetry: () => void;
  /** The tree's props, or undefined until locations have loaded. */
  tree: ComponentProps<typeof LocationTree> | undefined;
  dialog: ReactNode;
  /** The view on screen; searching forces "tree". */
  view: LocationsView;
  viewLocked: boolean;
  onViewChange: (view: LocationsView) => void;
}) {
  const changeView = useCallback(
    (values: string[]) => {
      const [next] = values;
      if (next === "building" || next === "tree") {
        onViewChange(next);
      }
    },
    [onViewChange]
  );
  return (
    <Card className="mt-4 gap-0 overflow-hidden py-0">
      <section
        aria-label="Blocks and levels"
        className="scroll-mt-24"
        id="locations"
      >
        <div className="flex justify-end border-b px-4 py-2">
          <ToggleGroup
            aria-label="View"
            disabled={viewLocked}
            onValueChange={changeView}
            size="sm"
            spacing={0}
            value={[view]}
            variant="outline"
          >
            <ToggleGroupItem value="building">Building</ToggleGroupItem>
            <ToggleGroupItem value="tree">Tree</ToggleGroupItem>
          </ToggleGroup>
        </div>
        {pending ? (
          <div className="p-4">
            <LoadingState label="Loading locations…" />
          </div>
        ) : null}
        {error ? (
          <div className="p-4">
            <ErrorState message={error.message} onRetry={onRetry} />
          </div>
        ) : null}
        {tree && view === "building" && tree.tree.length ? (
          <LocationsBuildings {...tree} />
        ) : null}
        {tree && (view === "tree" || !tree.tree.length) ? (
          <div className="px-4 pb-4">
            <LocationTree {...tree} />
          </div>
        ) : null}
        {dialog}
      </section>
    </Card>
  );
}
