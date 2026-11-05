import { LoadingRow, type LoadingVariant } from "@/components/loading-row";

const layouts: Record<LoadingVariant, string> = {
  list: "grid gap-3",
  table: "grid gap-2 rounded-lg border p-3",
  cards: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
};

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
  variant?: LoadingVariant;
  rows?: number;
}) {
  return (
    <div aria-busy="true" aria-label={label} role="status">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className={layouts[variant]}>
        {Array.from({ length: rows }, (_, index) => `row-${index}`).map(
          (key) => (
            <LoadingRow key={key} variant={variant} />
          )
        )}
      </div>
    </div>
  );
}
