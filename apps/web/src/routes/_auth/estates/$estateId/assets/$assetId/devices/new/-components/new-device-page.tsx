import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { useAsset } from "@/lib/assets";
import { type DeviceInput, useRegisterDevice } from "@/lib/devices";
import { useEstate } from "@/lib/estates";
import { DeviceForm } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/device-form";

export function NewDevicePage({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const estate = useEstate(estateId);
  const asset = useAsset(estateId, assetId);
  const register = useRegisterDevice(estateId, assetId);
  const navigate = useNavigate();
  const cancel = useCallback(
    () =>
      navigate({
        to: "/estates/$estateId/assets/$assetId",
        params: { estateId, assetId },
      }),
    [navigate, estateId, assetId]
  );
  const save = useCallback(
    async (values: DeviceInput) => {
      await register.mutateAsync(values);
      toast.success("Device registered. It is awaiting its first reading.");
      await cancel();
    },
    [register.mutateAsync, cancel]
  );
  const error = estate.error ?? asset.error;
  const loading = estate.isPending || asset.isPending;
  const allowed =
    estate.data?.owned &&
    !estate.data.deactivatedAt &&
    asset.data &&
    !asset.data.deactivatedAt;
  return (
    <main className="page-layout max-w-3xl">
      <Link
        className="text-sm underline"
        params={{ estateId, assetId }}
        to="/estates/$estateId/assets/$assetId"
      >
        Back to asset
      </Link>
      <PageHeader
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          {
            label: estate.data?.name ?? "Estate",
            to: "/estates/$estateId",
            params: { estateId },
          },
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
          { label: "Register device" },
        ]}
        description="Add a device, choose its measurements and set its reporting interval."
        title="Register device"
      />
      {loading ? <p role="status">Loading asset…</p> : null}
      {error ? <p role="alert">{error.message}</p> : null}
      {loading || error || allowed ? null : (
        <p role="alert">
          You cannot register a device here. Only the owner can register devices
          on an active asset in an active estate.
        </p>
      )}
      {allowed && asset.data ? (
        <div className="form-surface">
          <DeviceForm
            defaultLocationId={asset.data.locationId}
            estateId={estateId}
            onCancel={cancel}
            onSave={save}
          />
        </div>
      ) : null}
    </main>
  );
}
