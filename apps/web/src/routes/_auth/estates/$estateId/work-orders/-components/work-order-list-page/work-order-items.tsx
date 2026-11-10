import { Badge } from "@proj/ui/components/badge";
import { Link } from "@tanstack/react-router";
import { Wrench } from "lucide-react";
import { ListRow, ListRows } from "@/components/list/list-row";
import { WorkOrderStatusBadge } from "@/components/work-orders/work-order-status-badge";
import { badgeVariantFor, reportUrgencyTone } from "@/lib/status-tone";
import type { WorkOrder } from "@/lib/work-orders";
import { DuplicateCountBadge } from "@/routes/_auth/estates/$estateId/work-orders/-components/work-order-list-page/duplicate-count-badge";

/** The phone view of the work order list: one tappable item per order. */
export function WorkOrderItems({
  estateId,
  orders,
  loading,
}: {
  estateId: string;
  orders: WorkOrder[];
  loading: boolean;
}) {
  return (
    <ListRows busy={loading} label="Work orders">
      {orders.map((order) => (
        <ListRow
          icon={Wrench}
          key={order.id}
          meta={[order.reference, order.assetReference, order.locationPath]
            .filter(Boolean)
            .join(" · ")}
          render={
            <Link
              aria-label={order.reference}
              params={{ estateId, workOrderId: order.id }}
              to="/estates/$estateId/work-orders/$workOrderId"
            />
          }
          title={order.description}
          trailing={<WorkOrderStatusBadge status={order.status} />}
        >
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <Badge variant={badgeVariantFor(reportUrgencyTone[order.priority])}>
              {order.priority}
            </Badge>
            <DuplicateCountBadge
              count={order.sourceReportConfirmedDuplicateCount}
            />
            <span>{order.category.replaceAll("_", " ")}</span>
            <time dateTime={order.createdAt}>
              {new Date(order.createdAt).toLocaleString()}
            </time>
          </div>
        </ListRow>
      ))}
    </ListRows>
  );
}
