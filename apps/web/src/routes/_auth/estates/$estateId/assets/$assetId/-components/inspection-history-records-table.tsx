import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import type { InspectionResult } from "@/lib/inspections";
import { InspectionHistoryRow } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/inspection-history-row";

export function InspectionHistoryRecordsTable({
  canCreateWorkOrder,
  canViewWorkOrder,
  records,
}: {
  canCreateWorkOrder: boolean;
  canViewWorkOrder: boolean;
  records: InspectionResult[];
}) {
  return (
    <Table aria-label="Inspection records">
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Inspection date</TableHead>
          <TableHead scope="col">Outcome</TableHead>
          <TableHead scope="col">Follow-up / work order</TableHead>
          <TableHead scope="col">Inspector</TableHead>
          <TableHead scope="col">View record</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record) => (
          <InspectionHistoryRow
            canCreateWorkOrder={canCreateWorkOrder}
            canViewWorkOrder={canViewWorkOrder}
            key={record.id}
            record={record}
          />
        ))}
      </TableBody>
    </Table>
  );
}
