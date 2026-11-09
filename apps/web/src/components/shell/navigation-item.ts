import type { LucideIcon } from "lucide-react";

export type Destination =
  | "/"
  | "/reports"
  | "/reports/new"
  | "/estates/$estateId"
  | "/estates/$estateId/work-orders"
  | "/estates/$estateId/reports"
  | "/estates/$estateId/inspections"
  | "/estates/$estateId/locations"
  | "/estates/$estateId/assets"
  | "/estates/$estateId/assets/devices"
  | "/estates/$estateId/documents"
  | "/estates/$estateId/council"
  | "/estates/$estateId/roles"
  | "/estates/$estateId/notification-settings"
  | "/estates/$estateId/edit";

export interface NavigationItem {
  active: boolean;
  estateId?: string;
  icon: LucideIcon;
  label: string;
  search?: { estateId: string };
  to: Destination;
}
