import { Card, CardContent } from "@proj/ui/components/card";
import { Link } from "@tanstack/react-router";
import { LifecycleStatusBadge } from "@/components/badges/lifecycle-status-badge";
import type { AssetBlockGroup } from "@/lib/asset-monitoring";
import type { Asset } from "@/lib/assets";
import { type AssetCategoryOption, categoryLabel } from "@/lib/catalogue";
import {
  DeviceSummary,
  type MonitoringColumns,
  RiskFlag,
} from "@/routes/_auth/estates/$estateId/assets/-components/asset-register-page/asset-monitoring-cells";
import { ConditionBadge } from "@/routes/_auth/estates/$estateId/assets/-components/condition-badge";

export function AssetRegisterCards({
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
      <AssetCardList
        assets={assets}
        categories={categories}
        estateId={estateId}
        grouped={false}
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
              <AssetCardList
                assets={level.assets}
                categories={categories}
                estateId={estateId}
                grouped
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

function AssetCardList({
  assets,
  categories,
  estateId,
  grouped,
  label,
  monitoring,
}: {
  assets: Asset[];
  categories: AssetCategoryOption[] | undefined;
  estateId: string;
  grouped: boolean;
  label: string;
  monitoring: MonitoringColumns;
}) {
  const Name = grouped ? "h4" : "h2";
  return (
    <ul aria-label={label} className="grid gap-3">
      {assets.map((asset) => (
        <li key={asset.id}>
          <Link
            aria-label={`${asset.name} (${asset.reference})`}
            className="group focus-visible:ring-ring block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            params={{ estateId, assetId: asset.id }}
            to="/estates/$estateId/assets/$assetId"
          >
            <Card className="group-hover:bg-accent/40 group-hover:ring-primary/40 group-focus-visible:bg-accent/40 group-focus-visible:ring-primary/40 group-active:bg-accent group-active:ring-primary/40 h-full transition-[background-color,box-shadow] group-hover:shadow-sm motion-reduce:transition-none">
              <CardContent className="grid gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Name className="font-semibold break-words underline">
                      {asset.name}
                    </Name>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {asset.reference}
                    </p>
                  </div>
                  <LifecycleStatusBadge
                    inactive={Boolean(asset.deactivatedAt)}
                    inactiveLabel="Retired"
                  />
                </div>
                <dl className="grid gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Category</dt>
                    <dd>{categoryLabel(categories, asset.category)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Location</dt>
                    <dd className="break-words">{asset.locationPath}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground mb-1">
                      Current condition
                    </dt>
                    <dd>
                      <ConditionBadge condition={asset.currentCondition} />
                    </dd>
                  </div>
                  {monitoring.devices ? (
                    <div>
                      <dt className="text-muted-foreground">Devices</dt>
                      <dd>
                        <DeviceSummary
                          assetId={asset.id}
                          source={monitoring.devices}
                        />
                      </dd>
                    </div>
                  ) : null}
                  {monitoring.risk ? (
                    <div>
                      <dt className="text-muted-foreground mb-1">Risk</dt>
                      <dd>
                        <RiskFlag assetId={asset.id} source={monitoring.risk} />
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </CardContent>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
