import { Button } from "@proj/ui/components/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useCallback, useId } from "react";
import type { LocationNode } from "@/lib/locations";
import { LocationActions } from "@/routes/_auth/estates/$estateId/-components/locations-section/location-actions";
import type { Panel } from "@/routes/_auth/estates/$estateId/-components/locations-section/location-panel";

export function LocationItem({
  node,
  canCreate,
  canCreateFloors,
  canDeactivate,
  canEdit,
  onPanel,
  summaries,
  expandedIds,
  onToggle,
  searching,
}: {
  node: LocationNode;
  canCreate: boolean;
  canCreateFloors: boolean;
  canDeactivate: boolean;
  canEdit: boolean;
  onPanel: (panel: Panel) => void;
  summaries: Map<string, string>;
  expandedIds: string[];
  onToggle: (id: string) => void;
  searching: boolean;
}) {
  const labelId = useId();
  const childrenId = useId();
  const expanded = searching || expandedIds.includes(node.id);
  const toggle = useCallback(() => onToggle(node.id), [onToggle, node.id]);
  const title = (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="font-medium break-words" id={labelId}>
        {node.name}
      </span>
      <span className="text-muted-foreground text-xs">
        {summaries.get(node.id)}
      </span>
    </span>
  );
  return (
    <li
      aria-labelledby={labelId}
      className={
        node.type === "BLOCK"
          ? "bg-muted/20 rounded-lg border p-2"
          : "border-l pl-3"
      }
    >
      <div className="flex items-center gap-2">
        {node.children.length && !searching ? (
          <Button
            aria-controls={childrenId}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${node.name}`}
            className="h-auto min-w-0 flex-1 justify-start gap-3 p-2 text-left whitespace-normal"
            onClick={toggle}
            variant="ghost"
          >
            {expanded ? (
              <ChevronDown aria-hidden="true" className="shrink-0" />
            ) : (
              <ChevronRight aria-hidden="true" className="shrink-0" />
            )}
            {title}
          </Button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3 p-2">
            {node.children.length ? (
              <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
            ) : null}
            {title}
          </div>
        )}
        {canEdit || (canCreate && node.type !== "COMMON_AREA") ? (
          <LocationActions
            canCreate={canCreate}
            canCreateFloors={canCreateFloors}
            canDeactivate={canDeactivate}
            canEdit={canEdit}
            node={node}
            onPanel={onPanel}
          />
        ) : null}
      </div>
      {node.children.length ? (
        <ul className="mt-2 grid gap-2" hidden={!expanded} id={childrenId}>
          {expanded
            ? node.children.map((child) => (
                <LocationItem
                  canCreate={canCreate}
                  canCreateFloors={canCreateFloors}
                  canDeactivate={canDeactivate}
                  canEdit={canEdit}
                  expandedIds={expandedIds}
                  key={child.id}
                  node={child}
                  onPanel={onPanel}
                  onToggle={onToggle}
                  searching={searching}
                  summaries={summaries}
                />
              ))
            : null}
        </ul>
      ) : null}
    </li>
  );
}
