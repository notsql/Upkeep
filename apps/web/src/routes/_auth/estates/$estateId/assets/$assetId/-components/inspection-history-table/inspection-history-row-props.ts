import type { InspectionResult } from "@/lib/inspections";

export interface InspectionHistoryRowProps {
  canCreateWorkOrder: boolean;
  canViewWorkOrder: boolean;
  record: InspectionResult;
}
