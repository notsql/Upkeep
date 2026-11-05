import { Card } from "@proj/ui/components/card";
import { Skeleton } from "@proj/ui/components/skeleton";

export type LoadingVariant = "list" | "table" | "cards";

export function LoadingRow({ variant }: { variant: LoadingVariant }) {
  if (variant === "table") {
    return (
      <div className="flex items-center gap-4" data-slot="loading-row">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 w-1/6" />
      </div>
    );
  }
  return (
    <Card
      className={variant === "cards" ? "gap-3 px-5" : "gap-2 px-4 py-4"}
      data-slot="loading-row"
    >
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-1/3" />
      {variant === "cards" ? <Skeleton className="h-3 w-4/5" /> : null}
    </Card>
  );
}
