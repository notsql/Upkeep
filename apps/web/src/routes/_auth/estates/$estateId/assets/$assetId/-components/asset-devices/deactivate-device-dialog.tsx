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
          : "Couldn't turn off the sensor. Try again."
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
      confirmLabel="Turn off sensor"
      description="Its key stops working straight away and you can't turn it back on. We'll keep its readings."
      error={error}
      onCancel={onCancel}
      onConfirm={handleConfirm}
      open
      pending={pending}
      pendingLabel="Deactivating…"
      title={`Turn off ${identifier}?`}
    >
      <div className="grid gap-2">
        <p className="text-sm" id={`${id}-help`}>
          Type <strong>{identifier}</strong> to confirm.
        </p>
        <Label htmlFor={`${id}-identifier`}>Sensor name</Label>
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
