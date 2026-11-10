import { RefreshCw } from "lucide-react";
import { FormPage } from "@/components/page/form-page";
import { LoadingState } from "@/components/states/loading-state";
import { ReplaceDeviceFormCard } from "@/routes/_auth/estates/$estateId/assets/$assetId/devices/$deviceId/replace/-components/replace-device-page/replace-device-form-card";
import { useReplaceDevicePage } from "@/routes/_auth/estates/$estateId/assets/$assetId/devices/$deviceId/replace/-components/replace-device-page/use-replace-device-page";

/**
 * Deactivates a device and registers its replacement on the same asset (ID-45).
 * The form starts from the old device's details; only the identifier is new.
 */
export function ReplaceDevicePage({
  estateId,
  assetId,
  deviceId,
}: {
  estateId: string;
  assetId: string;
  deviceId: string;
}) {
  const { asset, blocked, cancel, device, error, loading, save, title } =
    useReplaceDevicePage(estateId, assetId, deviceId);
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
        { label: "Replace sensor" },
      ]}
      description="Swap in new hardware. Old readings stay with the old sensor."
      icon={RefreshCw}
      title={title}
    >
      {loading ? <LoadingState label="Loading sensor…" rows={2} /> : null}
      {error ? <p role="alert">{error.message}</p> : null}
      {blocked ? <p role="alert">{blocked}</p> : null}
      {device && !blocked && !loading && !error ? (
        <ReplaceDeviceFormCard
          device={device}
          estateId={estateId}
          onCancel={cancel}
          onSave={save}
        />
      ) : null}
    </FormPage>
  );
}
