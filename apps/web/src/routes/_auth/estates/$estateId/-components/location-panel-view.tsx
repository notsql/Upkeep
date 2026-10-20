import { useCallback } from "react";
import {
  flattenLocations,
  type Location,
  type LocationNode,
  type LocationType,
  nextLevelPosition,
} from "@/lib/locations";
import type { AddFloorsResult } from "@/routes/_auth/estates/$estateId/-components/add-floors-form";
import { AddLevelsTabs } from "@/routes/_auth/estates/$estateId/-components/add-levels-tabs";
import { DeactivateLocation } from "@/routes/_auth/estates/$estateId/-components/deactivate-location";
import {
  LocationForm,
  type LocationFormValues,
  type ParentOption,
} from "@/routes/_auth/estates/$estateId/-components/location-form";
import {
  type Panel,
  panelTitle,
} from "@/routes/_auth/estates/$estateId/-components/location-panel";

export function PanelView({
  onPendingChange,
  panel,
  items,
  onAddFloors,
  onCreate,
  onUpdate,
  onDeactivate,
  onCancel,
}: {
  onPendingChange: (pending: boolean) => void;
  panel: Panel;
  items: Location[];
  onAddFloors: (
    node: LocationNode,
    lowestFloor: number,
    highestFloor: number
  ) => Promise<AddFloorsResult>;
  onCreate: (type: LocationType, values: LocationFormValues) => Promise<void>;
  onUpdate: (node: LocationNode, values: LocationFormValues) => Promise<void>;
  onDeactivate: (node: LocationNode) => Promise<void>;
  onCancel: () => void;
}) {
  const save = useCallback(
    (values: LocationFormValues) => {
      if (panel.kind === "edit") {
        return onUpdate(panel.node, values);
      }
      if (panel.kind === "create") {
        return onCreate(panel.type, values);
      }
      if (panel.kind === "levels") {
        return onCreate("LEVEL", values);
      }
      return Promise.resolve();
    },
    [panel, onCreate, onUpdate]
  );
  const saveFloors = useCallback(
    (lowest: number, highest: number) =>
      panel.kind === "levels"
        ? onAddFloors(panel.node, lowest, highest)
        : Promise.resolve({ created: [], skipped: [] }),
    [panel, onAddFloors]
  );
  const confirm = useCallback(
    () =>
      panel.kind === "deactivate"
        ? onDeactivate(panel.node)
        : Promise.resolve(),
    [panel, onDeactivate]
  );
  if (panel.kind === "levels") {
    const { node } = panel;
    return (
      <AddLevelsTabs
        block={node}
        items={items}
        onCancel={onCancel}
        onPendingChange={onPendingChange}
        onSaveFloors={saveFloors}
        onSaveLevel={save}
      />
    );
  }
  if (panel.kind === "deactivate") {
    return (
      <DeactivateLocation
        name={panel.node.name}
        onCancel={onCancel}
        onConfirm={confirm}
        onPendingChange={onPendingChange}
      />
    );
  }
  if (panel.kind === "edit") {
    const { node } = panel;
    return (
      <LocationForm
        initialName={node.name}
        initialParentId={node.parentId ?? undefined}
        initialSortOrder={node.sortOrder ?? undefined}
        onCancel={onCancel}
        onPendingChange={onPendingChange}
        onSave={save}
        parentOptions={parentOptions(items, node.type)}
        showPosition={node.type === "LEVEL"}
        title={panelTitle(panel)}
      />
    );
  }
  // Managers add one level; owners also have the bulk-floor dialog.
  const { parent } = panel;
  return (
    <LocationForm
      initialParentId={parent?.id}
      initialSortOrder={
        panel.type === "LEVEL" && parent
          ? nextLevelPosition(items, parent.id)
          : undefined
      }
      onCancel={onCancel}
      onPendingChange={onPendingChange}
      onSave={save}
      showPosition={panel.type === "LEVEL"}
      title={panelTitle(panel)}
    />
  );
}

/** Where a location of this type may be moved to; blocks never move. */
function parentOptions(
  items: Location[],
  type: LocationType
): ParentOption[] | undefined {
  if (type === "BLOCK") {
    return;
  }
  const allowed: LocationType[] =
    type === "LEVEL" ? ["BLOCK"] : ["BLOCK", "LEVEL"];
  return flattenLocations(items)
    .filter((node) => allowed.includes(node.type))
    .map((node) => ({ id: node.id, label: node.path.join(" › ") }));
}
