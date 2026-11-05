import { Button } from "@proj/ui/components/button";
import type { ReactNode } from "react";

/**
 * Previous/Next paging for a list: a labelled `nav` with an optional summary
 * ("1–20 of 45") and two outline buttons, disabled at the ends or while
 * `disabled` (e.g. a placeholder page is loading). Works for offset and
 * cursor paging alike; the caller owns the page state.
 */
export function Pagination({
  label,
  summary,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  disabled = false,
}: {
  label: string;
  summary?: ReactNode;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  disabled?: boolean;
}) {
  return (
    <nav
      aria-label={label}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-muted-foreground text-sm">{summary}</p>
      <div className="flex gap-2">
        <Button
          disabled={disabled || !canPrevious}
          onClick={onPrevious}
          type="button"
          variant="outline"
        >
          Previous page
        </Button>
        <Button
          disabled={disabled || !canNext}
          onClick={onNext}
          type="button"
          variant="outline"
        >
          Next page
        </Button>
      </div>
    </nav>
  );
}
