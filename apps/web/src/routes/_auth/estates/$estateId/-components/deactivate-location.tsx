import { Button } from "@proj/ui/components/button";
import { useCallback, useState } from "react";

export function DeactivateLocation({
  onPendingChange,
  name,
  onConfirm,
  onCancel,
}: {
  onPendingChange: (pending: boolean) => void;
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
    onPendingChange(true);
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
      onPendingChange(false);
    }
  }, [onConfirm, pending, onPendingChange]);
  return (
    <fieldset className="mt-2 grid gap-2 border p-3">
      <legend className="font-medium text-sm">Deactivate {name}?</legend>
      <p className="text-muted-foreground text-sm">
        It stays on record so existing references keep working, but it is hidden
        from the hierarchy and cannot be changed or reactivated.
      </p>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={confirm} variant="destructive">
          {pending ? "Deactivating…" : "Deactivate"}
        </Button>
        <Button disabled={pending} onClick={onCancel} variant="outline">
          Cancel
        </Button>
      </div>
    </fieldset>
  );
}
