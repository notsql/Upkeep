import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";
import { useAsset } from "@/lib/assets";
import { type DeviceInput, useDevices, useReplaceDevice } from "@/lib/devices";
import { useEstate } from "@/lib/estates";

export function useReplaceDevicePage(
  estateId: string,
  assetId: string,
  deviceId: string
) {
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
  return { asset, blocked, cancel, device, error, loading, save, title };
}
