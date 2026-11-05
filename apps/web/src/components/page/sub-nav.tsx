import { tabsListVariants } from "@proj/ui/components/tabs";
import { cn } from "@proj/ui/lib/utils";
import { Link, type LinkProps } from "@tanstack/react-router";

export interface SubNavItem
  extends Pick<LinkProps, "to" | "params" | "search"> {
  /** Active only on an exact path match (use for the section's index). */
  exact?: boolean;
  label: string;
}

/**
 * Sub-navigation between a section's sibling routes, drawn like shadcn
 * line-variant Tabs (full-width row, underline on the current item)
 * but made of router links, so each sub-view is its own URL. The router
 * marks the current one with `aria-current="page"`.
 */
export function SubNav({
  label,
  items,
}: {
  label: string;
  items: SubNavItem[];
}) {
  return (
    <nav aria-label={label} className="mb-5 overflow-x-auto">
      <ul
        className={cn(
          tabsListVariants({ variant: "line" }),
          "h-10 w-full min-w-fit justify-start rounded-none border-b p-0"
        )}
      >
        {items.map((item) => (
          <li className="h-full" key={item.label}>
            <Link
              activeOptions={{ exact: item.exact ?? false }}
              className="text-foreground/60 hover:text-foreground focus-visible:ring-ring/50 aria-[current=page]:text-foreground after:bg-foreground dark:text-muted-foreground dark:hover:text-foreground relative inline-flex h-full items-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-all after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:opacity-0 after:transition-opacity focus-visible:ring-[3px] focus-visible:outline-none aria-[current=page]:after:opacity-100"
              params={item.params}
              search={item.search}
              to={item.to}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
