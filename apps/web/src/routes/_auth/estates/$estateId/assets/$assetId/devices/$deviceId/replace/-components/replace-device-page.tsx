import { Card, CardContent } from "@proj/ui/components/card";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";
import { FormPageHeader } from "@/components/form-page-header";
import { LoadingState } from "@/components/loading-state";
import { PageLayout } from "@/components/page-layout";
import { useAsset } from "@/lib/assets";
import { type DeviceInput, useDevices, useReplaceDevice } from "@/lib/devices";
import { useEstate } from "@/lib/estates";
import { DeviceForm } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/device-form";

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
  const estate = useEstate(estateId);
  const asset = useAsset(estateId, assetId);
  const devices = useDevices(estateId, assetId);
  const replace = useReplaceDevice(estateId, assetId, deviceId);
  const navigate = useNavigate();
  const device = devices.data?.find((item) => item.id === deviceId);
  const cancel = useCallback(
    () =>
      navigate({
        to: "/estates/$estateId/assets/$assetId/devices",
        params: { estateId, assetId },
      }),
    [navigate, estateId, assetId]
  );
  const save = useCallback(
    async (values: DeviceInput) => {
      const created = await replace.mutateAsync(values);
      toast.success(
        `Device replaced. Generate a credential for ${created.identifier} to start its readings.`
      );
      await cancel();
    },
    [replace.mutateAsync, cancel]
  );
  const error = estate.error ?? asset.error ?? devices.error;
  const loading = estate.isPending || asset.isPending || devices.isPending;
  const allowed =
    estate.data?.owned &&
    !estate.data.deactivatedAt &&
    asset.data &&
    !asset.data.deactivatedAt;
  let blocked: string | undefined;
  if (!(loading || error)) {
    if (!device) {
      blocked = "Device not found.";
    } else if (device.deactivatedAt) {
      blocked =
        "This device is already deactivated. Register a new device on the asset instead.";
    } else if (!allowed) {
      blocked =
        "You cannot replace this device. Only the owner can replace devices on an active asset in an active estate.";
    }
  }
  const title = device ? `Replace ${device.identifier}` : "Replace device";
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
          { label: "Replace device" },
        ]}
        description="New hardware; readings stay with the old device"
        title={title}
      />
      {loading ? <LoadingState label="Loading device…" rows={2} /> : null}
      {error ? <p role="alert">{error.message}</p> : null}
      {blocked ? <p role="alert">{blocked}</p> : null}
      {device && !blocked && !loading && !error ? (
        <Card>
          <CardContent>
            <div>
              <p className="mb-4 text-sm">
                {device.identifier} will be deactivated and its key will stop
                working. The new device needs its own identifier and credential.
              </p>
              <DeviceForm
                defaultLocationId={device.locationId}
                estateId={estateId}
                initialDevice={{
                  model: device.model,
                  locationId: device.locationId,
                  metrics: device.metrics.map(({ metric }) => metric),
                  reportingIntervalSeconds: device.reportingIntervalSeconds,
                }}
                onCancel={cancel}
                onSave={save}
                pendingLabel="Replacing…"
                submitLabel="Replace device"
              />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </PageLayout>
  );
}
