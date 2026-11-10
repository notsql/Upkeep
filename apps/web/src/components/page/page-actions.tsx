import { Button, buttonVariants } from "@proj/ui/components/button";
import { useIsMobile } from "@proj/ui/hooks/use-mobile";
import { Link, type LinkProps } from "@tanstack/react-router";
import { Plus } from "lucide-react";

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
  // Icon-only on mobile; the aria-label keeps the name.
  const mobile = useIsMobile();
  const content = (
    <>
      <Plus aria-hidden="true" />
      {mobile ? null : "Create"}
    </>
  );
  const label = mobile ? "Create" : undefined;
  if (props.onClick) {
    return (
      <Button
        aria-label={label}
        id={props.id}
        onClick={props.onClick}
        size={mobile ? "icon" : "default"}
        type="button"
      >
        {content}
      </Button>
    );
  }
  return (
    <Link
      aria-label={label}
      className={buttonVariants({ size: mobile ? "icon" : "default" })}
      id={props.id}
      params={props.params}
      search={props.search}
      to={props.to}
    >
      {content}
    </Link>
  );
}
