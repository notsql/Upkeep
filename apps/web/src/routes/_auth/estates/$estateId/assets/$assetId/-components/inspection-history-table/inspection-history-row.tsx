import { Badge } from "@proj/ui/components/badge";
import { TableCell, TableRow } from "@proj/ui/components/table";
import { Link } from "@tanstack/react-router";
import { InspectionFollowUp } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/inspection-history-table/inspection-follow-up";
import type { InspectionHistoryRowProps } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/inspection-history-table/inspection-history-row-props";

export function InspectionHistoryRow({
  record,
  canCreateWorkOrder,
  canViewWorkOrder,
}: InspectionHistoryRowProps) {
  return (
    <TableRow>
      <TableCell>{record.inspectedOn}</TableCell>
      <TableCell>
        <Badge
          variant={record.outcome === "PASS" ? "secondary" : "destructive"}
        >
          {record.outcome === "PASS" ? "Pass" : "Fail"}
        </Badge>
      </TableCell>
      <TableCell>
        <InspectionFollowUp
          canCreateWorkOrder={canCreateWorkOrder}
          canViewWorkOrder={canViewWorkOrder}
          record={record}
        />
      </TableCell>
      <TableCell>{record.recordedByName ?? "Inspector unavailable"}</TableCell>
      <TableCell>
        <Link
          className="underline underline-offset-4"
          params={{
            estateId: record.estateId,
            assetId: record.assetId,
            inspectionId: record.id,
          }}
          to="/estates/$estateId/assets/$assetId/inspections/$inspectionId"
        >
          View record
        </Link>
      </TableCell>
    </TableRow>
  );
}
