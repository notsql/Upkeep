import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import { useCallback, useState } from "react";

export function AccessConfirmation({
  title,
  email,
  description,
  confirmLabel,
  keepLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  email: string;
  description: string;
  confirmLabel: string;
  keepLabel: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const confirm = useCallback(async () => {
    if (pending) {
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      await onConfirm();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to update access. Please try again."
      );
    } finally {
      setPending(false);
    }
  }, [onClose, onConfirm, pending]);
  const changeOpen = useCallback(
    (open: boolean) => {
      if (!(open || pending)) {
        onClose();
      }
    },
    [onClose, pending]
  );
  return (
    <Dialog onOpenChange={changeOpen} open>
      <DialogContent className="p-6 sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {email}. {description}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button disabled={pending} onClick={onClose} variant="outline">
            {keepLabel}
          </Button>
          <Button disabled={pending} onClick={confirm} variant="destructive">
            {pending ? "Saving…" : <span>{confirmLabel}</span>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
