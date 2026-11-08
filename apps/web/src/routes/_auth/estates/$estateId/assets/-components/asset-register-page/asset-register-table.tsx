import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import { LifecycleStatusBadge } from "@/components/badges/lifecycle-status-badge";
import { SortableTableHead } from "@/components/table/sortable-table-head";
import type { AssetBlockGroup } from "@/lib/asset-monitoring";
import { type AssetSortColumn, assetSortOptions } from "@/lib/asset-sorting";
import type { Asset } from "@/lib/assets";
import { type AssetCategoryOption, categoryLabel } from "@/lib/catalogue";
import {
  DeviceSummary,
  type MonitoringColumns,
  RiskFlag,
} from "@/routes/_auth/estates/$estateId/assets/-components/asset-register-page/asset-monitoring-cells";
import { ConditionBadge } from "@/routes/_auth/estates/$estateId/assets/-components/condition-badge";

export function AssetRegisterTable({
  assets,
  categories,
  descending,
  estateId,
  groups,
  monitoring,
  onSort,
  sortColumn,
}: {
  assets: Asset[];
  categories: AssetCategoryOption[] | undefined;
  descending: boolean;
  estateId: string;
  /** Block and level groups; null renders one ungrouped list. */
  groups: AssetBlockGroup[] | null;
  monitoring: MonitoringColumns;
  onSort: (column: AssetSortColumn) => void;
  sortColumn: AssetSortColumn;
}) {
  const columnCount =
    assetSortOptions.length +
    (monitoring.devices ? 1 : 0) +
    (monitoring.risk ? 1 : 0);
  const rows = (items: Asset[]) =>
    items.map((asset) => (
      <AssetRow
        asset={asset}
        categories={categories}
        estateId={estateId}
        key={asset.id}
        monitoring={monitoring}
      />
    ));
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
          {monitoring.devices ? <TableHead>Devices</TableHead> : null}
          {monitoring.risk ? <TableHead>Risk</TableHead> : null}
        </TableRow>
      </TableHeader>
      {groups ? (
        groups.map((block) => (
          <TableBody key={block.id}>
            <TableRow className="hover:bg-transparent">
              <TableHead colSpan={columnCount} scope="colgroup">
                <h2 className="text-base font-semibold">{block.name}</h2>
              </TableHead>
            </TableRow>
            {block.levels.map((level) => (
              <Fragment key={level.id}>
                {level.name === null ? null : (
                  <TableRow className="hover:bg-transparent">
                    <TableHead colSpan={columnCount} scope="colgroup">
                      <h3 className="text-muted-foreground pl-4 text-sm font-medium">
                        {level.name}
                      </h3>
                    </TableHead>
                  </TableRow>
                )}
                {rows(level.assets)}
              </Fragment>
            ))}
          </TableBody>
        ))
      ) : (
        <TableBody>{rows(assets)}</TableBody>
      )}
    </Table>
  );
}

function AssetRow({
  asset,
  categories,
  estateId,
  monitoring,
}: {
  asset: Asset;
  categories: AssetCategoryOption[] | undefined;
  estateId: string;
  monitoring: MonitoringColumns;
}) {
  return (
    <TableRow>
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
      {monitoring.devices ? (
        <TableCell>
          <DeviceSummary assetId={asset.id} source={monitoring.devices} />
        </TableCell>
      ) : null}
      {monitoring.risk ? (
        <TableCell>
          <RiskFlag assetId={asset.id} source={monitoring.risk} />
        </TableCell>
      ) : null}
    </TableRow>
  );
}
