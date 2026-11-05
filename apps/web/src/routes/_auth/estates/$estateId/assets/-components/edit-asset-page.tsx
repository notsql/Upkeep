import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";
import { FormPageHeader } from "@/components/page/form-page-header";
import { PageLayout } from "@/components/page/page-layout";
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
    <PageLayout className="max-w-3xl">
      <FormPageHeader
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
      />
      {asset.isPending ? (
        <LoadingState label="Loading asset…" rows={2} />
      ) : null}
      {asset.error ? (
        <p className="text-destructive mt-6" role="alert">
          {asset.error.message}
        </p>
      ) : null}
      {asset.data?.deactivatedAt ? (
        <p className="mt-6 border p-4 text-sm" role="status">
          This asset is deactivated and can no longer be edited.
        </p>
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
    </PageLayout>
  );
}
