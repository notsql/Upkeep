import { useCallback, useState } from "react";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";

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
          : "Couldn't update access. Try again."
      );
    } finally {
      setPending(false);
    }
  }, [onClose, onConfirm, pending]);
  return (
    <ConfirmDialog
      cancelLabel={keepLabel}
      confirmLabel={confirmLabel}
      description={`${email}. ${description}`}
      error={error}
      onCancel={onClose}
      onConfirm={confirm}
      open
      pending={pending}
      pendingLabel="Saving…"
      title={title}
    />
  );
}
