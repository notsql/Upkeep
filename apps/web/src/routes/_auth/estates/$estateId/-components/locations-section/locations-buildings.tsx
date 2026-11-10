import type { LocationNode } from "@/lib/locations";
import { BlockBuilding } from "@/routes/_auth/estates/$estateId/-components/locations-section/block-building";
import { CanvasShell } from "@/routes/_auth/estates/$estateId/-components/locations-section/canvas-shell";
import type { Panel } from "@/routes/_auth/estates/$estateId/-components/locations-section/location-panel";

/**
 * The building view: an estate canvas with every block standing side by side
 * on one ground line. Drag to pan, Ctrl/Cmd + wheel or pinch to zoom, or use
 * the overlay controls and keyboard.
 */
export function LocationsBuildings({
  tree,
  summaries,
  onPanel,
  canCreate,
  canCreateFloors,
  canDeactivate,
  canEdit,
}: {
  tree: LocationNode[];
  summaries: Map<string, string>;
  onPanel: (panel: Panel) => void;
  canCreate: boolean;
  canCreateFloors: boolean;
  canDeactivate: boolean;
  canEdit: boolean;
}) {
  return (
    <CanvasShell>
      <div className="grid auto-cols-[18rem] grid-flow-col grid-rows-[auto_auto] pt-6">
        {tree.map((node) => (
          <BlockBuilding
            canCreate={canCreate}
            canCreateFloors={canCreateFloors}
            canDeactivate={canDeactivate}
            canEdit={canEdit}
            key={node.id}
            node={node}
            onPanel={onPanel}
            summaries={summaries}
          />
        ))}
      </div>
    </CanvasShell>
  );
}
