import { AlertTriangle } from "lucide-react";
import { SummaryCard } from "@/components/summary-card";
import { useEstateFailureRisk } from "@/lib/failure-risk";

export function RiskStat({ estateId }: { estateId: string }) {
  const risk = useEstateFailureRisk(estateId);
  const flagged = (risk.data ?? []).filter((item) => item.flagged).length;
  return (
    <SummaryCard
      icon={AlertTriangle}
      title="Flagged assets"
      value={flagged}
      warning={flagged > 0}
    >
      <span className="text-muted-foreground text-sm">
        Condition, failure risk or end of life
      </span>
    </SummaryCard>
  );
}
