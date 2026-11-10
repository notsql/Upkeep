import { Button } from "@proj/ui/components/button";
import { ClipboardList, SearchX } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";

export function ReportsEmpty({
  filtered,
  onClear,
}: {
  filtered: boolean;
  onClear: () => void;
}) {
  if (filtered) {
    return (
      <EmptyState
        action={
          <Button onClick={onClear} variant="outline">
            Clear filters
          </Button>
        }
        description="Try other filters"
        fill
        icon={SearchX}
        title="No matching reports"
      />
    );
  }
  return (
    <EmptyState
      description="Resident reports appear here"
      fill
      icon={ClipboardList}
      title="No reports yet"
    />
  );
}
