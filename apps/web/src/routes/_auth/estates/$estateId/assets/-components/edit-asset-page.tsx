import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";
import { FormCard, FormPage } from "@/components/page/form-page";
import { LoadingState } from "@/components/states/loading-state";
import { type AssetInput, useAsset, useUpdateAsset } from "@/lib/assets";
import { AssetForm } from "@/routes/_auth/estates/$estateId/assets/-components/asset-form/asset-form";

export function EditAssetPage({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const asset = useAsset(estateId, assetId);
  const update = useUpdateAsset(estateId, assetId);
  const navigate = useNavigate();
  const save = useCallback(
    async (values: AssetInput) => {
      await update.mutateAsync(values);
      toast.success("Asset details updated.");
      await navigate({
        to: "/estates/$estateId/assets/$assetId",
        params: { estateId, assetId },
      });
    },
    [update.mutateAsync, navigate, estateId, assetId]
  );
  const cancel = useCallback(() => {
    navigate({
      to: "/estates/$estateId/assets/$assetId",
      params: { estateId, assetId },
    });
  }, [navigate, estateId, assetId]);
  return (
    <FormPage
      breadcrumbs={[
        {
          label: "Assets",
          to: "/estates/$estateId/assets",
          params: { estateId },
        },
        {
          label: asset.data?.name ?? "Asset",
          to: "/estates/$estateId/assets/$assetId",
          params: { estateId, assetId },
        },
        { label: "Edit" },
      ]}
      description="Reference stays the same"
      title="Edit asset"
    >
      {asset.isPending ? (
        <LoadingState label="Loading asset…" rows={2} />
      ) : null}
      {asset.error ? (
        <Alert variant="destructive">
          <AlertDescription>{asset.error.message}</AlertDescription>
        </Alert>
      ) : null}
      {asset.data?.deactivatedAt ? (
        <FormCard>
          <p className="text-sm" role="status">
            This asset is deactivated and can no longer be edited.
          </p>
        </FormCard>
      ) : null}
      {asset.data && !asset.data.deactivatedAt ? (
        <AssetForm
          estateId={estateId}
          initialValues={asset.data}
          key={asset.data.id}
          onCancel={cancel}
          onSave={save}
        />
      ) : null}
    </FormPage>
  );
}
