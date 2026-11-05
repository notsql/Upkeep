import { Button } from "@proj/ui/components/button";
import { EmptyState } from "@/components/empty-state";

export function AssetsEmpty({
  filtered,
  canRegister,
  onClear,
}: {
  filtered: boolean;
  canRegister: boolean;
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
        description="Try fewer filters"
        title="No matching assets"
      />
    );
  }
  return (
    <EmptyState
      description={
        canRegister
          ? "Use Create to add the first asset, or set Status to All to include retired assets"
          : "Set Status to All to include retired assets"
      }
      title="No assets yet"
    />
  );
}
