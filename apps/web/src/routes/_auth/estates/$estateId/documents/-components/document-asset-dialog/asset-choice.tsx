import { Checkbox } from "@proj/ui/components/checkbox";
import { TableCell, TableRow } from "@proj/ui/components/table";
import { useCallback } from "react";
import { LifecycleStatusBadge } from "@/components/badges/lifecycle-status-badge";
import type { Asset } from "@/lib/assets";

export function AssetChoice({
  asset,
  category,
  disabled,
  onSelect,
  selected,
}: {
  asset: Asset;
  category: string;
  disabled: boolean;
  onSelect: (asset?: Asset) => void;
  selected: boolean;
}) {
  const select = useCallback(
    (checked: boolean) => onSelect(checked ? asset : undefined),
    [asset, onSelect]
  );
  return (
    <TableRow>
      <TableCell>
        <Checkbox
          aria-label={`Select ${asset.reference} ${asset.name}`}
          checked={selected}
          disabled={disabled}
          onCheckedChange={select}
        />
      </TableCell>
      <TableCell>{asset.reference}</TableCell>
      <TableCell>{asset.name}</TableCell>
      <TableCell>{category}</TableCell>
      <TableCell>{asset.locationPath}</TableCell>
      <TableCell>
        <LifecycleStatusBadge
          inactive={!!asset.deactivatedAt}
          inactiveLabel="Out of use"
        />
      </TableCell>
    </TableRow>
  );
}
