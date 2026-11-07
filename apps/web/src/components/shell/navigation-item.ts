import type { LucideIcon } from "lucide-react";

export type Destination =
  | "/"
  | "/reports"
  | "/reports/new"
  | "/estates/$estateId"
  | "/estates/$estateId/work-orders"
  | "/estates/$estateId/reports"
  | "/estates/$estateId/contractors"
  | "/estates/$estateId/inspections"
  | "/estates/$estateId/locations"
  | "/estates/$estateId/assets"
  | "/estates/$estateId/devices"
  | "/estates/$estateId/readings"
  | "/estates/$estateId/sensors"
  | "/estates/$estateId/failure-risk"
  | "/estates/$estateId/documents"
  | "/estates/$estateId/council"
  | "/estates/$estateId/roles"
  | "/estates/$estateId/asset-categories"
  | "/estates/$estateId/edit";

export interface NavigationItem {
  active: boolean;
  estateId?: string;
  icon: LucideIcon;
  label: string;
  search?: { estateId: string };
  to: Destination;
}
