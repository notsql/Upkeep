import { Button } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { ClipboardList, Pencil } from "lucide-react";
import { useId } from "react";
import {
  SectionCard,
  sectionActionClassName,
} from "@/components/page/section-card";
import { SectionHeading } from "@/components/page/section-heading";
import type { Asset } from "@/lib/assets";
import { useAssetCategories } from "@/lib/catalogue";
import { formatDate } from "@/lib/format";
import { DeactivateAssetDialog } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-page/deactivate-asset-dialog";
import { AssetRetirementPanel } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-tab/asset-retirement-panel/asset-retirement-panel";
import { useAssetDetailsTab } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-tab/use-asset-details-tab";

const NOT_RECORDED = "Not recorded";

function AssetFacts({ asset }: { asset: Asset }) {
  const categories = useAssetCategories();
  const category =
    categories.data?.find((item) => item.code === asset.category)?.label ??
    asset.category;
  const facts: [string, string][] = [
    ["Reference", asset.reference],
    ["Category", category],
    ["Location", asset.locationPath || NOT_RECORDED],
    [
      "Installation date",
      asset.installedOn ? formatDate(asset.installedOn) : NOT_RECORDED,
    ],
    ["Manufacturer", asset.manufacturer || NOT_RECORDED],
    ["Model", asset.model || NOT_RECORDED],
    ["Serial number", asset.serialNumber || NOT_RECORDED],
  ];
  return (
    <dl className="[&_dt]:text-muted-foreground grid gap-4 sm:grid-cols-2 [&_dd]:font-medium [&_dd]:wrap-anywhere [&_dt]:mb-1 [&_dt]:text-sm">
      {facts.map(([term, value]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RetireZone({ onRetire }: { onRetire: () => void }) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="border-destructive/40 bg-destructive/5 flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4"
    >
      <div className="grid min-w-0 flex-1 gap-1">
        <SectionHeading id={headingId}>Take out of use</SectionHeading>
        <p className="text-muted-foreground text-sm">
          Retiring keeps the asset and its records readable, but nothing can be
          edited or recorded against it until it is restored.
        </p>
      </div>
      <Button onClick={onRetire} variant="destructive">
        Take out of use
      </Button>
    </section>
  );
}

/** The asset's full record, with Edit, lifecycle history and Retire. */
export function AssetDetailsTab({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const { asset, closeConfirmation, confirm, confirming, openConfirmation } =
    useAssetDetailsTab(estateId, assetId);
  if (!asset.data) {
    return null;
  }
  const active = !asset.data.deactivatedAt;
  return (
    <>
      <SectionCard
        actions={
          active ? (
            <Link
              className={sectionActionClassName}
              params={{ estateId, assetId }}
              to="/estates/$estateId/assets/$assetId/edit"
            >
              <Pencil aria-hidden="true" />
              Edit
            </Link>
          ) : undefined
        }
        icon={ClipboardList}
        title="Details"
      >
        <AssetFacts asset={asset.data} />
      </SectionCard>
      <AssetRetirementPanel asset={asset.data} />
      {active ? <RetireZone onRetire={openConfirmation} /> : null}
      {confirming ? (
        <DeactivateAssetDialog
          installedOn={asset.data.installedOn}
          lifecycleVersion={asset.data.lifecycleVersion}
          name={asset.data.name}
          onCancel={closeConfirmation}
          onConfirm={confirm}
          reference={asset.data.reference}
        />
      ) : null}
    </>
  );
}
