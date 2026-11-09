import { Link } from "@tanstack/react-router";
import { Coins } from "lucide-react";
import { formatSgd, useCostliestAssets } from "@/lib/estate-costs";
import { ListCard } from "@/routes/_auth/estates/$estateId/-components/estate-details-page/list-card";

function unknownNote(count: number): string {
  return `${count} ${count === 1 ? "entry" : "entries"} with unknown costs`;
}

/** ID-34: the five active assets with the highest maintenance spend. */
export function CostliestAssets({ estateId }: { estateId: string }) {
  const top = useCostliestAssets(estateId);
  const assets = top.data ?? [];
  return (
    <ListCard
      description="Top five by total maintenance spend"
      empty={false}
      footer={null}
      icon={Coins}
      title="Costliest assets"
    >
      {top.data && assets.length === 0 ? (
        <li className="text-muted-foreground py-2 text-sm">
          No maintenance costs recorded yet.
        </li>
      ) : null}
      {assets.map((asset) => (
        <li className="py-2 first:pt-0" key={asset.assetId}>
          <Link
            className="flex items-start justify-between gap-3"
            params={{ estateId, assetId: asset.assetId }}
            to="/estates/$estateId/assets/$assetId/costs"
          >
            <span className="min-w-0">
              <span className="block font-medium">{asset.assetReference}</span>
              <span className="text-muted-foreground block truncate text-sm">
                {`${asset.assetName} · ${asset.categoryLabel}`}
              </span>
              {asset.entriesWithUnknownCosts > 0 ? (
                <span className="text-muted-foreground block text-xs">
                  {unknownNote(asset.entriesWithUnknownCosts)}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 font-medium tabular-nums">
              {formatSgd(asset.totalSpend)}
            </span>
          </Link>
        </li>
      ))}
    </ListCard>
  );
}
