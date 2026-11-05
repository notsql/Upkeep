import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";
import { LoadingState } from "@/components/loading-state";
import { FormPageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import {
  type AssetInput,
  useAsset,
  useCreateAsset,
  useUpdateAsset,
} from "@/lib/assets";
import { AssetForm } from "@/routes/_auth/estates/$estateId/assets/-components/asset-form";

export function NewAssetPage({ estateId }: { estateId: string }) {
  const create = useCreateAsset(estateId);
  const navigate = useNavigate();
  const save = useCallback(
    async (values: AssetInput) => {
      const asset = await create.mutateAsync(values);
      toast.success(`Asset ${asset.reference} registered.`);
      await navigate({
        to: "/estates/$estateId/assets/$assetId",
        params: { estateId, assetId: asset.id },
      });
    },
    [create.mutateAsync, navigate, estateId]
  );
  const cancel = useCallback(() => {
    navigate({ to: "/estates/$estateId/assets", params: { estateId } });
  }, [navigate, estateId]);
  return (
    <PageLayout className="max-w-3xl">
      <FormPageHeader
        breadcrumbs={[
          {
            label: "Assets",
            to: "/estates/$estateId/assets",
            params: { estateId },
          },
          { label: "Register asset" },
        ]}
        description="Equipment and its location"
        title="Register asset"
      />
      <AssetForm estateId={estateId} onCancel={cancel} onSave={save} />
    </PageLayout>
  );
}

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
