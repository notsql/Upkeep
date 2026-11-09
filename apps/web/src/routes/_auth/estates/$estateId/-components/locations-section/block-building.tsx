import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useCallback, useState } from "react";
import type { LocationNode } from "@/lib/locations";
import {
  type FloorSlab,
  floorSlabs,
  rangeEnds,
} from "@/routes/_auth/estates/$estateId/-components/locations-section/floor-slabs";
import { LocationActions } from "@/routes/_auth/estates/$estateId/-components/locations-section/location-actions";
import type { Panel } from "@/routes/_auth/estates/$estateId/-components/locations-section/location-panel";

interface Permissions {
  canCreate: boolean;
  canCreateFloors: boolean;
  canDeactivate: boolean;
  canEdit: boolean;
}

type SlabProps = Permissions & {
  basement: boolean;
  onPanel: (panel: Panel) => void;
};

/** Present for keyboard and screen readers; visible on hover, focus or touch. */
export const QUIET_ACTIONS =
  "shrink-0 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 [&_button]:size-7";

function AreaChips({ areas }: { areas: LocationNode[] }) {
  return areas.map((area) => (
    <li className="max-w-full" key={area.id}>
      <Badge
        className="block h-auto max-w-full truncate px-1.5 py-0 text-[0.6875rem]"
        title={area.name}
        variant="secondary"
      >
        {area.name}
      </Badge>
    </li>
  ));
}

function Slab({
  level,
  basement,
  onPanel,
  ...permissions
}: SlabProps & { level: LocationNode }) {
  const areas = level.children.filter((child) => child.type === "COMMON_AREA");
  const { canCreate, canEdit } = permissions;
  return (
    <li
      aria-label={level.name}
      className={`group flex min-h-9 items-center gap-2 px-3 py-1.5 transition-colors ${
        basement
          ? "text-muted-foreground hover:bg-muted-foreground/10"
          : "hover:bg-muted/40"
      }`}
    >
      <span
        className="w-12 shrink-0 truncate text-sm font-medium tabular-nums"
        title={level.name}
      >
        {level.name}
      </span>
      {areas.length ? (
        <ul
          aria-label={`${level.name} common areas`}
          className="flex min-w-0 flex-1 flex-wrap justify-end gap-1"
        >
          <AreaChips areas={areas} />
        </ul>
      ) : (
        <span className="flex-1" />
      )}
      {canEdit || canCreate ? (
        <span className={QUIET_ACTIONS}>
          <LocationActions {...permissions} node={level} onPanel={onPanel} />
        </span>
      ) : (
        <span aria-hidden="true" className="size-7 shrink-0" />
      )}
    </li>
  );
}

function rangeKey(levels: LocationNode[]): string {
  return `${levels[0].id}:${levels.at(-1)?.id}`;
}

function Range({
  levels,
  open,
  onToggle,
  ...slabProps
}: SlabProps & {
  levels: LocationNode[];
  open: boolean;
  onToggle: (key: string) => void;
}) {
  const toggle = useCallback(
    () => onToggle(rangeKey(levels)),
    [onToggle, levels]
  );
  const [from, to] = rangeEnds(levels);
  const span = `${from} to ${to}`;
  if (!open) {
    return (
      <li>
        <Button
          aria-expanded={false}
          aria-label={`Show ${span}`}
          className="bg-muted/40 hover:bg-muted h-9 w-full justify-start gap-2 rounded-none px-3"
          onClick={toggle}
          variant="ghost"
        >
          <ChevronRight aria-hidden="true" className="text-muted-foreground" />
          <span className="text-sm font-medium tabular-nums">
            {from} – {to}
          </span>
          <span className="text-muted-foreground ml-auto text-xs font-normal">
            {levels.length} levels
          </span>
        </Button>
      </li>
    );
  }
  return (
    <li className="border-brand-2/60 border-l-2">
      <Button
        aria-expanded
        aria-label={`Hide ${span}`}
        className="bg-muted/40 hover:bg-muted h-9 w-full justify-start gap-2 rounded-none px-3"
        onClick={toggle}
        variant="ghost"
      >
        <ChevronDown aria-hidden="true" className="text-muted-foreground" />
        <span className="text-sm font-medium tabular-nums">
          {from} – {to}
        </span>
      </Button>
      <ul
        aria-label={`${span} floors`}
        className="divide-border/60 border-border/60 divide-y border-t"
      >
        {levels.map((level) => (
          <Slab key={level.id} level={level} {...slabProps} />
        ))}
      </ul>
    </li>
  );
}

function Slabs({
  slabs,
  openRanges,
  onToggle,
  ...slabProps
}: SlabProps & {
  slabs: FloorSlab[];
  openRanges: Set<string>;
  onToggle: (key: string) => void;
}) {
  return slabs.map((slab) => {
    if (slab.kind === "level") {
      return <Slab key={slab.level.id} level={slab.level} {...slabProps} />;
    }
    const key = rangeKey(slab.levels);
    return (
      <Range
        key={key}
        levels={slab.levels}
        onToggle={onToggle}
        open={openRanges.has(key)}
        {...slabProps}
      />
    );
  });
}

/**
 * One block drawn as a 2D building: roof, a slab or range per
 * level group, the ground line, basements below it and the block's own common
 * areas as "Grounds". Above-ground and below-ground parts are the two rows of
 * a subgrid, so every building in a row shares one ground line.
 */
export function BlockBuilding({
  node,
  summaries,
  onPanel,
  ...permissions
}: Permissions & {
  node: LocationNode;
  summaries: Map<string, string>;
  onPanel: (panel: Panel) => void;
}) {
  const [openRanges, setOpenRanges] = useState<Set<string>>(new Set());
  const levels = node.children.filter((child) => child.type === "LEVEL");
  const above = floorSlabs(
    levels.filter((level) => (level.sortOrder ?? 0) > 0)
  );
  const below = floorSlabs(
    levels.filter((level) => (level.sortOrder ?? 0) <= 0)
  );
  const grounds = node.children.filter((child) => child.type === "COMMON_AREA");
  const { canCreate, canEdit } = permissions;
  const toggle = (key: string) => {
    setOpenRanges((current) => {
      const next = new Set(current);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  };
  const shared = { ...permissions, onPanel, openRanges, onToggle: toggle };
  return (
    <div className="row-span-2 grid grid-rows-subgrid px-4">
      <div className="mx-auto flex w-64 max-w-full flex-col justify-end self-end">
        <div className="bg-card overflow-hidden rounded-t-xl border border-b-0">
          <div className="group flex items-start gap-2 border-b px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold" title={node.name}>
                {node.name}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {summaries.get(node.id)}
              </p>
            </div>
            {canEdit || canCreate ? (
              <span className={QUIET_ACTIONS}>
                <LocationActions
                  {...permissions}
                  node={node}
                  onPanel={onPanel}
                />
              </span>
            ) : null}
          </div>
          {levels.length ? (
            <ul
              aria-label={`${node.name} floors`}
              className="divide-border/60 divide-y"
            >
              <Slabs basement={false} slabs={above} {...shared} />
            </ul>
          ) : (
            <p className="text-muted-foreground flex h-9 items-center justify-center px-3 text-xs">
              No levels yet
            </p>
          )}
        </div>
      </div>
      <div className="-mx-4 mb-6">
        <div className="border-foreground/40 border-t">
          {levels.length ? (
            <p className="text-muted-foreground px-4 pt-1 text-[0.625rem] font-medium tracking-wider uppercase">
              Ground
            </p>
          ) : null}
        </div>
        {below.length ? (
          <ul
            aria-label={`${node.name} basements`}
            className="bg-muted divide-border/60 mx-auto mt-1 w-64 max-w-full divide-y overflow-hidden rounded-b-xl border-x border-b border-dashed"
          >
            <Slabs basement slabs={below} {...shared} />
          </ul>
        ) : null}
        {grounds.length ? (
          <div className="mx-auto mt-2 w-64 max-w-full">
            <p className="text-muted-foreground text-[0.625rem] font-medium tracking-wider uppercase">
              Grounds
            </p>
            <ul
              aria-label={`${node.name} grounds`}
              className="mt-1 flex flex-wrap gap-1"
            >
              <AreaChips areas={grounds} />
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
