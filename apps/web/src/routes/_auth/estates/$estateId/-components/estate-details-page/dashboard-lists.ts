import type { components } from "@proj/api/schema";

type WorkOrder = components["schemas"]["WorkOrderResponse"];

export const NO_FILTERS = {};

export const RECENT = 5;

export function isOpen(order: WorkOrder): boolean {
  return order.status !== "CLOSED";
}

export const footerLink =
  "text-primary font-medium underline-offset-4 hover:underline";
