import { ItemGroup, ItemSeparator } from "@proj/ui/components/item";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { Fragment } from "react";
import type { InspectionResult } from "@/lib/inspections";
import { useMobile } from "@/lib/use-mobile";
import { InspectionHistoryItem } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/inspection-history-table/inspection-history-item";
import { InspectionHistoryRow } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/inspection-history-table/inspection-history-row";

export function InspectionHistoryRecordsTable({
  canCreateWorkOrder,
  canViewWorkOrder,
  records,
}: {
  canCreateWorkOrder: boolean;
  canViewWorkOrder: boolean;
  records: InspectionResult[];
}) {
  const mobile = useMobile();
  if (mobile) {
    return (
      <ItemGroup aria-label="Inspection records" className="gap-0">
        {records.map((record, index) => (
          <Fragment key={record.id}>
            {index > 0 ? <ItemSeparator className="my-0" /> : null}
            <InspectionHistoryItem
              canCreateWorkOrder={canCreateWorkOrder}
              canViewWorkOrder={canViewWorkOrder}
              record={record}
            />
          </Fragment>
        ))}
      </ItemGroup>
    );
  }
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
