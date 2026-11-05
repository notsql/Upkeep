import { Wrench } from "lucide-react";
import { SummaryCard } from "@/components/summary-card";
import { useWorkOrderList } from "@/lib/work-orders";
import {
  isOpen,
  NO_FILTERS,
} from "@/routes/_auth/estates/$estateId/-components/dashboard-lists";

export function WorkOrderStat({ estateId }: { estateId: string }) {
  const list = useWorkOrderList(estateId, NO_FILTERS);
  const items = list.data?.items ?? [];
  const open = items.filter(isOpen);
  const urgent = open.filter((order) => order.priority === "URGENT").length;
  return (
    <SummaryCard
      icon={Wrench}
      title="Open work orders"
      value={open.length}
      warning={urgent > 0}
    >
      <span className="text-muted-foreground text-sm">
        {list.data?.nextCursor
          ? "Among the latest 20"
          : `Urgent: ${urgent.toString()}`}
      </span>
    </SummaryCard>
  );
}
