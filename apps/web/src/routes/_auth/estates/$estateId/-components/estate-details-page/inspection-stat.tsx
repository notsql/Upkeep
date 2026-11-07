import { ClipboardCheck } from "lucide-react";
import { SummaryCard } from "@/components/page/summary-card";
import { useInspectionList } from "@/lib/inspection-list";

export function InspectionStat({ estateId }: { estateId: string }) {
  const list = useInspectionList(estateId);
  const overdue = list.data?.overdueCount ?? 0;
  return (
    <SummaryCard
      icon={ClipboardCheck}
      title="Overdue inspections"
      value={overdue}
      warning={overdue > 0}
    >
      <span className="text-muted-foreground text-sm">
        Due this month: {list.data?.dueCount ?? 0}
      </span>
    </SummaryCard>
  );
}
