import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
} from "@proj/ui/components/collapsible";
import { ListFilter, X } from "lucide-react";
import { type ReactNode, useCallback, useId, useState } from "react";

/**
 * State for a retractable FilterBar and its FilterToggle. Collapsed by
 * default; starts expanded when filters are already active on load.
 */
export function useFilterPanel(activeCount: number) {
  const id = useId();
  const [open, setOpen] = useState(activeCount > 0);
  const onToggle = useCallback(() => setOpen((value) => !value), []);
  return {
    open,
    setOpen,
    toggleProps: { controls: id, expanded: open, onToggle },
    barProps: { id, open },
  };
}

/**
 * The one filter toolbar, drawn as its own muted panel so it reads apart from
 * the results below. A "Filters" label heads it; when `activeCount` is above
 * zero it shows the count and, given `onClear`, a "Clear filters" button.
 * Search grows to fill the row, each filter field passes
 * `className="w-full sm:w-48"`, extra `actions` sit at the end. Stacks below
 * 640px and wraps above it.
 *
 * Pass `id` and `open` (from `useFilterPanel`) to make it retractable behind
 * a FilterToggle; without `open` it is always shown.
 */
export function FilterBar({
  label,
  search,
  children,
  actions,
  activeCount = 0,
  onClear,
  id,
  open,
}: {
  label: string;
  search?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  activeCount?: number;
  onClear?: () => void;
  id?: string;
  open?: boolean;
}) {
  const filtering = activeCount > 0;
  const bar = (
    <search
      aria-label={label}
      className="bg-muted/40 rounded-lg border p-3 sm:p-4"
      // biome-ignore lint/a11y/noRedundantRoles: jsdom does not yet map <search> to the search role.
      role="search"
    >
      <div className="mb-3 flex min-h-6 items-center gap-2">
        {/* The FilterToggle already shows ListFilter when retractable. */}
        {open === undefined ? (
          <ListFilter
            aria-hidden="true"
            className="text-muted-foreground size-4"
          />
        ) : null}
        <span className="text-sm font-medium">Filters</span>
        {filtering ? (
          <Badge variant="secondary">{activeCount} active</Badge>
        ) : null}
        {filtering && onClear ? (
          <Button
            className="ml-auto"
            onClick={onClear}
            size="sm"
            variant="ghost"
          >
            <X aria-hidden="true" />
            Clear filters
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        {search ? (
          <div className="min-w-0 sm:min-w-64 sm:flex-1">{search}</div>
        ) : null}
        {children}
        {actions ? (
          <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
            {actions}
          </div>
        ) : null}
      </div>
    </search>
  );
  if (open === undefined) {
    return id ? <div id={id}>{bar}</div> : bar;
  }
  return (
    <Collapsible open={open}>
      <CollapsibleContent id={id}>{bar}</CollapsibleContent>
    </Collapsible>
  );
}
