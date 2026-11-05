import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import { type FormEvent, type ReactNode, useCallback, useId } from "react";

/**
 * A short create/edit task in a Dialog: header, a `<form>` holding
 * `children` (the fields), an error line, and a Cancel + submit footer
 * (submit shows `pendingLabel`, default "Saving…", while pending). `onSubmit` gets the form element (not the event) - the default is prevented.
 * While `pending` it cannot be cancelled or dismissed.
 */
export function FormDialog({
  open,
  title,
  description,
  children,
  submitLabel,
  pendingLabel = "Saving…",
  pending = false,
  submitDisabled = false,
  secondaryActions,
  className,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  pending?: boolean;
  /** Keeps submit disabled, e.g. until a choice is made. */
  submitDisabled?: boolean;
  /** Extra footer buttons rendered before Cancel (e.g. Unlink). */
  secondaryActions?: ReactNode;
  /** Extra classes for the dialog content, e.g. width or scrolling. */
  className?: string;
  error?: ReactNode;
  /** Receives the form, for reading uncontrolled fields with FormData. */
  onSubmit: (form: HTMLFormElement) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const buttonLabel = pending ? pendingLabel : submitLabel;
  const change = useCallback(
    (next: boolean) => {
      if (!(next || pending)) {
        onClose();
      }
    },
    [pending, onClose]
  );
  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onSubmit(event.currentTarget);
    },
    [onSubmit]
  );
  return (
    <Dialog onOpenChange={change} open={open}>
      <DialogContent className={className} showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle id={titleId}>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <form
          aria-labelledby={titleId}
          className="grid gap-4"
          noValidate
          onSubmit={submit}
        >
          {children}
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            {secondaryActions}
            <Button
              disabled={pending}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={pending || submitDisabled} type="submit">
              {buttonLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
