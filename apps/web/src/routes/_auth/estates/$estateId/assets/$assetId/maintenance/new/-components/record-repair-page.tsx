import { useNavigate } from "@tanstack/react-router";
import { Wrench } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import { FormPage } from "@/components/page/form-page";
import { LoadingState } from "@/components/states/loading-state";
import { type AssetEventInput, useRecordAssetEvent } from "@/lib/asset-events";
import { useAsset } from "@/lib/assets";
import { RecordRepairForm } from "@/routes/_auth/estates/$estateId/assets/$assetId/maintenance/new/-components/record-repair-form";

export function RecordRepairPage({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const asset = useAsset(estateId, assetId);
  const recordEvent = useRecordAssetEvent(estateId, assetId);
  const navigate = useNavigate();
  const back = useCallback(
    () =>
      navigate({
        to: "/estates/$estateId/assets/$assetId/records",
        params: { estateId, assetId },
      }),
    [navigate, estateId, assetId]
  );
  const save = useCallback(
    async (values: AssetEventInput) => {
      await recordEvent.mutateAsync(values);
      toast.success("Event recorded.");
      await back();
    },
    [recordEvent.mutateAsync, back]
  );
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
        { label: "Record repair" },
      ]}
      description="What happened to this asset, when, and what it cost"
      icon={Wrench}
      title="Record repair"
    >
      {asset.isPending ? (
        <LoadingState label="Loading asset…" rows={2} />
      ) : null}
      {asset.error ? <p role="alert">{asset.error.message}</p> : null}
      {asset.data?.deactivatedAt ? (
        <p role="alert">You cannot record a repair on a deactivated asset.</p>
      ) : null}
      {asset.data && !asset.data.deactivatedAt ? (
        <RecordRepairForm
          defaultType="BREAKDOWN_REPAIR"
          onCancel={back}
          onSave={save}
        />
      ) : null}
    </FormPage>
  );
}
