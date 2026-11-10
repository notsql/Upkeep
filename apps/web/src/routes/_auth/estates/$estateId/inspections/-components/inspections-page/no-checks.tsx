import { ClipboardCheck } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";

export function NoChecks({ generated }: { generated: boolean }) {
  return (
    <EmptyState
      description={
        generated
          ? "Nothing due this month"
          : "Generate the list to see due checks"
      }
      icon={ClipboardCheck}
      title="No checks this month"
    />
  );
}
