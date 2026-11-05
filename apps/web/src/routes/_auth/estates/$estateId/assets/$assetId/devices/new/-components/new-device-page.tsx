import { Card, CardContent } from "@proj/ui/components/card";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";
import { FormPageHeader } from "@/components/form-page-header";
import { LoadingState } from "@/components/loading-state";
import { PageLayout } from "@/components/page-layout";
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
        to: "/estates/$estateId/assets/$assetId/devices",
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
          { label: "Register device" },
        ]}
        description="Measurements and reporting interval"
        title="Register device"
      />
      {loading ? <LoadingState label="Loading asset…" rows={2} /> : null}
      {error ? <p role="alert">{error.message}</p> : null}
      {loading || error || allowed ? null : (
        <p role="alert">
          You cannot register a device here. Only the owner can register devices
          on an active asset in an active estate.
        </p>
      )}
      {allowed && asset.data ? (
        <Card>
          <CardContent>
            <div>
              <DeviceForm
                defaultLocationId={asset.data.locationId}
                estateId={estateId}
                onCancel={cancel}
                onSave={save}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </PageLayout>
  );
}
