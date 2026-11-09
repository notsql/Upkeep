import { Button } from "@proj/ui/components/button";
import { SearchX, Wrench } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";

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
        icon={SearchX}
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
      icon={Wrench}
      title="No work orders yet"
    />
  );
}
