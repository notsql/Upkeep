import { Card, CardContent } from "@proj/ui/components/card";
import { Link } from "@tanstack/react-router";
import { LifecycleStatusBadge } from "@/components/badges/lifecycle-status-badge";
import type { Asset } from "@/lib/assets";
import { type AssetCategoryOption, categoryLabel } from "@/lib/catalogue";
import { ConditionBadge } from "@/routes/_auth/estates/$estateId/assets/-components/condition-badge";

export function AssetRegisterCards({
  assets,
  categories,
  estateId,
}: {
  assets: Asset[];
  categories: AssetCategoryOption[] | undefined;
  estateId: string;
}) {
  return (
    <ul aria-label="Assets" className="grid gap-3">
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
                    <h2 className="font-semibold break-words underline">
                      {asset.name}
                    </h2>
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
                </dl>
              </CardContent>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
