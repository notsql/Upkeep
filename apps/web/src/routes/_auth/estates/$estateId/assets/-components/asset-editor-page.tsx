import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";
import { FormPageHeader } from "@/components/page/form-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { type AssetInput, useCreateAsset } from "@/lib/assets";
import { AssetForm } from "@/routes/_auth/estates/$estateId/assets/-components/asset-form/asset-form";

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
