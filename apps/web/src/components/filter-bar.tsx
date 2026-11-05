import type { ReactNode } from "react";

/**
 * The one filter toolbar: search grows to fill the row, each filter field
 * passes `className="w-full sm:w-48"`, actions (Clear filters, counts) sit
 * at the end. Stacks below 640px and wraps above it.
 */
export function FilterBar({
  label,
  search,
  children,
  actions,
}: {
  label: string;
  search?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <search
      aria-label={label}
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      // biome-ignore lint/a11y/noRedundantRoles: jsdom does not yet map <search> to the search role.
      role="search"
    >
      {search ? (
        <div className="min-w-0 sm:min-w-64 sm:flex-1">{search}</div>
      ) : null}
      {children}
      {actions ? (
        <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
          {actions}
        </div>
      ) : null}
    </search>
  );
}
