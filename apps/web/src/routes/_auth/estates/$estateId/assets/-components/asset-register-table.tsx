import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { Link } from "@tanstack/react-router";
import { LifecycleStatusBadge } from "@/components/lifecycle-status-badge";
import { SortableTableHead } from "@/components/sortable-table-head";
import { type AssetSortColumn, assetSortOptions } from "@/lib/asset-sorting";
import type { Asset } from "@/lib/assets";
import { type AssetCategoryOption, categoryLabel } from "@/lib/catalogue";
import { ConditionBadge } from "@/routes/_auth/estates/$estateId/assets/-components/condition-badge";

export function AssetRegisterTable({
  assets,
  categories,
  descending,
  estateId,
  onSort,
  sortColumn,
}: {
  assets: Asset[];
  categories: AssetCategoryOption[] | undefined;
  descending: boolean;
  estateId: string;
  onSort: (column: AssetSortColumn) => void;
  sortColumn: AssetSortColumn;
}) {
  return (
    <Table aria-label="Assets">
      <TableHeader>
        <TableRow>
          {assetSortOptions.map((option) => (
            <SortableTableHead
              active={sortColumn === option.value}
              column={option.value}
              descending={descending}
              key={option.value}
              label={option.label}
              onSort={onSort}
            />
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map((asset) => (
          <TableRow key={asset.id}>
            <TableCell>
              <Link
                className="underline"
                params={{ estateId, assetId: asset.id }}
                to="/estates/$estateId/assets/$assetId"
              >
                {asset.reference}
              </Link>
            </TableCell>
            <TableCell>
              <Link
                className="underline"
                params={{ estateId, assetId: asset.id }}
                to="/estates/$estateId/assets/$assetId"
              >
                {asset.name}
              </Link>
            </TableCell>
            <TableCell>{categoryLabel(categories, asset.category)}</TableCell>
            <TableCell>{asset.locationPath}</TableCell>
            <TableCell>
              <ConditionBadge condition={asset.currentCondition} />
            </TableCell>
            <TableCell>
              <LifecycleStatusBadge
                inactive={Boolean(asset.deactivatedAt)}
                inactiveLabel="Retired"
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
