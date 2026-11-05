import { Badge } from "@proj/ui/components/badge";
import { Link } from "@tanstack/react-router";
import { History } from "lucide-react";
import { useWorkOrderList } from "@/lib/work-orders";
import {
  footerLink,
  isOpen,
  NO_FILTERS,
  RECENT,
} from "@/routes/_auth/estates/$estateId/-components/dashboard-lists";
import { ListCard } from "@/routes/_auth/estates/$estateId/-components/list-card";

export function RecentWorkOrders({ estateId }: { estateId: string }) {
  const list = useWorkOrderList(estateId, NO_FILTERS);
  const open = (list.data?.items ?? []).filter(isOpen).slice(0, RECENT);
  return (
    <ListCard
      description="Newest work still in progress"
      empty={open.length === 0}
      footer={
        <Link
          className={footerLink}
          params={{ estateId }}
          to="/estates/$estateId/work-orders"
        >
          All work orders
        </Link>
      }
      icon={History}
      title="Open work"
    >
      {open.map((order) => (
        <li className="py-2 first:pt-0" key={order.id}>
          <Link
            className="flex items-start justify-between gap-3"
            params={{ estateId, workOrderId: order.id }}
            to="/estates/$estateId/work-orders/$workOrderId"
          >
            <span className="min-w-0">
              <span className="block font-medium">{order.reference}</span>
              <span className="text-muted-foreground block truncate text-sm">
                {order.description} · {order.locationPath}
              </span>
            </span>
            <Badge
              variant={order.priority === "URGENT" ? "destructive" : "outline"}
            >
              {order.priority.toLowerCase()}
            </Badge>
          </Link>
        </li>
      ))}
    </ListCard>
  );
}
