import { Cpu } from "lucide-react";
import { useCallback, useState } from "react";
import { ListPageHeader } from "@/components/page/list-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { PauseSensorDialog } from "@/components/sensors/pause-sensor-dialog";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useAssetViewsAccess } from "@/lib/devices";
import type { MonitoredSensor } from "@/lib/flatlined-sensors";
import { AssetViewsNav } from "@/routes/_auth/estates/$estateId/assets/-components/asset-views-nav";
import { AllDevicesTable } from "@/routes/_auth/estates/$estateId/assets/devices/-components/all-devices-page/all-devices-table";
import { MetricPoliciesDialog } from "@/routes/_auth/estates/$estateId/assets/devices/-components/all-devices-page/metric-policies-dialog";
import { useAllDevicesPage } from "@/routes/_auth/estates/$estateId/assets/devices/-components/all-devices-page/use-all-devices-page";

function AllDevicesResults({
  estateId,
  withDevices,
  linkAssets,
}: {
  estateId: string;
  withDevices: boolean;
  linkAssets: boolean;
}) {
  const page = useAllDevicesPage(estateId, withDevices);
  const [selected, setSelected] = useState<MonitoredSensor>();
  const closePause = useCallback(() => setSelected(undefined), []);
  return (
    <div className="grid min-w-0 gap-4">
      <p className="text-muted-foreground text-sm">
        Most urgent first: possible flatline, offline, awaiting first reading,
        online, deactivated. Refreshes every 60 seconds while this page is open.
      </p>
      {page.devicesError ? (
        <ErrorState
          message={page.devicesError.message}
          onRetry={page.retryDevices}
          retryLabel="Retry devices"
        />
      ) : null}
      {page.reviewError ? (
        <ErrorState
          message={page.reviewError.message}
          onRetry={page.retryReview}
          retryLabel="Retry device monitoring"
        />
      ) : null}
      {page.rows ? null : (
        <LoadingState label="Loading devices…" variant="table" />
      )}
      {page.rows?.length === 0 && !(page.devicesError && page.reviewError) ? (
        <EmptyState
          description="Register devices from an asset's Devices page"
          icon={Cpu}
          title="No devices yet"
        />
      ) : null}
      {page.rows?.length ? (
        <AllDevicesTable
          canManage={page.canManage}
          estateId={estateId}
          linkAssets={linkAssets}
          locationFor={page.locationFor}
          onPause={setSelected}
          rows={page.rows}
          showStatus={page.showStatus}
        />
      ) : null}
      {selected && page.canManage ? (
        <PauseSensorDialog
          estateId={estateId}
          onClose={closePause}
          sensor={selected}
        />
      ) : null}
    </div>
  );
}

/**
 * Assets > All devices. Device status comes from the estate device list for
 * owners and Managers; Council get read-only rows from the flatline review.
 */
export function AllDevicesPage({ estateId }: { estateId: string }) {
  const access = useAssetViewsAccess(estateId);
  return (
    <PageLayout className="min-w-0 space-y-6">
      <ListPageHeader
        actions={
          access.review ? <MetricPoliciesDialog estateId={estateId} /> : null
        }
        description="Every device, most urgent first"
        icon={Cpu}
        title="All devices"
      />
      <AssetViewsNav estateId={estateId} />
      {access.pending ? (
        <LoadingState label="Loading access…" rows={2} />
      ) : null}
      {!access.pending && access.review ? (
        <AllDevicesResults
          estateId={estateId}
          linkAssets={access.assetPages}
          withDevices={access.devices}
        />
      ) : null}
      {access.pending || access.review ? null : (
        <EmptyState
          description="Device monitoring is not available for your role"
          icon={Cpu}
          title="No device view"
        />
      )}
    </PageLayout>
  );
}
