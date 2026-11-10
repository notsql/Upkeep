import { Button } from "@proj/ui/components/button";
import { Building2, SearchX } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";

export function EstateEmptyState({
  emptyMessage,
  filtersActive,
  onClear,
}: {
  emptyMessage: string;
  filtersActive: boolean;
  onClear: () => void;
}) {
  return (
    <EmptyState
      action={
        filtersActive ? (
          <Button onClick={onClear} variant="outline">
            Clear filters
          </Button>
        ) : undefined
      }
      description={
        filtersActive ? emptyMessage : "Use Create to add the first estate"
      }
      icon={filtersActive ? SearchX : Building2}
      title={filtersActive ? "No matching estates" : emptyMessage}
    />
  );
}
