import { Badge } from "@proj/ui/components/badge";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@proj/ui/components/item";
import { Link } from "@tanstack/react-router";
import { InspectionFollowUp } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/inspection-history-table/inspection-follow-up";
import type { InspectionHistoryRowProps } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/inspection-history-table/inspection-history-row-props";

/** Phone view of one inspection record; the date opens the record. */
export function InspectionHistoryItem({
  record,
  canCreateWorkOrder,
  canViewWorkOrder,
}: InspectionHistoryRowProps) {
  // Follow-up is blank for an open failure the viewer cannot act on.
  const hasFollowUp =
    record.outcome === "PASS" ||
    Boolean(record.workOrder) ||
    canCreateWorkOrder;
  return (
    <Item className="flex-nowrap items-start" role="listitem" size="sm">
      <ItemContent className="min-w-0">
        <ItemTitle>
          <Link
            className="underline-offset-4 hover:underline"
            params={{
              estateId: record.estateId,
              assetId: record.assetId,
              inspectionId: record.id,
            }}
            to="/estates/$estateId/assets/$assetId/inspections/$inspectionId"
          >
            {record.inspectedOn}
          </Link>
        </ItemTitle>
        <ItemDescription className="line-clamp-none text-xs">
          <span>{record.recordedByName ?? "Inspector unavailable"}</span>
          {hasFollowUp ? (
            <>
              {" · "}
              <span>
                <InspectionFollowUp
                  canCreateWorkOrder={canCreateWorkOrder}
                  canViewWorkOrder={canViewWorkOrder}
                  record={record}
                />
              </span>
            </>
          ) : null}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Badge
          variant={record.outcome === "PASS" ? "secondary" : "destructive"}
        >
          {record.outcome === "PASS" ? "Pass" : "Fail"}
        </Badge>
      </ItemActions>
    </Item>
  );
}
