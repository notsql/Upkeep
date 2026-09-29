import { Button, buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { assetCategoryLabel, useAsset, useDeactivateAsset } from "@/lib/assets";
import { AssetConditionSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-condition-section";
import { AssetDevicesSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-devices-section";
import { DeactivateAssetDialog } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/deactivate-asset-dialog";

const NOT_RECORDED = "Not recorded";

export function AssetDetailsPage({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const asset = useAsset(estateId, assetId);
  const deactivate = useDeactivateAsset(estateId, assetId);
  const [confirming, setConfirming] = useState(false);
  const openConfirmation = useCallback(() => setConfirming(true), []);
  const closeConfirmation = useCallback(() => setConfirming(false), []);
  const confirm = useCallback(
    async (reference: string) => {
      await deactivate.mutateAsync(reference);
      setConfirming(false);
      toast.success("Asset deactivated. Its record has been preserved.");
    },
    [deactivate.mutateAsync]
  );
  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <Link
        className="text-sm underline"
        params={{ estateId }}
        to="/estates/$estateId"
      >
        Back to estate
      </Link>
      {asset.isPending ? (
        <p aria-live="polite" className="mt-6">
          Loading asset…
        </p>
      ) : null}
      {asset.error ? (
        <p className="mt-6 text-destructive" role="alert">
          {asset.error.message}
        </p>
      ) : null}
      {asset.data ? (
        <>
          <div className="mt-6 flex items-center justify-between gap-4">
            <h1 className="font-semibold text-2xl">{asset.data.name}</h1>
            <span className="border px-3 py-1 text-sm" role="status">
              {asset.data.deactivatedAt ? "Deactivated" : "Active"}
            </span>
          </div>
          {asset.data.deactivatedAt ? (
            <p className="mt-4 border p-4 text-sm">
              This asset is deactivated. Its record remains available but can no
              longer be edited.
            </p>
          ) : null}
          <dl className="my-6 grid gap-4">
            <div>
              <dt className="font-medium">Reference</dt>
              <dd>{asset.data.reference}</dd>
            </div>
            <div>
              <dt className="font-medium">Category</dt>
              <dd>{assetCategoryLabel[asset.data.category]}</dd>
            </div>
            <div>
              <dt className="font-medium">Location</dt>
              <dd>{asset.data.locationPath}</dd>
            </div>
            <div>
              <dt className="font-medium">Installation date</dt>
              <dd>{asset.data.installedOn ?? NOT_RECORDED}</dd>
            </div>
            <div>
              <dt className="font-medium">Manufacturer</dt>
              <dd>{asset.data.manufacturer ?? NOT_RECORDED}</dd>
            </div>
            <div>
              <dt className="font-medium">Model</dt>
              <dd>{asset.data.model ?? NOT_RECORDED}</dd>
            </div>
            <div>
              <dt className="font-medium">Serial number</dt>
              <dd>{asset.data.serialNumber ?? NOT_RECORDED}</dd>
            </div>
          </dl>
          {asset.data.deactivatedAt ? null : (
            <div className="flex items-center gap-4">
              <Link
                className={buttonVariants({ variant: "outline" })}
                params={{ estateId, assetId }}
                to="/estates/$estateId/assets/$assetId/edit"
              >
                Edit asset
              </Link>
              <Button onClick={openConfirmation} variant="destructive">
                Deactivate asset
              </Button>
            </div>
          )}
          <AssetConditionSection
            assetId={assetId}
            canRecord={!asset.data.deactivatedAt}
            estateId={estateId}
          />
          <AssetDevicesSection
            assetId={assetId}
            assetLocationId={asset.data.locationId}
            canRegister={!asset.data.deactivatedAt}
            estateId={estateId}
          />
          {confirming ? (
            <DeactivateAssetDialog
              name={asset.data.name}
              onCancel={closeConfirmation}
              onConfirm={confirm}
              reference={asset.data.reference}
            />
          ) : null}
        </>
      ) : null}
    </main>
  );
}
