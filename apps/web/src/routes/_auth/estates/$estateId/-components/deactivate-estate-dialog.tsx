import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import { type ChangeEvent, useCallback, useState } from "react";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";

export function DeactivateEstateDialog({
  name,
  code,
  onConfirm,
  onCancel,
}: {
  name: string;
  code: string;
  onConfirm: (code: string) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const handleConfirm = useCallback(async () => {
    if (pending || confirmation !== code) {
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
          : "Unable to deactivate the estate. Please try again."
      );
    } finally {
      setPending(false);
    }
  }, [pending, confirmation, code, onConfirm]);
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setConfirmation(event.target.value),
    []
  );
  return (
    <ConfirmDialog
      confirmDisabled={confirmation !== code}
      confirmLabel="Deactivate estate"
      description="Existing records will be preserved. This estate will no longer accept new assets or reports."
      error={error}
      onCancel={onCancel}
      onConfirm={handleConfirm}
      open
      pending={pending}
      pendingLabel="Deactivating…"
      title={`Deactivate ${name}?`}
    >
      <div className="grid gap-2">
        <p className="text-sm" id="deactivate-code-help">
          Type <strong>{code}</strong> to confirm.
        </p>
        <Label htmlFor="deactivate-code">MCST number</Label>
        <Input
          aria-describedby="deactivate-code-help"
          autoComplete="off"
          disabled={pending}
          id="deactivate-code"
          onChange={handleChange}
          value={confirmation}
        />
      </div>
    </ConfirmDialog>
  );
}
