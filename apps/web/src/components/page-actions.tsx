import { Badge } from "@proj/ui/components/badge";
import { Button, buttonVariants } from "@proj/ui/components/button";
import { Link, type LinkProps } from "@tanstack/react-router";
import { ListFilter, Plus } from "lucide-react";

export type CreateButtonProps = { id?: string } & (
  | (Pick<LinkProps, "to" | "params" | "search"> & { onClick?: never })
  | { onClick: () => void; to?: never; params?: never; search?: never }
);

/**
 * The one list-page create action: a primary "Create" button with a Plus
 * icon. Give `to` (+ `params`/`search`) to navigate, or `onClick` to open a
 * dialog. Put it in PageHeader's `actions`, after a FilterToggle.
 */
export function CreateButton(props: CreateButtonProps) {
  const content = (
    <>
      <Plus aria-hidden="true" />
      Create
    </>
  );
  if (props.onClick) {
    return (
      <Button id={props.id} onClick={props.onClick} type="button">
        {content}
      </Button>
    );
  }
  return (
    <Link
      className={buttonVariants()}
      id={props.id}
      params={props.params}
      search={props.search}
      to={props.to}
    >
      {content}
    </Link>
  );
}

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
  return (
    <Button
      aria-controls={controls}
      aria-expanded={expanded}
      aria-label={
        activeCount > 0 ? `Filters, ${activeCount} active` : "Filters"
      }
      onClick={onToggle}
      type="button"
      variant="outline"
    >
      <ListFilter aria-hidden="true" />
      Filters
      {activeCount > 0 ? (
        <Badge aria-hidden="true" variant="secondary">
          {activeCount}
        </Badge>
      ) : null}
    </Button>
  );
}
