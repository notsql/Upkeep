import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import type { Location, LocationNode, LocationType } from "@/lib/locations";
import type { AddFloorsResult } from "@/routes/_auth/estates/$estateId/-components/add-floors-form";
import type { LocationFormValues } from "@/routes/_auth/estates/$estateId/-components/location-form";
import {
  dialogDescription,
  type Panel,
  panelTitle,
} from "@/routes/_auth/estates/$estateId/-components/location-panel";
import { PanelView } from "@/routes/_auth/estates/$estateId/-components/location-panel-view";

export function LocationsDialog({
  panel,
  items,
  busy,
  returnFocus,
  onAddFloors,
  onCancel,
  onCreate,
  onPendingChange,
  onUpdate,
}: {
  panel: Panel;
  items: Location[];
  busy: boolean;
  returnFocus: () => HTMLElement | null;
  onAddFloors: (
    node: LocationNode,
    lowestFloor: number,
    highestFloor: number
  ) => Promise<AddFloorsResult>;
  onCancel: () => void;
  onCreate: (type: LocationType, values: LocationFormValues) => Promise<void>;
  onPendingChange: (pending: boolean) => void;
  onUpdate: (node: LocationNode, values: LocationFormValues) => Promise<void>;
}) {
  return (
    <DialogContent
      className="sm:max-w-lg"
      finalFocus={returnFocus}
      showCloseButton={!busy}
    >
      <DialogHeader>
        <DialogTitle>{panelTitle(panel)}</DialogTitle>
        <DialogDescription>{dialogDescription(panel)}</DialogDescription>
      </DialogHeader>
      <PanelView
        items={items}
        onAddFloors={onAddFloors}
        onCancel={onCancel}
        onCreate={onCreate}
        onPendingChange={onPendingChange}
        onUpdate={onUpdate}
        panel={panel}
      />
    </DialogContent>
  );
}
