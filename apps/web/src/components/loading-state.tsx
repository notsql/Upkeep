import { Card } from "@proj/ui/components/card";
import { Skeleton } from "@proj/ui/components/skeleton";

type Variant = "list" | "table" | "cards";

const layouts: Record<Variant, string> = {
  list: "grid gap-3",
  table: "grid gap-2 rounded-lg border p-3",
  cards: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
};

function Row({ variant }: { variant: Variant }) {
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

/**
 * The one loading pattern for content regions: skeletons shaped like the
 * content they replace, announced once by `label`. Route-level pending
 * screens keep `Loader`.
 */
export function LoadingState({
  label,
  variant = "list",
  rows = 3,
}: {
  label: string;
  variant?: Variant;
  rows?: number;
}) {
  return (
    <div aria-busy="true" aria-label={label} role="status">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className={layouts[variant]}>
        {Array.from({ length: rows }, (_, index) => `row-${index}`).map(
          (key) => (
            <Row key={key} variant={variant} />
          )
        )}
      </div>
    </div>
  );
}
