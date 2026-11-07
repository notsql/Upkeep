import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import { TableCell, TableHead, TableRow } from "@proj/ui/components/table";
import { useCallback } from "react";
import type { EstateAssetCategory } from "@/lib/asset-categories";
import { IntervalBadge } from "@/routes/_auth/estates/$estateId/asset-categories/-components/asset-categories-page/interval-badge";

/** The most recent change to either the flag or the interval. */
function lastChanged(category: EstateAssetCategory): string {
  const changes = [category.lastChange, category.lastIntervalChange].filter(
    (change) => change !== null && change !== undefined
  );
  const [latest] = changes.sort((a, b) =>
    b.changedAt.localeCompare(a.changedAt)
  );
  if (!latest) {
    return "Default";
  }
  const by = latest.changedByName ?? "Unknown user";
  return `${by} · ${new Date(latest.changedAt).toLocaleString()}`;
}

export function CategoryRow({
  category,
  disabled,
  onToggleFlag,
  onEditInterval,
}: {
  category: EstateAssetCategory;
  disabled: boolean;
  onToggleFlag: (category: EstateAssetCategory) => void;
  onEditInterval: (category: EstateAssetCategory) => void;
}) {
  const toggleFlag = useCallback(
    () => onToggleFlag(category),
    [category, onToggleFlag]
  );
  const editInterval = useCallback(
    () => onEditInterval(category),
    [category, onEditInterval]
  );
  return (
    <TableRow>
      <TableHead className="font-medium" scope="row">
        {category.label}
      </TableHead>
      <TableCell className="tabular-nums">
        {category.activeAssetCount}
      </TableCell>
      <TableCell>
        {category.failsSilently ? (
          <Badge variant="secondary">Fails silently</Badge>
        ) : (
          <span className="text-muted-foreground">No</span>
        )}
      </TableCell>
      <TableCell>
        <IntervalBadge interval={category.serviceInterval} />
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {lastChanged(category)}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-2">
          <Button
            aria-label={`Edit service interval for ${category.label}`}
            disabled={disabled}
            onClick={editInterval}
            size="sm"
            variant="outline"
          >
            Edit interval
          </Button>
          <Button
            aria-label={
              category.failsSilently
                ? `Stop flagging ${category.label}`
                : `Flag ${category.label} as failing silently`
            }
            disabled={disabled}
            onClick={toggleFlag}
            size="sm"
            variant="ghost"
          >
            {category.failsSilently ? "Stop flagging" : "Flag"}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
