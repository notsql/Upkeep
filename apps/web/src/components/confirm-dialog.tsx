import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import type { LucideIcon } from "lucide-react";
import { type ReactNode, useCallback } from "react";

/**
 * The one confirmation dialog. Title names the action, `description` states
 * its effect, `children` identifies the target. While `pending` both buttons
 * are disabled, the close X is hidden and Escape/outside clicks are ignored.
 * `destructive` (default true) makes the confirm button destructive.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel,
  pendingLabel,
  cancelLabel = "Cancel",
  confirmIcon: ConfirmIcon,
  destructive = true,
  pending = false,
  confirmDisabled = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  cancelLabel?: string;
  confirmIcon?: LucideIcon;
  destructive?: boolean;
  pending?: boolean;
  /** Keeps confirm disabled, e.g. until a typed confirmation matches. */
  confirmDisabled?: boolean;
  error?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const buttonLabel = pending ? (pendingLabel ?? confirmLabel) : confirmLabel;
  const change = useCallback(
    (next: boolean) => {
      if (!(next || pending)) {
        onCancel();
      }
    },
    [pending, onCancel]
  );
  return (
    <Dialog onOpenChange={change} open={open}>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        {children}
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            {cancelLabel}
          </Button>
          <Button
            disabled={pending || confirmDisabled}
            onClick={onConfirm}
            type="button"
            variant={destructive ? "destructive" : "default"}
          >
            {ConfirmIcon ? <ConfirmIcon aria-hidden="true" /> : null}
            {buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
