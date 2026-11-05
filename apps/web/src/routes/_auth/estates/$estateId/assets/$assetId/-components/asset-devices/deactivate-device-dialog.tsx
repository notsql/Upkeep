import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import { type ChangeEvent, useCallback, useId, useState } from "react";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";

/** Confirms a permanent device deactivation by typing its identifier (ID-45). */
export function DeactivateDeviceDialog({
  identifier,
  onConfirm,
  onCancel,
}: {
  identifier: string;
  onConfirm: (identifier: string) => Promise<unknown>;
  onCancel: () => void;
}) {
  const id = useId();
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const matches = confirmation === identifier;

  const handleConfirm = useCallback(async () => {
    if (pending || !matches) {
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      await onConfirm(confirmation);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to deactivate the device. Please try again."
      );
    } finally {
      setPending(false);
    }
  }, [pending, matches, onConfirm, confirmation]);
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setConfirmation(event.target.value),
    []
  );

  return (
    <ConfirmDialog
      confirmDisabled={!matches}
      confirmLabel="Deactivate device"
      description="Its key stops working immediately and it can't be reactivated. Its readings stay on the asset."
      error={error}
      onCancel={onCancel}
      onConfirm={handleConfirm}
      open
      pending={pending}
      pendingLabel="Deactivating…"
      title={`Deactivate ${identifier}?`}
    >
      <div className="grid gap-2">
        <p className="text-sm" id={`${id}-help`}>
          Type <strong>{identifier}</strong> to confirm.
        </p>
        <Label htmlFor={`${id}-identifier`}>Device identifier</Label>
        <Input
          aria-describedby={`${id}-help`}
          autoComplete="off"
          disabled={pending}
          id={`${id}-identifier`}
          onChange={handleChange}
          value={confirmation}
        />
      </div>
    </ConfirmDialog>
  );
}
