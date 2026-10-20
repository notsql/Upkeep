import { Button } from "@proj/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@proj/ui/components/dropdown-menu";
import { ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react";
import { useCallback, useId } from "react";
import type { LocationNode } from "@/lib/locations";
import type { Panel } from "@/routes/_auth/estates/$estateId/-components/location-panel";

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
  canEdit,
  onPanel,
  summaries,
  expandedIds,
  onToggle,
  searching,
  query,
}: {
  tree: LocationNode[];
  canCreate: boolean;
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
      <p className="mt-4 text-sm" role="status">
        {searching
          ? `No locations match “${query.trim()}”.`
          : "No locations yet."}
        {!searching && canCreate ? " Add a block to start." : ""}
      </p>
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

function LocationItem({
  node,
  canCreate,
  canEdit,
  onPanel,
  summaries,
  expandedIds,
  onToggle,
  searching,
}: {
  node: LocationNode;
  canCreate: boolean;
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
      <span className="break-words font-medium" id={labelId}>
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
          ? "rounded-lg border bg-muted/20 p-2"
          : "border-l pl-3"
      }
    >
      <div className="flex items-center gap-2">
        {node.children.length && !searching ? (
          <Button
            aria-controls={childrenId}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${node.name}`}
            className="h-auto min-w-0 flex-1 justify-start gap-3 whitespace-normal p-2 text-left"
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

function LocationActions({
  node,
  canCreate,
  canEdit,
  onPanel,
}: {
  node: LocationNode;
  canCreate: boolean;
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
            aria-label={`Add ${canEdit ? "levels" : "level"} to ${node.name}`}
            onClick={canEdit ? addLevels : addLevel}
          >
            {canEdit ? "Add levels" : "Add level"}
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
          <>
            <DropdownMenuItem aria-label={`Edit ${node.name}`} onClick={edit}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              aria-label={`Deactivate ${node.name}`}
              className="text-destructive"
              onClick={deactivate}
            >
              Deactivate
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
