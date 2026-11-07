import { Button } from "@proj/ui/components/button";
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
        title="No matching reports"
      />
    );
  }
  return (
    <EmptyState
      description="Resident reports appear here"
      title="No reports yet"
    />
  );
}
