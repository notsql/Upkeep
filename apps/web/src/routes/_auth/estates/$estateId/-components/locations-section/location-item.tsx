import { Button } from "@proj/ui/components/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useCallback, useId, useState } from "react";
import type { LocationNode } from "@/lib/locations";
import {
  type FloorSlab,
  floorSlabs,
  rangeEnds,
} from "@/routes/_auth/estates/$estateId/-components/locations-section/floor-slabs";
import { LocationActions } from "@/routes/_auth/estates/$estateId/-components/locations-section/location-actions";
import type { Panel } from "@/routes/_auth/estates/$estateId/-components/locations-section/location-panel";

type ItemProps = Omit<Parameters<typeof LocationItem>[0], "node">;
type Row = { kind: "node"; node: LocationNode } | FloorSlab;

/** A block's children with its levels grouped into floor ranges, in place. */
function blockRows(children: LocationNode[]): Row[] {
  const levels = children.filter((child) => child.type === "LEVEL");
  const rows: Row[] = [];
  let placed = false;
  for (const child of children) {
    if (child.type !== "LEVEL") {
      rows.push({ kind: "node", node: child });
    } else if (!placed) {
      placed = true;
      rows.push(...floorSlabs(levels));
    }
  }
  return rows;
}

function rangeKey(levels: LocationNode[]): string {
  return `${levels[0].id}:${levels.at(-1)?.id}`;
}

function TreeRange({
  levels,
  open,
  onToggleRange,
  itemProps,
}: {
  levels: LocationNode[];
  open: boolean;
  onToggleRange: (key: string) => void;
  itemProps: ItemProps;
}) {
  const toggle = useCallback(
    () => onToggleRange(rangeKey(levels)),
    [onToggleRange, levels]
  );
  const [from, to] = rangeEnds(levels);
  const span = `${from} to ${to}`;
  return (
    <li className="border-l pl-3">
      <Button
        aria-expanded={open}
        aria-label={`${open ? "Hide" : "Show"} ${span}`}
        className="bg-muted/40 hover:bg-muted h-auto w-full justify-start gap-3 p-2 text-left"
        onClick={toggle}
        variant="ghost"
      >
        {open ? (
          <ChevronDown aria-hidden="true" className="shrink-0" />
        ) : (
          <ChevronRight aria-hidden="true" className="shrink-0" />
        )}
        <span className="font-medium tabular-nums">
          {from} – {to}
        </span>
        <span className="text-muted-foreground text-xs font-normal">
          {levels.length} levels
        </span>
      </Button>
      {open ? (
        <ul className="mt-2 grid gap-2">
          {levels.map((level) => (
            <LocationItem key={level.id} node={level} {...itemProps} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

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
  const [openRanges, setOpenRanges] = useState<Set<string>>(new Set());
  const toggleRange = useCallback((key: string) => {
    setOpenRanges((current) => {
      const next = new Set(current);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  }, []);
  const itemProps: ItemProps = {
    canCreate,
    canCreateFloors,
    canDeactivate,
    canEdit,
    expandedIds,
    onPanel,
    onToggle,
    searching,
    summaries,
  };
  const rows: Row[] =
    node.type === "BLOCK" && !searching
      ? blockRows(node.children)
      : node.children.map((child) => ({ kind: "node", node: child }));
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
            ? rows.map((row) => {
                if (row.kind === "range") {
                  const key = rangeKey(row.levels);
                  return (
                    <TreeRange
                      itemProps={itemProps}
                      key={key}
                      levels={row.levels}
                      onToggleRange={toggleRange}
                      open={openRanges.has(key)}
                    />
                  );
                }
                const child = row.kind === "level" ? row.level : row.node;
                return (
                  <LocationItem key={child.id} node={child} {...itemProps} />
                );
              })
            : null}
        </ul>
      ) : null}
    </li>
  );
}
