import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { Cpu } from "lucide-react";
import { useCallback, useMemo } from "react";
import { ListPageHeader } from "@/components/page/list-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useEstateDevices } from "@/lib/devices";
import { flattenLocations, useLocations } from "@/lib/locations";

import { DeviceRow } from "@/routes/_auth/estates/$estateId/devices/-components/estate-devices-page/device-row";

export function EstateDevicesPage({ estateId }: { estateId: string }) {
  const devices = useEstateDevices(estateId);
  const locations = useLocations(estateId);
  const paths = useMemo(
    () =>
      new Map(
        flattenLocations(locations.data ?? []).map((node) => [
          node.id,
          node.path.join(" › "),
        ])
      ),
    [locations.data]
  );
  const retry = useCallback(() => devices.refetch(), [devices.refetch]);
  return (
    <PageLayout className="min-w-0">
      <ListPageHeader
        description="Reporting status, quiet devices first"
        icon={Cpu}
        title="Devices"
      />
      <p className="text-muted-foreground my-4 text-sm">
        Refreshes every 60 seconds while this page is open.
      </p>
      {devices.isPending ? (
        <LoadingState label="Loading devices…" variant="table" />
      ) : null}
      {devices.error ? (
        <ErrorState message={devices.error.message} onRetry={retry} />
      ) : null}
      {devices.data?.length === 0 ? (
        <EmptyState
          description="Register devices from an asset's Devices page"
          title="No devices yet"
        />
      ) : null}
      {devices.data?.length ? (
        <Table
          aria-label="Devices"
          className="[&_td]:align-top [&_td]:whitespace-normal"
        >
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Last seen</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.data.map((device) => (
              <DeviceRow
                device={device}
                key={device.id}
                location={paths.get(device.locationId)}
              />
            ))}
          </TableBody>
        </Table>
      ) : null}
    </PageLayout>
  );
}
