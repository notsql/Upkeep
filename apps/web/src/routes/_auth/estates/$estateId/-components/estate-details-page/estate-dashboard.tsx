import type { components } from "@proj/api/schema";
import {
  canOpenDevices,
  canOpenFailureRisk,
  canOpenFaultReports,
  canOpenInspections,
  canOpenWorkOrders,
} from "@/lib/estate-destinations";
import { BudgetForecastCard } from "@/routes/_auth/estates/$estateId/-components/estate-details-page/budget-forecast-card";
import { CostliestAssets } from "@/routes/_auth/estates/$estateId/-components/estate-details-page/costliest-assets";
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
  /** ID-33/34 cost widgets: the owner only, like asset costs. */
  costs: boolean;
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
    costs: Boolean(permission && owned),
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
  return (
    <>
      {anyStat ? (
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          {access.workOrders ? <WorkOrderStat estateId={estateId} /> : null}
          {access.inspections ? <InspectionStat estateId={estateId} /> : null}
          {access.devices ? <DeviceStat estateId={estateId} /> : null}
          {access.failureRisk ? <RiskStat estateId={estateId} /> : null}
        </div>
      ) : null}
      <DashboardLists access={access} estateId={estateId} />
    </>
  );
}

function DashboardLists({
  estateId,
  access,
}: {
  estateId: string;
  access: DashboardAccess;
}) {
  const anyList =
    access.workOrders || access.reports || access.failureRisk || access.costs;
  if (!anyList) {
    return null;
  }
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      {access.workOrders ? <RecentWorkOrders estateId={estateId} /> : null}
      {access.reports ? <RecentReports estateId={estateId} /> : null}
      {access.failureRisk ? <FlaggedAssets estateId={estateId} /> : null}
      {access.costs ? <BudgetForecastCard estateId={estateId} /> : null}
      {access.costs ? <CostliestAssets estateId={estateId} /> : null}
    </div>
  );
}
