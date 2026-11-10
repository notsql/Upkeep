import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@proj/ui/components/item";
import { cn } from "@proj/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

/**
 * The flat phone list: no card, no outer border. Rows sit on the page with
 * hairline dividers between them, inset to start after the icon tile
 * (settings-app style). Children are `ListRow`s, each its own `li`.
 */
export function ListRows({
  label,
  busy,
  className,
  children,
}: {
  label: string;
  /** The rows are refreshing. */
  busy?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <ul
      aria-busy={busy}
      aria-label={label}
      className={cn(
        // A grid or flex parent would otherwise widen to fit the longest
        // untruncated meta line, pushing rows past the screen edge.
        "flex w-full min-w-0 flex-col",
        "[&>li+li]:before:bg-border [&>li+li]:before:absolute [&>li+li]:before:top-0 [&>li+li]:before:right-0 [&>li+li]:before:left-14 [&>li+li]:before:h-px",
        className
      )}
    >
      {children}
    </ul>
  );
}

/**
 * One row of a `ListRows`: a brand-tinted icon tile (or a short text such as
 * an initial), a strong title, at most one muted meta line that truncates,
 * and a trailing slot (badge, menu or chevron) centred with the row.
 * `children` render under the title, aligned with it, for rows that carry a
 * control or a measurement. Pass `render` (a Link) to make the whole row
 * tappable.
 */
export function ListRow({
  icon: Icon,
  initial,
  title,
  meta,
  trailing,
  children,
  render,
  className,
}: {
  icon?: LucideIcon;
  /** Text for the tile instead of an icon, e.g. a person's initial. */
  initial?: string;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
  render?: ReactElement;
  className?: string;
}) {
  const itemProps: ComponentProps<typeof Item> = render ? { render } : {};
  return (
    <li className="relative">
      <Item
        {...itemProps}
        className={cn(
          "flex-nowrap items-center gap-3 rounded-lg px-2 py-3",
          render ? "hover:bg-muted active:bg-muted" : null,
          className
        )}
      >
        <ItemMedia
          aria-hidden="true"
          className={cn(
            "bg-brand-1/15 text-brand-2 size-9 shrink-0 rounded-lg text-sm font-semibold [&_svg:not([class*='size-'])]:size-4.5",
            children ? "self-start" : "self-center"
          )}
          variant="icon"
        >
          {Icon ? <Icon /> : (initial ?? null)}
        </ItemMedia>
        <ItemContent className="min-w-0 gap-1">
          <ItemTitle className="line-clamp-none w-full min-w-0 text-base font-medium [overflow-wrap:anywhere]">
            {title}
          </ItemTitle>
          {meta ? (
            <ItemDescription className="line-clamp-1 text-sm [overflow-wrap:anywhere]">
              {meta}
            </ItemDescription>
          ) : null}
          {children ? <div className="mt-1 grid gap-2">{children}</div> : null}
        </ItemContent>
        {trailing ? (
          <ItemActions className="shrink-0 self-center">{trailing}</ItemActions>
        ) : null}
      </Item>
    </li>
  );
}
