import { tabsListVariants } from "@proj/ui/components/tabs";
import { Link, type LinkProps } from "@tanstack/react-router";

export interface SubNavItem
  extends Pick<LinkProps, "to" | "params" | "search"> {
  /** Active only on an exact path match (use for the section's index). */
  exact?: boolean;
  label: string;
}

/**
 * Sub-navigation between a section's sibling routes, drawn like shadcn Tabs
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
      <ul className={tabsListVariants({ variant: "default" })}>
        {items.map((item) => (
          <li className="h-full" key={item.label}>
            <Link
              activeOptions={{ exact: item.exact ?? false }}
              className="text-foreground/60 hover:text-foreground focus-visible:ring-ring/50 aria-[current=page]:bg-background aria-[current=page]:text-foreground dark:aria-[current=page]:bg-input/30 inline-flex h-full items-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-[3px] focus-visible:outline-none aria-[current=page]:shadow-sm"
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
