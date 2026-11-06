import { Button } from "@proj/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@proj/ui/components/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { useCallback } from "react";
import type { LocationNode } from "@/lib/locations";
import type { Panel } from "@/routes/_auth/estates/$estateId/-components/locations-section/location-panel";

export function LocationActions({
  node,
  canCreate,
  canCreateFloors,
  canDeactivate,
  canEdit,
  onPanel,
}: {
  node: LocationNode;
  canCreate: boolean;
  canCreateFloors: boolean;
  canDeactivate: boolean;
  canEdit: boolean;
  onPanel: (panel: Panel) => void;
}) {
  const addLevels = useCallback(
    () => onPanel({ kind: "levels", node }),
    [node, onPanel]
  );
  const addLevel = useCallback(
    () => onPanel({ kind: "create", type: "LEVEL", parent: node }),
    [node, onPanel]
  );
  const addCommonArea = useCallback(
    () => onPanel({ kind: "create", type: "COMMON_AREA", parent: node }),
    [node, onPanel]
  );
  const edit = useCallback(
    () => onPanel({ kind: "edit", node }),
    [node, onPanel]
  );
  const deactivate = useCallback(
    () => onPanel({ kind: "deactivate", node }),
    [node, onPanel]
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Actions for ${node.name}`}
            className="ml-auto shrink-0"
            id={`location-actions-${node.id}`}
            size="icon"
            variant="ghost"
          />
        }
      >
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {node.type === "BLOCK" && canCreate ? (
          <DropdownMenuItem
            aria-label={`Add ${canCreateFloors ? "levels" : "level"} to ${node.name}`}
            onClick={canCreateFloors ? addLevels : addLevel}
          >
            {canCreateFloors ? "Add levels" : "Add level"}
          </DropdownMenuItem>
        ) : null}
        {canCreate && node.type !== "COMMON_AREA" ? (
          <DropdownMenuItem
            aria-label={`Add common area to ${node.name}`}
            onClick={addCommonArea}
          >
            Add common area
          </DropdownMenuItem>
        ) : null}
        {canEdit ? (
          <DropdownMenuItem aria-label={`Edit ${node.name}`} onClick={edit}>
            Edit
          </DropdownMenuItem>
        ) : null}
        {canDeactivate ? (
          <DropdownMenuItem
            aria-label={`Deactivate ${node.name}`}
            className="text-destructive"
            onClick={deactivate}
          >
            Deactivate
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
