import type { components } from "@proj/api/schema";
import {
  canOpenDevices,
  canOpenFailureRisk,
  canOpenFaultReports,
  canOpenInspections,
  canOpenWorkOrders,
} from "@/lib/estate-destinations";
import { DeviceStat } from "@/routes/_auth/estates/$estateId/-components/estate-details-page/device-stat";
import { FlaggedAssets } from "@/routes/_auth/estates/$estateId/-components/estate-details-page/flagged-assets";
import { InspectionStat } from "@/routes/_auth/estates/$estateId/-components/estate-details-page/inspection-stat";
import { RecentReports } from "@/routes/_auth/estates/$estateId/-components/estate-details-page/recent-reports";
import { RecentWorkOrders } from "@/routes/_auth/estates/$estateId/-components/estate-details-page/recent-work-orders";
import { RiskStat } from "@/routes/_auth/estates/$estateId/-components/estate-details-page/risk-stat";
import { WorkOrderStat } from "@/routes/_auth/estates/$estateId/-components/estate-details-page/work-order-stat";

type Permission = components["schemas"]["EstateAccessResponse"];

/** Which dashboard sections a member may see; the rest are never fetched. */
export interface DashboardAccess {
  devices: boolean;
  failureRisk: boolean;
  inspections: boolean;
  reports: boolean;
  workOrders: boolean;
}

export function dashboardAccess(
  permission: Permission | undefined,
  owned: boolean | undefined
): DashboardAccess {
  return {
    workOrders: canOpenWorkOrders(permission),
    reports: canOpenFaultReports(permission),
    inspections: canOpenInspections(permission, owned),
    devices: canOpenDevices(permission, owned),
    failureRisk: canOpenFailureRisk(permission, owned),
  };
}

export function EstateDashboard({
  estateId,
  access,
}: {
  estateId: string;
  access: DashboardAccess;
}) {
  const anyStat =
    access.workOrders ||
    access.inspections ||
    access.devices ||
    access.failureRisk;
  const anyList = access.workOrders || access.reports || access.failureRisk;
  return (
    <>
      {anyStat ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {access.workOrders ? <WorkOrderStat estateId={estateId} /> : null}
          {access.inspections ? <InspectionStat estateId={estateId} /> : null}
          {access.devices ? <DeviceStat estateId={estateId} /> : null}
          {access.failureRisk ? <RiskStat estateId={estateId} /> : null}
        </div>
      ) : null}
      {anyList ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {access.workOrders ? <RecentWorkOrders estateId={estateId} /> : null}
          {access.reports ? <RecentReports estateId={estateId} /> : null}
          {access.failureRisk ? <FlaggedAssets estateId={estateId} /> : null}
        </div>
      ) : null}
    </>
  );
}
