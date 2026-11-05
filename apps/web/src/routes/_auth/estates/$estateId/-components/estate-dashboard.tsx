import type { components } from "@proj/api/schema";
import { Badge } from "@proj/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ClipboardCheck,
  ClipboardList,
  Cpu,
  Flag,
  History,
  type LucideIcon,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/empty-state";
import { SummaryCard } from "@/components/summary-card";
import { useEstateDevices } from "@/lib/devices";
import {
  canOpenDevices,
  canOpenFailureRisk,
  canOpenFaultReports,
  canOpenInspections,
  canOpenWorkOrders,
} from "@/lib/estate-destinations";
import { useEstateReportList } from "@/lib/estate-reports";
import { useEstateFailureRisk } from "@/lib/failure-risk";
import { useInspectionList } from "@/lib/inspection-list";
import { useWorkOrderList } from "@/lib/work-orders";

type Permission = components["schemas"]["EstateAccessResponse"];
type WorkOrder = components["schemas"]["WorkOrderResponse"];

const NO_FILTERS = {};
const RECENT = 5;

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

function isOpen(order: WorkOrder): boolean {
  return order.status !== "CLOSED";
}

function WorkOrderStat({ estateId }: { estateId: string }) {
  const list = useWorkOrderList(estateId, NO_FILTERS);
  const items = list.data?.items ?? [];
  const open = items.filter(isOpen);
  const urgent = open.filter((order) => order.priority === "URGENT").length;
  return (
    <SummaryCard
      icon={Wrench}
      title="Open work orders"
      value={open.length}
      warning={urgent > 0}
    >
      <span className="text-muted-foreground text-sm">
        {list.data?.nextCursor
          ? "Among the latest 20"
          : `Urgent: ${urgent.toString()}`}
      </span>
    </SummaryCard>
  );
}

function InspectionStat({ estateId }: { estateId: string }) {
  const list = useInspectionList(estateId);
  const overdue = list.data?.overdueCount ?? 0;
  return (
    <SummaryCard
      icon={ClipboardCheck}
      title="Overdue inspections"
      value={overdue}
      warning={overdue > 0}
    >
      <span className="text-muted-foreground text-sm">
        Due this month: {list.data?.dueCount ?? 0}
      </span>
    </SummaryCard>
  );
}

function DeviceStat({ estateId }: { estateId: string }) {
  const devices = useEstateDevices(estateId);
  const items = devices.data ?? [];
  const offline = items.filter((device) => device.status === "OFFLINE").length;
  const online = items.filter((device) => device.status === "ONLINE").length;
  return (
    <SummaryCard
      icon={Cpu}
      title="Offline devices"
      value={offline}
      warning={offline > 0}
    >
      <span className="text-muted-foreground text-sm">Online: {online}</span>
    </SummaryCard>
  );
}

function RiskStat({ estateId }: { estateId: string }) {
  const risk = useEstateFailureRisk(estateId);
  const flagged = (risk.data ?? []).filter((item) => item.flagged).length;
  return (
    <SummaryCard
      icon={AlertTriangle}
      title="Flagged assets"
      value={flagged}
      warning={flagged > 0}
    >
      <span className="text-muted-foreground text-sm">
        Condition, failure risk or end of life
      </span>
    </SummaryCard>
  );
}

function ListCard({
  title,
  description,
  footer,
  empty,
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  footer: ReactNode;
  empty: boolean;
  children: ReactNode;
}) {
  return (
    <Card aria-label={title} role="region">
      <CardHeader>
        <CardTitle>
          <h2 className="flex items-center gap-2">
            <Icon aria-hidden="true" className="text-muted-foreground size-4" />
            {title}
          </h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {empty ? (
          <EmptyState title="Nothing to show" />
        ) : (
          <ul className="divide-y">{children}</ul>
        )}
        <div className="text-sm">{footer}</div>
      </CardContent>
    </Card>
  );
}

const footerLink =
  "text-primary font-medium underline-offset-4 hover:underline";

function RecentWorkOrders({ estateId }: { estateId: string }) {
  const list = useWorkOrderList(estateId, NO_FILTERS);
  const open = (list.data?.items ?? []).filter(isOpen).slice(0, RECENT);
  return (
    <ListCard
      description="Newest work still in progress"
      empty={open.length === 0}
      footer={
        <Link
          className={footerLink}
          params={{ estateId }}
          to="/estates/$estateId/work-orders"
        >
          All work orders
        </Link>
      }
      icon={History}
      title="Open work"
    >
      {open.map((order) => (
        <li className="py-2 first:pt-0" key={order.id}>
          <Link
            className="flex items-start justify-between gap-3"
            params={{ estateId, workOrderId: order.id }}
            to="/estates/$estateId/work-orders/$workOrderId"
          >
            <span className="min-w-0">
              <span className="block font-medium">{order.reference}</span>
              <span className="text-muted-foreground block truncate text-sm">
                {order.description} · {order.locationPath}
              </span>
            </span>
            <Badge
              variant={order.priority === "URGENT" ? "destructive" : "outline"}
            >
              {order.priority.toLowerCase()}
            </Badge>
          </Link>
        </li>
      ))}
    </ListCard>
  );
}

function RecentReports({ estateId }: { estateId: string }) {
  const list = useEstateReportList(estateId, NO_FILTERS);
  const items = (list.data?.items ?? []).slice(0, RECENT);
  return (
    <ListCard
      description="Latest resident issues"
      empty={items.length === 0}
      footer={
        <Link
          className={footerLink}
          params={{ estateId }}
          to="/estates/$estateId/reports"
        >
          All fault reports
        </Link>
      }
      icon={ClipboardList}
      title="Recent fault reports"
    >
      {items.map((report) => (
        <li className="py-2 first:pt-0" key={report.id}>
          <Link
            className="flex items-start justify-between gap-3"
            params={{ estateId, reportId: report.id }}
            to="/estates/$estateId/reports/$reportId"
          >
            <span className="min-w-0">
              <span className="block font-medium">{report.title}</span>
              <span className="text-muted-foreground block truncate text-sm">
                {report.location.label}
              </span>
            </span>
            <Badge variant="outline">
              {report.status.toLowerCase().replaceAll("_", " ")}
            </Badge>
          </Link>
        </li>
      ))}
    </ListCard>
  );
}

function FlaggedAssets({ estateId }: { estateId: string }) {
  const risk = useEstateFailureRisk(estateId);
  const flagged = (risk.data ?? [])
    .filter((item) => item.flagged)
    .slice(0, RECENT);
  return (
    <ListCard
      description="Assets needing attention"
      empty={flagged.length === 0}
      footer={
        <Link
          className={footerLink}
          params={{ estateId }}
          to="/estates/$estateId/failure-risk"
        >
          Failure risk
        </Link>
      }
      icon={Flag}
      title="At-risk assets"
    >
      {flagged.map((item) => (
        <li className="py-2 first:pt-0" key={item.assetId}>
          <Link
            className="block"
            params={{ estateId, assetId: item.assetId }}
            to="/estates/$estateId/assets/$assetId"
          >
            <span className="block font-medium">{item.assetReference}</span>
            <span className="text-muted-foreground block truncate text-sm">
              {item.assetName}
            </span>
          </Link>
        </li>
      ))}
    </ListCard>
  );
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
