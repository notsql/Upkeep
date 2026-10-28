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
import { SortableTableHead } from "@/components/sortable-table-head";
import { useMobile } from "@/lib/use-mobile";
import type { WorkOrder, WorkOrderListSearch } from "@/lib/work-orders";
import { WorkOrderCards } from "./work-order-cards";
import { WorkOrderSortControls } from "./work-order-sort-controls";

type SortColumn = NonNullable<WorkOrderListSearch["sortBy"]>;
const columns: { label: string; sortBy?: SortColumn }[] = [
  { label: "Reference", sortBy: "REFERENCE" },
  { label: "Description" },
  { label: "Category", sortBy: "CATEGORY" },
  { label: "Priority", sortBy: "PRIORITY" },
  { label: "Status" },
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
        <WorkOrderCards estateId={estateId} loading={loading} orders={orders} />
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
              <Badge
                variant={
                  order.priority === "URGENT" ? "destructive" : "outline"
                }
              >
                {order.priority}
              </Badge>
            </TableCell>
            <TableCell>{order.status}</TableCell>
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
