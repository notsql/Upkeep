import { Button } from "@proj/ui/components/button";
import { Package } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";

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
        icon={Package}
        title="No matching assets"
      />
    );
  }
  return (
    <EmptyState
      description={
        canRegister
          ? "Use Create to add the first asset, or set Status to All to include assets out of use."
          : "Set Status to All to include assets out of use."
      }
      icon={Package}
      title="No assets yet"
    />
  );
}
