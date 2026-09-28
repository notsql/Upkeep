import { Button } from "@proj/ui/components/button";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import {
  type ChangeEvent,
  type SubmitEvent,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export function DeactivateAssetDialog({
  name,
  reference,
  onConfirm,
  onCancel,
}: {
  name: string;
  reference: string;
  onConfirm: (reference: string) => Promise<unknown>;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const handleSubmit = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending || confirmation !== reference) {
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
            : "Unable to deactivate the asset. Please try again."
        );
      } finally {
        setPending(false);
      }
    },
    [pending, confirmation, reference, onConfirm]
  );
  const handleCancel = useCallback(
    (event: SyntheticEvent<HTMLDialogElement>) => {
      event.preventDefault();
      if (!pending) {
        onCancel();
      }
    },
    [pending, onCancel]
  );
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      setConfirmation(event.target.value),
    []
  );
  return (
    <dialog
      aria-describedby="deactivate-asset-warning"
      aria-labelledby="deactivate-asset-title"
      className="m-auto w-full max-w-md border bg-card p-6 text-card-foreground shadow-lg backdrop:bg-black/60"
      onCancel={handleCancel}
      ref={dialog}
    >
      <h2 className="font-semibold text-xl" id="deactivate-asset-title">
        Deactivate {name}?
      </h2>
      <p
        className="mt-3 text-muted-foreground text-sm"
        id="deactivate-asset-warning"
      >
        The asset stays on record and remains readable, but it can no longer be
        edited.
      </p>
      <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
        <p className="text-sm" id="deactivate-asset-reference-help">
          Type <strong>{reference}</strong> to confirm.
        </p>
        <Label htmlFor="deactivate-asset-reference">Asset reference</Label>
        <Input
          aria-describedby="deactivate-asset-reference-help"
          autoComplete="off"
          disabled={pending}
          id="deactivate-asset-reference"
          onChange={handleChange}
          value={confirmation}
        />
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-3">
          <Button
            disabled={pending}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={pending || confirmation !== reference}
            type="submit"
            variant="destructive"
          >
            {pending ? "Deactivating…" : "Deactivate asset"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
