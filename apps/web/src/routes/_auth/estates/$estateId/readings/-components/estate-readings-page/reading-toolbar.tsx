import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";

/**
 * One row above a readings list: the result summary on the left, the Filters
 * toggle (with its active count) and the export on the right. Wire the toggle
 * from `useFilterPanel(...).toggleProps`.
 */
export function ReadingToolbar({
  summary,
  activeCount,
  controls,
  expanded,
  onToggle,
  exportAction,
}: {
  summary?: ReactNode;
  activeCount: number;
  controls: string;
  expanded: boolean;
  onToggle: () => void;
  exportAction?: ReactNode;
}) {
  return (
    <div
      aria-label="Reading tools"
      className="flex flex-wrap items-center gap-2"
      role="toolbar"
    >
      <div className="text-muted-foreground min-w-0 flex-1 text-sm">
        {summary}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          aria-controls={controls}
          aria-expanded={expanded}
          aria-label={
            activeCount > 0 ? `Filters, ${activeCount} active` : "Filters"
          }
          onClick={onToggle}
          size="sm"
          type="button"
          variant="outline"
        >
          <SlidersHorizontal aria-hidden="true" />
          Filters
          {activeCount > 0 ? (
            <Badge aria-hidden="true" variant="secondary">
              {activeCount}
            </Badge>
          ) : null}
        </Button>
        {exportAction}
      </div>
    </div>
  );
}
