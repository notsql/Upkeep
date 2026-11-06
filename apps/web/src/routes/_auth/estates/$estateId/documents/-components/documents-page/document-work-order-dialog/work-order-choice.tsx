import { Button } from "@proj/ui/components/button";
import { TableCell, TableRow } from "@proj/ui/components/table";
import { useCallback } from "react";
import type { WorkOrder } from "@/lib/work-orders";

export function WorkOrderChoice({
  order,
  onSelect,
}: {
  order: WorkOrder;
  onSelect: (order: WorkOrder) => void;
}) {
  const select = useCallback(() => onSelect(order), [onSelect, order]);
  return (
    <TableRow>
      <TableCell>
        <p>{order.reference}</p>
        <p className="whitespace-pre-wrap">{order.description}</p>
      </TableCell>
      <TableCell>{order.status.replaceAll("_", " ")}</TableCell>
      <TableCell>{order.locationPath}</TableCell>
      <TableCell>
        <Button
          aria-label={`Select ${order.reference}`}
          onClick={select}
          type="button"
          variant="outline"
        >
          Select
        </Button>
      </TableCell>
    </TableRow>
  );
}
