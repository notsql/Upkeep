import { Badge } from "@proj/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { Link } from "@tanstack/react-router";
import { SortableTableHead } from "@/components/table/sortable-table-head";
import { WorkOrderStatusBadge } from "@/components/work-orders/work-order-status-badge";
import { badgeVariantFor, reportUrgencyTone } from "@/lib/status-tone";
import { useMobile } from "@/lib/use-mobile";
import type { WorkOrder, WorkOrderListSearch } from "@/lib/work-orders";
import { DuplicateCountBadge } from "@/routes/_auth/estates/$estateId/work-orders/-components/work-order-list-page/duplicate-count-badge";
import { WorkOrderItems } from "@/routes/_auth/estates/$estateId/work-orders/-components/work-order-list-page/work-order-items";
import { WorkOrderSortControls } from "@/routes/_auth/estates/$estateId/work-orders/-components/work-order-list-page/work-order-sort-controls";

type SortColumn = NonNullable<WorkOrderListSearch["sortBy"]>;
const columns: { label: string; sortBy?: SortColumn }[] = [
  { label: "Reference", sortBy: "REFERENCE" },
  { label: "Description" },
  { label: "Category", sortBy: "CATEGORY" },
  { label: "Priority", sortBy: "PRIORITY" },
  { label: "Status" },
  { label: "Assigned to" },
  { label: "Created", sortBy: "CREATED_AT" },
];
export function WorkOrderTable({
  estateId,
  orders,
  sortBy,
  descending,
  onSort,
  loading,
}: {
  estateId: string;
  orders: WorkOrder[];
  sortBy: SortColumn;
  descending: boolean;
  onSort: (column: SortColumn) => void;
  loading: boolean;
}) {
  const mobile = useMobile();
  if (mobile) {
    return (
      <div className="space-y-4">
        <WorkOrderSortControls
          descending={descending}
          onSort={onSort}
          sortBy={sortBy}
        />
        <WorkOrderItems estateId={estateId} loading={loading} orders={orders} />
      </div>
    );
  }
  return (
    <Table aria-busy={loading} aria-label="Work orders">
      <TableHeader>
        <TableRow>
          {columns.map((column) =>
            column.sortBy ? (
              <SortableTableHead
                active={column.sortBy === sortBy}
                column={column.sortBy}
                descending={descending}
                key={column.label}
                label={column.label}
                onSort={onSort}
              />
            ) : (
              <TableHead key={column.label}>{column.label}</TableHead>
            )
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell>
              <Link
                params={{ estateId, workOrderId: order.id }}
                to="/estates/$estateId/work-orders/$workOrderId"
              >
                {order.reference}
              </Link>
            </TableCell>
            <TableCell className="max-w-sm whitespace-normal">
              {order.description}
            </TableCell>
            <TableCell>{order.category.replaceAll("_", " ")}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                <Badge
                  variant={badgeVariantFor(reportUrgencyTone[order.priority])}
                >
                  {order.priority}
                </Badge>
                <DuplicateCountBadge
                  count={order.sourceReportConfirmedDuplicateCount}
                />
              </div>
            </TableCell>
            <TableCell>
              <WorkOrderStatusBadge status={order.status} />
            </TableCell>
            <TableCell>{order.assignee?.name ?? "Nobody yet"}</TableCell>
            <TableCell>
              <time dateTime={order.createdAt}>
                {new Date(order.createdAt).toLocaleString()}
              </time>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
