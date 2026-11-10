import { Link } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { LifecycleStatusBadge } from "@/components/badges/lifecycle-status-badge";
import { ListRow, ListRows } from "@/components/list/list-row";
import type { AssetBlockGroup } from "@/lib/asset-monitoring";
import type { Asset } from "@/lib/assets";
import { type AssetCategoryOption, categoryLabel } from "@/lib/catalogue";
import {
  DeviceSummary,
  type MonitoringColumns,
  type MonitoringSource,
  RiskFlag,
} from "@/routes/_auth/estates/$estateId/assets/-components/asset-register-page/asset-monitoring-cells";
import { ConditionBadge } from "@/routes/_auth/estates/$estateId/assets/-components/condition-badge";

/** The phone view of the register: one linked list item per asset. */
export function AssetRegisterList({
  assets,
  categories,
  estateId,
  groups,
  monitoring,
}: {
  assets: Asset[];
  categories: AssetCategoryOption[] | undefined;
  estateId: string;
  /** Block and level groups; null renders one ungrouped list. */
  groups: AssetBlockGroup[] | null;
  monitoring: MonitoringColumns;
}) {
  if (!groups) {
    return (
      <AssetItemList
        assets={assets}
        categories={categories}
        estateId={estateId}
        label="Assets"
        monitoring={monitoring}
      />
    );
  }
  return (
    <div className="grid gap-6">
      {groups.map((block) => (
        <section className="grid gap-3" key={block.id}>
          <h2 className="text-base font-semibold">{block.name}</h2>
          {block.levels.map((level) => (
            <div className="grid gap-2" key={level.id}>
              {level.name === null ? null : (
                <h3 className="text-muted-foreground text-sm font-medium">
                  {level.name}
                </h3>
              )}
              <AssetItemList
                assets={level.assets}
                categories={categories}
                estateId={estateId}
                label={
                  level.name === null
                    ? `${block.name} assets`
                    : `${block.name} › ${level.name} assets`
                }
                monitoring={monitoring}
              />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function AssetItemList({
  assets,
  categories,
  estateId,
  label,
  monitoring,
}: {
  assets: Asset[];
  categories: AssetCategoryOption[] | undefined;
  estateId: string;
  label: string;
  monitoring: MonitoringColumns;
}) {
  return (
    <ListRows label={label}>
      {assets.map((asset) => (
        <AssetItem
          asset={asset}
          categories={categories}
          estateId={estateId}
          key={asset.id}
          monitoring={monitoring}
        />
      ))}
    </ListRows>
  );
}

function AssetItem({
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
  const monitoringParts = [
    monitoring.devices ? (
      <DeviceSummary
        assetId={asset.id}
        key="devices"
        source={monitoring.devices}
      />
    ) : null,
    monitoring.risk && hasValue(monitoring.risk, asset.id) ? (
      <RiskFlag assetId={asset.id} key="risk" source={monitoring.risk} />
    ) : null,
  ];
  return (
    <ListRow
      icon={Package}
      meta={
        <Parts
          parts={[
            asset.reference,
            categoryLabel(categories, asset.category),
            asset.locationPath,
          ]}
        />
      }
      render={
        <Link
          aria-label={`${asset.name} (${asset.reference})`}
          params={{ estateId, assetId: asset.id }}
          to="/estates/$estateId/assets/$assetId"
        />
      }
      title={asset.name}
      trailing={
        <div className="flex flex-col items-end gap-1">
          <LifecycleStatusBadge
            inactive={Boolean(asset.deactivatedAt)}
            inactiveLabel="Out of use"
          />
          <ConditionBadge condition={asset.currentCondition} />
        </div>
      }
    >
      {monitoringParts.some(Boolean) ? (
        <p className="text-muted-foreground truncate text-xs">
          <Parts parts={monitoringParts} />
        </p>
      ) : null}
    </ListRow>
  );
}

/** Risk shows on the phone only when it is loading, failed or flagged. */
function hasValue(source: MonitoringSource, assetId: string): boolean {
  return source.pending || source.failed || source.valueFor(assetId) !== null;
}

/** Non-empty parts joined with " · ", each in its own span. */
function Parts({ parts }: { parts: ReactNode[] }) {
  const present = parts.filter(
    (part) => part !== null && part !== undefined && part !== ""
  );
  return present.map((part, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: parts are a fixed, ordered set
    <Fragment key={index}>
      {index > 0 ? " · " : null}
      <span>{part}</span>
    </Fragment>
  ));
}
