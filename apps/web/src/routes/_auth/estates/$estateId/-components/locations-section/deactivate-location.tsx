import { useCallback, useState } from "react";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";

export function DeactivateLocation({
  name,
  onConfirm,
  onCancel,
}: {
  name: string;
  onConfirm: () => Promise<unknown>;
  onCancel: () => void;
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
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to deactivate the location. Please try again."
      );
    } finally {
      setPending(false);
    }
  }, [onConfirm, pending]);
  return (
    <ConfirmDialog
      confirmLabel="Deactivate"
      description="It stays on record so existing references keep working, but it is hidden from the hierarchy and cannot be changed or reactivated."
      error={error}
      onCancel={onCancel}
      onConfirm={confirm}
      open
      pending={pending}
      pendingLabel="Deactivating…"
      title={`Deactivate ${name}?`}
    />
  );
}
