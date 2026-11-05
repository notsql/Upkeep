import { Button } from "@proj/ui/components/button";
import { EmptyState } from "@/components/empty-state";

export function WorkOrderEmptyState({
  filtered,
  canCreate,
  onClear,
}: {
  filtered: boolean;
  canCreate: boolean;
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
        title="No matching work orders"
      />
    );
  }
  return (
    <EmptyState
      description={
        canCreate
          ? "Use Create to add the first work order"
          : "Saved work orders appear here"
      }
      title="No work orders yet"
    />
  );
}
