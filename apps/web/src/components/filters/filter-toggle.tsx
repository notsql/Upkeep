import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import { useIsMobile } from "@proj/ui/hooks/use-mobile";
import { ListFilter } from "lucide-react";

/**
 * Shows or hides a page's FilterBar. Wire it with `useFilterPanel` from
 * `@/components/filter-bar`: `<FilterToggle activeCount={n} {...panel.toggleProps} />`.
 */
export interface FilterToggleProps {
  activeCount?: number;
  controls: string;
  expanded: boolean;
  onToggle: () => void;
}

export function FilterToggle({
  activeCount = 0,
  expanded,
  controls,
  onToggle,
}: FilterToggleProps) {
  // Icon-only on mobile; the aria-label keeps the name.
  const mobile = useIsMobile();
  return (
    <Button
      aria-controls={controls}
      aria-expanded={expanded}
      aria-label={
        activeCount > 0 ? `Filters, ${activeCount} active` : "Filters"
      }
      onClick={onToggle}
      size={mobile ? "icon" : "default"}
      type="button"
      variant="outline"
    >
      <ListFilter aria-hidden="true" />
      {mobile ? null : "Filters"}
      {activeCount > 0 ? (
        <Badge aria-hidden="true" variant="secondary">
          {activeCount}
        </Badge>
      ) : null}
    </Button>
  );
}
