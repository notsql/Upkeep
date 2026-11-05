import { Button, buttonVariants } from "@proj/ui/components/button";
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
